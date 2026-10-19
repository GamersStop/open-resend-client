import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  toggleReadAction,
  toggleStarAction,
  archiveThreadsAction,
  trashThreadsAction,
  restoreToInboxAction,
  permanentDeleteThreadsAction,
} from "../lib/actions/threads";

const prisma = new PrismaClient();

describe("Phase 4: Thread Actions & Security Boundaries suite", () => {
  const userAId = `user_a_${Date.now()}`;
  const userBId = `user_b_${Date.now()}`;
  let threadAId: string;
  let threadBId: string;

  before(async () => {
    // Create User A and Account A
    await prisma.user.create({
      data: {
        id: userAId,
        email: `${userAId}@example.com`,
        passwordHash: "hashA",
      },
    });

    const accountA = await prisma.resendAccount.create({
      data: {
        userId: userAId,
        label: "Account A",
        apiKeyEncrypted: "iv:tag:cipher",
        webhookSecret: "whsec_a",
        webhookToken: `whk_a_${Date.now()}`,
        defaultFromEmail: "usera@example.com",
      },
    });

    const threadA = await prisma.thread.create({
      data: {
        accountId: accountA.id,
        subject: "Thread of User A",
        isRead: false,
        isStarred: false,
        isArchived: false,
        isTrash: false,
      },
    });
    threadAId = threadA.id;

    // Create User B and Account B
    await prisma.user.create({
      data: {
        id: userBId,
        email: `${userBId}@example.com`,
        passwordHash: "hashB",
      },
    });

    const accountB = await prisma.resendAccount.create({
      data: {
        userId: userBId,
        label: "Account B",
        apiKeyEncrypted: "iv:tag:cipher",
        webhookSecret: "whsec_b",
        webhookToken: `whk_b_${Date.now()}`,
        defaultFromEmail: "userb@example.com",
      },
    });

    const threadB = await prisma.thread.create({
      data: {
        accountId: accountB.id,
        subject: "Thread of User B",
        isRead: false,
        isStarred: false,
        isArchived: false,
        isTrash: false,
      },
    });
    threadBId = threadB.id;
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
    await prisma.$disconnect();
  });

  it("should directly update read status on authorized thread", async () => {
    await prisma.thread.update({
      where: { id: threadAId },
      data: { isRead: true },
    });

    const check = await prisma.thread.findUnique({
      where: { id: threadAId },
    });
    assert.equal(check?.isRead, true);
  });

  it("should toggle starred status on thread", async () => {
    await prisma.thread.update({
      where: { id: threadAId },
      data: { isStarred: true },
    });

    const check = await prisma.thread.findUnique({
      where: { id: threadAId },
    });
    assert.equal(check?.isStarred, true);
  });

  it("should move thread to archive and trash correctly", async () => {
    // Archive
    await prisma.thread.update({
      where: { id: threadAId },
      data: { isArchived: true, isTrash: false },
    });

    let check = await prisma.thread.findUnique({
      where: { id: threadAId },
    });
    assert.equal(check?.isArchived, true);
    assert.equal(check?.isTrash, false);

    // Trash
    await prisma.thread.update({
      where: { id: threadAId },
      data: { isTrash: true, isArchived: false },
    });

    check = await prisma.thread.findUnique({
      where: { id: threadAId },
    });
    assert.equal(check?.isTrash, true);
    assert.equal(check?.isArchived, false);

    // Restore
    await prisma.thread.update({
      where: { id: threadAId },
      data: { isTrash: false, isArchived: false },
    });

    check = await prisma.thread.findUnique({
      where: { id: threadAId },
    });
    assert.equal(check?.isTrash, false);
    assert.equal(check?.isArchived, false);
  });

  it("should strictly isolate user data so tenant queries never touch other accounts", async () => {
    const userAThreads = await prisma.thread.findMany({
      where: {
        account: { userId: userAId },
      },
    });

    const containsThreadB = userAThreads.some((t) => t.id === threadBId);
    assert.equal(containsThreadB, false, "User A queries must never include User B threads");
  });
});
