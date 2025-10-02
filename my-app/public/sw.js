self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open("trolly-cache");
      const urlsToCache = ["/"]; // keep only what you are sure exists
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("⚠️ Failed to cache:", url, err);
        }
      }
    })()
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
