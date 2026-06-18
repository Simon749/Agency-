// lib/sms/index.ts
// Barrel export for all SMS utilities.

export { sendSms, sendBulkSms } from "./sendSms";
export type { SmsResult } from "./sendSms";
export * as templates from "./templates";
export * from "./triggers";