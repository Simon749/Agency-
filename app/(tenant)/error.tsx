"use client";

import { useEffect } from "react";

export default function TenantError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("[Tenant Error Boundary]", error);
  }, [error]);

  return (
    <div style={{ padding: '40px 24px', maxWidth: '600px', margin: '0 auto' }}>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '16px' }}>
        Error
      </p>
      <h1 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 400, letterSpacing: '-0.02em', color: '#ffffff', marginBottom: '16px' }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '32px' }}>
        We encountered an error loading your portal. Try refreshing or contact your property manager if the problem persists.
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => reset()}
          style={{
            padding: '12px 24px',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0.14em',
            color: '#0b0b0b',
            backgroundColor: '#ffffff',
            border: '1px solid #ffffff',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          Try Again
        </button>
        <a
          href="/tenant/dashboard"
          style={{
            padding: '12px 24px',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0.14em',
            color: 'rgba(255,255,255,0.7)',
            backgroundColor: 'transparent',
            border: '1px solid rgba(255,255,255,0.25)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          My Dashboard
        </a>
      </div>
    </div>
  );
}