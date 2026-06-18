// lib/sms/sendSms.ts
// Africa's Talking SMS wrapper — Kenya-focused, sandbox → live switchable.
// All SMS functions are async and return structured results for logging.

const AT_USERNAME = process.env.AT_USERNAME;
const AT_API_KEY = process.env.AT_API_KEY;
const AT_SANDBOX = process.env.AT_SANDBOX === "true";

const AT_BASE_URL = AT_SANDBOX
  ? "https://api.sandbox.africastalking.com/version1"
  : "https://api.africastalking.com/version1";

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: unknown;
}

/**
 * Send a single SMS to a Kenyan phone number.
 * Automatically prepends +254 if the number starts with 07/01/254.
 */
export async function sendSms(
  phone: string,
  message: string,
  senderId?: string
): Promise<SmsResult> {
  if (!AT_USERNAME || !AT_API_KEY) {
    console.warn("[SMS] AT_USERNAME or AT_API_KEY not set — SMS skipped");
    return { success: false, error: "Africa's Talking credentials not configured" };
  }

  const formattedPhone = formatKenyanPhone(phone);
  const trimmedMessage = message.slice(0, 480); // AT hard limit ~480 chars

  const url = `${AT_BASE_URL}/messaging`;
  const body = new URLSearchParams({
    username: AT_USERNAME,
    to: formattedPhone,
    message: trimmedMessage,
    ...(senderId ? { from: senderId } : {}),
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apiKey: AT_API_KEY,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await res.json();

    // AT returns 200 even for partial failures — inspect SMSMessageData
    const smsData = data.SMSMessageData;
    const recipients = smsData?.Recipients ?? [];
    const first = recipients[0];

    if (first?.status === "Success") {
      return {
        success: true,
        messageId: first.messageId,
        raw: data,
      };
    }

    return {
      success: false,
      error: first?.status ?? smsData?.Message ?? "Unknown AT error",
      raw: data,
    };
  } catch (err) {
    console.error("[SMS] Network error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send the same message to multiple recipients (batch).
 * Returns per-recipient results.
 */
export async function sendBulkSms(
  phones: string[],
  message: string,
  senderId?: string
): Promise<SmsResult[]> {
  const results: SmsResult[] = [];
  for (const phone of phones) {
    const result = await sendSms(phone, message, senderId);
    results.push(result);
  }
  return results;
}

/**
 * Format a Kenyan phone number for Africa's Talking.
 *  0712345678  → +254712345678
 *  254712...   → +254712...
 *  +254712...  → +254712... (no change)
 */
function formatKenyanPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, "").replace(/-/g, "");
  if (cleaned.startsWith("+254")) return cleaned;
  if (cleaned.startsWith("254")) return `+${cleaned}`;
  if (cleaned.startsWith("07") || cleaned.startsWith("01")) {
    return `+254${cleaned.slice(1)}`;
  }
  return cleaned; // fallback — AT will reject if invalid
}