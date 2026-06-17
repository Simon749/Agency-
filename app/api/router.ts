// api/router.ts
import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

const appRouter = router({
  health: publicProcedure.query(() => "ok"),
});

export type AppRouter = typeof appRouter;
export { appRouter };