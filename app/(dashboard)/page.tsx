import React from "react";
export const dynamic = "force-dynamic";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MailboxClient } from "@/components/email/mailbox-client";
import { SerializedThread } from "@/components/email/thread-view";
import { Prisma } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    folder?: string;
    q?: string;
    threadId?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const currentFolder = resolvedParams.folder || "inbox";
  const searchQuery = resolvedParams.q?.trim();
  const requestedThreadId = resolvedParams.threadId;

  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get("openresend_active_account")?.value;
  const isFilteredAccount = activeAccountId && activeAccountId !== "all";

  // Build folder query conditions
  const folderFilter: Prisma.ThreadWhereInput = {};

  if (currentFolder === "starred") {
    folderFilter.isStarred = true;
    folderFilter.isTrash = false;
  } else if (currentFolder === "archive") {
    folderFilter.isArchived = true;
    folderFilter.isTrash = false;
  } else if (currentFolder === "trash") {
    folderFilter.isTrash = true;
  } else if (currentFolder === "sent") {
    folderFilter.isTrash = false;
    folderFilter.messages = {
      some: { direction: "OUTBOUND" },
    };
  } else {
    // default: inbox
    folderFilter.isTrash = false;
    folderFilter.isArchived = false;
  }

  // Build full query
  const whereClause: Prisma.ThreadWhereInput = {
    ...folderFilter,
    account: {
      userId: session.user.userId,
      ...(isFilteredAccount ? { id: activeAccountId } : {}),
    },
    ...(searchQuery
      ? {
          OR: [
            { subject: { contains: searchQuery } },
            {
              messages: {
                some: {
                  OR: [
                    { from: { contains: searchQuery } },
                    { textBody: { contains: searchQuery } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  const rawThreads = await db.thread.findMany({
    where: whereClause,
    include: {
      account: {
        select: {
          id: true,
          label: true,
          defaultFromEmail: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          attachments: true,
        },
      },
    },
    orderBy: {
      lastActivity: "desc",
    },
  });

  // Serialize threads for client component consumption
  const serializedThreads: SerializedThread[] = rawThreads.map((t) => ({
    id: t.id,
    subject: t.subject,
    isRead: t.isRead,
    isStarred: t.isStarred,
    isArchived: t.isArchived,
    isTrash: t.isTrash,
    lastActivity: t.lastActivity.toISOString(),
    account: {
      id: t.account.id,
      label: t.account.label,
      defaultFromEmail: t.account.defaultFromEmail,
    },
    messages: t.messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      from: m.from,
      to: m.to,
      cc: m.cc,
      bcc: m.bcc,
      subject: m.subject,
      htmlBody: m.htmlBody,
      textBody: m.textBody,
      messageIdHeader: m.messageIdHeader,
      createdAt: m.createdAt.toISOString(),
      attachments: m.attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        storagePath: a.storagePath,
      })),
    })),
  }));

  return (
    <MailboxClient
      threads={serializedThreads}
      initialThreadId={requestedThreadId}
      currentFolder={currentFolder}
    />
  );
}
