import { sendWhatsAppTemplate } from "./client";

export const WHATSAPP_TEMPLATES = {
  payment_received: "propflow_payment_received",
  rent_reminder: "propflow_rent_reminder",
  rent_overdue: "propflow_rent_overdue",
  lease_renewal: "propflow_lease_renewal",
  complaint_resolved: "propflow_complaint_resolved",
  invite: "propflow_invite",
} as const;

export type WhatsAppTemplateName = keyof typeof WHATSAPP_TEMPLATES;

interface TemplateParams {
  payment_received: { amount: string; month: string; code: string };
  rent_reminder: { amount: string; building: string; unit: string; date: string };
  rent_overdue: { amount: string };
  lease_renewal: { date: string };
  complaint_resolved: { title: string };
  invite: { agency: string; link: string };
}

export async function sendTemplateMessage<T extends WhatsAppTemplateName>(
  phone: string,
  templateName: T,
  params: TemplateParams[T]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const templateMapping = WHATSAPP_TEMPLATES[templateName];
  
  // Build components based on template
  const components: unknown[] = [];
  
  if (templateName === "payment_received") {
    const p = params as TemplateParams["payment_received"];
    components.push({
      type: "body",
      parameters: [
        { type: "text", text: p.amount },
        { type: "text", text: p.month },
        { type: "text", text: p.code },
      ],
    });
  } else if (templateName === "rent_reminder") {
    const p = params as TemplateParams["rent_reminder"];
    components.push({
      type: "body",
      parameters: [
        { type: "text", text: p.amount },
        { type: "text", text: p.building },
        { type: "text", text: p.unit },
        { type: "text", text: p.date },
      ],
    });
  } else if (templateName === "rent_overdue") {
    const p = params as TemplateParams["rent_overdue"];
    components.push({
      type: "body",
      parameters: [{ type: "text", text: p.amount }],
    });
  } else if (templateName === "lease_renewal") {
    const p = params as TemplateParams["lease_renewal"];
    components.push({
      type: "body",
      parameters: [{ type: "text", text: p.date }],
    });
  } else if (templateName === "complaint_resolved") {
    const p = params as TemplateParams["complaint_resolved"];
    components.push({
      type: "body",
      parameters: [{ type: "text", text: p.title }],
    });
  } else if (templateName === "invite") {
    const p = params as TemplateParams["invite"];
    components.push({
      type: "body",
      parameters: [
        { type: "text", text: p.agency },
        { type: "text", text: p.link },
      ],
    });
  }

  return sendWhatsAppTemplate(phone, templateMapping, "en", components);
}