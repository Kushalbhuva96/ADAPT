const buildId = new URL(self.location.href).searchParams.get("build") || "development";
const cacheName = `adapt-app-shell-${buildId}`;
const cachePrefix = "adapt-app-shell-";
const appRoot = new URL(self.registration.scope).pathname;
const appUrl = (path) => `${appRoot}${path}`;
const coreUrls = ["", "manifest.webmanifest", "favicon.svg", "icons/adapt-192.png", "icons/adapt-512.png", "icons/adapt-maskable-512.png"].map(appUrl);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    for (const url of coreUrls) {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (!response.ok) {
          if (url === appUrl("")) throw new Error("ADAPT needs one successful online visit before it can be used offline.");
          continue;
        }
        await cache.put(url, response);
      } catch {
        if (url === appUrl("")) throw new Error("ADAPT needs one successful online visit before it can be used offline.");
      }
    }

    const shell = await cache.match(appUrl(""));
    const html = shell ? await shell.text() : "";
    const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => match[1])
      .filter((url) => url.startsWith("/assets/") && /\.(?:js|css)(?:\?|$)/i.test(url));
    await Promise.all(assetUrls.map(async (url) => {
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error(`Could not cache required app asset: ${url}`);
      await cache.put(url, response);
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === appUrl("api") || url.pathname.startsWith(appUrl("api/"))) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(cacheName);
          await cache.put(appUrl(""), response.clone());
        }
        return response;
      } catch {
        return (await caches.match(appUrl(""))) || new Response("ADAPT is not available offline yet. Open the app once while online, then retry.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })());
    return;
  }

  if (!(["script", "style", "image", "font", "worker"].includes(request.destination) || url.pathname === "/manifest.webmanifest")) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
