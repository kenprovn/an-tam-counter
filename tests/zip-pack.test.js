import test from "node:test";
import assert from "node:assert/strict";
import { zipSync } from "fflate";
import { IDBFactory } from "fake-indexeddb";
import { MPEGDecoder } from "mpg123-decoder";
import { tone } from "./fixtures/audio-fixtures.js";
import {
  inspectZip,
  importZipPack,
  verifyDevicePack,
  deviceSources,
  MAX_ZIP_BYTES,
} from "../src/audio/zip-pack.js";
import { loadDevicePack, saveDevicePack } from "../src/audio/device-store.js";
function entries() {
  return Object.fromEntries(
    Array.from({ length: 100 }, (_, i) => [
      `${String(i + 1).padStart(3, "0")}.mp3`,
      tone,
    ]),
  );
}
function file(bytes) {
  return new Blob([bytes], { type: "application/zip" });
}
async function decoder() {
  const instance = new MPEGDecoder();
  await instance.ready;
  return {
    close: () => instance.free(),
    decode: async (bytes) => {
      await instance.reset();
      const pcm = instance.decode(new Uint8Array(bytes));
      return {
        numberOfChannels: pcm.channelData.length,
        sampleRate: pcm.sampleRate,
        getChannelData: (i) => pcm.channelData[i],
      };
    },
  };
}
test("imports 100 compressed MP3s with CRC/PCM validation and preserves bytes", async () => {
  const audio = await decoder();
  try {
    const progress = [];
    const pack = await importZipPack(file(zipSync(entries(), { level: 6 })), {
      decode: audio.decode,
      onProgress: (n) => progress.push(n),
    });
    assert.equal(pack.clips.length, 100);
    assert.equal(pack.manifest.source, "zip-device");
    assert.equal(progress.at(-1), 100);
    assert.deepEqual(pack.clips[26].data, new Uint8Array(tone));
    const factory = new IDBFactory();
    assert.equal(await loadDevicePack(factory), null);
    await saveDevicePack(pack, factory);
    const restored = await loadDevicePack(factory);
    assert.equal(restored.id, pack.id);
    // Restore is entirely local: verifyDevicePack uses only the bytes loaded from IDB.
    const verified = await verifyDevicePack(restored, { decode: audio.decode });
    assert.equal(verified.files.length, 100);
    assert.equal(verified.unavailable.length, 0);
  } finally {
    audio.close();
  }
});
test("ZIP accepts a containing folder and ignores non-audio metadata", () => {
  const files = Object.fromEntries(
    Object.entries(entries()).map(([name, bytes]) => ["sonia/" + name, bytes]),
  );
  files["sonia/README.md"] = new TextEncoder().encode("private audio");
  assert.equal(inspectZip(zipSync(files)).length, 100);
});
test("ZIP rejects missing, misnamed, duplicate and unsafe paths", () => {
  const missing = entries();
  delete missing["100.mp3"];
  assert.throws(() => inspectZip(zipSync(missing)), /99\/100/);
  const wrong = entries();
  wrong["one.mp3"] = tone;
  assert.throws(() => inspectZip(zipSync(wrong)), /Tên MP3/);
  const duplicate = entries();
  duplicate["second/001.mp3"] = tone;
  assert.throws(() => inspectZip(zipSync(duplicate)), /hai file/);
  const unsafe = entries();
  unsafe["../evil.txt"] = tone;
  assert.throws(() => inspectZip(zipSync(unsafe)), /đường dẫn/);
});
test("ZIP rejects encryption and declared expansion beyond the bounded budget", () => {
  const bytes = zipSync(entries(), { level: 0 });
  const end = bytes.length - 22;
  const encrypted = bytes.slice(),
    e = new DataView(encrypted.buffer),
    start = e.getUint32(end + 16, true);
  e.setUint16(start + 8, 1, true);
  assert.throws(() => inspectZip(encrypted), /mã hóa/);
  const large = bytes.slice(),
    l = new DataView(large.buffer);
  l.setUint32(start + 24, MAX_ZIP_BYTES + 1, true);
  assert.throws(() => inspectZip(large), /32 MiB/);
});
test("ZIP rejects CRC damage and invalid MP3 before it can be saved", async () => {
  const audio = await decoder();
  try {
    const corrupt = zipSync(entries(), { level: 0 });
    const v = new DataView(corrupt.buffer);
    const offset = 30 + v.getUint16(26, true) + v.getUint16(28, true);
    corrupt[offset + 100] ^= 1;
    await assert.rejects(
      importZipPack(file(corrupt), { decode: audio.decode }),
      /bị hỏng/,
    );
    const invalid = entries();
    invalid["050.mp3"] = new Uint8Array(1024);
    await assert.rejects(
      importZipPack(file(zipSync(invalid)), { decode: audio.decode }),
      /050.mp3/,
    );
  } finally {
    audio.close();
  }
});
test("aborted ZIP import never returns a pack", async () => {
  const signal = AbortSignal.abort();
  await assert.rejects(importZipPack(file(zipSync(entries())), { signal }), {
    name: "AbortError",
  });
});
test("failed IndexedDB replacement preserves previous active pack and stored versions", async () => {
  const factory = new IDBFactory(),
    original = {
      id: "old",
      clips: [{ number: 1, data: new Uint8Array([1, 2, 3]) }],
    };
  await saveDevicePack(original, factory);
  await assert.rejects(
    saveDevicePack({ id: "new", uncloneable: () => {} }, factory),
  );
  assert.equal((await loadDevicePack(factory)).id, "old");
  await saveDevicePack({ id: "next" }, factory);
  assert.equal((await loadDevicePack(factory)).id, "next");
});
test("device sources create one synchronous blob URL for each validated clip", () => {
  const created = [],
    revoked = [];
  const pack = { clips: [{ number: 1, data: tone }], manifest: { files: [1] } };
  const sources = deviceSources(pack, [1], {
    createObjectURL: (blob) => {
      created.push(blob);
      return "blob:private-1";
    },
    revokeObjectURL: (url) => revoked.push(url),
  });
  assert.equal(sources.get(1), "blob:private-1");
  assert.equal(created[0].size, tone.length);
  assert.deepEqual(revoked, []);
});
