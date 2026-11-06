import { audioPath } from "./numbers.js";
export const cacheName = (manifest) => `sonia-${manifest.revision}`;
export async function cachedCount(manifest) {
  if (!globalThis.caches) return 0;
  const cache = await caches.open(cacheName(manifest));
  let count = 0;
  for (const number of manifest.files)
    if (await cache.match(audioPath(number))) count++;
  return count;
}
export async function downloadAudio(manifest, onProgress, signal) {
  if (!globalThis.caches)
    throw new Error("Trình duyệt chưa hỗ trợ lưu âm thanh offline.");
  if (manifest.files.length !== 100)
    throw new Error(
      `Mới có ${manifest.files.length}/100 file Sonia trên máy chủ.`,
    );
  const cache = await caches.open(cacheName(manifest));
  let count = 0;
  for (const number of manifest.files) {
    signal?.throwIfAborted();
    const path = audioPath(number);
    if (!(await cache.match(path))) {
      const response = await fetch(path, { signal, cache: "reload" });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("audio/")
      )
        throw new Error(`Không tải được ${path}. Thử lại khi có mạng.`);
      await cache.put(path, response);
    }
    onProgress(++count);
  }
  return count;
}
