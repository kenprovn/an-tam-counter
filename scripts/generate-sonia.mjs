// Development-only official Azure REST client. No secrets or SDK in the frontend.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { numberText } from "../src/audio/numbers.js";
import { spawnSync } from "node:child_process";
const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
if (!key || !region || !/^[a-z0-9]+$/.test(region)) {
  console.error(
    "Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in your local process environment. Never use VITE_ secrets.",
  );
  process.exit(1);
}
const directory = new URL("../public/audio/sonia/", import.meta.url);
await mkdir(directory, { recursive: true });
const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
const overwrite = process.argv.includes("--overwrite");
let generated = 0;
try {
  for (let number = 1; number <= 100; number++) {
    const name = `${String(number).padStart(3, "0")}.mp3`;
    const path = new URL(name, directory);
    if (!overwrite) {
      try {
        await readFile(path);
        console.log(`Keep ${name}`);
        continue;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    const ssml = `<speak version="1.0" xml:lang="en-GB"><voice name="en-GB-SoniaNeural"><prosody rate="0%" volume="0dB">${numberText(number)}</prosody></voice></speak>`;
    let response;
    for (let attempt = 0; attempt < 4; attempt++) {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "AnTamCounter-AudioPreparation",
        },
        body: ssml,
        signal: AbortSignal.timeout(30_000),
      });
      if (
        response.ok ||
        ![429, 500, 502, 503, 504].includes(response.status) ||
        attempt === 3
      )
        break;
      const retry = Math.min(
        10,
        Number(response.headers.get("retry-after")) || 2 ** attempt,
      );
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, retry * 1000));
    }
    // Avoid logging Azure response bodies or request headers, which might contain account information.
    if (!response.ok)
      throw new Error(
        `Azure returned HTTP ${response.status} for ${name}. Check resource access, region, quota and billing.`,
      );
    const buffer = Buffer.from(await response.arrayBuffer());
    if (
      buffer.length < 256 ||
      !(
        buffer.subarray(0, 3).toString() === "ID3" ||
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      )
    )
      throw new Error(`Azure did not return an MP3 for ${name}.`);
    const temporary = new URL(name + ".tmp", directory);
    await writeFile(temporary, buffer);
    await rename(temporary, path);
    generated++;
    console.log(`Created ${name}: ${numberText(number)}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  // Per-run metadata records only this run; existing supplied files are not vouched for.
  await writeFile(
    new URL("generation.json", directory),
    JSON.stringify(
      {
        source:
          generated === 100
            ? "official-azure-speech"
            : "mixed-or-resumed-azure-generation",
        voice: "en-GB-SoniaNeural",
        format: "audio-24khz-48kbitrate-mono-mp3",
        generatedThisRun: generated,
        date: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  const result = spawnSync(
    process.execPath,
    ["scripts/prepare-audio.mjs", "--require-complete"],
    { stdio: "inherit", cwd: new URL("../", import.meta.url) },
  );
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(
    error instanceof TypeError
      ? "Azure network request failed. Check connectivity and resource region."
      : error.message,
  );
  console.error(
    "Completed files are retained. Rerun to resume; --overwrite regenerates all 100 files and incurs new synthesis usage.",
  );
  process.exitCode = 1;
}
