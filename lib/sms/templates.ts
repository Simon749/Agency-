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


export function subscriptionDue7DaySms(params: {
  agencyName: string;
  amount: number | string;
  dueDate: string;
  paybillNumber: string;
  accountNumber: string;
}): string {
  const { agencyName, amount, dueDate, paybillNumber, accountNumber } = params;
  return `PropFlow: Hi ${agencyName}, your subscription of KES ${amount} is due on ${dueDate}. Pay via M-Pesa Paybill ${paybillNumber}, Acc: ${accountNumber} to avoid service interruption.`;
}

export function subscriptionDue1DaySms(params: {
  agencyName: string;
  amount: number | string;
  dueDate: string;
  paybillNumber: string;
  accountNumber: string;
}): string {
  const { agencyName, amount, dueDate, paybillNumber, accountNumber } = params;
  return `PropFlow URGENT: ${agencyName}, your subscription of KES ${amount} is due TOMORROW (${dueDate}). Pay now: M-Pesa Paybill ${paybillNumber}, Acc: ${accountNumber}.`;
}

export function subscriptionOverdueSms(params: {
  agencyName: string;
  amount: number | string;
  daysOverdue: number;
  gracePeriodDays: number;
  paybillNumber: string;
  accountNumber: string;
}): string {
  const { agencyName, amount, daysOverdue, gracePeriodDays, paybillNumber, accountNumber } = params;
  return `PropFlow OVERDUE: ${agencyName}, your subscription of KES ${amount} is ${daysOverdue} days overdue. Pay within ${gracePeriodDays} days to avoid suspension: M-Pesa Paybill ${paybillNumber}, Acc: ${accountNumber}.`;
}

export function subscriptionSuspendedSms(params: {
  agencyName: string;
  amount: number | string;
  daysOverdue: number;
}): string {
  const { agencyName, amount, daysOverdue } = params;
  return `PropFlow: ${agencyName}, your account has been SUSPENDED after ${daysOverdue} days of non-payment (KES ${amount} due). Contact support to reactivate: support@propflow.co.ke`;
}

export function subscriptionPaymentConfirmedSms(params: {
  agencyName: string;
  amount: number | string;
  paidThroughDate: string;
  method: string;
}): string {
  const { agencyName, amount, paidThroughDate, method } = params;
  return `PropFlow: Confirmed! ${agencyName}, your payment of KES ${amount} via ${method} has been received. Your subscription is active through ${paidThroughDate}. Thank you!`;
}

export function trialEndingSms(params: {
  agencyName: string;
  trialEndsDate: string;
  starterAmount: number | string;
}): string {
  const { agencyName, trialEndsDate, starterAmount } = params;
  return `PropFlow: Hi ${agencyName}, your free trial ends on ${trialEndsDate}. Upgrade to Starter (KES ${starterAmount}/mo) to keep your account active. Log in to subscribe.`;
}

export interface RefundConfirmationSmsParams {
  tenantName: string;
  amount: number | string;
  reason?: string;
  buildingName?: string;
}

export function refundConfirmationSms(params: RefundConfirmationSmsParams): string {
  const { tenantName, amount, buildingName } = params;
  const firstName = tenantName.split(" ")[0];
  const amountStr = typeof amount === "number" ? amount.toFixed(2) : amount;

  return (
    `Hi ${firstName}, a refund of KES ${amountStr} has been sent to your M-Pesa` +
    `${buildingName ? ` for ${buildingName}` : ""}. ` +
    `You should receive it shortly. Contact your property manager with any questions. - PropFlow`
  );
}