// db/schema/index.ts
// Single import point for all PropFlow table definitions and types.
// Usage: import { agencies, tenants, ... } from "@/db/schema"

export * from "./enums";
export * from "./agencies";
export * from "./buildings";
export * from "./buildingutilities";
export * from "./units";
export * from "./tenants";
export * from "./leases";
export * from "./tenant_ledger";
export * from "./utility_readings";
export * from "./pending_transactions";
export * from "./complaints";
export * from "./staff";