import { audioPath } from "./numbers.js";
import { verifyLibrary, audioCacheName } from "./library.js";
export const cacheName = audioCacheName;
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
  const result = await verifyLibrary(manifest, {
    signal,
    onProgress: (result) => onProgress(result.cached),
  });
  if (result.cached !== 100)
    throw new Error(
      `Mới lưu được ${result.cached}/100 MP3 hợp lệ. Kiểm tra mạng và dung lượng trình duyệt.`,
    );
  return result.cached;
}
