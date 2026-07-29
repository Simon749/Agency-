

"use client";

import { useState, useEffect } from "react";

export default function Preloader({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"enter" | "exit" | "done">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("exit"), 2000);
    const t2 = setTimeout(() => onDone(), 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  if (phase === "done") return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: phase === "exit" ? 0 : 1,
        transition: "opacity 0.5s ease",
        pointerEvents: phase === "exit" ? "none" : "auto",
      }}
    >
      <span
        style={{
          fontSize: 'clamp(32px, 8vw, 80px)',
          fontWeight: 500,
          letterSpacing: '-0.04em',
          color: '#ffffff',
          transform: phase === 'exit' ? 'translateY(40px)' : 'translateY(0)',
          opacity: phase === 'exit' ? 0 : 1,
          transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s ease',
        }}
      >
        PROPFLOW
      </span>
    </div>
  );
}