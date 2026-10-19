import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { POST } from "../app/api/webhooks/resend/[webhookToken]/route";
import { NextRequest } from "next/server";

const prisma = new PrismaClient();

describe("Phase 3: Webhook Route & Signature Verification suite", () => {
  const testUserId = `user_webhook_${Date.now()}`;
  let testAccountId: string;
  let webhookToken: string;
  const webhookSecret = "whsec_test_secret_for_suite_12345678";

  before(async () => {
    const user = await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        passwordHash: "hash123",
      },
    });

    webhookToken = `whk_${Date.now()}`;
    const account = await prisma.resendAccount.create({
      data: {
        userId: user.id,
        label: "Webhook Test Domain",
        apiKeyEncrypted: "iv:tag:cipher",
        webhookSecret,
        webhookToken,
        defaultFromEmail: "inbox@domain.com",
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

  it("should reject unauthenticated request with 401 Unauthorized", async () => {
    const payload = JSON.stringify({
      from: "attacker@malicious.com",
      to: "inbox@domain.com",
      subject: "Spoofed Email",
      text: "Malicious payload",
    });

    const req = new NextRequest(
      `http://localhost:3000/api/webhooks/resend/${webhookToken}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: payload,
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ webhookToken }),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes("401 Unauthorized"));
  });

  it("should accept authentic webhook with direct secret token and process email", async () => {
    const payload = JSON.stringify({
      from: "client@acme.com",
      to: "inbox@domain.com",
      subject: "Valid Client Request",
      text: "Legitimate inbound body",
      message_id: `<valid-${Date.now()}@acme.com>`,
    });

    const req = new NextRequest(
      `http://localhost:3000/api/webhooks/resend/${webhookToken}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": webhookSecret,
        },
        body: payload,
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ webhookToken }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.threadId);
    assert.ok(data.messageId);
  });

  it("should accept authentic webhook with HMAC-SHA256 signature", async () => {
    const payload = JSON.stringify({
      from: "partner@tech.com",
      to: "inbox@domain.com",
      subject: "Partnership Opportunity",
      text: "Signed via HMAC.",
      message_id: `<partner-${Date.now()}@tech.com>`,
    });

    const hmacSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    const req = new NextRequest(
      `http://localhost:3000/api/webhooks/resend/${webhookToken}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-resend-signature": hmacSig,
        },
        body: payload,
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ webhookToken }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  it("should return 404 for unknown webhook tokens", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/webhooks/resend/non_existent_token`,
      {
        method: "POST",
        headers: {
          "x-webhook-secret": "any_secret",
        },
        body: "{}",
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ webhookToken: "non_existent_token" }),
    });

    assert.equal(res.status, 404);
  });
});
