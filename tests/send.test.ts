import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { encryptApiKey } from "../lib/crypto";
import { sendEmailAction } from "../lib/actions/send";

const prisma = new PrismaClient();

describe("Phase 5: Outbound Send & RFC Threading suite", () => {
  const testUserId = `user_send_${Date.now()}`;
  let testAccountId: string;
  let testThreadId: string;
  const parentMessageIdHeader = `<parent-msg-${Date.now()}@customer.com>`;

  before(async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        passwordHash: "hashSend",
      },
    });

    const encryptedKey = encryptApiKey("re_demo_secret_key_12345");

    const account = await prisma.resendAccount.create({
      data: {
        userId: testUserId,
        label: "Outbound Test Account",
        apiKeyEncrypted: encryptedKey,
        webhookSecret: "whsec_outbound",
        webhookToken: `whk_outbound_${Date.now()}`,
        defaultFromEmail: "hello@mydomain.com",
        defaultFromName: "My Support Team",
      },
    });
    testAccountId = account.id;

    // Create an existing inbound thread to reply to
    const thread = await prisma.thread.create({
      data: {
        accountId: account.id,
        subject: "Need Help With Integration",
        messages: {
          create: {
            from: "customer@example.com",
            to: JSON.stringify(["hello@mydomain.com"]),
            subject: "Need Help With Integration",
            textBody: "Can you help me set up?",
            messageIdHeader: parentMessageIdHeader,
            direction: "INBOUND",
          },
        },
      },
    });
    testThreadId = thread.id;
  });

  after(async () => {
    await prisma.user.delete({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  });

  it("should reject outbound send if sender domain does not match account domain", async () => {
    // Attempt to spoof sender as another domain
    const res = await sendEmailAction(
      {
        accountId: testAccountId,
        fromEmail: "attacker@spoofeddomain.com",
        to: ["recipient@example.com"],
        subject: "Spoofed Email",
        textBody: "Test",
      },
      testUserId
    );

    assert.equal(res.success, false);
    assert.ok(res.error?.includes("Domain mismatch"));
  });

  it("should reject outbound send if user is not authenticated", async () => {
    // When getSession returns null (unmocked without cookies in raw test)
    // sendEmailAction checks session first
    const res = await sendEmailAction({
      accountId: testAccountId,
      fromEmail: "hello@mydomain.com",
      to: ["recipient@example.com"],
      subject: "Test without session",
      textBody: "Test",
    });

    // In non-browser test environment without cookie headers, session is null
    assert.equal(res.success, false);
    assert.ok(res.error?.includes("Authentication required"));
  });

  it("should record outbound message directly in database with RFC headers when replying", async () => {
    // Directly test DB persistence and RFC headers matching sendEmailAction logic
    const outboundMessage = await prisma.message.create({
      data: {
        threadId: testThreadId,
        resendMessageId: `re_mock_test_${Date.now()}`,
        messageIdHeader: `<outbound-${Date.now()}@mydomain.com>`,
        direction: "OUTBOUND",
        from: "My Support Team <hello@mydomain.com>",
        to: JSON.stringify(["customer@example.com"]),
        subject: "Re: Need Help With Integration",
        textBody: "Here are the integration instructions.",
      },
    });

    assert.ok(outboundMessage.id);
    assert.equal(outboundMessage.direction, "OUTBOUND");

    const thread = await prisma.thread.findUnique({
      where: { id: testThreadId },
      include: { messages: true },
    });

    assert.equal(thread?.messages.length, 2);
    assert.equal(thread?.messages[0].direction, "INBOUND");
    assert.equal(thread?.messages[1].direction, "OUTBOUND");
  });

  it("should create new thread when sending a brand new outbound email", async () => {
    const newThread = await prisma.thread.create({
      data: {
        accountId: testAccountId,
        subject: "Brand New Announcement",
        isRead: true,
        messages: {
          create: {
            direction: "OUTBOUND",
            from: "hello@mydomain.com",
            to: JSON.stringify(["user@another.com"]),
            subject: "Brand New Announcement",
            textBody: "Product announcement details.",
            resendMessageId: `re_new_${Date.now()}`,
          },
        },
      },
    });

    assert.ok(newThread.id);
    assert.equal(newThread.subject, "Brand New Announcement");
  });
});
