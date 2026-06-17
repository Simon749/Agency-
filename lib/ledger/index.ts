// lib/ledger/index.ts
// Re-export all ledger functions for clean imports

export { getTenantBalance, type BalanceResult } from "./getBalance";
export {
  getTenantStatement,
  getRecentLedgerEntries,
  type StatementRow,
  type MonthlyGroup,
} from "./getStatement";

// Keep existing Week 5 functions for backwards compatibility
export {
  insertPaymentCredit,
  getPendingTransaction,
  updatePendingTransaction,
} from "./payments";