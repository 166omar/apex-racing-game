/* APEX Racing service worker — auto-updating, with offline play.
   Strategy:
   - App's own files (HTML/manifest/icons): NETWORK-FIRST, so a new version
     downloads automatically whenever the phone is online. Falls back to cache offline.
   - Version-pinned CDN libs + fonts: CACHE-FIRST (their URLs never change), for
     fast loads and offline play. */
const CACHE = 'apex-v4';

const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const IMMUTABLE = [
  'https://unpkg.com/three@0.160.0/build/three.module.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&family=Rajdhani:wght@500;600;700&display=swap'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled([...APP_SHELL, ...IMMUTABLE].map(u => c.add(u)))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  const sameOrigin = u.origin === location.origin;
  const isImmutable = u.host.includes('unpkg.com') || u.host.includes('fonts.googleapis.com') || u.host.includes('fonts.gstatic.com');
  if (!sameOrigin && !isImmutable) return;

  // Version-pinned assets: cache-first (they never change).
  if (isImmutable) {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(resp => {
      const cp = resp.clone();
      caches.open(CACHE).then(c => c.put(r, cp)).catch(() => {});
      return resp;
    })));
    return;
  }

  // App's own files: network-first so updates propagate automatically; cache is the offline fallback.
  e.respondWith(
    fetch(r).then(resp => {
      const cp = resp.clone();
      caches.open(CACHE).then(c => c.put(r, cp)).catch(() => {});
      return resp;
    }).catch(() => caches.match(r).then(hit => hit || caches.match('./index.html')))
  );
});
