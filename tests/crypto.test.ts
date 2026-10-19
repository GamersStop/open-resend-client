import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encryptApiKey, decryptApiKey, maskApiKey } from "../lib/crypto";

describe("lib/crypto.ts AES-256-GCM suite", () => {
  const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const apiKey = "re_123456789_sec_sample_key";

  it("should encrypt a plain API key into 'iv:authTag:ciphertext' format", () => {
    const encrypted = encryptApiKey(apiKey, testKey);

    assert.equal(typeof encrypted, "string");
    const parts = encrypted.split(":");
    assert.equal(parts.length, 3, "Payload must have exactly 3 parts");

    const [ivHex, authTagHex, ciphertextHex] = parts;
    assert.equal(ivHex.length, 24, "12-byte IV should be 24 hex characters");
    assert.equal(authTagHex.length, 32, "16-byte auth tag should be 32 hex characters");
    assert.ok(ciphertextHex.length > 0, "Ciphertext should not be empty");
  });

  it("should successfully decrypt an encrypted payload back to the original plaintext", () => {
    const encrypted = encryptApiKey(apiKey, testKey);
    const decrypted = decryptApiKey(encrypted, testKey);

    assert.equal(decrypted, apiKey);
  });

  it("should produce unique IVs and ciphertexts for identical inputs (semantic security)", () => {
    const enc1 = encryptApiKey(apiKey, testKey);
    const enc2 = encryptApiKey(apiKey, testKey);

    assert.notEqual(enc1, enc2, "Subsequent encryptions must use fresh IVs");
    assert.equal(decryptApiKey(enc1, testKey), apiKey);
    assert.equal(decryptApiKey(enc2, testKey), apiKey);
  });

  it("should fail gracefully when ciphertext is corrupted or tampered with", () => {
    const encrypted = encryptApiKey(apiKey, testKey);
    const parts = encrypted.split(":");
    // Tamper with ciphertext by altering last char
    const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -1)}f`;

    assert.throws(
      () => decryptApiKey(tampered, testKey),
      /Decryption failed: payload has been tampered with/
    );
  });

  it("should fail gracefully when auth tag is tampered with", () => {
    const encrypted = encryptApiKey(apiKey, testKey);
    const parts = encrypted.split(":");
    const tamperedAuthTag = "0".repeat(32);
    const tampered = `${parts[0]}:${tamperedAuthTag}:${parts[2]}`;

    assert.throws(
      () => decryptApiKey(tampered, testKey),
      /Decryption failed: payload has been tampered with/
    );
  });

  it("should reject malformed payloads missing delimiters", () => {
    assert.throws(
      () => decryptApiKey("not-a-valid-payload", testKey),
      /Malformed encrypted payload/
    );
  });

  it("should properly mask API keys for safe UI display", () => {
    const masked = maskApiKey("re_prod_abcdef1234567890");
    assert.equal(masked, "re_pro••••••••7890");
    assert.equal(maskApiKey("short"), "••••••••");
  });
});
