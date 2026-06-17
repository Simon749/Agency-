export const Session = {
  cookieName: "propflow_session",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
  noAgency: "No agency assigned to user",
} as const;

export const Paths = {
  login: "/sign-in",
} as const;

export const ClerkMetadataShape = {
  role: ["SUPER_ADMIN", "AGENCY_OWNER", "MANAGER", "FIELD_AGENT", "TENANT"] as const,
} as const;
