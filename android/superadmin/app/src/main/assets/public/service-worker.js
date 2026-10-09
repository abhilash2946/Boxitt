const CACHE_NAME = 'turf-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).catch(err => console.error('Service Worker: Cache installation failed:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin requests, auth requests, and Vite internal dev requests
  if (
    !event.request.url.startsWith(self.location.origin) ||
    event.request.url.includes('@vite') ||
    event.request.url.includes('node_modules') ||
    event.request.url.includes('/auth/v1/') ||
    url.pathname.includes('auth-callback')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request)
        .then((res) => res)
        .catch((error) => {
          console.error('Service Worker: Fetch failed for:', event.request.url, error);
          return new Response('Network error occurred', {
            status: 502,
            statusText: 'Network error',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
    })
  );
});
