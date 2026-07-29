// app/providers.tsx
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { TRPCProvider } from "@/app/providers/trpc";

const Preloader = dynamic(() => import("@/app/sections/Preloader"), {
  ssr: false,
  loading: () => null,
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [showPreloader, setShowPreloader] = useState(false);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem("propflow_preloader_played");
    if (hasPlayed !== "true") {
      setShowPreloader(true);
    }
  }, []);

  return (
    <TRPCProvider>
      {children}
      {showPreloader && (
        <Preloader onDone={() => {
          sessionStorage.setItem("propflow_preloader_played", "true");
          setShowPreloader(false);
        }} />
      )}
    </TRPCProvider>
  );
}