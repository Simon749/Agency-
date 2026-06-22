import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: '48px' }}>
        <Skeleton className="h-3 w-24 mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <Skeleton className="h-10 w-64" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* KPI Cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2px', marginBottom: '56px' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '28px 24px' }}>
            <Skeleton className="h-3 w-32 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <Skeleton className="h-8 w-40 mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <Skeleton className="h-3 w-24" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-3 w-20" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
            <Skeleton className="h-4 w-32" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <Skeleton className="h-4 w-20" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <Skeleton className="h-4 w-24" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <Skeleton className="h-4 w-16" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <Skeleton className="h-4 w-20" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <Skeleton className="h-8 w-16" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}