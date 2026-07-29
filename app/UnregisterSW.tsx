"use client";

import { useEffect } from "react";

export function UnregisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
        console.log("[SW KILL] Unregistered:", registration.scope);
      }
    });

    // Also nuke the Cache Storage so stale chunks can't be served from there either
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }, []);

  return null;
}