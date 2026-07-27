/**
 * Handles incoming WhatsApp webhooks from Meta.
 * 
 * Events we care about:
 * - messages: incoming text from tenant (e.g., "BALANCE", "PAY")
 * - message_statuses: delivery/read receipts (for analytics)
 * 
 * Meta webhook verification uses a verify token.
 */

const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ wa_id: string; profile: { name: string } }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: { body: string };
          type: string;
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export function verifyWebhook(mode: string, token: string, challenge: string): string | null {
  if (mode === "subscribe" && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

export async function handleWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const value = change.value;
      
      // Handle incoming messages
      if (value.messages) {
        for (const message of value.messages) {
          if (message.type === "text" && message.text) {
            await handleIncomingMessage(message.from, message.text.body);
          }
        }
      }
      
      // Handle status updates (delivered, read, failed)
      if (value.statuses) {
        for (const status of value.statuses) {
          console.log(`[WhatsApp] Message ${status.id} status: ${status.status} to ${status.recipient_id}`);
          // TODO: Update notification delivery status in DB
        }
      }
    }
  }
}

async function handleIncomingMessage(from: string, body: string): Promise<void> {
  const text = body.trim().toUpperCase();
  
  console.log(`[WhatsApp] Incoming from ${from}: ${body}`);
  
  // Simple command handling
  if (text === "BALANCE" || text === "BAL") {
    // TODO: Look up tenant by WhatsApp phone, fetch balance, reply
    // This requires a reply function — for now, log
    console.log(`[WhatsApp] Balance request from ${from}`);
  } else if (text === "PAY" || text === "LIPA") {
    // TODO: Generate STK Push for tenant
    console.log(`[WhatsApp] Payment request from ${from}`);
  } else if (text === "HELP" || text === "SAIDA") {
    // TODO: Send help text
    console.log(`[WhatsApp] Help request from ${from}`);
  }
}