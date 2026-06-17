import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { verifyClerkToken } from "./lib/clerk";

export type ClerkUser = {
  clerkUserId: string;
  role: "SUPER_ADMIN" | "AGENCY_OWNER" | "MANAGER" | "FIELD_AGENT" | "TENANT";
  agencyId: string | null;
  buildingId: string | null;
  unitId: string | null;
  email?: string;
};

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: ClerkUser;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };

  try {
    const token = opts.req.headers.get("x-clerk-session-token");
    if (token) {
      ctx.user = await verifyClerkToken(token);
    }
  } catch {
    // Authentication is optional here
  }

  return ctx;
}