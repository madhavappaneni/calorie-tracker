/* App-shell service worker (spec §3). v1 needs the network to log — this only makes
   the shell load offline and cold starts fast. Nothing from Supabase or Open Food
   Facts is ever cached: stale macros would be worse than an error. */

const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const BASE = new URL(self.registration.scope).pathname;

const SHELL_URLS = [BASE, `${BASE}manifest.webmanifest`, `${BASE}favicon.svg`, `${BASE}icon-192.png`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // Individually, so one missing file can't fail the whole install.
      await Promise.all(SHELL_URLS.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Open Food Facts: network only

  // Navigations: fresh when online, cached shell when not.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL);
          cache.put(BASE, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(SHELL);
          return (await cache.match(BASE)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Build assets carry a content hash, so cache-first is safe and stays fast.
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSETS);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    })(),
  );
});
