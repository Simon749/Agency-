// app/suspended/page.tsx
// Shown to all agency staff and tenants when their agency is suspended.
// Public route — no auth required. Matches the dark theme.

export const metadata = {
  title: 'Account Suspended — PropFlow',
};

export default function SuspendedPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0b0b0b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: '"Helvetica Neue", sans-serif',
        color: '#ffffff',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '2px solid #f43f5e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
          fontSize: '24px',
          color: '#f43f5e',
        }}
      >
        ✕
      </div>

      <h1
        style={{
          fontSize: 'clamp(24px, 3vw, 36px)',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          marginBottom: '16px',
        }}
      >
        Account Suspended
      </h1>

      <p
        style={{
          fontSize: '15px',
          color: 'rgba(255,255,255,0.45)',
          maxWidth: '420px',
          lineHeight: 1.6,
          marginBottom: '40px',
        }}
      >
        Your agency has been temporarily suspended by the platform administrator.
        All access to buildings, tenants, payments, and reports is blocked until
        the suspension is lifted.
      </p>

      <div
        style={{
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '24px 32px',
          maxWidth: '420px',
          width: '100%',
        }}
      >
        <p
          style={{
            fontSize: '11px',
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.35)',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}
        >
          What to do
        </p>
        <p
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.6,
          }}
        >
          Contact your agency owner or PropFlow support to resolve the issue.
          If you believe this is an error, reach out to the platform administrator.
        </p>
      </div>

      <p
        style={{
          marginTop: '40px',
          fontSize: '11px',
          letterSpacing: '0.14em',
          color: 'rgba(255,255,255,0.25)',
          textTransform: 'uppercase',
        }}
      >
        PropFlow Kenya
      </p>
    </div>
  );
}