import { useCallback, useMemo } from "react";

/**
 * Clerk-compatible auth hook.
 *
 * This is a stub that reads the Clerk session token from localStorage.
 * When you integrate @clerk/clerk-react, replace this with useAuth() from Clerk.
 *
 * Usage:
 *   const { user, isAuthenticated, isLoading, logout } = useAuth();
 */

export type AuthUser = {
  clerkUserId: string;
  role: "SUPER_ADMIN" | "AGENCY_OWNER" | "MANAGER" | "FIELD_AGENT" | "TENANT";
  agencyId: string | null;
  buildingId: string | null;
  unitId: string | null;
  email?: string;
};

export function useAuth() {
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem("clerk_session_token") 
    : null;

  // Decode JWT payload without verification (for UI use only)
  const user = useMemo((): AuthUser | null => {
    if (!token) return null;
    try {
      const payload = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
      );
      const metadata = (payload.publicMetadata ?? {}) as Record<string, unknown>;
      return {
        clerkUserId: payload.sub ?? "",
        role: (metadata.role as AuthUser["role"]) ?? "TENANT",
        agencyId: (metadata.agencyId as string) ?? null,
        buildingId: (metadata.buildingId as string) ?? null,
        unitId: (metadata.unitId as string) ?? null,
        email: payload.email as string | undefined,
      };
    } catch {
      return null;
    }
  }, [token]);

  const logout = useCallback(() => {
    localStorage.removeItem("clerk_session_token");
    window.location.reload();
  }, []);

  const setToken = useCallback((newToken: string) => {
    localStorage.setItem("clerk_session_token", newToken);
    window.location.reload();
  }, []);

  return useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      isSignedIn: !!user,
      logout,
      setToken,
    }),
    [user, logout, setToken]
  );
}
