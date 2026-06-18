// lib/staff/index.ts
// Barrel export for staff utilities.

export {
  getStaffByAgency,
  getStaffById,
  getStaffByClerkId,
  insertStaff,
  deactivateStaff,
  reactivateStaff,
  updateStaffBuildings,
} from "./queries";

export type { StaffListItem } from "./queries";

export {
  inviteStaff,
  deactivateStaffAction,
  reactivateStaffAction,
  updateStaffBuildingsAction,
} from "./actions";