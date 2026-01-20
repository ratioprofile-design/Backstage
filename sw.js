
const CACHE_NAME = 'backstage-assets-v1';

// Assets to cache immediately on installation
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;700;900&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Roboto+Mono:wght@400;700&display=swap',
  'https://apis.google.com/js/api.js'
];

// Install event: Precache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(self.skipWaiting())
  );
});

// Activate event: Cleanup old caches
self.addEventListener('activate', event => {
  const currentCaches = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
    }).then(cachesToDelete => {
      return Promise.all(cachesToDelete.map(cacheToDelete => {
        return caches.delete(cacheToDelete);
      }));
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Strategy depends on the request type
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Strategy: Cache-First for Third Party Dependencies (CDN and Fonts)
  // This makes these assets effectively "local" once downloaded once.
  const isCdnRequest = 
    url.hostname.includes('tailwindcss.com') || 
    url.hostname.includes('gstatic.com') || 
    url.hostname.includes('googleapis.com') || 
    url.hostname.includes('esm.sh') ||
    url.hostname.includes('google.com');

  if (isCdnRequest) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache? Fetch, cache, and return.
        return fetch(request).then(networkResponse => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
          // If network fetch fails and not in cache, we're truly offline.
          // For images/scripts, returning a custom offline asset could go here.
        });
      })
    );
  } else {
    // Strategy: Stale-While-Revalidate for local files (index.tsx, components, etc.)
    // This keeps the app fast while ensuring updates are pulled in the background.
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        const fetchPromise = fetch(request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
