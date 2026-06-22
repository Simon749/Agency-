// lib/super-admin/index.ts
// Barrel export for Super Admin utilities.

export {
  getSystemMetrics,
  getAgencyList,
  toggleAgencyStatus,
} from "./queries";

export type {
  SystemMetrics,
  AgencyListItem,
} from "./queries";

export {
  toggleAgencyStatus as toggleAgencyStatusAction,
  createAgencyAndInviteOwner,
} from "./actions";

export type { CreateAgencyResult } from "./actions";