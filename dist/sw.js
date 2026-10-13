/* Increment VERSION whenever a deployed application-shell asset changes. */
const VERSION = '2026.10.13-1';
const SCOPE = new URL('./', self.location.href);
const PREFIX = 'form-seven:' + encodeURIComponent(SCOPE.pathname) + ':';
const CACHE = PREFIX + VERSION;
const SHELL_PATHS = [
  './index.html', './fitness.js', './fitness.css', './movement.css', './catalog.js', './reminders.js', './energy.js', './ui.js', './planner.js', './personalize.css', './privacy.html', './privacy.css', './app.js', './engine.js', './exercises.js', './checkpoint.js', './storage.js', './styles.css',
  './pwa.js', './pwa.css', './mobile.css', './manifest.webmanifest', './assets/favicon.svg',
  './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-512.png',
];
const SHELL_URLS = SHELL_PATHS.map(path => new URL(path, SCOPE).href);
const SHELL_SET = new Set(SHELL_URLS);
const APP_SHELL = new URL('./index.html', SCOPE).href;

self.addEventListener('install', event => {
  // Cache.addAll commits this entire same-origin shell or fails the install.
  // A failed install leaves the previous working worker and cache intact.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL_URLS.map(url => new Request(url, {cache: 'reload', credentials: 'same-origin'})));
    // Updates wait here until a user explicitly accepts them in pwa.js.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION' && event.ports?.[0]) event.ports[0].postMessage({version: VERSION});
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Deliberately do not intercept video, thumbnails, fonts, analytics, APIs,
  // downloads, or non-GET requests. Progress is saved locally by the app.
  if (request.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
      } catch { /* The complete installed shell is the offline fallback. */ }
      const cached = await (await caches.open(CACHE)).match(APP_SHELL);
      return cached || new Response('Your offline copy is not ready yet. Reconnect and reopen FORM SEVEN.', {
        status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'},
      });
    })());
    return;
  }
  // Only the explicit, immutable shell is cached. Query strings can never
  // introduce new cache entries or turn the worker into a general proxy.
  if (!SHELL_SET.has(url.href)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(request);
    return cached || fetch(request);
  })());
});
