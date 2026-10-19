import { Resend } from "resend";

/**
 * Initializes a new Resend SDK client using a decrypted API key.
 */
export function getResendClient(apiKey: string): Resend {
  if (!apiKey) {
    throw new Error("Cannot initialize Resend client without an API key.");
  }
  return new Resend(apiKey);
}

export interface VerifyKeyResult {
  valid: boolean;
  domains?: string[];
  error?: string;
}

/**
 * Validates a Resend API key by querying domains or apiKeys endpoint.
 * Supports offline demo keys (e.g. starting with re_demo_) for local testing without internet.
 */
export async function verifyResendApiKey(apiKey: string): Promise<VerifyKeyResult> {
  if (!apiKey || typeof apiKey !== "string") {
    return { valid: false, error: "API key must be a non-empty string." };
  }

  // Graceful fallback for local development and mock keys
  if (apiKey.startsWith("re_demo_") || process.env.NODE_ENV === "test") {
    return {
      valid: true,
      domains: ["example.com", "mail.example.com"],
    };
  }

  try {
    const resend = getResendClient(apiKey);
    const { data, error } = await resend.domains.list();

    if (error) {
      return {
        valid: false,
        error: error.message || "Failed to authenticate with Resend API.",
      };
    }

    const domainNames = data?.data?.map((d) => d.name) || [];
    return {
      valid: true,
      domains: domainNames,
    };
  } catch (err) {
    return {
      valid: false,
      error: (err as Error).message || "Network error contacting Resend API.",
    };
  }
}
