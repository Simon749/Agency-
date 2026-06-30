"use client";

// app/pending-setup/page.tsx
// Shown to staff users (AGENCY_OWNER, MANAGER, FIELD_AGENT) when they have
// no agencyId in their Clerk metadata.
//
// SUPER_ADMINs are auto-redirected to /super-admin/agencies.
// Uses SignOutCTA for consistent sign-out UX across the app.

import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import SignOutCTA from "@/components/auth/SignOutCTA";

export default function PendingSetupPage() {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const role = user?.publicMetadata?.role as string | undefined;

  // Auto-redirect SUPER_ADMIN on client side
  useEffect(() => {
    if (isLoaded && role === "SUPER_ADMIN") {
      router.replace("/super-admin/agencies");
    }
  }, [isLoaded, role, router]);

  // Show nothing while loading or redirecting
  if (!isLoaded || role === "SUPER_ADMIN") {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#0b0b0b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0b0b0b",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        color: "#ffffff",
        textAlign: "center",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          border: "2px solid #f59e0b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
          fontSize: "24px",
          color: "#f59e0b",
        }}
      >
        ⚡
      </div>

      {/* Heading */}
      <h1
        style={{
          fontSize: "clamp(24px, 3vw, 36px)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          marginBottom: "16px",
        }}
      >
        Agency Setup Pending
      </h1>

      {/* Subtext */}
      <p
        style={{
          fontSize: "15px",
          color: "rgba(255,255,255,0.45)",
          maxWidth: "420px",
          lineHeight: 1.6,
          marginBottom: "40px",
        }}
      >
        Your account has been created, but your agency profile is not yet
        configured. Please contact your platform administrator to complete
        the setup and link your account to an agency.
      </p>

      {/* Info Card */}
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "24px 32px",
          maxWidth: "420px",
          width: "100%",
          marginBottom: "24px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}
        >
          What to do
        </p>
        <p
          style={{
            fontSize: "13px",
            color: "rgba(255,255,255,0.6)",
            lineHeight: 1.6,
          }}
        >
          Reach out to your Super Admin or PropFlow support team. Provide
          your email address and role so they can link you to the correct
          agency.
        </p>
      </div>

      {/* Support Contact */}
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "20px 32px",
          maxWidth: "420px",
          width: "100%",
          marginBottom: "24px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            marginBottom: "16px",
          }}
        >
          Support
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <a
            href="mailto:support@propflow.co.ke"
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.6)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span>✉</span> support@propflow.co.ke
          </a>
          <a
            href="tel:+254700000000"
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.6)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span>☎</span> +254 700 000 000
          </a>
        </div>
      </div>

      {/* Sign Out — Uses your existing SignOutCTA component */}
      <div style={{ marginTop: "8px" }}>
        <SignOutCTA />
      </div>

      {/* Debug Info (remove in production) */}
      {userId && (
        <div
          style={{
            marginTop: "32px",
            padding: "12px 16px",
            border: "1px dashed rgba(255,255,255,0.08)",
            maxWidth: "420px",
            width: "100%",
          }}
        >
          <p
            style={{
              fontSize: "10px",
              color: "rgba(255,255,255,0.2)",
              fontFamily: "monospace",
              textAlign: "left",
            }}
          >
            Debug: userId={userId.slice(0, 8)}... | role={role ?? "none"}
            <br />
            If you are a Super Admin, you should have been redirected.
          </p>
        </div>
      )}

      {/* Footer */}
      <p
        style={{
          marginTop: "40px",
          fontSize: "11px",
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.25)",
          textTransform: "uppercase",
        }}
      >
        PropFlow Kenya
      </p>
    </div>
  );
}