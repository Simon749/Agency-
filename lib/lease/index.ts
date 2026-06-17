// lib/lease/index.ts
// Re-export all lease functions

export {
  generateLease,
  defaultLeaseTemplate,
  placeholderList,
  type LeaseData,
} from "./generateLease";

export {
  generateLeaseForTenant,
  signLease,
  getLeaseStatus,
  createRenewalLease,
  type LeaseStatusResult,
  type RenewalResult,
} from "./leaseActions";