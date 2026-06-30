"use client";
import { useClerk } from "@clerk/nextjs";
import { useRef, useState } from "react";

export default function SignOutCTA({ redirectTo = "/sign-in" }: { redirectTo?: string }) {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const settledRef = useRef(false);

  const forceRedirect = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    // Hard navigation, not router.push — guarantees middleware re-evaluates
    // the session from scratch even if Clerk's client-side state is stuck.
    window.location.href = redirectTo;
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    settledRef.current = false;

    // Safety net: if signOut() hasn't resolved within 4s (e.g. a browser
    // extension is blocking Clerk's network call or cookie access), force
    // the redirect anyway instead of leaving the button stuck forever.
    const timeoutId = setTimeout(forceRedirect, 4000);

    try {
      await signOut();
      clearTimeout(timeoutId);
      forceRedirect();
    } catch (err) {
      console.error("[SignOutCTA] signOut failed:", err);
      clearTimeout(timeoutId);
      forceRedirect();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={isSigningOut}
      style={{
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.14em",
        color: "rgba(255,255,255,0.6)",
        backgroundColor: "transparent",
        border: "1px solid rgba(255,255,255,0.2)",
        padding: "8px 16px",
        cursor: isSigningOut ? "default" : "pointer",
        opacity: isSigningOut ? 0.5 : 1,
        textTransform: "uppercase",
        fontFamily: '"Helvetica Neue", sans-serif',
      }}
    >
      {isSigningOut ? "Signing Out..." : "Sign Out"}
    </button>
  );
}