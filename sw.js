/* Service worker: keeps the reader and its fonts on the device so the
   Mushaf opens without a connection once it has been read or saved. */
const SHELL_CACHE = 'mushaf-shell-v2';
const FONT_CACHE = 'mushaf-fonts-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/mushaf.css',
  'assets/ornaments.js',
  'assets/reader.js',
  'data/mushaf.js',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isFont(url) {
  return /\.woff2?$/.test(url.pathname) || url.hostname === 'fonts.gstatic.com';
}

// Fonts never change at a given URL: serve from the cache, fetch once.
async function fontFirst(request) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// App files: answer from the cache at once and refresh it in the background.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  const update = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => hit || Response.error());
  return hit || update;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isFont(url)) {
    event.respondWith(fontFirst(request));
  } else if (url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(request));
  }
});
