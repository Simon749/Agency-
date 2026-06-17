// app/providers.tsx
"use client";

import { useState, useEffect } from "react";
import { TRPCProvider } from "@/app/providers/trpc";
import Preloader from "@/app/sections/Preloader";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preloaderDone, setPreloaderDone] = useState(false);

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem("propflow_preloader_played");
    if (hasPlayed === "true") {
      setPreloaderDone(true);
    }
  }, []);

  return (
    <TRPCProvider>
      {!preloaderDone && (
        <Preloader onDone={() => setPreloaderDone(true)} />
      )}
      {preloaderDone && children}
    </TRPCProvider>
  );
}