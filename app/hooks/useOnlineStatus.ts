// hooks/useOnlineStatus.ts
// PHASE 7: Detect online/offline status, show banner, auto-sync when back online.

"use client";

import { useState, useEffect, useCallback } from "react";
import { syncQueue } from "@/lib/offline/sync";
import { getQueueStats } from "@/lib/offline/queue";

interface OnlineStatus {
  isOnline: boolean;
  unsyncedCount: number;
  isSyncing: boolean;
  lastSyncResult: { success: number; failed: number } | null;
  triggerSync: () => Promise<void>;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ success: number; failed: number } | null>(null);

  const updateStats = useCallback(async () => {
    const stats = await getQueueStats();
    setUnsyncedCount(stats.unsynced);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncQueue();
      setLastSyncResult({ success: result.success, failed: result.failed });
      await updateStats();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, updateStats]);

  useEffect(() => {
    // Initial state
    setIsOnline(navigator.onLine);
    updateStats();

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      setTimeout(() => triggerSync(), 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic stats refresh (every 10s)
    const interval = setInterval(updateStats, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [triggerSync, updateStats]);

  return { isOnline, unsyncedCount, isSyncing, lastSyncResult, triggerSync };
}