// public/sw.js
// PHASE 7: Service worker with offline page + sync event support.
// Next.js Server Actions cannot be intercepted, so we use API routes for sync.

const CACHE_NAME = "propflow-v2";
const OFFLINE_URL = "/offline.html";

// Install: cache offline page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve offline page for navigation requests when offline
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL).then((response) => {
          return response || new Response("Offline", { status: 503 });
        })
      )
    );
  }
});

// Background Sync: trigger client-side sync when connection returns
// NOTE: The actual IndexedDB sync is handled by useOnlineStatus hook.
// This event just notifies any open clients to run their sync.
self.addEventListener("sync", (event) => {
  if (event.tag === "propflow-sync") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SYNC_TRIGGERED" });
        });
      })
    );
  }
});