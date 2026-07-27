export interface KeyRotationReminderData {
  buildingName: string;
  daysUntilExpiry: number;
  rotationUrl: string;
  urgency?: "REMINDER" | "URGENT";
}

export function keyRotationReminderSms(data: KeyRotationReminderData): string {
  const { buildingName, daysUntilExpiry, rotationUrl, urgency } = data;
  const prefix = urgency === "URGENT" ? "PropFlow URGENT:" : "PropFlow Security:";
  return `${prefix} Daraja credentials for ${buildingName} expire in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}. Rotate now: ${rotationUrl}`;
}

export interface KeyRotationOverdueData {
  buildingName: string;
  daysOverdue: number;
  rotationUrl: string;
  supportEmail: string;
}

export function keyRotationOverdueSms(data: KeyRotationOverdueData): string {
  const { buildingName, daysOverdue, rotationUrl, supportEmail } = data;
  return `PropFlow CRITICAL: Daraja credentials for ${buildingName} are ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} OVERDUE. Rotate immediately: ${rotationUrl} or contact ${supportEmail}`;
}

export interface KeyRotationSuccessData {
  buildingName: string;
  rotatedAt: string;
}

export function keyRotationSuccessSms(data: KeyRotationSuccessData): string {
  const { buildingName, rotatedAt } = data;
  const date = new Date(rotatedAt).toLocaleDateString("en-KE");
  return `PropFlow: Daraja credentials for ${buildingName} rotated on ${date}. M-Pesa integration secure.`;
}

export interface KeyRotationFailedData {
  buildingName: string;
  error: string;
  contactSupport: string;
}

export function keyRotationFailedSms(data: KeyRotationFailedData): string {
  const { buildingName, error, contactSupport } = data;
  return `PropFlow ALERT: Rotation failed for ${buildingName}. Error: ${error.slice(0, 50)}... Contact ${contactSupport}.`;
}
