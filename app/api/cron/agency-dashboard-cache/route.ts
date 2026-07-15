// app/api/cron/agency-dashboard-cache/route.ts
//
// This replaces whatever manual CRON_SECRET header check (if any) is
// currently in this file. QStash's signature verification is stronger
// than a static shared secret, because it's cryptographically signed
// per-request rather than a string that could leak once and be replayed
// forever.

import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

async function handler(req: Request) {
  // ... your existing agency-dashboard-cache logic goes here unchanged ...
  // e.g. recompute and store cached dashboard aggregates per agency

  return new Response("OK", { status: 200 });
}

// Wrapping the handler is what makes this route reject any request
// that isn't signed by QStash — including a random person curling
// your URL directly.
export const POST = verifySignatureAppRouter(handler);