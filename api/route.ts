import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  // TODO: Add agency router
  // TODO: Add building router
  // TODO: Add unit router
  // TODO: Add tenant router
  // TODO: Add lease router
  // TODO: Add ledger router
  // TODO: Add complaint router
});

export type AppRouter = typeof appRouter;