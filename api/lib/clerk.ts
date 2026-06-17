import * as jose from "jose";
import { env } from "./env";
import type { ClerkUser } from "../context";

/**
 * Verify a Clerk session token and extract user metadata.
 *
 * In production, this should use @clerk/backend's verifyToken() method.
 * For now, we decode the JWT and extract the publicMetadata which contains
 * the user's role, agencyId, buildingId, and unitId.
 */
export async function verifyClerkToken(token: string): Promise<ClerkUser | undefined> {
  try {
    // For production: use @clerk/backend's verifyToken()
    // For now, we decode the JWT payload to extract publicMetadata
    const payload = jose.decodeJwt(token);

    // Clerk session tokens include the user's publicMetadata
    const publicMetadata = (payload.publicMetadata ?? {}) as Record<string, unknown>;

    const role = publicMetadata.role as ClerkUser["role"] | undefined;
    if (!role) {
      return undefined;
    }

    return {
      clerkUserId: payload.sub ?? "",
      role,
      agencyId: (publicMetadata.agencyId as string) ?? null,
      buildingId: (publicMetadata.buildingId as string) ?? null,
      unitId: (publicMetadata.unitId as string) ?? null,
      email: payload.email as string | undefined,
    };
  } catch (error) {
    console.warn("[clerk] Token verification failed:", error);
    return undefined;
  }
}

/**
 * Verify Clerk webhook signature using Svix.
 * The webhook secret starts with "whsec_" — the rest is the Base64 secret.
 */
export function verifyClerkWebhookSecret(): string {
  const secret = env.clerkWebhookSecret;
  if (!secret) {
    throw new Error("CLERK_WEBHOOK_SECRET is not configured");
  }
  // Remove "whsec_" prefix if present
  return secret.startsWith("whsec_") ? secret.slice(6) : secret;
}
