import { createHash } from "node:crypto";

/**
 * Computes hexadecimal SHA-256 checksum for a binary buffer.
 */
export function calculateSha256(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}
