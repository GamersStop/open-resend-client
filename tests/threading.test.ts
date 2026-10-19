import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  stripRe,
  extractMessageIds,
  processInboundEmail,
} from "../lib/threading";

const prisma = new PrismaClient();

describe("Phase 3: RFC Threading Engine suite", () => {
  const testUserId = `user_threading_${Date.now()}`;
  let testAccountId: string;

  before(async () => {
    const user = await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        passwordHash: "hash123",
      },
    });

    const account = await prisma.resendAccount.create({
      data: {
        userId: user.id,
        label: "Threading Test Domain",
        apiKeyEncrypted: "iv:tag:cipher",
        webhookSecret: "whsec_secret",
        webhookToken: `whk_${Date.now()}`,
        defaultFromEmail: "test@domain.com",
      },
    });

    testAccountId = account.id;
  });

  after(async () => {
    await prisma.user.delete({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  });

  it("should normalize email subjects with stripRe()", () => {
    assert.equal(stripRe("Re: Hello World"), "Hello World");
    assert.equal(stripRe("RE: [URGENT] Server Alert"), "[URGENT] Server Alert");
    assert.equal(stripRe("Fwd: Re: Question"), "Question");
    assert.equal(stripRe("Re: Re: Re: Followup"), "Followup");
    assert.equal(stripRe("Just an email"), "Just an email");
  });

  it("should extract bracketed message IDs correctly", () => {
    const ids = extractMessageIds("<msg1@domain.com> <msg2@domain.com>");
    assert.deepEqual(ids, ["<msg1@domain.com>", "<msg2@domain.com>"]);
  });

  it("should create a new thread for an initial inbound email", async () => {
    const parentMsgId = `<msg-parent-${Date.now()}@sender.com>`;
    const res = await processInboundEmail({
      accountId: testAccountId,
      from: "alice@sender.com",
      to: ["test@domain.com"],
      subject: "Contract Discussion",
      textBody: "Let's review the contract.",
      messageIdHeader: parentMsgId,
    });

    assert.ok(res.threadId);
    assert.ok(res.messageId);
    assert.equal(res.isNewThread, true);

    const thread = await prisma.thread.findUnique({
      where: { id: res.threadId },
      include: { messages: true },
    });

    assert.equal(thread?.messages.length, 1);
    assert.equal(thread?.subject, "Contract Discussion");
  });

  it("should match In-Reply-To header and append reply to the same thread", async () => {
    const parentMsgId = `<msg-orig-${Date.now()}@sender.com>`;
    const orig = await processInboundEmail({
      accountId: testAccountId,
      from: "bob@sender.com",
      to: ["test@domain.com"],
      subject: "Project Roadmap",
      textBody: "Initial timeline.",
      messageIdHeader: parentMsgId,
    });

    // Inbound reply referencing parentMsgId
    const replyMsgId = `<msg-reply-${Date.now()}@sender.com>`;
    const reply = await processInboundEmail({
      accountId: testAccountId,
      from: "bob@sender.com",
      to: ["test@domain.com"],
      subject: "Re: Project Roadmap",
      textBody: "Here are the revised milestones.",
      messageIdHeader: replyMsgId,
      inReplyTo: parentMsgId,
    });

    assert.equal(reply.threadId, orig.threadId, "Reply must attach to the parent thread");
    assert.equal(reply.isNewThread, false);

    const thread = await prisma.thread.findUnique({
      where: { id: orig.threadId },
      include: { messages: true },
    });

    assert.equal(thread?.messages.length, 2);
  });

  it("should fall back to subject normalization within 7 days if RFC headers are absent", async () => {
    const orig = await processInboundEmail({
      accountId: testAccountId,
      from: "charlie@sender.com",
      to: ["test@domain.com"],
      subject: "Budget Proposal 2026",
      textBody: "Draft budget numbers.",
    });

    // Subsequent email with Re: but no In-Reply-To header
    const followUp = await processInboundEmail({
      accountId: testAccountId,
      from: "charlie@sender.com",
      to: ["test@domain.com"],
      subject: "Re: Budget Proposal 2026",
      textBody: "Revised numbers.",
    });

    assert.equal(followUp.threadId, orig.threadId, "Must match via normalized subject fallback");
    assert.equal(followUp.isNewThread, false);
  });
});
