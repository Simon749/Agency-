// lib/ledger/index.ts
// Re-export all ledger functions for clean imports
// PHASE 2: Added getTenantBalanceForMonth, getLedgerEntriesPaginated

export { getTenantBalance, getTenantBalanceForMonth, type BalanceResult } from "./getBalance";
export {
  getTenantStatement,
  getRecentLedgerEntries,
  getLedgerEntriesPaginated,
  type StatementRow,
  type MonthlyGroup,
} from "./getStatement";

// Keep existing Week 5 functions for backwards compatibility
export {
  insertPaymentCredit,
  getPendingTransaction,
  updatePendingTransaction,
} from "./payments";

// Manual payments
export {
  logManualPayment,
  checkReferenceCodeExists,
  type ManualPaymentInput,
  type ManualPaymentResult,
} from "./manualPayments";

// Utility billing
export {
  getLastReading,
  submitMeterReading,
  getReadingHistory,
  type MeterReadingInput,
  type MeterReadingResult,
} from "./utilityBilling";