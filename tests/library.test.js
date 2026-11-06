import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { MPEGDecoder } from "mpg123-decoder";
import { tone, silence } from "./fixtures/audio-fixtures.js";
import { inspectLibrary, prepareLibrary } from "../scripts/audio-library.mjs";
import {
  validateManifest,
  verifyLibrary,
  verifyResponse,
} from "../src/audio/library.js";
import {
  validateMp3Structure,
  validateDecodedAudio,
  MAX_AUDIO_BYTES,
} from "../src/audio/validation.js";
const record = {
  bytes: tone.length,
  sha256: createHash("sha256").update(tone).digest("hex"),
};
const manifest = {
  voice: "en-GB-SoniaNeural",
  revision: "0123456789abcdef",
  files: [1, 2, 3],
  assets: { 1: record, 2: record, 3: record },
};
async function decode(buffer) {
  const decoder = new MPEGDecoder();
  await decoder.ready;
  try {
    const pcm = decoder.decode(new Uint8Array(buffer));
    assert.equal(pcm.errors.length, 0);
    return {
      numberOfChannels: pcm.channelData.length,
      sampleRate: pcm.sampleRate,
      getChannelData: (index) => pcm.channelData[index],
    };
  } finally {
    decoder.free();
  }
}
function memoryCache() {
  const entries = new Map();
  return {
    entries,
    async open() {
      return {
        match: async (key) => entries.get(key)?.clone(),
        put: async (key, response) => {
          entries.set(key, response.clone());
        },
        delete: async (key) => entries.delete(key),
      };
    },
  };
}
async function temp(t) {
  const directory = await mkdtemp(join(tmpdir(), "an-tam-audio-test-"));
  t.after(() => {
    const target = resolve(directory);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("an-tam-audio-test-"));
    return rm(target, { recursive: true, force: true });
  });
  return pathToFileURL(directory + "/");
}
test("scanner decodes all 100 imported files and records size/hash/duration", async (t) => {
  const directory = await temp(t);
  for (let i = 1; i <= 100; i++)
    await writeFile(
      new URL(String(i).padStart(3, "0") + ".mp3", directory),
      tone,
    );
  const result = await inspectLibrary(directory);
  assert.equal(result.manifest.files.length, 100);
  assert.equal(result.invalid.length, 0);
  assert.equal(result.missing.length, 0);
  assert.equal(result.totalBytes, tone.length * 100);
  assert.equal(result.manifest.assets[27].sha256, record.sha256);
  assert.ok(result.manifest.assets[27].duration > 0.1);
});
test("scanner excludes empty, renamed, truncated, silent, oversize and misnamed files", async (t) => {
  const directory = await temp(t);
  const samples = {
    "001.mp3": tone,
    "002.mp3": Buffer.alloc(0),
    "003.mp3": Buffer.from("ID3" + "not audio".repeat(100)),
    "004.mp3": tone.subarray(0, tone.length - 3),
    "005.mp3": silence,
    "006.mp3": Buffer.alloc(MAX_AUDIO_BYTES + 1),
    "007.mp3": Buffer.from("RIFF" + "wave".repeat(100)),
    "100.MP3": tone,
  };
  for (const [name, data] of Object.entries(samples))
    await writeFile(new URL(name, directory), data);
  const result = await inspectLibrary(directory);
  assert.deepEqual(result.manifest.files, [1]);
  assert.equal(result.invalid.length, 6);
  assert.deepEqual(result.unexpected, ["100.MP3"]);
});
test("Vercel publication guard refuses local audio without touching the library", async (t) => {
  const directory = await temp(t);
  await writeFile(new URL("001.mp3", directory), tone);
  await assert.rejects(
    prepareLibrary({ directory, cloud: true }),
    /chế độ cục bộ/,
  );
  assert.deepEqual(await readFile(new URL("001.mp3", directory)), tone);
  await assert.rejects(access(new URL("manifest.json", directory)));
});
test("manifest and PCM validation reject forged metadata and silence", () => {
  assert.throws(() => validateManifest({ ...manifest, files: [1, 1] }));
  assert.throws(() => validateManifest({ ...manifest, assets: {} }));
  assert.throws(() => validateMp3Structure(Buffer.alloc(300)));
  assert.throws(
    () => validateDecodedAudio([new Float32Array(24000)], 24000),
    /im lặng/,
  );
});
test("browser library counts only decodable matching MP3s; verifies cached audio offline", async () => {
  const cache = memoryCache();
  const result = await verifyLibrary(manifest, {
    decode,
    cacheStorage: cache,
    fetcher: async (path) =>
      path.endsWith("001.mp3")
        ? new Response(tone)
        : path.endsWith("002.mp3")
          ? new Response("<html>404</html>", { status: 404 })
          : new Response(Buffer.alloc(tone.length)),
  });
  assert.deepEqual(result.files, [1]);
  assert.equal(result.unavailable.length, 2);
  assert.equal(result.cached, 1);
  const offline = await verifyLibrary(
    { ...manifest, files: [1] },
    {
      decode,
      cacheStorage: cache,
      fetcher: async () => {
        throw new Error("Offline");
      },
    },
  );
  assert.deepEqual(offline.files, [1]);
  assert.equal(offline.cached, 1);
});
test("browser validation catches changed bytes and device decode failure", async () => {
  await assert.rejects(
    verifyResponse(
      new Response(tone),
      { ...record, sha256: "0".repeat(64) },
      decode,
    ),
    /đã thay đổi/,
  );
  const result = await verifyLibrary(
    { ...manifest, files: [1] },
    {
      cacheStorage: null,
      decode: async () => {
        throw new Error("Device unsupported");
      },
      fetcher: async () => new Response(tone),
    },
  );
  assert.deepEqual(result.files, []);
  assert.equal(result.cached, 0);
});
