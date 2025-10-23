import { Receiver } from "@upstash/qstash";
import { NextRequest } from "next/server";
import { isDevelopment } from "@/lib/config/env";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export interface VerificationResult<T = unknown> {
  valid: boolean;
  body?: T;
  error?: string;
}

/**
 * Verify QStash signature and return parsed JSON body.
 * - In production: requires valid `Upstash-Signature` header.
 * - In development: falls back to request.json() if signature is missing.
 */
export async function verifyQstashRequest<T = unknown>(
  request: NextRequest
): Promise<VerificationResult<T>> {
  try {
    const signature = request.headers.get("Upstash-Signature");

    // Prefer signature verification if provided
    if (signature) {
      const raw = await request.text();
      const ok = await receiver.verify({ body: raw, signature });
      if (!ok) {
        return { valid: false, error: "Invalid QStash signature" };
      }
      const parsed = JSON.parse(raw) as T;
      return { valid: true, body: parsed };
    }

    // Allow local/manual testing without signature in development
    if (isDevelopment) {
      const parsed = (await request.json()) as T;
      return { valid: true, body: parsed };
    }

    return { valid: false, error: "Missing Upstash-Signature header" };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Verification failed",
    };
  }
}