const CACHE_NAME = 'aqsha-budget-card-edit-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/app.js?v=aqsha_card_edit_v7',
  './js/storage.js?v=aqsha_sync_v4',
  './js/state-sync.js?v=aqsha_sync_v4',
  './js/imports/core.js',
  './js/imports/generic-csv.js',
  './js/imports/adapters.js',
  './js/imports/bcc-pdf.js',
  './vendor/pdf.min.mjs',
  './vendor/pdf.worker.min.mjs',
  './vendor/tesseract.esm.min.js',
  './vendor/tesseract-worker.min.js',
  './js/bcc-deposits.js',
  './js/analytics.js',
  './js/firebase-config.js?v=aqsha_sync_v4',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('Pre-cache partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network first for same-origin app shell, fallback to cache
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
