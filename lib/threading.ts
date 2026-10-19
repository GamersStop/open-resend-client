import { db } from "@/lib/db";
import { sanitizeHtml, sanitizeAttachmentFilename } from "@/lib/sanitizer";
import path from "path";
import fs from "fs/promises";

export interface InboundAttachmentInput {
  filename: string;
  mimeType: string;
  size: number;
  content?: string; // Base64 content if provided
  downloadUrl?: string; // Download URL from Resend webhook if provided
}

export interface InboundEmailPayload {
  accountId: string;
  from: string;
  to: string[] | string;
  cc?: string[] | string;
  bcc?: string[] | string;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  resendMessageId?: string;
  messageIdHeader?: string;
  inReplyTo?: string;
  references?: string | string[];
  attachments?: InboundAttachmentInput[];
}

/**
 * Normalizes an email subject by stripping repetitive "Re:", "Fwd:", etc. prefixes.
 */
export function stripRe(subject: string): string {
  if (!subject) return "";
  let clean = subject.trim();
  // Strip patterns like Re:, RE:, Fwd:, FWD:, Re[2]:, Fwd[1]:
  const rePattern = /^(\s*(re|fwd|fw|aw|antw|wg)\s*(\[\d+\])?\s*:\s*)+/i;
  while (rePattern.test(clean)) {
    clean = clean.replace(rePattern, "").trim();
  }
  return clean;
}

/**
 * Extracts distinct Message-IDs from header strings like `<id1@domain> <id2@domain>`.
 */
export function extractMessageIds(
  rawHeader: string | string[] | null | undefined
): string[] {
  if (!rawHeader) return [];

  const rawString = Array.isArray(rawHeader)
    ? rawHeader.join(" ")
    : String(rawHeader);

  // Match all <...> bracketed message IDs or whitespace-separated tokens
  const matches = rawString.match(/<[^>]+>/g);
  if (matches && matches.length > 0) {
    return matches.map((m) => m.trim());
  }

  return rawString
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * RFC Threading Algorithm:
 * 1. Checks In-Reply-To and References against existing messageIdHeader entries for the account.
 * 2. If matched, appends to the corresponding thread and bumps lastActivity.
 * 3. If no header match, normalizes subject (stripRe) and checks for recent thread (<7 days).
 * 4. Otherwise, creates a new Thread.
 */
export async function processInboundEmail(
  payload: InboundEmailPayload
): Promise<{ threadId: string; messageId: string; isNewThread: boolean }> {
  const { accountId, from, subject } = payload;

  // Normalize To/Cc/Bcc to array strings
  const toArray = Array.isArray(payload.to)
    ? payload.to
    : typeof payload.to === "string"
    ? [payload.to]
    : [];

  const ccArray = Array.isArray(payload.cc)
    ? payload.cc
    : typeof payload.cc === "string"
    ? [payload.cc]
    : [];

  const bccArray = Array.isArray(payload.bcc)
    ? payload.bcc
    : typeof payload.bcc === "string"
    ? [payload.bcc]
    : [];

  // Sanitize incoming HTML body server-side
  const cleanHtml = sanitizeHtml(payload.htmlBody);

  // Ensure Message-ID is present
  const messageIdHeader =
    payload.messageIdHeader ||
    `<inbound-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@openresend.local>`;

  // 1. Collect candidate reference IDs from In-Reply-To and References
  const candidateIds = [
    ...extractMessageIds(payload.inReplyTo),
    ...extractMessageIds(payload.references),
  ];

  let matchedThreadId: string | null = null;
  let isNewThread = false;

  // Step 1: RFC Header matching
  if (candidateIds.length > 0) {
    const parentMessage = await db.message.findFirst({
      where: {
        messageIdHeader: { in: candidateIds },
        thread: { accountId },
      },
      select: { threadId: true },
    });

    if (parentMessage) {
      matchedThreadId = parentMessage.threadId;
    }
  }

  // Step 2: Subject normalization 7-day rolling window fallback
  if (!matchedThreadId) {
    const normalizedSubject = stripRe(subject);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const candidateThreads = await db.thread.findMany({
      where: {
        accountId,
        lastActivity: { gte: sevenDaysAgo },
      },
      select: { id: true, subject: true },
      orderBy: { lastActivity: "desc" },
    });

    for (const cand of candidateThreads) {
      if (stripRe(cand.subject).toLowerCase() === normalizedSubject.toLowerCase()) {
        matchedThreadId = cand.id;
        break;
      }
    }
  }

  // Step 3: Resolve or create Thread
  let threadId: string;

  if (matchedThreadId) {
    threadId = matchedThreadId;
    await db.thread.update({
      where: { id: threadId },
      data: {
        lastActivity: new Date(),
        isRead: false,
        isTrash: false,
      },
    });
  } else {
    isNewThread = true;
    const newThread = await db.thread.create({
      data: {
        accountId,
        subject: subject || "(No Subject)",
        lastActivity: new Date(),
        isRead: false,
      },
    });
    threadId = newThread.id;
  }

  // Step 4: Persist Message record
  const createdMessage = await db.message.create({
    data: {
      threadId,
      resendMessageId: payload.resendMessageId || null,
      messageIdHeader,
      direction: "INBOUND",
      from,
      to: JSON.stringify(toArray),
      cc: ccArray.length > 0 ? JSON.stringify(ccArray) : null,
      bcc: bccArray.length > 0 ? JSON.stringify(bccArray) : null,
      subject: subject || "(No Subject)",
      textBody: payload.textBody || null,
      htmlBody: cleanHtml || null,
    },
  });

  // Step 5: Process attachments if any
  if (payload.attachments && payload.attachments.length > 0) {
    const storageDir = path.join(
      process.cwd(),
      "storage",
      "attachments",
      accountId,
      createdMessage.id
    );

    await fs.mkdir(storageDir, { recursive: true });

    for (const att of payload.attachments) {
      const safeFilename = sanitizeAttachmentFilename(att.filename);
      const filePath = path.join(storageDir, safeFilename);

      if (att.content) {
        const buffer = Buffer.from(att.content, "base64");
        await fs.writeFile(filePath, buffer);
      } else {
        // Create placeholder file record if binary is streamed or downloaded
        await fs.writeFile(filePath, Buffer.from(""));
      }

      await db.attachment.create({
        data: {
          messageId: createdMessage.id,
          filename: safeFilename,
          mimeType: att.mimeType || "application/octet-stream",
          size: att.size || 0,
          storagePath: filePath,
        },
      });
    }
  }

  return {
    threadId,
    messageId: createdMessage.id,
    isNewThread,
  };
}
