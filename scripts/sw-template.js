/* global SHELL_CACHE, AUDIO_CACHE, PRECACHE */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
  // New versions wait until existing tabs close, avoiding mixed app versions.
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (
          (name.startsWith("an-tam-") && name !== SHELL_CACHE) ||
          (name.startsWith("sonia-") && name !== AUDIO_CACHE)
        )
          await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});
async function audioResponse(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request.url);
  if (cached) {
    const range = request.headers.get("range");
    if (!range) return cached;
    const buffer = await cached.arrayBuffer();
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const invalid = () =>
      new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${buffer.byteLength}` },
      });
    if (!match || (!match[1] && !match[2])) return invalid();
    const start = match[1]
      ? Number(match[1])
      : Math.max(0, buffer.byteLength - Number(match[2]));
    const end =
      match[1] && match[2]
        ? Math.min(Number(match[2]), buffer.byteLength - 1)
        : buffer.byteLength - 1;
    if (start >= buffer.byteLength || end < start) return invalid();
    return new Response(buffer.slice(start, end + 1), {
      status: 206,
      headers: {
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${buffer.byteLength}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  // Only cache full successful MP3 responses; never cache 404 HTML or a partial range.
  const response = await fetch(request);
  if (
    response.status === 200 &&
    response.headers.get("content-type")?.includes("audio/")
  )
    await cache.put(request.url, response.clone());
  return response;
}
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (/^\/audio\/sonia\/\d{3}\.mp3$/.test(url.pathname)) {
    event.respondWith(audioResponse(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(
      caches
        .open(SHELL_CACHE)
        .then(
          async (cache) => (await cache.match("/index.html")) || fetch(request),
        ),
    );
    return;
  }
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(SHELL_CACHE)
        .then(
          async (cache) => (await cache.match(url.pathname)) || fetch(request),
        ),
    );
  }
});
