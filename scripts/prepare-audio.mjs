import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const directory = new URL("../public/audio/sonia/", import.meta.url);
const files = [];
const hash = createHash("sha256");
for (const entry of (await readdir(directory)).sort()) {
  if (!entry.endsWith(".mp3")) continue;
  if (!/^(0[0-9]{2}|100)\.mp3$/.test(entry) || entry === "000.mp3")
    throw new Error(`Unexpected audio file: ${entry}`);
  const data = await readFile(new URL(entry, directory));
  const mp3 =
    data.subarray(0, 3).toString() === "ID3" ||
    (data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
  if (data.length < 256 || !mp3)
    throw new Error(`Not a valid MP3 header: ${entry}`);
  files.push(Number(entry.slice(0, 3)));
  hash.update(entry);
  hash.update(data);
}
let provenance;
try {
  provenance = JSON.parse(
    await readFile(new URL("generation.json", directory), "utf8"),
  );
} catch {
  /* No synthesized files yet. */
}
const manifest = {
  voice: "en-GB-SoniaNeural",
  language: "en-GB",
  revision: files.length ? hash.digest("hex").slice(0, 16) : "empty",
  files,
  source: files.length
    ? (provenance?.source ?? "provided-files-unverified-voice")
    : "not-generated",
};
await writeFile(
  new URL("manifest.json", directory),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`Sonia library: ${files.length}/100 real MP3 files found.`);
if (process.argv.includes("--require-complete") && files.length !== 100) {
  console.error(
    "Incomplete Sonia library. Generate or supply the missing real MP3 files before claiming Sonia is ready.",
  );
  process.exitCode = 1;
}
