/* ---------------------------------------------------------
   SERVICE WORKER — app-shell caching for offline use.
   Bump CACHE_VERSION any time index.html or js/*.js change,
   so returning users get the new files instead of a stale cache.
--------------------------------------------------------- */
const CACHE_VERSION = "v21";
const CACHE_NAME = `eduexam-shell-${CACHE_VERSION}`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/js/icons.js",
  "/js/ui.js",
  "/js/auth-screens.js",
  "/js/screens-exams.js",
  "/js/screens-taking.js",
  "/js/screens-classes.js",
  "/js/app.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/assets/login-hero.jpg",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll fails the whole install if even one request fails (e.g. a
      // flaky CDN request during install) — fetch individually instead so
      // one bad request can't block caching of everything else.
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(url, { cache: "no-cache" })
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never intercept POST/DELETE (KV writes)

  const url = new URL(req.url);

  // API calls must always go to the network live — never serve stale exam
  // data or KV responses from cache.
  if (url.pathname.startsWith("/api/")) return;

  // App shell + CDN scripts: cache-first, falling back to network, and
  // refreshing the cache in the background when the network succeeds.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
