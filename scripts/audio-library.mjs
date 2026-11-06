import {
  readdir,
  readFile,
  writeFile,
  rename,
  mkdir,
  stat,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { MPEGDecoder } from "mpg123-decoder";
import {
  validateMp3Structure,
  validateDecodedAudio,
  MAX_AUDIO_BYTES,
} from "../src/audio/validation.js";

export const audioDirectory = new URL(
  "../public/audio/sonia/",
  import.meta.url,
);
export async function inspectLibrary(directory = audioDirectory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const audioEntries = entries.filter((entry) => /\.mp3$/i.test(entry.name));
  const unexpected = audioEntries
    .filter((entry) => !/^(00[1-9]|0[1-9][0-9]|100)\.mp3$/.test(entry.name))
    .map((entry) => entry.name);
  const files = [],
    missing = [],
    invalid = [],
    assets = {};
  const decoder = new MPEGDecoder();
  const hash = createHash("sha256");
  await decoder.ready;
  try {
    for (let number = 1; number <= 100; number++) {
      const name = `${String(number).padStart(3, "0")}.mp3`;
      const entry = entries.find((item) => item.name === name);
      if (!entry) {
        missing.push(number);
        continue;
      }
      try {
        if (!entry.isFile())
          throw new Error(
            "Chỉ chấp nhận tệp thường, không nhận thư mục/symlink.",
          );
        const path = new URL(name, directory);
        if ((await stat(path)).size > MAX_AUDIO_BYTES)
          throw new Error("Tệp vượt giới hạn 2 MiB.");
        const bytes = await readFile(path);
        validateMp3Structure(bytes);
        const decoded = decoder.decode(bytes);
        const info = validateDecodedAudio(
          decoded.channelData,
          decoded.sampleRate,
          decoded.errors,
        );
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        assets[number] = { bytes: bytes.length, sha256, ...info };
        files.push(number);
        hash.update(name);
        hash.update(sha256);
      } catch (error) {
        invalid.push({ number, name, reason: error.message });
      } finally {
        await decoder.reset();
      }
    }
  } finally {
    decoder.free();
  }
  const manifest = {
    voice: "en-GB-SoniaNeural",
    language: "en-GB",
    revision: files.length ? hash.digest("hex").slice(0, 16) : "empty",
    files,
    source: files.length ? "provided-files-unverified-voice" : "not-generated",
    validation: "mp3-layer3-and-pcm-v1",
    assets,
  };
  return {
    manifest,
    missing,
    invalid,
    unexpected,
    totalBytes: Object.values(assets).reduce(
      (sum, asset) => sum + asset.bytes,
      0,
    ),
  };
}
async function writeChanged(path, value) {
  const text = JSON.stringify(value, null, 2) + "\n";
  try {
    if ((await readFile(path, "utf8")) === text) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = new URL(path.href + ".tmp");
  await writeFile(temporary, text);
  await rename(temporary, path);
}
export async function prepareLibrary({
  directory = audioDirectory,
  reportPath = new URL("../.local/sonia-validation.json", import.meta.url),
} = {}) {
  // Scanning is not publication. The build never consumes this source manifest.
  // Publication guard now lives in prepareDeployment() and the Vite emitter;
  // both local and cloud builds enforce exactly the same private/public policy.
  const report = await inspectLibrary(directory);
  await writeChanged(new URL("manifest.json", directory), report.manifest);
  await mkdir(new URL("./", reportPath), { recursive: true });
  await writeChanged(reportPath, report);
  return report;
}
