// app/components/ServiceWorkerRegister.tsx
// PHASE 5: Register service worker for offline agent mode
// Place this in your root layout or template

"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Skip on localhost during development (optional)
    if (window.location.hostname === "localhost" && process.env.NODE_ENV === "development") {
      console.log("[SW] Skipped on localhost dev");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        console.log("[SW] Registered:", registration.scope);

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("[SW] New version available — reload to update");
              // Optional: show update banner to user
            }
          });
        });
      })
      .catch((err) => {
        console.error("[SW] Registration failed:", err);
      });
  }, []);

  return null;
}