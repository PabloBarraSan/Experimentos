const CACHE_NAME = 'smart-trainer-v2';
const PRECACHE = ["./assets/ExpeditionRenderer-gZt2_g-l.js","./assets/ExpeditionRenderer3D-DY_dFk4g.js","./assets/GameView-yvAtG2Ej.js","./assets/RideDecor-TjsyZTLn.js","./assets/RideView-Bt6ZfLLL.js","./assets/RideView-DKYiiWTk.css","./assets/index-BZNyl4pz.css","./assets/index-DOCTHXFO.js","./assets/manifest-B_BapiDK.json","./assets/three-Bq2T38Z6.js","./icon-192x192.png","./icon-512x512.png","./index.html","./manifest.json"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    })),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION' && event.ports?.[0]) {
    event.ports[0].postMessage({ version: '2.0.0', cacheName: CACHE_NAME });
  }
});
