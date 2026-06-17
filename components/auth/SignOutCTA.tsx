"use client";
import { SignOutButton } from "@clerk/nextjs";

export default function SignOutCTA() {
  return (
    <SignOutButton>
      <button
        style={{
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.6)",
          backgroundColor: "transparent",
          border: "1px solid rgba(255,255,255,0.2)",
          padding: "8px 16px",
          cursor: "pointer",
          textTransform: "uppercase",
          fontFamily: '"Helvetica Neue", sans-serif',
        }}
      >
        Sign Out
      </button>
    </SignOutButton>
  );
}