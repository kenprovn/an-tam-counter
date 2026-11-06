import { mkdir, writeFile } from "node:fs/promises";
import { inspectLibrary } from "./audio-library.mjs";
import { publicationDraft } from "./audio-publication.mjs";

try {
  const report = await inspectLibrary();
  if (report.manifest.files.length !== 100 || report.unexpected.length)
    throw new Error(
      "Cần đủ đúng 100 MP3 hợp lệ trước khi lập bản nháp xác nhận quyền.",
    );
  const directory = new URL("../.local/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL("sonia-publication.draft.json", directory),
    JSON.stringify(publicationDraft(report.manifest), null, 2) + "\n",
  );
  console.log(
    "Bản nháp CHƯA ĐƯỢC DUYỆT: .local/sonia-publication.draft.json. Không cấp quyền hoặc bật public audio.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
