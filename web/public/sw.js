const CACHE_NAME = 'mymusic-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear all previous caches immediately to prevent stale asset hashes
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept audio streams or API endpoints
  if (url.pathname.includes('/api/') || url.pathname.includes('/stream')) {
    return;
  }
  if (event.request.method !== 'GET') {
    return;
  }

  // Network-First strategy: Always fetch freshest assets from network first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful static responses
        if (response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache only when offline
        return caches.match(event.request);
      })
  );
});
