'use client';

// app/(admin)/admin/tenants/new/invite-form.tsx
import { useState } from 'react';
import { inviteTenant } from './actions';

type Building = { id: string; name: string };
type VacantUnit = {
  id: string;
  buildingId: string;
  unitNumber: string;
  type: string | null;
  rentAmount: string;
  depositAmount: string;
};

export function InviteTenantForm({
  buildings,
  vacantUnits,
  agencyId,
}: {
  buildings: Building[];
  vacantUnits: VacantUnit[];
  agencyId: string;
}) {
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [duration, setDuration] = useState('12');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const unitsForBuilding = vacantUnits.filter((u) => u.buildingId === selectedBuildingId);
  const selectedUnit = vacantUnits.find((u) => u.id === selectedUnitId);

  // Auto-calculate end date
  const today = new Date().toISOString().split('T')[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    setSuccess('');

    const form = e.currentTarget;
    const data = new FormData(form);

    const result = await inviteTenant(data);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess('Tenant invited successfully. Invite email has been sent.');
      form.reset();
      setSelectedBuildingId('');
      setSelectedUnitId('');
    }
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '800px' }}>
      <input type="hidden" name="agencyId" value={agencyId} />

      {/* Section: Tenant Details */}
      <SectionLabel>Tenant Details</SectionLabel>
      <div style={gridStyle}>
        <FormField name="fullName" label="Full Name" placeholder="e.g. Jane Wanjiru" required />
        <FormField name="phone" label="Phone Number" placeholder="+254 700 000 000" type="tel" required />
        <FormField name="email" label="Email Address" placeholder="jane@example.com" type="email" required />
        <FormField name="nationalId" label="National ID" placeholder="e.g. 12345678" />
      </div>

      {/* Section: Unit Assignment */}
      <SectionLabel>Unit Assignment</SectionLabel>
      <div style={gridStyle}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Building</span>
          <select
            name="buildingId"
            required
            value={selectedBuildingId}
            onChange={(e) => {
              setSelectedBuildingId(e.target.value);
              setSelectedUnitId('');
            }}
            style={inputStyle}
          >
            <option value="">Select a building</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>Vacant Unit</span>
          <select
            name="unitId"
            required
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            style={inputStyle}
            disabled={!selectedBuildingId}
          >
            <option value="">
              {!selectedBuildingId
                ? 'Select a building first'
                : unitsForBuilding.length === 0
                ? 'No vacant units'
                : 'Select a unit'}
            </option>
            {unitsForBuilding.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitNumber}{u.type ? ` — ${u.type}` : ''} (KES {Number(u.rentAmount).toLocaleString('en-KE')}/mo)
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Section: Lease Terms */}
      <SectionLabel>Lease Terms</SectionLabel>
      <div style={gridStyle}>
        <FormField
          name="startDate"
          label="Lease Start Date"
          placeholder=""
          type="date"
          defaultValue={today}
          required
        />

        <label style={labelStyle}>
          <span style={labelTextStyle}>Duration</span>
          <select
            name="duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={inputStyle}
          >
            <option value="6">6 Months</option>
            <option value="12">1 Year</option>
            <option value="24">2 Years</option>
          </select>
        </label>

        <FormField
          name="rentAmount"
          label="Monthly Rent (KES)"
          placeholder="e.g. 25000"
          type="number"
          defaultValue={selectedUnit?.rentAmount ?? ''}
          required
        />
        <FormField
          name="depositAmount"
          label="Deposit Amount (KES)"
          placeholder="e.g. 50000"
          type="number"
          defaultValue={selectedUnit?.depositAmount ?? ''}
          required
        />
      </div>

      {/* Feedback */}
      {error && (
        <p style={{ fontSize: '13px', color: '#f87171', marginBottom: '24px', padding: '12px 16px', border: '1px solid rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.05)' }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ fontSize: '13px', color: '#4ade80', marginBottom: '24px', padding: '12px 16px', border: '1px solid rgba(74,222,128,0.3)', backgroundColor: 'rgba(74,222,128,0.05)' }}>
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          padding: '14px 36px', fontSize: '12px', fontWeight: 500, letterSpacing: '0.16em',
          color: '#0b0b0b', backgroundColor: pending ? 'rgba(255,255,255,0.5)' : '#ffffff',
          border: '1px solid #ffffff', cursor: pending ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase', fontFamily: '"Helvetica Neue", sans-serif',
        }}
      >
        {pending ? 'Sending Invite...' : 'Add Tenant & Send Invite'}
      </button>
    </form>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginTop: '40px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      {children}
    </p>
  );
}

function FormField({
  name, label, placeholder, type = 'text', required, defaultValue,
}: {
  name: string; label: string; placeholder: string;
  type?: string; required?: boolean; defaultValue?: string;
}) {
  return (
    <label style={labelStyle}>
      <span style={labelTextStyle}>{label}</span>
      <input
        type={type} name={name} placeholder={placeholder}
        required={required} defaultValue={defaultValue}
        style={{ ...inputStyle, colorScheme: 'dark' }}
      />
    </label>
  );
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '20px',
  marginBottom: '8px',
};

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '6px',
};

const labelTextStyle: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.18em',
  color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  padding: '12px 0', fontSize: '14px', backgroundColor: 'transparent',
  color: '#ffffff', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.25)',
  outline: 'none', fontFamily: '"Helvetica Neue", sans-serif', letterSpacing: '0.01em',
  width: '100%',
};