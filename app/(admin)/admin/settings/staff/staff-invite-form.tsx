'use client';

// app/(admin)/admin/settings/staff/staff-invite-form.tsx
import { useState } from 'react';
import { inviteStaff } from './actions';

export function StaffInviteForm({ agencyId }: { agencyId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    setSuccess('');

    const form = e.currentTarget;
    const data = new FormData(form);
    const result = await inviteStaff(data);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess('Invite sent successfully.');
      form.reset();
    }
    setPending(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', maxWidth: '800px' }}
    >
      <input type="hidden" name="agencyId" value={agencyId} />

      <Field name="fullName" label="Full Name" placeholder="e.g. David Otieno" />
      <Field name="email" label="Email Address" placeholder="david@example.com" type="email" />

      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={labelTextStyle}>Role</span>
        <select name="role" required style={inputStyle}>
          <option value="">Select role</option>
          <option value="MANAGER">Manager</option>
          <option value="FIELD_AGENT">Field Agent</option>
        </select>
      </label>

      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            width: '100%', padding: '13px 24px', fontSize: '12px', fontWeight: 500,
            letterSpacing: '0.16em', color: '#0b0b0b',
            backgroundColor: pending ? 'rgba(255,255,255,0.5)' : '#ffffff',
            border: '1px solid #ffffff', cursor: pending ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', fontFamily: '"Helvetica Neue", sans-serif',
          }}
        >
          {pending ? 'Sending...' : 'Send Invite'}
        </button>
      </div>

      {(error || success) && (
        <div style={{ gridColumn: '1 / -1' }}>
          <p style={{ fontSize: '13px', color: error ? '#f87171' : '#4ade80', margin: 0 }}>
            {error || success}
          </p>
        </div>
      )}
    </form>
  );
}

function Field({ name, label, placeholder, type = 'text' }: {
  name: string; label: string; placeholder: string; type?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={labelTextStyle}>{label}</span>
      <input
        type={type} name={name} placeholder={placeholder} required
        style={inputStyle}
      />
    </label>
  );
}

const labelTextStyle: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.18em',
  color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  padding: '12px 0', fontSize: '14px', backgroundColor: 'transparent',
  color: '#ffffff', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.25)',
  outline: 'none', fontFamily: '"Helvetica Neue", sans-serif',
};