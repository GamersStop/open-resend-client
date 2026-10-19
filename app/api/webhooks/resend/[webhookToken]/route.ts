import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { processInboundEmail } from "@/lib/threading";

/**
 * Validates the inbound webhook signature using the account's webhook secret.
 * Supports Svix v1 signatures, standard HMAC-SHA256, and header token authentication.
 */
function verifyWebhookSignature({
  secret,
  rawBody,
  headers,
}: {
  secret: string;
  rawBody: string;
  headers: Headers;
}): boolean {
  if (!secret) return false;

  // 1. Direct secret token header check (e.g. for testing / direct integrations)
  const headerSecret =
    headers.get("x-webhook-secret") ||
    headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (headerSecret && headerSecret === secret) {
    return true;
  }

  // 2. Svix standard signature verification (used by Resend)
  const svixId = headers.get("svix-id") || headers.get("resend-id");
  const svixTimestamp =
    headers.get("svix-timestamp") || headers.get("resend-timestamp");
  const svixSignature =
    headers.get("svix-signature") || headers.get("resend-signature");

  if (svixId && svixTimestamp && svixSignature) {
    // Replay attack protection: verify timestamp tolerance (300 seconds / 5 mins)
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(svixTimestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > 300) {
      return false;
    }

    const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
    const cleanSecret = secret.startsWith("whsec_")
      ? secret.substring(6)
      : secret;

    let secretKey: Buffer;
    try {
      secretKey = Buffer.from(cleanSecret, "base64");
    } catch {
      secretKey = Buffer.from(cleanSecret, "utf8");
    }

    const expectedSig = crypto
      .createHmac("sha256", secretKey)
      .update(toSign)
      .digest("base64");

    const signatures = svixSignature
      .split(" ")
      .map((item) => item.replace(/^v1,/, ""));

    if (
      signatures.some((sig) => {
        try {
          const sigBuf = Buffer.from(sig);
          const expBuf = Buffer.from(expectedSig);
          return (
            sigBuf.length === expBuf.length &&
            crypto.timingSafeEqual(sigBuf, expBuf)
          );
        } catch {
          return false;
        }
      })
    ) {
      return true;
    }
  }

  // 3. Fallback: Direct hex-encoded HMAC-SHA256 over raw body
  const customSignature =
    headers.get("x-resend-signature") || headers.get("x-signature-sha256");
  if (customSignature) {
    const expectedHex = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    try {
      const sigBuf = Buffer.from(customSignature);
      const expBuf = Buffer.from(expectedHex);
      if (
        sigBuf.length === expBuf.length &&
        crypto.timingSafeEqual(sigBuf, expBuf)
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

// Zod schemas for flexible Resend payload validation
const AttachmentSchema = z.object({
  filename: z.string(),
  content: z.string().optional(),
  mime_type: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  download_url: z.string().optional(),
});

const EmailDataSchema = z.object({
  from: z.string(),
  to: z.union([z.string(), z.array(z.string())]),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  bcc: z.union([z.string(), z.array(z.string())]).optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  message_id: z.string().optional(),
  messageId: z.string().optional(),
  in_reply_to: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.union([z.string(), z.array(z.string())]).optional(),
  headers: z.record(z.string(), z.unknown()).optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

const InboundWebhookSchema = z.union([
  // Wrapped event format: { type: "email.received", data: { ... } }
  z.object({
    type: z.string(),
    data: EmailDataSchema,
  }),
  // Flat format: { from, to, subject, ... }
  EmailDataSchema,
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ webhookToken: string }> }
) {
  const { webhookToken } = await params;

  if (!webhookToken) {
    return NextResponse.json(
      { error: "Webhook token missing" },
      { status: 400 }
    );
  }

  // 1. Look up account by unique token
  const account = await db.resendAccount.findUnique({
    where: { webhookToken },
  });

  if (!account) {
    return NextResponse.json(
      { error: "Account not found for provided webhook token" },
      { status: 404 }
    );
  }

  // Read raw body for signature verification before parsing JSON
  const rawBody = await request.text();

  // 2. Security Gate: Verify signature against account's secret
  const isSignatureValid = verifyWebhookSignature({
    secret: account.webhookSecret,
    rawBody,
    headers: request.headers,
  });

  if (!isSignatureValid) {
    return NextResponse.json(
      { error: "401 Unauthorized: Invalid or missing webhook signature" },
      { status: 401 }
    );
  }

  // 3. Schema validation with Zod
  let jsonPayload: unknown;
  try {
    jsonPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const parsed = InboundWebhookSchema.safeParse(jsonPayload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload validation failed",
        details: parsed.error.issues,
      },
      { status: 422 }
    );
  }

  // Normalize data object whether flat or wrapped
  const emailData = "data" in parsed.data ? parsed.data.data : parsed.data;

  // Extract RFC headers from headers object if present
  let inReplyTo = emailData.in_reply_to || emailData.inReplyTo;
  let references = emailData.references;
  let messageIdHeader = emailData.message_id || emailData.messageId;

  if (emailData.headers) {
    if (!inReplyTo && emailData.headers["in-reply-to"]) {
      inReplyTo = String(emailData.headers["in-reply-to"]);
    }
    if (!references && emailData.headers["references"]) {
      const refVal = emailData.headers["references"];
      references = Array.isArray(refVal) ? refVal.map(String) : String(refVal);
    }
    if (!messageIdHeader && emailData.headers["message-id"]) {
      messageIdHeader = String(emailData.headers["message-id"]);
    }
  }

  // Map attachments
  const attachments = emailData.attachments?.map((att) => ({
    filename: att.filename,
    mimeType: att.mime_type || att.mimeType || "application/octet-stream",
    size: att.size || 0,
    content: att.content,
  }));

  try {
    const result = await processInboundEmail({
      accountId: account.id,
      from: emailData.from,
      to: emailData.to,
      cc: emailData.cc,
      bcc: emailData.bcc,
      subject: emailData.subject || "(No Subject)",
      textBody: emailData.text,
      htmlBody: emailData.html,
      resendMessageId: messageIdHeader,
      messageIdHeader,
      inReplyTo,
      references,
      attachments,
    });

    return NextResponse.json({
      success: true,
      threadId: result.threadId,
      messageId: result.messageId,
      isNewThread: result.isNewThread,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Internal processing error: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
