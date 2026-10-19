import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // NIST SP 800-38D recommended for GCM

/**
 * Resolves the 32-byte encryption key from process.env.ENCRYPTION_KEY or an override.
 */
function getEncryptionKey(overrideKey?: string): Buffer {
  const secret = overrideKey || process.env.ENCRYPTION_KEY;

  if (!secret) {
    throw new Error(
      "Missing ENCRYPTION_KEY environment variable. A 32-byte hex or string key is required."
    );
  }

  // If provided as a 64-character hex string (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  // If provided as raw utf8 string, ensure 32 bytes or hash it with SHA-256
  if (Buffer.byteLength(secret, "utf8") === 32) {
    return Buffer.from(secret, "utf8");
  }

  // Fallback: derive deterministic 32-byte key using SHA-256 hash
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext Resend API key using AES-256-GCM.
 * Output format: `iv:authTag:ciphertext` (hex-encoded).
 */
export function encryptApiKey(plainKey: string, keyOverride?: string): string {
  if (!plainKey || typeof plainKey !== "string") {
    throw new Error("Plaintext key must be a non-empty string.");
  }

  const keyBuffer = getEncryptionKey(keyOverride);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(plainKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  return `${ivHex}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted payload (`iv:authTag:ciphertext`).
 * Throws an explicit error if the payload is corrupted or tampering is detected.
 */
export function decryptApiKey(
  encryptedPayload: string,
  keyOverride?: string
): string {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    throw new Error("Encrypted payload must be a non-empty string.");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Malformed encrypted payload. Expected format 'iv:authTag:ciphertext'."
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;

  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Encrypted payload components cannot be empty.");
  }

  try {
    const keyBuffer = getEncryptionKey(keyOverride);
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(
      `Decryption failed: payload has been tampered with or invalid key. ${(error as Error).message}`
    );
  }
}

/**
 * Safely masks a Resend API key for display in settings UI (e.g., `re_abc...xyz`).
 */
export function maskApiKey(plainKey: string): string {
  if (!plainKey) return "";
  if (plainKey.length <= 8) return "••••••••";
  const start = plainKey.slice(0, 6);
  const end = plainKey.slice(-4);
  return `${start}••••••••${end}`;
}
