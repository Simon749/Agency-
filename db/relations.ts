import { relations } from "drizzle-orm";
import {
  agencies,
  buildings,
  buildingUtilities,
  units,
  tenants,
  leases,
  tenantLedger,
  utilityReadings,
  pendingTransactions,
  complaints,
  complaintUpdates,
} from "./schema";

export const agenciesRelations = relations(agencies, ({ many }) => ({
  buildings: many(buildings),
}));

export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  agency: one(agencies, {
    fields: [buildings.agencyId],
    references: [agencies.id],
  }),
  utilities: many(buildingUtilities),
  units: many(units),
}));

export const buildingUtilitiesRelations = relations(
  buildingUtilities,
  ({ one }) => ({
    building: one(buildings, {
      fields: [buildingUtilities.buildingId],
      references: [buildings.id],
    }),
  }),
);

export const unitsRelations = relations(units, ({ one, many }) => ({
  building: one(buildings, {
    fields: [units.buildingId],
    references: [buildings.id],
  }),
  tenants: many(tenants),
  leases: many(leases),
  utilityReadings: many(utilityReadings),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  building: one(buildings, {
    fields: [tenants.buildingId],
    references: [buildings.id],
  }),
  unit: one(units, {
    fields: [tenants.unitId],
    references: [units.id],
  }),
  leases: many(leases),
  ledgerEntries: many(tenantLedger),
  utilityReadings: many(utilityReadings),
  complaints: many(complaints),
  pendingTransactions: many(pendingTransactions),
}));

export const leasesRelations = relations(leases, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leases.tenantId],
    references: [tenants.id],
  }),
  unit: one(units, {
    fields: [leases.unitId],
    references: [units.id],
  }),
}));

export const tenantLedgerRelations = relations(tenantLedger, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantLedger.tenantId],
    references: [tenants.id],
  }),
}));

export const utilityReadingsRelations = relations(
  utilityReadings,
  ({ one }) => ({
    unit: one(units, {
      fields: [utilityReadings.unitId],
      references: [units.id],
    }),
  }),
);

export const pendingTransactionsRelations = relations(
  pendingTransactions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [pendingTransactions.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const complaintsRelations = relations(complaints, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [complaints.tenantId],
    references: [tenants.id],
  }),
  updates: many(complaintUpdates),
}));

export const complaintUpdatesRelations = relations(
  complaintUpdates,
  ({ one }) => ({
    complaint: one(complaints, {
      fields: [complaintUpdates.complaintId],
      references: [complaints.id],
    }),
  }),
);