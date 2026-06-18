// app/(admin)/admin/settings/page.tsx
import { getSessionMeta, requireRole } from '@/lib/auth/getRole';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = {
  title: 'Settings — PropFlow',
};

export default async function SettingsPage() {
  await requireRole(['AGENCY_OWNER']);
  const session = await getSessionMeta();
  const agencyId = session.agencyId;

  if (!agencyId) redirect('/pending-setup');

  const settingsCards = [
    {
      href: '/admin/settings/staff',
      label: 'Staff Management',
      description: 'Invite managers and field agents. Manage roles and building assignments.',
      tag: 'Team',
    },
    {
      href: '/admin/settings/daraja',
      label: 'M-Pesa (Daraja)',
      description: 'Configure Safaricom Daraja API credentials per building for STK Push and Paybill.',
      tag: 'Payments',
    },
    {
      href: '/admin/settings/utilities',
      label: 'Utility Rates',
      description: 'Set fixed or per-unit rates for water, electricity, garbage, WiFi, and service charges.',
      tag: 'Billing',
    },
    {
      href: '/admin/settings/lease-template',
      label: 'Lease Templates',
      description: 'Manage tenancy agreement templates per building with Markdown and placeholders.',
      tag: 'Legal',
    },
  ];

  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Agency Settings
      </p>
      <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: '48px', color: '#ffffff' }}>
        Settings
      </h1>

      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '48px', maxWidth: '600px', lineHeight: 1.6 }}>
        Manage your agency configuration, team access, payment integrations, and lease templates. All changes are scoped to your agency.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2px' }}>
        {settingsCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="settings-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="settings-card__tag">{card.tag}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 17L17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </div>

            <span className="settings-card__label">{card.label}</span>
            <span className="settings-card__desc">{card.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}