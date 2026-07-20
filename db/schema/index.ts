// db/schema/index.ts
// MERGE THIS INTO YOUR EXISTING index.ts
// Add these two lines to your current exports:

// export * from "./audit_log";
// export type { AuditLogEntry, InsertAuditLogEntry } from "./audit_log";

// Or replace your entire file with this if it matches your current structure:

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
export * from "./notifications";
export * from "./audit_log"; 
export * from "./ledgerAllocations";
export * from "./balanceSnapshots";         
export { staff } from "./staff";
export type { Staff, InsertStaff } from "./staff";
export type { AuditLogEntry, InsertAuditLogEntry } from "./audit_log";  // ← PHASE B: NEW