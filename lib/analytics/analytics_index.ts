// lib/analytics/index.ts
// Barrel export for all analytics queries and types.

export {
  getDashboardSummary,
  getBuildingBreakdown,
  getRecentPayments,
  getArrearsReport,
  getOccupancyHistory,
} from "./queries";

export type {
  DashboardSummary,
  BuildingBreakdown,
  RecentPayment,
  ArrearsTenant,
  DateRange,
} from "./queries";