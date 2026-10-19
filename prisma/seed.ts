import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

// Helper to encrypt demo API key using AES-256-GCM matching lib/crypto.ts
function encryptDemoApiKey(key: string, secretHex: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(secretHex, "hex"),
    iv
  );
  let encrypted = cipher.update(key, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

async function main() {
  console.log("Seeding database...");

  const defaultPassword = "password123";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@openresend.local" },
    update: {},
    create: {
      email: "admin@openresend.local",
      passwordHash,
    },
  });

  console.log(`Created user: ${user.email} (Password: ${defaultPassword})`);

  const encryptionKey =
    process.env.ENCRYPTION_KEY ||
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const encryptedKey = encryptDemoApiKey("re_demo_123456789abcdef", encryptionKey);

  const existingAccount = await prisma.resendAccount.findFirst({
    where: { userId: user.id },
  });

  if (!existingAccount) {
    const account = await prisma.resendAccount.create({
      data: {
        userId: user.id,
        label: "Primary Domain",
        apiKeyEncrypted: encryptedKey,
        webhookSecret: "whsec_demo_secret_token_123",
        defaultFromEmail: "hello@example.com",
        defaultFromName: "OpenResend Admin",
      },
    });

    console.log(`Created demo Resend account: ${account.label} (Token: ${account.webhookToken})`);

    const thread = await prisma.thread.create({
      data: {
        accountId: account.id,
        subject: "Welcome to OpenResend!",
        isRead: false,
        isStarred: true,
        lastActivity: new Date(),
        messages: {
          create: {
            direction: "INBOUND",
            from: "team@resend.com",
            to: JSON.stringify(["hello@example.com"]),
            subject: "Welcome to OpenResend!",
            textBody:
              "Welcome to OpenResend! Your open-source, self-hosted webmail client built for Resend.\n\nYou can connect multiple accounts, configure inbound webhooks, and start sending & receiving domain emails effortlessly.",
            htmlBody:
              "<div style=\"font-family: sans-serif; padding: 20px; color: #1e293b;\"><h2 style=\"color: #0f172a;\">Welcome to OpenResend!</h2><p>Your open-source, self-hosted webmail client built for Resend.</p><p>You can connect multiple accounts, configure inbound webhooks, and start sending & receiving domain emails effortlessly.</p><hr style=\"border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;\" /><p style=\"color: #64748b; font-size: 13px;\">RFC-compliant threading • Multi-account • AES-256-GCM secure</p></div>",
            messageIdHeader: `<welcome-${Date.now()}@resend.com>`,
          },
        },
      },
    });

    console.log(`Created welcome email thread: ${thread.subject}`);
  }

  console.log("Database seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
