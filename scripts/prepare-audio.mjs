import { prepareLibrary } from "./audio-library.mjs";
import { prepareDeployment } from "./audio-publication.mjs";
try {
  if (process.argv.includes("--build")) {
    const { manifest } = await prepareDeployment();
    console.log(
      `Deployment audio: ${manifest.deploymentMode}, ${manifest.files.length}/100 MP3. Source files/manifest unchanged.`,
    );
  } else {
    const report = await prepareLibrary();
    console.log(
      `Sonia library: ${report.manifest.files.length}/100 valid MP3 files, ${report.totalBytes} bytes.`,
    );
    for (const file of report.invalid)
      console.error(`${file.name}: ${file.reason}`);
    if (report.missing.length)
      console.log(
        `Missing: ${report.missing.map((n) => String(n).padStart(3, "0") + ".mp3").join(", ")}`,
      );
    if (report.unexpected.length)
      console.error(
        `Ignored unexpected names: ${report.unexpected.join(", ")}`,
      );
    console.log(
      "Detailed local report: .local/sonia-validation.json. Audio content/voice identity still requires listening.",
    );
    if (
      process.argv.includes("--require-complete") &&
      (report.manifest.files.length !== 100 || report.unexpected.length)
    )
      process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
