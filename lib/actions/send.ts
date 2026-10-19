"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { decryptApiKey } from "@/lib/crypto";
import { getResendClient } from "@/lib/resend";
import { sanitizeAttachmentFilename } from "@/lib/sanitizer";
import path from "path";
import fs from "fs/promises";

const OutboundEmailSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  threadId: z.string().optional(),
  fromEmail: z.string().email("Valid From email required"),
  fromName: z.string().optional(),
  to: z.array(z.string().email("Invalid recipient email")).min(1, "At least one recipient required"),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1, "Subject cannot be empty"),
  htmlBody: z.string().optional(),
  textBody: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        content: z.string(), // base64
        mimeType: z.string(),
        size: z.number(),
      })
    )
    .optional(),
});

export type OutboundEmailInput = z.infer<typeof OutboundEmailSchema>;

export async function sendEmailAction(
  input: OutboundEmailInput,
  userIdOverride?: string
): Promise<{ success: boolean; threadId?: string; messageId?: string; error?: string }> {
  // 1. Session check
  let effectiveUserId = userIdOverride;
  if (!effectiveUserId) {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Authentication required." };
    }
    effectiveUserId = session.user.userId;
  }

  // 2. Validate input schema
  const parsed = OutboundEmailSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: errorMsg };
  }

  const {
    accountId,
    threadId,
    fromEmail,
    fromName,
    to,
    cc = [],
    bcc = [],
    subject,
    htmlBody,
    textBody,
    inReplyTo,
    references,
    attachments = [],
  } = parsed.data;

  // 3. AppSec & Tenant Scoping: Lookup account owned by user
  const account = await db.resendAccount.findFirst({
    where: { id: accountId, userId: effectiveUserId },
  });

  if (!account) {
    return { success: false, error: "Unauthorized or account not found." };
  }

  // 4. Domain Lockdown: Verify sender domain matches account configuration
  const accountDomain = account.defaultFromEmail.split("@")[1]?.toLowerCase();
  const senderDomain = fromEmail.split("@")[1]?.toLowerCase();

  if (accountDomain && senderDomain && accountDomain !== senderDomain) {
    return {
      success: false,
      error: `Domain mismatch: '${fromEmail}' does not match verified domain '@${accountDomain}' for this account.`,
    };
  }

  // 5. Decrypt Resend API key in memory only
  let plainApiKey: string;
  try {
    plainApiKey = decryptApiKey(account.apiKeyEncrypted);
  } catch (err) {
    return {
      success: false,
      error: `Failed to decrypt account credentials: ${(err as Error).message}`,
    };
  }

function ensureBracketedMessageId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("<") && trimmed.endsWith(">")
    ? trimmed
    : `<${trimmed}>`;
}

function formatReferencesHeader(refs: string): string {
  return refs
    .trim()
    .split(/\s+/)
    .map(ensureBracketedMessageId)
    .filter(Boolean)
    .join(" ");
}

  // 6. Format sender string: e.g. "Name <email@domain.com>"
  const formattedFrom = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  // 7. Inject RFC Headers for threading compliance (RFC 5322 & Rule 1 of rules.md)
  const customHeaders: Record<string, string> = {};
  if (inReplyTo && inReplyTo.trim()) {
    customHeaders["In-Reply-To"] = ensureBracketedMessageId(inReplyTo);
  }
  if (references && references.trim()) {
    customHeaders["References"] = formatReferencesHeader(references);
  }

  // Ensure multipart content (both HTML and clean Plain Text) to prevent spam flags
  const plainTextAlternative =
    textBody && textBody.trim().length > 0
      ? textBody.trim()
      : htmlBody
      ? htmlBody
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : undefined;

  const htmlAlternative =
    htmlBody && htmlBody.trim().length > 0
      ? htmlBody
      : textBody
      ? `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${textBody.replace(
          /\n/g,
          "<br/>"
        )}</div>`
      : undefined;

  let resendMessageId: string;

  // 8. Dispatch via Resend API
  if (plainApiKey.startsWith("re_demo_") || process.env.NODE_ENV === "test") {
    // Offline / Mock Dispatch for local development without paid key
    resendMessageId = `re_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  } else {
    try {
      const resend = getResendClient(plainApiKey);

      const sendPayload = {
        from: formattedFrom,
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject,
        html: htmlAlternative,
        text: plainTextAlternative,
        headers: Object.keys(customHeaders).length > 0 ? customHeaders : undefined,
        attachments:
          attachments.length > 0
            ? attachments.map((a) => ({
                filename: a.filename,
                content: Buffer.from(a.content, "base64"),
              }))
            : undefined,
      };

      const result = await resend.emails.send(
        sendPayload as Parameters<typeof resend.emails.send>[0]
      );

      if (result.error) {
        return {
          success: false,
          error: `Resend API Error: ${result.error.message}`,
        };
      }

      resendMessageId = result.data?.id || `re_${Date.now()}`;
    } catch (err) {
      return {
        success: false,
        error: `Failed to transmit email: ${(err as Error).message}`,
      };
    }
  }

  // 9. Persist into Local Database
  let targetThreadId: string;

  if (threadId) {
    // Reply to existing thread
    const existingThread = await db.thread.findFirst({
      where: { id: threadId, accountId: account.id },
    });

    if (!existingThread) {
      return { success: false, error: "Target thread not found for this account." };
    }

    targetThreadId = existingThread.id;
    await db.thread.update({
      where: { id: targetThreadId },
      data: {
        lastActivity: new Date(),
        isTrash: false,
      },
    });
  } else {
    // Brand new thread
    const newThread = await db.thread.create({
      data: {
        accountId: account.id,
        subject,
        lastActivity: new Date(),
        isRead: true, // Sent messages are marked read by default
      },
    });
    targetThreadId = newThread.id;
  }

  // Generate Message-ID header
  const outboundMessageIdHeader = `<${resendMessageId}@${senderDomain || "openresend.local"}>`;

  const createdMessage = await db.message.create({
    data: {
      threadId: targetThreadId,
      resendMessageId,
      messageIdHeader: outboundMessageIdHeader,
      direction: "OUTBOUND",
      from: formattedFrom,
      to: JSON.stringify(to),
      cc: cc.length > 0 ? JSON.stringify(cc) : null,
      bcc: bcc.length > 0 ? JSON.stringify(bcc) : null,
      subject,
      htmlBody: htmlBody || null,
      textBody: textBody || null,
    },
  });

  // Save attachments if any
  if (attachments.length > 0) {
    const storageDir = path.join(
      process.cwd(),
      "storage",
      "attachments",
      account.id,
      createdMessage.id
    );
    await fs.mkdir(storageDir, { recursive: true });

    for (const att of attachments) {
      const safeFilename = sanitizeAttachmentFilename(att.filename);
      const filePath = path.join(storageDir, safeFilename);
      const buffer = Buffer.from(att.content, "base64");
      await fs.writeFile(filePath, buffer);

      await db.attachment.create({
        data: {
          messageId: createdMessage.id,
          filename: safeFilename,
          mimeType: att.mimeType,
          size: att.size,
          storagePath: filePath,
        },
      });
    }
  }

  revalidatePath("/");
  return {
    success: true,
    threadId: targetThreadId,
    messageId: createdMessage.id,
  };
}
