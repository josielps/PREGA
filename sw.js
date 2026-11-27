const CACHE = 'prega-v5';
const FILES = ['/', '/index.html', '/project.html', '/app.js', '/style.css', '/bible.json', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/vendor/pptxgen.js'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});

