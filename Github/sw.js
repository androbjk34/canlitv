const CACHE_NAME = 'iptv-player-cache-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/index.tsx',
  '/src/App.tsx',
  '/src/types.ts',
  '/src/utils/m3uParser.ts',
  '/src/utils/xmltvParser.ts',
  '/src/components/PlayerView.tsx',
  '/src/components/ChannelListItem.tsx',
  '/src/components/BottomNavBar.tsx',
  '/src/components/GroupFilterModal.tsx',
  '/src/components/EpgDetailModal.tsx',
  '/src/components/ChannelSwitcher.tsx',
  '/src/components/Icons.tsx',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force the waiting service worker to become the active service worker.
  );
});

self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  // For M3U and XMLTV files, use a network-first strategy WITHOUT cache fallback.
  // This prevents showing stale data if the network request fails (e.g., due to CORS in web preview).
  // The error will propagate to the app, which can then show a proper error message.
  if (event.request.url.includes('.m3u') || event.request.url.includes('.xml')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(response => {
        // If the fetch is successful, clone the response and cache it for potential offline use.
        // The next online fetch will still go to the network due to 'no-store'.
        if (response.ok) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      }) // We remove the .catch() block here intentionally for errors to propagate.
    );
    return;
  }
  
  // For other requests, use cache-first strategy.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
            (response) => {
              // Check if we received a valid response
              if(!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }

              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });

              return response;
            }
          );
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients.
  );
});