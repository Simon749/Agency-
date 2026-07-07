import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "SUPER_ADMIN",
  "AGENCY_OWNER",
  "MANAGER",
  "FIELD_AGENT",
  "TENANT",
]);

export const leaseStatusEnum = pgEnum("lease_status", [
  "ACTIVE",
  "PENDING_RENEWAL",
  "VACATED",
  "TERMINATED",
]);

export const entryTypeEnum = pgEnum("entry_type", ["DEBIT", "CREDIT"]);

export const categoryEnum = pgEnum("category", [
  "RENT",
  "WATER",
  "ELECTRICITY",
  "GARBAGE",
  "SERVICE_CHARGE",
  "WIFI",
  "SECURITY",
  "PREVIOUS_BALANCE",
  "DEPOSIT",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "MPESA_STK",
  "BANK_RECEIPT",
  "CASH",
  "SYSTEM",
]);

export const complaintStatusEnum = pgEnum("complaint_status", [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

export const complaintPriorityEnum = pgEnum("complaint_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REJECTED",
]);