import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { verifyDeployment } from "./audio-publication.mjs";
import { pathToFileURL } from "node:url";

export async function buildOffline({
  root = new URL("../dist/", import.meta.url),
  mode,
  commit = process.env.VERCEL_GIT_COMMIT_SHA,
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(commit ?? "")) {
    try {
      commit = execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      commit = "unknown";
    }
  }
  const library = await verifyDeployment(root, mode);
  await writeFile(
    new URL("build-info.json", root),
    JSON.stringify(
      {
        commit,
        audioFiles: library.files.length,
        audioRevision: library.revision,
        audioMode: library.deploymentMode,
      },
      null,
      2,
    ) + "\n",
  );
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
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await buildOffline();
