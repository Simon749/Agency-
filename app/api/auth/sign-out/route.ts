// app/api/auth/sign-out/route.ts
// Server-side sign-out handler.
// Redirects to Clerk's built-in sign-out endpoint.
//
// SECURITY FIX (Phase 0 audit): `redirect` came from an unvalidated query
// param and was passed straight into the post-sign-out redirect target —
// an open-redirect vector (e.g. a crafted link that signs the user out
// then sends them to an external phishing page). Only internal paths are
// now accepted.

import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

function safeInternalPath(value: string | null): string {
  if (!value) return "/sign-in";
  // Must start with a single "/" — reject protocol-relative ("//evil.com")
  // and absolute URLs.
  if (!value.startsWith("/") || value.startsWith("//")) return "/sign-in";
  return value;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const redirectTo = safeInternalPath(searchParams.get("redirect"));

  // Redirect to Clerk's sign-out URL, which clears the session
  // and then redirects to the specified page
  const signOutUrl = new URL("/sign-out", req.url);
  signOutUrl.searchParams.set("redirect_url", redirectTo);

  redirect(signOutUrl.toString());
}