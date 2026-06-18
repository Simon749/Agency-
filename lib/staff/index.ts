// lib/staff/index.ts
// Barrel export for staff utilities.

export {
  getStaffByAgency,
  getStaffByClerkId,
  insertStaff,
  deactivateStaff,
  reactivateStaff,
  updateStaffBuildings,
} from "@/lib/staff/queries";

export type { StaffListItem } from "@/lib/staff/queries";

export {
  inviteStaff,
  deactivateStaffAction,
  reactivateStaffAction,
  updateStaffBuildingsAction,
} from "@/lib/staff/actions";