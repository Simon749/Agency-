'use client';

// app/(super-admin)/agencies/_components/AddAgencyForm.tsx
// Form for Super Admin to create a new agency and send an invite to the owner.
// Mirrors the StaffInviteForm pattern exactly.

import { useState } from 'react';
import { createAgencyAndInviteOwner } from '@/lib/super-admin/actions';

export function AddAgencyForm() {
  const [pending, setPending] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [open, setOpen]       = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    setSuccess('');

    const form   = e.currentTarget;
    const data   = new FormData(form);
    const result = await createAgencyAndInviteOwner(data);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Agency created. Invite sent to the owner\'s email.');
      form.reset();
      // Collapse the form after success so the updated table is visible
      setTimeout(() => {
        setOpen(false);
        setSuccess('');
      }, 3000);
    }

    setPending(false);
  }

  return (
    <div style={{ marginBottom: '40px' }}>
      {/* Toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            fontSize: '12px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            padding: '13px 28px',
            border: '1px solid rgba(255,255,255,0.35)',
            backgroundColor: 'transparent',
            color: '#ffffff',
            cursor: 'pointer',
            fontFamily: '"Helvetica Neue", sans-serif',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.7)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.35)';
          }}
        >
          + Add New Agency
        </button>
      )}

      {/* Form panel */}
      {open && (
        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '32px',
          }}
        >
          {/* Form header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '28px',
            }}
          >
            <p
              style={{
                fontSize: '13px',
                color: '#ffffff',
                letterSpacing: '0.04em',
                margin: 0,
              }}
            >
              New Agency
            </p>
            <button
              onClick={() => {
                setOpen(false);
                setError('');
                setSuccess('');
              }}
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.4)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Cancel
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '28px',
            }}
          >
            {/* Agency Name */}
            <Field
              name="agencyName"
              label="Agency Name"
              placeholder="e.g. Nairobi Prime Properties"
            />

            {/* Agency Contact Email */}
            <Field
              name="agencyEmail"
              label="Agency Contact Email"
              placeholder="office@agency.co.ke"
              type="email"
            />

            {/* Phone */}
            <Field
              name="agencyPhone"
              label="Phone Number"
              placeholder="+254712345678"
              type="tel"
            />

            {/* Owner Email — separate from agency email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={labelStyle}>Owner's Email</span>
              <input
                type="email"
                name="ownerEmail"
                placeholder="owner@agency.co.ke"
                required
                style={inputStyle}
              />
              <span
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.06em',
                  marginTop: '2px',
                }}
              >
                Clerk invite will be sent here
              </span>
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="submit"
                disabled={pending}
                style={{
                  width: '100%',
                  padding: '13px 24px',
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.16em',
                  color: '#0b0b0b',
                  backgroundColor: pending ? 'rgba(255,255,255,0.5)' : '#ffffff',
                  border: '1px solid #ffffff',
                  cursor: pending ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                  fontFamily: '"Helvetica Neue", sans-serif',
                }}
              >
                {pending ? 'Creating...' : 'Create & Send Invite'}
              </button>
            </div>

            {/* Error / success feedback */}
            {(error || success) && (
              <div style={{ gridColumn: '1 / -1' }}>
                <p
                  style={{
                    fontSize: '13px',
                    color: error ? '#f87171' : '#4ade80',
                    margin: 0,
                  }}
                >
                  {error || success}
                </p>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

// ── Shared field component ─────────────────────────────────────────────────

function Field({
  name,
  label,
  placeholder,
  type = 'text',
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required
        style={inputStyle}
      />
    </label>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.18em',
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  padding: '12px 0',
  fontSize: '14px',
  backgroundColor: 'transparent',
  color: '#ffffff',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.25)',
  outline: 'none',
  fontFamily: '"Helvetica Neue", sans-serif',
};