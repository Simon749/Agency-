// db/schema/index.ts
// Single import point for all PropFlow table definitions and types.
// Usage: import { agencies, tenants, ... } from "@/db/schema"

export * from "./enums.ts";
export * from "./agencies.ts";
export * from "./buildings.ts";
export * from "./buildingutilities.ts";
export * from "./units.ts";
export * from "./tenants.ts";
export * from "./leases.ts";
export * from "./tenant_ledger.ts";
export * from "./utility_readings.ts";
export * from "./pending_transactions.ts";
export * from "./complaints.ts";       
export * from "./notifications.ts";
export { staff } from "./staff.ts";
export type { Staff, InsertStaff } from "./staff.ts";