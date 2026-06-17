// api/context.ts
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export function createContext(_opts: FetchCreateContextFnOptions) {
  return {};
}

export type Context = Awaited<ReturnType<typeof createContext>>;