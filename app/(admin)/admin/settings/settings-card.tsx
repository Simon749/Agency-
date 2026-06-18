'use client';

import Link from 'next/link';

export function SettingsCard({
  href,
  tag,
  label,
  description,
}: {
  href: string;
  tag: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '28px 24px',
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        textDecoration: 'none',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
          {tag}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17L17 7" />
          <path d="M7 7h10v10" />
        </svg>
      </div>

      <span style={{ fontSize: '16px', fontWeight: 500, color: '#ffffff', letterSpacing: '-0.01em' }}>
        {label}
      </span>

      <span style={{ fontSize: '13px', lineHeight: 1.5, color: 'rgba(255,255,255,0.4)' }}>
        {description}
      </span>
    </Link>
  );
}