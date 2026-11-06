import { audioPath } from "./numbers.js";
import {
  validateMp3Structure,
  validateDecodedAudio,
  MAX_AUDIO_BYTES,
} from "./validation.js";

export const audioCacheName = (manifest) => `sonia-${manifest.revision}`;
export function validateManifest(data) {
  if (
    data?.voice !== "en-GB-SoniaNeural" ||
    !/^(?:empty|[a-f0-9]{16})$/.test(data.revision) ||
    !Array.isArray(data.files) ||
    new Set(data.files).size !== data.files.length ||
    !data.files.every((n) => Number.isInteger(n) && n >= 1 && n <= 100)
  )
    throw new Error("Danh sách MP3 không hợp lệ.");
  for (const number of data.files) {
    const record = data.assets?.[number];
    if (
      !record ||
      !Number.isInteger(record.bytes) ||
      record.bytes < 256 ||
      record.bytes > MAX_AUDIO_BYTES ||
      !/^[a-f0-9]{64}$/.test(record.sha256)
    )
      throw new Error(
        "Thiếu thông tin kiểm tra MP3. Chạy npm run audio:scan rồi build lại.",
      );
  }
  return data;
}
export async function verifyResponse(response, record, decode, signal) {
  signal?.throwIfAborted();
  if (response.status !== 200) throw new Error("Không tải được toàn bộ MP3.");
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_AUDIO_BYTES) throw new Error("MP3 quá lớn.");
  const buffer = await response.arrayBuffer();
  signal?.throwIfAborted();
  if (buffer.byteLength !== record.bytes)
    throw new Error("Dung lượng MP3 không khớp manifest.");
  const bytes = new Uint8Array(buffer);
  validateMp3Structure(bytes);
  const hash = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== record.sha256)
    throw new Error("Nội dung MP3 đã thay đổi. Chạy kiểm tra và build lại.");
  const decoded = await decode(buffer.slice(0));
  signal?.throwIfAborted();
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
    decoded.getChannelData(i),
  );
  validateDecodedAudio(channels, decoded.sampleRate);
  return new Response(bytes, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(bytes.length),
    },
  });
}
export async function verifyLibrary(
  manifest,
  {
    signal,
    onProgress = () => {},
    fetcher = globalThis.fetch,
    decode,
    cacheStorage = globalThis.caches,
  } = {},
) {
  validateManifest(manifest);
  const files = [],
    unavailable = [];
  let checked = 0,
    cached = 0,
    context;
  const cache = cacheStorage
    ? await cacheStorage.open(audioCacheName(manifest)).catch(() => null)
    : null;
  if (!manifest.files.length)
    return { ...manifest, files, unavailable, checked, cached };
  if (!decode) {
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Context)
      throw new Error("Thiết bị không hỗ trợ kiểm tra giải mã MP3.");
    context = new Context();
    decode = (buffer) => context.decodeAudioData(buffer);
  }
  let cursor = 0;
  const worker = async () => {
    while (cursor < manifest.files.length) {
      signal?.throwIfAborted();
      const number = manifest.files[cursor++],
        path = audioPath(number);
      const timeout = AbortSignal.timeout(15000);
      const requestSignal = signal
        ? AbortSignal.any([signal, timeout])
        : timeout;
      try {
        let verified,
          existing = await cache?.match(path);
        if (existing) {
          try {
            verified = await verifyResponse(
              existing,
              manifest.assets[number],
              decode,
              requestSignal,
            );
          } catch (error) {
            requestSignal.throwIfAborted();
            await cache.delete(path);
          }
        }
        if (!verified)
          verified = await verifyResponse(
            await fetcher(path, { signal: requestSignal, cache: "no-store" }),
            manifest.assets[number],
            decode,
            requestSignal,
          );
        if (cache) {
          try {
            await cache.put(path, verified);
            cached++;
          } catch {
            /* Audio remains usable if quota is exhausted. */
          }
        }
        files.push(number);
      } catch (error) {
        signal?.throwIfAborted();
        unavailable.push({ number, reason: error.message });
      }
      checked++;
      onProgress({
        ...manifest,
        files: [...files].sort((a, b) => a - b),
        unavailable: [...unavailable],
        checked,
        cached,
      });
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(3, manifest.files.length) }, worker),
    );
  } finally {
    if (context) await context.close();
  }
  return {
    ...manifest,
    files: files.sort((a, b) => a - b),
    unavailable,
    checked,
    cached,
  };
}
