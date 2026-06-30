// app/api/auth/sign-out/route.ts
// Server-side sign-out handler.
// Redirects to Clerk's built-in sign-out endpoint.

import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const redirectTo = searchParams.get("redirect") || "/sign-in";

  // Redirect to Clerk's sign-out URL, which clears the session
  // and then redirects to the specified page
  const signOutUrl = new URL("/sign-out", req.url);
  signOutUrl.searchParams.set("redirect_url", redirectTo);

  redirect(signOutUrl.toString());
}