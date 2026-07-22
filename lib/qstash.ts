import { Client, Receiver } from "@upstash/qstash";

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export const QUEUES = {
  BILLING: "billing-queue",
  CALLBACKS: "callback-queue",
  SMS: "sms-queue",
} as const;

interface PublishOptions<T> {
  queue?: string;
  url: string;
  body: T;
  headers?: Record<string, string>;
  retries?: number;
  delay?: number; // seconds
  deduplicationId?: string;
}

export async function publishMessage<T>(opts: PublishOptions<T>) {
  return qstash.publishJSON({
    url: opts.url,
    body: opts.body,
    queue: opts.queue,
    headers: opts.headers,
    retries: opts.retries ?? 3,
    delay: opts.delay, // number of seconds; do not make `${delay}s`
    deduplicationId: opts.deduplicationId,
  });
}

interface BatchMessage<T> {
  queue?: string;
  url: string;
  body: T;
  headers?: Record<string, string>;
  retries?: number;
  delay?: number;
  deduplicationId?: string;
}

export async function publishBatch<T>(messages: BatchMessage<T>[]) {
  return qstash.batchJSON(
    messages.map((m) => ({
      url: m.url,
      body: m.body,
      queue: m.queue,
      headers: m.headers,
      retries: m.retries ?? 3,
      delay: m.delay,
      deduplicationId: m.deduplicationId,
    }))
  );
}

export async function verifyQStashSignature(
  req: Request,
  body: string
): Promise<boolean> {
  const signature = req.headers.get("upstash-signature");
  if (!signature) return false;

  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });

  try {
    await receiver.verify({
      signature,
      body,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/bill-building`,
    });
    return true;
  } catch {
    return false;
  }
}