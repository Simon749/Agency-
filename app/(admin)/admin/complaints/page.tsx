// app/(admin)/admin/complaints/page.tsx
import { getSessionMeta } from '@/lib/auth/getRole';

export default async function ComplaintsPage() {
  await getSessionMeta();
  return (
    <div>
      <p style={{ fontSize: '11px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: '12px' }}>
        Complaint Tracking
      </p>
      <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: '48px', color: '#ffffff' }}>
        Complaints
      </h1>
      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
        Complaints system coming in Week 11. This page will show open tickets, priority levels, and resolution timelines.
      </p>
    </div>
  );
}
