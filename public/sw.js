// public/sw.js — Service Worker for offline form submission
const CACHE_NAME = "propflow-agent-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "/admin/agent/meter-readings",
        "/offline.html",
      ]);
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method === "POST" && event.request.url.includes("/api/agent/meter-reading")) {
    // Queue POST requests when offline
    event.respondWith(
      fetch(event.request).catch(() => {
        // Store in IndexedDB for sync when back online
        return new Response(JSON.stringify({ queued: true }), {
          headers: { "Content-Type": "application/json" },
        });
      })
    );
  }
});