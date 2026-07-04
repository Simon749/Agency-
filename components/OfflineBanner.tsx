// components/OfflineBanner.tsx
// PHASE 7: Shows when offline, displays unsynced count, manual sync button.

"use client";

import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";

export function OfflineBanner() {
  const { isOnline, unsyncedCount, isSyncing, lastSyncResult, triggerSync } = useOnlineStatus();

  if (isOnline && unsyncedCount === 0) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-between gap-4 ${
        isOnline ? "bg-green-950/90 border-t border-green-500/30" : "bg-red-950/90 border-t border-red-500/30"
      }`}
      style={{ backdropFilter: "blur(8px)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg shrink-0">{isOnline ? "📡" : "📵"}</span>
        <div className="min-w-0">
          <p className={`text-sm font-medium ${isOnline ? "text-green-400" : "text-red-400"}`}>
            {isOnline ? "Back Online" : "You're Offline"}
          </p>
          {unsyncedCount > 0 && (
            <p className="text-xs text-white/55 truncate">
              {unsyncedCount} {unsyncedCount === 1 ? "item" : "items"} waiting to sync
              {lastSyncResult && (
                <span className="ml-2">
                  (Last: {lastSyncResult.success} ok{lastSyncResult.failed > 0 ? `, ${lastSyncResult.failed} failed` : ""})
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {isOnline && unsyncedCount > 0 && (
        <button
          onClick={triggerSync}
          disabled={isSyncing}
          className="shrink-0 px-4 py-2 text-xs tracking-widest uppercase bg-white text-black hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSyncing ? "Syncing..." : "Sync Now"}
        </button>
      )}
    </div>
  );
}