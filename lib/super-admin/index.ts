// lib/super-admin/index.ts
// Barrel export for Super Admin utilities.

export {
  getSystemMetrics,
  getAgencyList,
  toggleAgencyStatus,
  getAgencySubscription,
  getOverdueAgencies,
} from "./queries";

export type {
  SystemMetrics,
  AgencyListItem,
} from "./queries";

export {
  toggleAgencyStatus as toggleAgencyStatusAction,
  createAgencyAndInviteOwner,
  recordSubscriptionPayment,
  updateAgencyPlan,
} from "./actions";

export type { CreateAgencyResult } from "./actions";