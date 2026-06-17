// lib/daraja/utils.ts
// Helpers for generating Daraja API passwords and timestamps

import { createHash } from "crypto";

/**
 * Generate the password for STK Push.
 * Format: base64(Shortcode + Passkey + Timestamp)
 */
export function generatePassword(
  shortcode: string,
  passkey: string,
  timestamp: string
): string {
  const raw = `${shortcode}${passkey}${timestamp}`;
  return Buffer.from(raw).toString("base64");
}

/**
 * Generate Daraja timestamp in YYYYMMDDHHmmss format.
 */
export function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${now.getFullYear()}` +
    `${pad(now.getMonth() + 1)}` +
    `${pad(now.getDate())}` +
    `${pad(now.getHours())}` +
    `${pad(now.getMinutes())}` +
    `${pad(now.getSeconds())}`
  );
}

/**
 * Format phone number to 2547XXXXXXXX format for Daraja.
 * Handles: 0712345678, +254712345678, 254712345678
 */
export function formatPhoneForDaraja(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return `254${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith("254") && cleaned.length === 12) {
    return cleaned;
  }
  if (cleaned.startsWith("+254")) {
    return cleaned.slice(1);
  }
  throw new Error(`Invalid phone number format: ${phone}`);
}