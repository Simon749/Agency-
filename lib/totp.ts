import { randomBytes, createHmac } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 Base32 encode */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** RFC 4648 Base32 decode */
export function base32Decode(encoded: string): Buffer {
  encoded = encoded.replace(/=+$/, "").toUpperCase();
  const bits: number[] = [];

  for (const char of encoded) {
    const val = ALPHABET.indexOf(char);
    if (val === -1) continue;
    for (let i = 4; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    if (i + 8 > bits.length) break;
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bits[i + j] ?? 0);
    }
    bytes.push(byte);
  }

  return Buffer.from(bytes);
}

/** Generate a 6-digit TOTP code for a given secret and time window */
export function generateTOTP(secret: string, window = 0): string {
  const decoded = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + window;

  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(counter, 4);

  const hmac = createHmac("sha1", decoded).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24 |
      (hmac[offset + 1] & 0xff) << 16 |
      (hmac[offset + 2] & 0xff) << 8 |
      (hmac[offset + 3] & 0xff)) %
    1000000;

  return code.toString().padStart(6, "0");
}

/** Verify a user-provided TOTP code against a secret */
export function verifyTOTP(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  // Check current window + one step back/forward for clock skew
  for (let w = -1; w <= 1; w++) {
    if (generateTOTP(secret, w) === token) return true;
  }
  return false;
}

/** Generate cryptographically random backup codes */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(4).toString("hex").toUpperCase()
  );
}

/** Generate a standard otpauth:// URL for QR codes */
export function getOtpAuthUrl(
  email: string,
  secret: string,
  issuer = "PropFlow"
): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const iss = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}