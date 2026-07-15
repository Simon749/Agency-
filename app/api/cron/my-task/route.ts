// app/api/cron/my-task/route.ts
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

async function handler(req: Request) {
  // your actual task logic here
  return new Response("OK");
}

export const POST = verifySignatureAppRouter(handler);