// app/providers/trpc.tsx
// tRPC removed — using Next.js Server Actions + Drizzle instead
import type { ReactNode } from "react";

export function TRPCProvider({ children }: { children: ReactNode }) {
  // No-op wrapper — tRPC removed from project
  return <>{children}</>;
}