// apps/api/src/lib/crypto.ts
// AES-256-GCM encryption for storing sensitive tokens (ORCID access tokens) at rest.
//
// Why AES-256-GCM?
//   - Authenticated encryption — detects tampering (unlike AES-CBC)
//   - GCM is hardware-accelerated on most CPUs
//   - 256-bit key is beyond brute-force range for foreseeable future

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // 96-bit IV is optimal for GCM
const TAG_LENGTH = 16;  // 128-bit auth tag

function getKey(): Buffer {
  const keyHex = process.env["ENCRYPTION_KEY"];
  if (!keyHex) throw new Error("ENCRYPTION_KEY environment variable is required");
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  return key;
}

/**
 * Encrypts plaintext and returns a base64 string of: IV + ciphertext + auth tag.
 * All three parts are needed for decryption — we store them together.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Pack: [IV (12)] + [tag (16)] + [ciphertext (variable)]
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * Decrypts a base64 string produced by encrypt().
 * Returns null if decryption fails (tampered data, wrong key, etc.)
 */
export function decrypt(encoded: string): string | null {
  try {
    const key = getKey();
    const buf = Buffer.from(encoded, "base64");

    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(ciphertext) + decipher.final("utf8");
  } catch {
    // Return null rather than throwing — callers handle missing tokens gracefully
    return null;
  }
}
