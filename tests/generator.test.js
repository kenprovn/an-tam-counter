import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
const root = new URL("../", import.meta.url);
test("Sonia dry-run plans all 100 numbers without credentials or file changes", () => {
  const manifest = new URL(
    "../public/audio/sonia/manifest.json",
    import.meta.url,
  );
  const before = statSync(manifest).mtimeMs;
  const result = spawnSync(
    process.execPath,
    ["scripts/generate-sonia.mjs", "--dry-run"],
    {
      cwd: root,
      env: { ...process.env, AZURE_SPEECH_KEY: "", AZURE_SPEECH_REGION: "" },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /001.mp3: One/);
  assert.match(result.stdout, /027.mp3: Twenty-seven/);
  assert.match(result.stdout, /100.mp3: One hundred/);
  assert.equal(
    result.stdout.match(/(?:Keep|Would generate) \d{3}\.mp3:/g).length,
    100,
  );
  assert.equal(statSync(manifest).mtimeMs, before);
});
test("Sonia synthesis fails clearly without local credentials", () => {
  const result = spawnSync(process.execPath, ["scripts/generate-sonia.mjs"], {
    cwd: root,
    env: { ...process.env, AZURE_SPEECH_KEY: "", AZURE_SPEECH_REGION: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION/);
});
