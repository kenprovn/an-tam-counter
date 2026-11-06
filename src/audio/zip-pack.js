import {
  validateMp3Structure,
  validateDecodedAudio,
  MAX_AUDIO_BYTES,
} from "./validation.js";
import { verifyLibrary } from "./library.js";
export const MAX_ZIP_BYTES = 32 * 1024 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });
export function inspectZip(bytes) {
  if (bytes.length < 22 || bytes.length > MAX_ZIP_BYTES)
    throw new Error("ZIP không hợp lệ hoặc vượt 32 MiB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true))
    throw new Error("Chỉ nhận ZIP một phần, không mã hóa, không ZIP64.");
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    start = view.getUint32(end + 16, true);
  if (
    count > 256 ||
    count !== view.getUint16(end + 8, true) ||
    start + size !== end
  )
    throw new Error("Cấu trúc ZIP không được hỗ trợ.");
  const records = [],
    numbers = new Set(),
    names = new Set();
  let offset = start,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error("Danh mục ZIP bị hỏng.");
    const flags = view.getUint16(offset + 8, true),
      method = view.getUint16(offset + 10, true),
      crc = view.getUint32(offset + 16, true);
    const compressed = view.getUint32(offset + 20, true),
      original = view.getUint32(offset + 24, true),
      nameSize = view.getUint16(offset + 28, true);
    const next =
      offset +
      46 +
      nameSize +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    if (
      next > end ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      original === 0xffffffff ||
      compressed === 0xffffffff ||
      local + 30 > start ||
      view.getUint16(offset + 34, true)
    )
      throw new Error(
        "ZIP mã hóa/ZIP64 hoặc phương pháp nén không được hỗ trợ.",
      );
    const name = decoder.decode(
      bytes.subarray(offset + 46, offset + 46 + nameSize),
    );
    const normalized = name.replaceAll("\\", "/");
    if (
      /^(?:\/|[a-z]:)/i.test(normalized) ||
      normalized.split("/").includes("..") ||
      normalized.includes("\0") ||
      names.has(normalized)
    )
      throw new Error("ZIP chứa đường dẫn hoặc tên trùng không hợp lệ.");
    names.add(normalized);
    total += original;
    if (total > MAX_ZIP_BYTES)
      throw new Error("Nội dung giải nén vượt 32 MiB.");
    if (
      view.getUint32(local, true) !== 0x04034b50 ||
      view.getUint16(local + 6, true) !== flags ||
      view.getUint16(local + 8, true) !== method
    )
      throw new Error("Header ZIP không khớp danh mục.");
    const localNameLength = view.getUint16(local + 26, true),
      dataStart =
        local + 30 + localNameLength + view.getUint16(local + 28, true);
    if (
      dataStart + compressed > start ||
      decoder.decode(
        bytes.subarray(local + 30, local + 30 + localNameLength),
      ) !== name
    )
      throw new Error("Dữ liệu ZIP bị cắt hoặc sai đường dẫn.");
    if (/\.mp3$/i.test(normalized)) {
      const filename = normalized.split("/").at(-1);
      if (!/^(00[1-9]|0[1-9][0-9]|100)\.mp3$/.test(filename))
        throw new Error(`Tên MP3 phải là 001.mp3…100.mp3: ${filename}`);
      const number = Number(filename.slice(0, 3));
      if (numbers.has(number))
        throw new Error(`ZIP có hai file cho số ${number}.`);
      if (original < 256 || original > MAX_AUDIO_BYTES)
        throw new Error(`${filename}: dung lượng MP3 không hợp lệ.`);
      numbers.add(number);
      records.push({ number, name, bytes: original, crc });
    }
    offset = next;
  }
  if (offset !== end || records.length !== 100)
    throw new Error(
      `ZIP cần đủ 100 MP3 đúng tên; hiện có ${records.length}/100.`,
    );
  return records.sort((a, b) => a.number - b.number);
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
async function hash(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
async function extract(bytes, records, signal) {
  const { unzip } = await import("fflate");
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const allowed = new Set(records.map((item) => item.name));
    let terminate;
    const abort = () => {
      terminate?.();
      reject(signal.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
    terminate = unzip(
      bytes,
      { filter: (file) => allowed.has(file.name) },
      (error, files) => {
        signal?.removeEventListener("abort", abort);
        if (error)
          reject(
            new Error(
              "Không giải nén được ZIP. Hãy tạo lại ZIP không mật khẩu.",
            ),
          );
        else resolve(files);
      },
    );
  });
}
export async function importZipPack(
  file,
  { signal, onProgress = () => {}, decode } = {},
) {
  if (!file || file.size > MAX_ZIP_BYTES)
    throw new Error("Chọn tệp ZIP không quá 32 MiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal?.throwIfAborted();
  const records = inspectZip(bytes),
    extracted = await extract(bytes, records, signal);
  let context;
  if (!decode) {
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Context) throw new Error("Trình duyệt không hỗ trợ kiểm tra MP3.");
    context = new Context();
    decode = (buffer) => context.decodeAudioData(buffer);
  }
  const clips = [],
    assets = {};
  try {
    for (const record of records) {
      signal?.throwIfAborted();
      const data = extracted[record.name];
      if (!data || data.length !== record.bytes || crc32(data) !== record.crc)
        throw new Error(`${record.name}: dữ liệu ZIP bị hỏng.`);
      try {
        validateMp3Structure(data);
        const audio = await decode(data.slice().buffer);
        const info = validateDecodedAudio(
          Array.from({ length: audio.numberOfChannels }, (_, i) =>
            audio.getChannelData(i),
          ),
          audio.sampleRate,
        );
        const sha256 = await hash(data);
        assets[record.number] = { bytes: data.length, sha256, ...info };
        clips.push({ number: record.number, data: data.slice() });
      } catch (error) {
        throw new Error(`${record.name}: ${error.message}`);
      }
      onProgress(clips.length);
    }
  } finally {
    if (context) await context.close();
  }
  signal?.throwIfAborted();
  const id = await hash(new TextEncoder().encode(JSON.stringify(assets)));
  return {
    id,
    clips,
    manifest: {
      voice: "en-GB-SoniaNeural",
      language: "en-GB",
      revision: id.slice(0, 16),
      files: records.map((item) => item.number),
      assets,
      source: "zip-device",
      validation: "mp3-layer3-and-pcm-v1",
    },
  };
}
export async function verifyDevicePack(
  pack,
  { signal, decode, onProgress } = {},
) {
  if (!pack?.id || !Array.isArray(pack.clips) || pack.clips.length !== 100)
    throw new Error("Bộ ZIP đã lưu không đầy đủ. Hãy nhập lại ZIP.");
  const clips = new Map(pack.clips.map((clip) => [clip.number, clip.data]));
  return verifyLibrary(pack.manifest, {
    signal,
    decode,
    onProgress,
    cacheStorage: null,
    fetcher: async (path) => {
      const number = Number(path.split("/").at(-1).slice(0, 3));
      return clips.has(number)
        ? new Response(clips.get(number))
        : new Response(null, { status: 404 });
    },
  });
}
export function deviceSources(pack, files = pack.manifest.files, urls = URL) {
  const clips = new Map(pack.clips.map((clip) => [clip.number, clip.data])),
    sources = new Map();
  try {
    for (const number of files)
      sources.set(
        number,
        urls.createObjectURL(
          new Blob([clips.get(number)], { type: "audio/mpeg" }),
        ),
      );
  } catch (error) {
    for (const value of sources.values()) urls.revokeObjectURL(value);
    throw error;
  }
  return sources;
}
