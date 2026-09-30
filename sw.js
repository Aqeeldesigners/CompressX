/**
 * Compress-X Studio — Service Worker
 * Network-First Strategy for Instant Updates & Cache Auto-Purge
 */

const CACHE_NAME = 'compress-x-v4.1';

// Install event: immediately take over
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event: completely purge all old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Delete all old cache stores
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message event: support programmatic cache purging
self.addEventListener('message', (event) => {
  if (event.data && (event.data.action === 'CLEAR_CACHE' || event.data === 'CLEAR_CACHE')) {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => {
      if (event.source) {
        event.source.postMessage({ status: 'CACHE_CLEARED' });
      }
    });
  }
});

// Fetch event: Network-First strategy ensures you always see the latest code
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network is offline
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
  );
});
