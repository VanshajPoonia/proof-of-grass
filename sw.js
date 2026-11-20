// Offline support. The point of the app is to be used where the signal is worst.
//
// The app shell is precached. transformers.js already keeps the model weights and the
// ONNX runtime in its own Cache Storage, so after one online visit the whole judge
// runs in airplane mode. Everything else (the library from jsDelivr, the sample
// photos) is cached the first time it is fetched.
const SHELL = 'pog-shell-v2';
const RUNTIME = 'pog-runtime-v1';
const FILES = [
  './', 'index.html', 'assets/styles.css', 'manifest.webmanifest',
  'src/app.js', 'src/card.js', 'src/items.js',
  'judge/core.js', 'judge/browser.js', 'judge/vocab.js',
  'data/classes.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pog-') && k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin && url.hostname !== 'cdn.jsdelivr.net') return; // model files: transformers.js caches those itself

  // Network first for our own files (so deploys show up), cache when offline.
  // Cache first for the pinned, immutable library build.
  e.respondWith((async () => {
    const cache = await caches.open(sameOrigin ? SHELL : RUNTIME);
    if (!sameOrigin) {
      const hit = await cache.match(e.request);
      if (hit) return hit;
    }
    try {
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      return (await cache.match(e.request, { ignoreSearch: true })) || (await caches.match('index.html'));
    }
  })());
});
