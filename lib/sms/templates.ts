// lib/sms/templates.ts
// Pre-formatted SMS message templates for every trigger event.
// All functions return the final message string (max ~480 chars for AT).

export interface PaymentSmsData {
  tenantName: string;
  amount: number | string;
  month: string;
  receipt: string;
  buildingName?: string;
}

export function paymentReceivedSms(data: PaymentSmsData): string {
  const { tenantName, amount, month, receipt, buildingName } = data;
  const building = buildingName ? ` at ${buildingName}` : "";
  return `Hi ${tenantName}, confirmed KES ${amount} received for ${month} rent${building}. Ref: ${receipt}. Thank you. —PropFlow`;
}

export interface RentReminderData {
  tenantName: string;
  amount: number | string;
  buildingName: string;
  unitNumber: string;
  dueDate: string;
}

export function rentDueReminderSms(data: RentReminderData): string {
  const { tenantName, amount, buildingName, unitNumber, dueDate } = data;
  return `Hi ${tenantName}, your rent of KES ${amount} for ${buildingName}, Unit ${unitNumber} is due on ${dueDate}. Please pay via M-Pesa to avoid penalties. —PropFlow`;
}

export interface OverdueReminderData {
  tenantName: string;
  amount: number | string;
  daysOverdue: number;
  buildingName: string;
  unitNumber: string;
}

export function rentOverdueSms(data: OverdueReminderData): string {
  const { tenantName, amount, daysOverdue, buildingName, unitNumber } = data;
  return `Hi ${tenantName}, your account for ${buildingName}, Unit ${unitNumber} has an outstanding balance of KES ${amount} (${daysOverdue} days overdue). Please pay immediately. —PropFlow`;
}

export interface LeaseRenewalData {
  tenantName: string;
  expiryDate: string;
  buildingName: string;
  unitNumber: string;
}

export function leaseRenewalReminderSms(data: LeaseRenewalData): string {
  const { tenantName, expiryDate, buildingName, unitNumber } = data;
  return `Hi ${tenantName}, your lease at ${buildingName}, Unit ${unitNumber} expires on ${expiryDate}. Log in to PropFlow to review and renew your agreement. —PropFlow`;
}

export interface ComplaintNotifyData {
  managerName: string;
  tenantName: string;
  unitNumber: string;
  buildingName: string;
  title: string;
  priority: string;
}

export function newComplaintManagerSms(data: ComplaintNotifyData): string {
  const { managerName, tenantName, unitNumber, buildingName, title, priority } = data;
  return `Hi ${managerName}, new complaint from ${tenantName} in ${buildingName}, Unit ${unitNumber}: "${title}". Priority: ${priority}. Check PropFlow admin. —PropFlow`;
}

export interface ComplaintResolvedData {
  tenantName: string;
  title: string;
  buildingName: string;
  unitNumber: string;
}

export function complaintResolvedSms(data: ComplaintResolvedData): string {
  const { tenantName, title, buildingName, unitNumber } = data;
  return `Hi ${tenantName}, your complaint "${title}" at ${buildingName}, Unit ${unitNumber} has been resolved. Log in to PropFlow to view details. —PropFlow`;
}

export interface InviteData {
  tenantName: string;
  agencyName: string;
  inviteLink: string;
}

export function tenantInviteSms(data: InviteData): string {
  const { tenantName, agencyName, inviteLink } = data;
  return `Hi ${tenantName}, you have been invited to PropFlow by ${agencyName}. Access your tenant portal here: ${inviteLink} —PropFlow`;
}

export interface PaymentFailedData {
  tenantName: string;
  amount: number | string;
  reason: string;
}

export function paymentFailedSms(data: PaymentFailedData): string {
  const { tenantName, amount, reason } = data;
  return `Hi ${tenantName}, your M-Pesa payment of KES ${amount} failed. Reason: ${reason}. Please try again or contact your agent. —PropFlow`;
}