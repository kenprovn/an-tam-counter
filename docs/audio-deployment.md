# Triển khai âm thanh: private và public

## Chế độ build

Biến môi trường build `SONIA_AUDIO_MODE` chỉ nhận `private` hoặc `public`. Không đặt biến này thì dùng `private`; giá trị sai/rỗng làm build thất bại. Biến này không phải secret và không cấp quyền phân phối.

| Chế độ | MP3 trong dist | Manifest deploy | Điều kiện |
| --- | --- | --- | --- |
| private (mặc định) | 0 | 0/100, revision `empty`, deploymentMode `private` | ZIP riêng trong IndexedDB hoặc TTS theo cài đặt |
| public | đúng 100 | 100/100, hash revision, deploymentMode `public` | đủ file hợp lệ + hồ sơ quyền khớp cả 100 SHA-256 |

`npm run audio` và `npm run audio:check` quét file nguồn, không bật public. `npm run dev` cho phép nghe file nguồn trên localhost. `npm run build`/`preview` áp dụng chính sách triển khai giống Vercel; private không chứa MP3 ngay cả khi máy build có 100 file. ZIP riêng, dữ liệu đếm, localStorage và theme không bị thay đổi.

## Pipeline GitHub → Vercel

1. `.vercelignore` không còn loại mọi MP3. `dist/`, `.local/`, test, file tạm và generation metadata vẫn bị loại. Việc cho file đến builder không đồng nghĩa cho phép xuất bản.
2. Prebuild `prepare-audio.mjs --build` kiểm tra chế độ. Public kiểm tra frame MP3, giải mã PCM, đủ đúng các số 1–100, không file thừa và hồ sơ quyền. Thiếu file hoặc xác nhận làm build lỗi rõ ràng trước khi Vite chạy; không hạ xuống 0/100.
3. Vite tắt `publicDir` khi build. Plugin sao chép tài nguyên app nhưng bỏ toàn bộ `audio/sonia` nguồn; chỉ xuất manifest được chuẩn bị theo chính sách và MP3 đã qua guard. Hash được kiểm tra lại lúc emit để phát hiện file thay đổi giữa quá trình build. Hồ sơ quyền/generation metadata/ZIP không xuất hiện trong `dist`.
4. `build-sw.mjs` kiểm tra lại số file, hash, revision và chế độ trong artifact trước khi ghi `build-info.json` và service worker. Build-info ghi cùng số file/revision/mode với manifest. PWA cache shell theo nội dung; MP3 cache riêng theo revision, hỗ trợ byte ranges. IndexedDB không bị xóa khi cập nhật SW.

Manifest nguồn đã commit không được dùng để quyết định đóng gói và không bị build ghi đè. Giữ Output Directory của Vercel là **dist**, Build Command là **npm run build**; không deploy thư mục `public` trực tiếp hoặc bỏ qua pipeline.

## Chuẩn bị bộ được phép phân phối

Hiện chưa có bằng chứng xác nhận quyền cho bộ được cung cấp. Kiểm tra kỹ thuật, tên giọng, việc đã upload GitHub hoặc tạo được MP3 đều không chứng minh quyền phân phối.

