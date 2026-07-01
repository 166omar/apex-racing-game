/* APEX Racing service worker — fast offline play + user-approved updates.
   - Precaches the app shell + version-pinned CDN libs and serves them cache-first
     (instant loads, works offline).
   - Does NOT auto-activate: a new version waits until the page tells it to
     (SKIP_WAITING), which is what the in-game "Update Now" button does. */
const CACHE = 'apex-v5';

const PRECACHE = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  'https://unpkg.com/three@0.160.0/build/three.module.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600;700&family=Rajdhani:wght@500;600;700&display=swap'
];

self.addEventListener('install', e => {
  // Note: no skipWaiting() here — the new version waits for the user to approve it.
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(PRECACHE.map(u => c.add(u)))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page posts 'SKIP_WAITING' when the user taps "Update Now".
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const cacheable = u.origin === location.origin || u.host.includes('unpkg.com') || u.host.includes('fonts.googleapis.com') || u.host.includes('fonts.gstatic.com');
  if (!cacheable) return;
  e.respondWith(
    caches.match(r).then(hit => hit || fetch(r).then(resp => {
      const cp = resp.clone();
      caches.open(CACHE).then(c => c.put(r, cp)).catch(() => {});
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});
