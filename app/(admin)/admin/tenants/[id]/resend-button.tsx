'use client';

// app/(admin)/admin/tenants/[id]/resend-button.tsx
import { useState } from 'react';
import { resendInvite } from '../new/actions';

export function ResendInviteButton({
  email,
  buildingId,
  unitId,
}: {
  email: string;
  buildingId: string;
  unitId: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  async function handleResend() {
    setPending(true);
    setMessage('');
    const data = new FormData();
    data.set('email', email);
    data.set('buildingId', buildingId);
    data.set('unitId', unitId);

    const result = await resendInvite(data);
    if (result?.error) {
      setIsError(true);
      setMessage(result.error);
    } else {
      setIsError(false);
      setMessage('Invite resent successfully.');
    }
    setPending(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
      <button
        onClick={handleResend}
        disabled={pending}
        style={{
          padding: '12px 28px', fontSize: '12px', fontWeight: 500, letterSpacing: '0.14em',
          color: pending ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)',
          backgroundColor: 'transparent',
          border: `1px solid ${pending ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.3)'}`,
          cursor: pending ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase', fontFamily: '"Helvetica Neue", sans-serif',
        }}
      >
        {pending ? 'Sending...' : 'Resend Invite Email'}
      </button>
      {message && (
        <span style={{ fontSize: '13px', color: isError ? '#f87171' : '#4ade80' }}>
          {message}
        </span>
      )}
    </div>
  );
}