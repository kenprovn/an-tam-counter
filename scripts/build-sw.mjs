import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../dist/", import.meta.url);
async function walk(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory())
      result.push(
        ...(await walk(new URL(entry.name + "/", directory), path + "/")),
      );
    else if (
      !path.endsWith(".mp3") &&
      !path.endsWith(".tmp") &&
      path !== "sw.js"
    )
      result.push("/" + path);
  }
  return result;
}
const files = (await walk(root)).sort();
const hash = createHash("sha256");
for (const file of files)
  hash.update(await readFile(new URL(file.slice(1), root)));
const manifest = JSON.parse(
  await readFile(new URL("audio/sonia/manifest.json", root), "utf8"),
);
const source = await readFile(
  new URL("./sw-template.js", import.meta.url),
  "utf8",
);
await writeFile(
  new URL("sw.js", root),
  `const SHELL_CACHE = 'an-tam-${hash.digest("hex").slice(0, 16)}';\nconst AUDIO_CACHE = 'sonia-${manifest.revision}';\nconst PRECACHE = ${JSON.stringify(files)};\n${source}`,
);
console.log(
  `Offline shell prepared: ${files.length} assets. Audio is cached separately on request.`,
);
