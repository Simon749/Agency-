import { Skeleton } from "@/components/ui/skeleton";

export default function SuperAdminLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: '48px' }}>
        <Skeleton className="h-3 w-32 mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <Skeleton className="h-10 w-72" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* KPI Cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2px', marginBottom: '56px' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '28px 24px' }}>
            <Skeleton className="h-3 w-32 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <Skeleton className="h-8 w-32 mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <Skeleton className="h-3 w-24" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}