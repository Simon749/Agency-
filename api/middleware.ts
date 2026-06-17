import { ErrorMessages } from "@/contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

function requireRole(...roles: string[]) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || !roles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

// ── Procedure Types ────────────────────────────────────────────────

/** Any authenticated user */
export const authedQuery = t.procedure.use(requireAuth);

/** Super Admin only */
export const superAdminQuery = authedQuery.use(requireRole("SUPER_ADMIN"));

/** Agency Owner or above */
export const agencyOwnerQuery = authedQuery.use(requireRole("SUPER_ADMIN", "AGENCY_OWNER"));

/** Manager or above (Owner, Manager, Super Admin) */
export const managerQuery = authedQuery.use(
  requireRole("SUPER_ADMIN", "AGENCY_OWNER", "MANAGER"),
);

/** Any agency staff (Owner, Manager, Field Agent) */
export const staffQuery = authedQuery.use(
  requireRole("SUPER_ADMIN", "AGENCY_OWNER", "MANAGER", "FIELD_AGENT"),
);

/** Tenant only */
export const tenantQuery = authedQuery.use(requireRole("TENANT"));