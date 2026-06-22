import { Skeleton } from "@/components/ui/skeleton";

export default function TenantLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: '32px' }}>
        <Skeleton className="h-3 w-24 mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <Skeleton className="h-8 w-48" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* Balance cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '32px' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '24px' }}>
            <Skeleton className="h-3 w-28 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <Skeleton className="h-10 w-32" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
          </div>
        ))}
      </div>

      {/* Recent activity skeleton */}
      <div>
        <Skeleton className="h-3 w-32 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Skeleton className="h-6 w-16" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
                <div>
                  <Skeleton className="h-4 w-40 mb-1" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
                  <Skeleton className="h-3 w-24" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
                </div>
              </div>
              <Skeleton className="h-4 w-20" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}