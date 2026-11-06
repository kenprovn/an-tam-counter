import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inspectLibrary, audioDirectory } from "./audio-library.mjs";

export const publicationPath = new URL(
  "../config/sonia-publication.json",
  import.meta.url,
);

export function audioMode(value = process.env.SONIA_AUDIO_MODE ?? "private") {
  if (value !== "private" && value !== "public")
    throw new Error(
      `SONIA_AUDIO_MODE=${JSON.stringify(value)} không hợp lệ; chỉ nhận private hoặc public.`,
    );
  return value;
}

export function publicationDraft(manifest) {
  return {
    schemaVersion: 1,
    voice: manifest.voice,
    libraryRevision: manifest.revision,
    permission: {
      confirmed: false,
      allowsPublicHosting: false,
      basis: "",
      reference: "",
      confirmedBy: "",
      confirmedAt: "",
    },
    files: Object.fromEntries(
      manifest.files.map((number) => [
        `${String(number).padStart(3, "0")}.mp3`,
        manifest.assets[number].sha256,
      ]),
    ),
  };
}

export function validatePublication(record, manifest) {
  const p = record?.permission;
  const nonempty = (value) =>
    typeof value === "string" && value.trim().length > 0;
  if (
    record?.schemaVersion !== 1 ||
    record.voice !== manifest.voice ||
    p?.confirmed !== true ||
    p.allowsPublicHosting !== true ||
    !["azure-paid-prebuilt-neural", "written-permission"].includes(p.basis) ||
    !nonempty(p.reference) ||
    !nonempty(p.confirmedBy) ||
    !nonempty(p.confirmedAt) ||
    !Number.isFinite(Date.parse(p.confirmedAt))
  )
    throw new Error(
      "Public audio: thiếu xác nhận quyền phân phối. Cần hồ sơ đã được người có thẩm quyền xác minh; biến chế độ public không cấp quyền sử dụng.",
    );
  const expected = publicationDraft(manifest).files;
  if (
    record.libraryRevision !== manifest.revision ||
    !record.files ||
    Object.keys(record.files).length !== 100 ||
    Object.entries(expected).some(([name, hash]) => record.files[name] !== hash)
  )
    throw new Error(
      "Public audio: hồ sơ quyền không khớp SHA-256 của đủ 100 MP3 hiện tại. Không được dùng xác nhận của bộ file khác.",
    );
}

export async function prepareDeployment({
  mode = audioMode(),
  directory = audioDirectory,
  rightsPath = publicationPath,
} = {}) {
  audioMode(mode);
  if (mode === "private") {
    // Never copy the source manifest or local MP3s to the deployable artifact.
    // Device-private packs remain in IndexedDB; the source files are untouched.
    return {
      manifest: {
        voice: "en-GB-SoniaNeural",
        language: "en-GB",
        revision: "empty",
        files: [],
        assets: {},
        source: "device-private",
        validation: "mp3-layer3-and-pcm-v1",
        deploymentMode: mode,
      },
      totalBytes: 0,
    };
  }
  let report;
  try {
    report = await inspectLibrary(directory);
  } catch (error) {
    throw new Error(
      `Public audio: không kiểm tra được thư mục MP3 (${error.code ?? error.message}). Cần đủ 100/100 file trong public/audio/sonia; build bị chặn.`,
    );
  }
  if (report.manifest.files.length !== 100 || report.unexpected.length) {
    const names = report.missing.map(
      (n) => `${String(n).padStart(3, "0")}.mp3`,
    );
    const invalid = report.invalid.map(
      (item) => `${item.name}: ${item.reason}`,
    );
    throw new Error(
      `Public audio: cần đủ 100/100 MP3 hợp lệ; hiện có ${report.manifest.files.length}/100. Thiếu: ${names.join(", ") || "không"}. Lỗi: ${invalid.join("; ") || "không"}. Tên ngoài bộ: ${report.unexpected.join(", ") || "không"}. Kiểm tra .vercelignore và nguồn Git.`,
    );
  }
  let record;
  try {
    record = JSON.parse(await readFile(rightsPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Public audio: không đọc được config/sonia-publication.json (${error.code ?? "JSON không hợp lệ"}). Chưa có xác nhận quyền phân phối; build bị chặn.`,
    );
  }
  validatePublication(record, report.manifest);
  return {
    ...report,
    manifest: {
      ...report.manifest,
      source: "licensed-public-files",
      deploymentMode: mode,
    },
  };
}

export async function verifiedAudioBytes(directory, number, asset) {
  const bytes = await readFile(
    new URL(`${String(number).padStart(3, "0")}.mp3`, directory),
  );
  if (
    bytes.length !== asset.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== asset.sha256
  )
    throw new Error(
      `Public audio: ${number} đã thay đổi sau khi kiểm tra. Dừng build.`,
    );
  return bytes;
}

export async function verifyDeployment(directory, mode = audioMode()) {
  const folder = new URL("audio/sonia/", directory);
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", folder), "utf8"),
  );
  const names = (await readdir(folder)).filter((name) => /\.mp3$/i.test(name));
  if (
    manifest.deploymentMode !== mode ||
    (mode === "private" &&
      (names.length ||
        manifest.files.length ||
        manifest.revision !== "empty")) ||
    (mode === "public" &&
      (names.length !== 100 || manifest.files.length !== 100))
  )
    throw new Error(
      "Audio artifact không khớp chế độ triển khai: manifest và MP3 trong dist không nhất quán.",
    );
  if (mode === "public") {
    const expected = Array.from({ length: 100 }, (_, i) => i + 1);
    if (
      expected.some((n, i) => manifest.files[i] !== n) ||
      !/^[a-f0-9]{16}$/.test(manifest.revision)
    )
      throw new Error("Public audio artifact: manifest không đủ các số 1–100.");
    const hash = createHash("sha256");
    for (const number of expected) {
      await verifiedAudioBytes(folder, number, manifest.assets[number]);
      hash.update(`${String(number).padStart(3, "0")}.mp3`);
      hash.update(manifest.assets[number].sha256);
    }
    if (hash.digest("hex").slice(0, 16) !== manifest.revision)
      throw new Error(
        "Public audio artifact: revision không khớp hash của 100 MP3.",
      );
  }
  return manifest;
}
