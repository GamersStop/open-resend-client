"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * Validates that all given thread IDs belong to accounts owned by the authenticated user.
 */
async function getAuthorizedThreadIds(
  userId: string,
  threadIds: string[]
): Promise<string[]> {
  if (!threadIds || threadIds.length === 0) return [];

  const validThreads = await db.thread.findMany({
    where: {
      id: { in: threadIds },
      account: { userId },
    },
    select: { id: true },
  });

  return validThreads.map((t) => t.id);
}

/**
 * Marks threads as read or unread.
 */
export async function toggleReadAction(
  threadIds: string[],
  isRead: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const authorizedIds = await getAuthorizedThreadIds(
    session.user.userId,
    threadIds
  );

  if (authorizedIds.length === 0) {
    return { success: false, error: "No authorized threads found" };
  }

  await db.thread.updateMany({
    where: { id: { in: authorizedIds } },
    data: { isRead },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Toggles the starred status of a single thread.
 */
export async function toggleStarAction(
  threadId: string,
  isStarred: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const authorizedIds = await getAuthorizedThreadIds(session.user.userId, [
    threadId,
  ]);

  if (authorizedIds.length === 0) {
    return { success: false, error: "Unauthorized or thread not found" };
  }

  await db.thread.update({
    where: { id: authorizedIds[0] },
    data: { isStarred },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Moves threads to Archive.
 */
export async function archiveThreadsAction(
  threadIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const authorizedIds = await getAuthorizedThreadIds(
    session.user.userId,
    threadIds
  );

  if (authorizedIds.length === 0) {
    return { success: false, error: "Unauthorized or threads not found" };
  }

  await db.thread.updateMany({
    where: { id: { in: authorizedIds } },
    data: { isArchived: true, isTrash: false },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Moves threads to Trash.
 */
export async function trashThreadsAction(
  threadIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const authorizedIds = await getAuthorizedThreadIds(
    session.user.userId,
    threadIds
  );

  if (authorizedIds.length === 0) {
    return { success: false, error: "Unauthorized or threads not found" };
  }

  await db.thread.updateMany({
    where: { id: { in: authorizedIds } },
    data: { isTrash: true, isArchived: false },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Restores threads from Trash or Archive back to the main Inbox.
 */
export async function restoreToInboxAction(
  threadIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const authorizedIds = await getAuthorizedThreadIds(
    session.user.userId,
    threadIds
  );

  if (authorizedIds.length === 0) {
    return { success: false, error: "Unauthorized or threads not found" };
  }

  await db.thread.updateMany({
    where: { id: { in: authorizedIds } },
    data: { isTrash: false, isArchived: false },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Permanently deletes threads and cascaded messages/attachments.
 */
export async function permanentDeleteThreadsAction(
  threadIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const authorizedIds = await getAuthorizedThreadIds(
    session.user.userId,
    threadIds
  );

  if (authorizedIds.length === 0) {
    return { success: false, error: "Unauthorized or threads not found" };
  }

  await db.thread.deleteMany({
    where: { id: { in: authorizedIds } },
  });

  revalidatePath("/");
  return { success: true };
}
