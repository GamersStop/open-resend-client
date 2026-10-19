"use server";

import { z } from "zod";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { encryptApiKey } from "@/lib/crypto";
import { verifyResendApiKey } from "@/lib/resend";

const CreateAccountSchema = z.object({
  label: z.string().min(2, "Label must be at least 2 characters"),
  apiKey: z.string().min(10, "API key must be at least 10 characters"),
  webhookSecret: z.string().optional(),
  defaultFromEmail: z.string().email("Valid email address required for sender"),
  defaultFromName: z.string().optional(),
});

const UpdateAccountSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  label: z.string().min(2, "Label must be at least 2 characters"),
  apiKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  defaultFromEmail: z.string().email("Valid email address required for sender"),
  defaultFromName: z.string().optional(),
});

export type AccountActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export interface SafeAccount {
  id: string;
  label: string;
  webhookToken: string;
  defaultFromEmail: string;
  defaultFromName: string | null;
  createdAt: Date;
  threadCount?: number;
}

/**
 * Creates a new ResendAccount with encrypted credentials and verified connection.
 */
export async function createAccountAction(
  _prevState: AccountActionState | null,
  formData: FormData
): Promise<AccountActionState> {
  const session = await getSession();
  if (!session) {
    return { error: "Authentication required to perform this action." };
  }

  const rawData = {
    label: formData.get("label"),
    apiKey: formData.get("apiKey"),
    webhookSecret: formData.get("webhookSecret") || undefined,
    defaultFromEmail: formData.get("defaultFromEmail"),
    defaultFromName: formData.get("defaultFromName") || undefined,
  };

  const parsed = CreateAccountSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string") {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }

  const { label, apiKey, defaultFromEmail, defaultFromName } = parsed.data;

  // 1. AppSec Validation: Verify API key with Resend before persisting
  const verification = await verifyResendApiKey(apiKey);
  if (!verification.valid) {
    return {
      error: `Resend API validation failed: ${verification.error || "Invalid key"}`,
    };
  }

  // 2. Encryption at rest (AES-256-GCM format iv:authTag:ciphertext)
  const apiKeyEncrypted = encryptApiKey(apiKey);

  // 3. Generate secure webhook credentials
  const webhookSecret =
    parsed.data.webhookSecret?.trim() ||
    `whsec_${crypto.randomBytes(16).toString("hex")}`;
  const webhookToken = `whk_${crypto.randomBytes(12).toString("hex")}`;

  try {
    await db.resendAccount.create({
      data: {
        userId: session.user.userId,
        label,
        apiKeyEncrypted,
        webhookSecret,
        webhookToken,
        defaultFromEmail,
        defaultFromName: defaultFromName || null,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { error: `Failed to register account: ${(err as Error).message}` };
  }
}

/**
 * Updates an existing ResendAccount ensuring strict tenant isolation.
 */
export async function updateAccountAction(
  _prevState: AccountActionState | null,
  formData: FormData
): Promise<AccountActionState> {
  const session = await getSession();
  if (!session) {
    return { error: "Authentication required." };
  }

  const rawData = {
    accountId: formData.get("accountId"),
    label: formData.get("label"),
    apiKey: formData.get("apiKey") || undefined,
    webhookSecret: formData.get("webhookSecret") || undefined,
    defaultFromEmail: formData.get("defaultFromEmail"),
    defaultFromName: formData.get("defaultFromName") || undefined,
  };

  const parsed = UpdateAccountSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string") {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }

  const {
    accountId,
    label,
    apiKey,
    webhookSecret,
    defaultFromEmail,
    defaultFromName,
  } = parsed.data;

  // AppSec: Verify account ownership
  const existing = await db.resendAccount.findFirst({
    where: { id: accountId, userId: session.user.userId },
  });

  if (!existing) {
    return { error: "Account not found or access denied." };
  }

  const updateData: {
    label: string;
    defaultFromEmail: string;
    defaultFromName: string | null;
    apiKeyEncrypted?: string;
    webhookSecret?: string;
  } = {
    label,
    defaultFromEmail,
    defaultFromName: defaultFromName || null,
  };

  if (apiKey && apiKey.trim().length > 0) {
    const verification = await verifyResendApiKey(apiKey.trim());
    if (!verification.valid) {
      return {
        error: `Resend API validation failed: ${verification.error || "Invalid key"}`,
      };
    }
    updateData.apiKeyEncrypted = encryptApiKey(apiKey.trim());
  }

  if (webhookSecret && webhookSecret.trim().length > 0) {
    updateData.webhookSecret = webhookSecret.trim();
  }

  try {
    await db.resendAccount.update({
      where: { id: accountId },
      data: updateData,
    });

    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { error: `Update failed: ${(err as Error).message}` };
  }
}

/**
 * Deletes a ResendAccount ensuring strict tenant scoping.
 */
export async function deleteAccountAction(accountId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Authentication required." };
  }

  // AppSec: Verify account ownership
  const existing = await db.resendAccount.findFirst({
    where: { id: accountId, userId: session.user.userId },
  });

  if (!existing) {
    return { success: false, error: "Account not found or unauthorized." };
  }

  try {
    await db.resendAccount.delete({
      where: { id: accountId },
    });

    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Retrieves sanitized accounts for client components (never returning plaintext or encrypted keys).
 */
export async function getSafeAccounts(): Promise<SafeAccount[]> {
  const session = await getSession();
  if (!session) return [];

  const accounts = await db.resendAccount.findMany({
    where: { userId: session.user.userId },
    select: {
      id: true,
      label: true,
      webhookToken: true,
      defaultFromEmail: true,
      defaultFromName: true,
      createdAt: true,
      _count: {
        select: { threads: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return accounts.map((acc) => ({
    id: acc.id,
    label: acc.label,
    webhookToken: acc.webhookToken,
    defaultFromEmail: acc.defaultFromEmail,
    defaultFromName: acc.defaultFromName,
    createdAt: acc.createdAt,
    threadCount: acc._count.threads,
  }));
}
