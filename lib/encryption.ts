import crypto from "crypto";

/**
 * Versioned AES-256-GCM encryption for credentials at rest (Daraja keys, etc.)
 *
 * Env vars expected:
 *   ENCRYPTION_KEY_CURRENT_VERSION=2
 *   ENCRYPTION_KEY_V1=<64-char hex, 32 bytes>
 *   ENCRYPTION_KEY_V2=<64-char hex, 32 bytes>
 *
 * Stored format: "v<version>:<ivHex>:<authTagHex>:<ciphertextHex>"
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

function getCurrentVersion(): number {
  const v = process.env.ENCRYPTION_KEY_CURRENT_VERSION;
  if (!v) throw new Error("ENCRYPTION_KEY_CURRENT_VERSION is not set");
  return parseInt(v, 10);
}

function getKeyForVersion(version: number): Buffer {
  const envKey = process.env[`ENCRYPTION_KEY_V${version}`];
  if (!envKey) throw new Error(`ENCRYPTION_KEY_V${version} is not set`);
  const key = Buffer.from(envKey, "hex");
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY_V${version} must be 32 bytes (64 hex chars)`);
  }
  return key;
}

/** Encrypt plaintext using the CURRENT key version. */
export function encryptCredential(plaintext: string): string {
  const version = getCurrentVersion();
  const key = getKeyForVersion(version);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v${version}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt a stored credential, using whichever key version it was encrypted under. */
export function decryptCredential(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4) throw new Error("Malformed encrypted credential");
  const [versionTag, ivHex, authTagHex, cipherHex] = parts;

  const version = parseInt(versionTag.replace("v", ""), 10);
  const key = getKeyForVersion(version);

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Re-encrypt a credential under the CURRENT key version.
 * Used by scripts/rotate-keys.ts — decrypts under whatever version it was
 * stored with, then re-encrypts under the active version. If it's already
 * on the current version, this is a no-op re-wrap (still safe to run).
 */
export async function reencryptCredential(stored: string): Promise<string> {
  const plaintext = decryptCredential(stored);
  return encryptCredential(plaintext);
}