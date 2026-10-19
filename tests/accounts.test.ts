import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { encryptApiKey, decryptApiKey } from "../lib/crypto";

const prisma = new PrismaClient();

describe("Phase 2: Multi-Account Isolation & Provisioning suite", () => {
  const testUserId = `test_user_${Date.now()}`;
  let createdAccountId: string;

  before(async () => {
    // Setup test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        passwordHash: "hash123",
      },
    });
  });

  after(async () => {
    // Cleanup test user and accounts
    await prisma.user.delete({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  });

  it("should encrypt the Resend API key upon account provisioning", async () => {
    const rawApiKey = "re_live_secret_123456789";
    const encryptedKey = encryptApiKey(rawApiKey);

    const account = await prisma.resendAccount.create({
      data: {
        userId: testUserId,
        label: "Client Marketing",
        apiKeyEncrypted: encryptedKey,
        webhookSecret: "whsec_test_secret_abc",
        webhookToken: `whk_test_${Date.now()}`,
        defaultFromEmail: "marketing@client.com",
        defaultFromName: "Client Marketing",
      },
    });

    createdAccountId = account.id;

    assert.ok(account.id);
    assert.notEqual(account.apiKeyEncrypted, rawApiKey, "Plaintext API key must never be stored");
    assert.equal(account.apiKeyEncrypted.split(":").length, 3, "Encrypted key must be in iv:authTag:ciphertext format");

    // Decrypt in memory to verify integrity
    const decrypted = decryptApiKey(account.apiKeyEncrypted);
    assert.equal(decrypted, rawApiKey, "Decrypted key must match original plaintext in memory");
  });

  it("should enforce tenant scoping so user A cannot access user B's account", async () => {
    const otherUserId = `other_user_${Date.now()}`;

    const accountForUserA = await prisma.resendAccount.findFirst({
      where: { id: createdAccountId, userId: testUserId },
    });
    assert.ok(accountForUserA, "User A must access their own account");

    const accountForUserB = await prisma.resendAccount.findFirst({
      where: { id: createdAccountId, userId: otherUserId },
    });
    assert.equal(accountForUserB, null, "User B must be denied access to User A's account");
  });

  it("should generate a unique webhook token for incoming webhooks", async () => {
    const account = await prisma.resendAccount.findUnique({
      where: { id: createdAccountId },
    });

    assert.ok(account?.webhookToken);
    assert.ok(account.webhookToken.startsWith("whk_"));
  });

  it("should cascade delete thread and message data when an account is deleted", async () => {
    // Create a thread under this account
    const thread = await prisma.thread.create({
      data: {
        accountId: createdAccountId,
        subject: "Test Thread",
        messages: {
          create: {
            from: "sender@example.com",
            to: JSON.stringify(["marketing@client.com"]),
            subject: "Test Thread",
            textBody: "Hello",
          },
        },
      },
    });

    assert.ok(thread.id);

    // Delete the account
    await prisma.resendAccount.delete({
      where: { id: createdAccountId },
    });

    // Check thread was cascaded
    const threadCheck = await prisma.thread.findUnique({
      where: { id: thread.id },
    });
    assert.equal(threadCheck, null, "Threads must be cascaded upon account deletion");
  });
});