[Microsoft Product Terms — Text-to-Speech Services](https://www.microsoft.com/licensing/terms/en-US/productoffering/MicrosoftAzure/allprograms) nêu quyền dùng đầu ra prebuilt neural cho khách hàng gói TTS trả phí, gồm mục đích thương mại. Phải đối chiếu điều khoản áp dụng với tài khoản và nguồn của chính bộ file; không áp dụng mặc định cho bộ hiện tại chưa rõ nguồn.

1. Xác minh nguồn và điều khoản áp dụng với người có thẩm quyền: ví dụ đầu ra prebuilt neural từ **Azure Speech gói trả phí** theo điều khoản của tài khoản, hoặc văn bản Microsoft cho phép host công khai chính bộ file này. Giữ bằng chứng riêng. Không suy ra quyền của bộ Edge/nguồn chưa rõ từ điều khoản Azure. Xác nhận nội dung và giọng bằng nghe kiểm tra.
2. Nếu cần bộ mới, giữ bộ cũ ở bản dự phòng riêng trước khi đưa bộ mới hợp lệ vào `public/audio/sonia/`. Không tự chạy tổng hợp có phí. API key chỉ ở môi trường local của generator, không đưa vào frontend/Git/Vercel.
3. Chạy `npm run audio` rồi `npm run audio:publication-draft`. Bản nháp `.local/sonia-publication.draft.json` gắn revision và SHA-256 đủ 100 file, mặc định `confirmed: false` và `allowsPublicHosting: false`.
4. **Sau khi quyền thực sự được xác minh**, sao chép bản nháp sang `config/sonia-publication.json`. Điền `permission.basis` là `azure-paid-prebuilt-neural` hoặc `written-permission`, `reference` là tham chiếu bằng chứng riêng, `confirmedBy` là người xác minh, `confirmedAt` là ngày giờ ISO. Chỉ lúc đó xác nhận hai trường boolean. Không thay hash bằng tay để duyệt bộ file khác. Đây là khai báo của người xác minh; script không tự kiểm chứng pháp lý của tài liệu.
5. Thử build public trên PowerShell:

```powershell
$env:SONIA_AUDIO_MODE = 'public'
try {
  npm run audio
  npm test
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Public build failed' }
} finally {
  Remove-Item Env:SONIA_AUDIO_MODE -ErrorAction SilentlyContinue
}
```

6. Xác nhận dist có đúng 100 MP3, manifest `files.length` và build-info `audioFiles` đều 100; cùng revision/mode public. Nghe các mẫu 001/002/027/080/099/100 qua preview. Commit **bộ hợp lệ và hồ sơ đã duyệt**, không commit ZIP/key/bằng chứng nhạy cảm. Không dùng force push.
7. Trong Vercel Project → Settings → Environment Variables, đặt `SONIA_AUDIO_MODE=public` cho Production (Preview chỉ khi cũng có quyền host tại đó). Redeploy commit có đủ file/hồ sơ. Nếu không có quyền hoặc cần rút public, chuyển `private` và redeploy. Không xóa guard để sửa lỗi build.

## Xác nhận deployment

- Đối chiếu `/build-info.json` với commit mới. Public phải có `audioMode: public`, `audioFiles: 100` và revision khớp `/audio/sonia/manifest.json`.
- Các URL `/audio/sonia/001.mp3`, `027.mp3`, `080.mp3`, `100.mp3` phải trả HTTP 200, `audio/mpeg`, đúng byte/hash nguồn, có thể giải mã và phát sau chạm. Private trả 404 cho các MP3 là đúng chính sách; ZIP đã nhập vẫn phát cục bộ.
- Đóng các tab/PWA cũ rồi mở lại để SW chờ được kích hoạt; không xóa site data vì sẽ mất count/ZIP. Thử trên origin/profile chưa có ZIP để tránh nhầm âm thanh IndexedDB với MP3 từ server. Bộ ZIP đã nhập vẫn được ưu tiên theo hành vi hiện tại.
- Tải trước cả 100 MP3 bằng Settings, chờ 100/100 đã cache; ngắt mạng, reload PWA và phát các số mẫu. TTS dự phòng không đảm bảo offline. Kiểm tra Android thật vẫn cần thực hiện trên điện thoại.
- Lỗi `public` thiếu file/quyền: xem dòng `Public audio:` trong Build Logs, kiểm tra Git input/`.vercelignore` và hồ sơ khớp hash. Deployment lỗi không thay thế production cũ. HTTP 404 từ request trực tiếp ngoài SW nghĩa là server thiếu file; autoplay/`play()` không tạo ra 404 server.
