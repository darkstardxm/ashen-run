// Ashen Run service worker: lets the game install to the home screen and replay offline.
// Pages: network first. Hashed build files (/assets/): cache first. Art and audio keep their names,
// so serve the cached copy and refresh it in the background.
const CACHE = 'ashenrun-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const put = (res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then((k) => k.put(req, c)); } return res; };
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req).then((r) => r || caches.match('./'))));
    return;
  }
  const hashed = new URL(req.url).pathname.includes('/assets/');
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then(put);
    if (hit) { if (!hashed) e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
