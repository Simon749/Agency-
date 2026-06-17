// Route paths for PropFlow
export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";

// Role-based dashboard routes
export const ROUTES = {
  superAdmin: "/super-admin/dashboard",
  agencyOwner: "/admin/dashboard",
  manager: "/admin/dashboard",
  fieldAgent: "/admin/agent/meter-readings",
  tenant: "/tenant/dashboard",
} as const;
