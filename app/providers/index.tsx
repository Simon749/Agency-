// app/providers/index.tsx
import { TRPCProvider } from "./trpc";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <TRPCProvider>{children}</TRPCProvider>;
}