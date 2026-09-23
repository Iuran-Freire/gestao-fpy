const CACHE = "fpy-shell-v2";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll([
          "/",
          "/inventus-power-logo.svg",
          "/favicon.svg",
          "/manifest.webmanifest",
          "/icon-192.png",
          "/icon-512.png",
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("fpy-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    /signin|signout|callback/.test(url.pathname)
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async (r) => {
          if (r.ok && !r.redirected && new URL(r.url).pathname === "/") {
            const c = await caches.open(CACHE);
            await c.put("/", r.clone());
          }
          return r;
        })
        .catch(
          async () =>
            (await caches.match("/")) ||
            new Response("Conecte-se para abrir o FPY pela primeira vez.", {
              status: 503,
            }),
        ),
    );
    return;
  }
  if (/\.(js|css|svg|png|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
  }
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === "CACHE_ASSETS" && Array.isArray(event.data.urls))
    event.waitUntil(
      caches.open(CACHE).then((cache) =>
        Promise.all(
          event.data.urls
            .filter((value) => {
              try {
                const url = new URL(value);
                return (
                  url.origin === self.location.origin &&
                  /\.(js|css|svg|png|woff2?)$/.test(url.pathname)
                );
              } catch {
                return false;
              }
            })
            .map((url) => cache.add(url).catch(() => {})),
        ),
      ),
    );
});
