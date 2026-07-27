const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

const WHATSAPP_BASE_URL = "https://graph.facebook.com/v18.0";

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: unknown;
}

function formatPhoneForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("254")) return cleaned;
  if (cleaned.startsWith("0")) return "254" + cleaned.slice(1);
  if (cleaned.startsWith("7") || cleaned.startsWith("1")) return "254" + cleaned;
  return cleaned;
}

export async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  languageCode: string = "en",
  components?: unknown[]
): Promise<WhatsAppResult> {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }

  const formattedPhone = formatPhoneForWhatsApp(phone);

  const url = `${WHATSAPP_BASE_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.error) {
      return { success: false, error: data.error.message, raw: data };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      raw: data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function sendWhatsAppText(
  phone: string,
  text: string
): Promise<WhatsAppResult> {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }

  const formattedPhone = formatPhoneForWhatsApp(phone);

  const url = `${WHATSAPP_BASE_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "text",
    text: { body: text, preview_url: false },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.error) {
      return { success: false, error: data.error.message, raw: data };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      raw: data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}