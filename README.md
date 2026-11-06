# An Tâm · Đếm biến Chú Đại Bi

Ứng dụng React + Vite, mobile-first, không tài khoản, backend hay database. Giao diện mặc định tím đen, dùng cho Android Chrome/PWA. Đếm và cài đặt lưu ngay trong localStorage. Không tự reset khi đạt mục tiêu hoặc vượt 100.

## Trạng thái giọng đọc

**Bộ file cục bộ do người dùng cung cấp: 100/100 MP3 đã qua kiểm tra kỹ thuật**, tổng 1.121.472 byte (khoảng 1,07 MiB), ngày 06/11/2026. Các file này được Git bỏ qua và chưa được công khai. Kiểm tra kỹ thuật không chứng minh danh tính giọng Sonia hay quyền phân phối. Giọng Web Speech chỉ là dự phòng, phụ thuộc thiết bị và có thể cần mạng. Không giả định Android có Sonia.

Mặc định: `en-GB-SoniaNeural` (nữ, British English, Microsoft). MP3 cho 1–100 chỉ chứa số tiếng Anh: `One`, `Twenty-seven`, `One hundred`. Ngoài phạm vi này, số đếm vẫn tăng; Web Speech đọc số nếu bật dự phòng. Tắt dự phòng thì số thiếu MP3 không phát tiếng.

## Chạy và kiểm thử

Yêu cầu Node.js 22.12+ và npm.

```powershell
npm install
npm run dev
npm test
npm run build
npm run preview
```

PWA/service worker chỉ được đăng ký trong bản production (`build` + `preview` hoặc HTTPS sau deploy). `dev` không cài service worker để tránh cache mã đang sửa. Icon PNG đã có sẵn; không cần Python khi deploy.

## Nhập bộ MP3 đã chuẩn bị

1. Đặt các tệp **001.mp3 … 100.mp3** vào `D:\01_Projects\Count\an-tam-counter\public\audio\sonia\`. Mỗi tệp đọc đúng số tương ứng. Không đổi đuôi WAV/HTML thành `.mp3`; chữ thường và ba chữ số là bắt buộc. Có thể thêm từng phần; số thiếu dùng TTS nếu đã bật dự phòng.
2. Chạy `npm run audio:check`. Công cụ kiểm tra đủ 100 tên, dung lượng 256 byte–2 MiB/tệp, chuỗi frame MPEG Layer III không bị cắt, giải mã PCM có tín hiệu, thời lượng 0,1–15 giây. Đây là giới hạn cho clip đọc một số. Tệp lỗi bị loại khỏi manifest; báo cáo chi tiết nằm ở **`.local/sonia-validation.json`**, gồm lý do lỗi, tệp thiếu, tổng byte, thời lượng, hash SHA-256 và mức tín hiệu. `npm run audio:scan` cho phép quét bộ chưa đủ mà không bắt buộc đủ 100.
3. Chạy `npm run build`, rồi `npm run preview`. Chỉ các MP3 đã đạt kiểm tra được đưa vào `dist`. **Bản build cục bộ này có chứa âm thanh riêng tư; không tải `dist` lên hosting khi chưa xác minh quyền.** Không cần cài FFmpeg cho build; decoder WASM chỉ là dependency khi phát triển/build, không đưa vào frontend.
4. Mở URL local được in ra. Settings → Âm thanh → chọn **File MP3 Sonia**. Trình duyệt kiểm tra lại hash, dung lượng và khả năng giải mã trên thiết bị; badge đếm số MP3 đã xác nhận hợp lệ, không đếm file lỗi. MP3 được ưu tiên ngay dựa trên kiểm tra lúc build; nếu thiết bị không phát được, quay về TTS theo cài đặt. Quá trình kiểm tra chạy nền, không chặn thao tác đếm.
5. MP3 đã kiểm tra được lưu vào cache theo revision. Chờ Settings báo **100/100 MP3** và **Đã lưu offline 100/100**; nút tải toàn bộ cũng kiểm tra/lưu lại 100 tệp. Sau đó có thể đóng máy chủ hoặc mất mạng và phát từ cache. Trình duyệt vẫn có thể xóa cache khi thiếu dung lượng.
6. Khi thay bộ file, chạy lại check/build và đóng các tab/PWA cũ trước khi mở bản mới. Nếu dùng `npm run dev`, việc thêm/sửa/xóa MP3 sẽ tự quét lại và tải lại trang sau khi cập nhật manifest; dữ liệu đếm vẫn được lưu.

**Bảo vệ file cục bộ:** `.gitignore` bỏ qua bộ âm thanh và `.local`; `.vercelignore` bỏ qua MP3 và `dist` khi upload bằng CLI. Build trong môi trường Vercel dừng nếu phát hiện MP3 cục bộ, nhằm tránh đưa file chưa xác minh quyền lên cloud. Không dùng `git add -f` hoặc xóa chặn khi chưa xác minh quyền. Bước cho phép phân phối cần được xử lý riêng sau khi có căn cứ quyền sử dụng phù hợp.

`manifest.json` là dữ liệu sinh tự động và cũng được Git bỏ qua. Checkout chỉ chứa mã nguồn sẽ tạo manifest **0/100** khi build; bộ file trên máy cá nhân không bị xóa hoặc thay thế. `/build-info.json` trên bản đã deploy cho biết SHA commit và số MP3 thực sự có trong bản build, giúp đối chiếu production với GitHub.

Nhận dạng nội dung tự động bằng Windows Speech Recognizer (offline, tập lựa chọn 100 số) đã khớp 1, 2, 27, 80, 99, 100; không thay thế nghe trực tiếp, không xác nhận được danh tính giọng. Báo cáo cục bộ: `.local/audio-review/recognition.json` và `.local/browser-audio-review.json`.

## How to generate Sonia MP3 files locally

Chạy `npm run audio:plan` để kiểm tra kế hoạch đủ 100 số và file hiện có. Chế độ dry-run không cần key, không gọi mạng, không tạo file và không phát sinh phí Azure. `.env.example` chỉ minh họa tên biến; script đọc biến môi trường của tiến trình, không tự nạp tệp `.env`.

1. Tự tạo/chọn Azure Speech resource mà bạn có quyền sử dụng, với quota và billing phù hợp; xem điều khoản áp dụng trong tài khoản. Việc tổng hợp có thể tính phí theo gói của bạn. Script không tự tạo tài khoản hoặc mua dịch vụ.
2. Trên **máy phát triển**, cung cấp `AZURE_SPEECH_KEY` và `AZURE_SPEECH_REGION` qua biến môi trường của tiến trình. Không gửi key vào chat, không dùng tiền tố `VITE_`, không thêm key vào source, GitHub hoặc Vercel. Có thể nhập key ẩn trong PowerShell:

```powershell
$speechSecret = Read-Host 'Azure Speech key' -AsSecureString
$env:AZURE_SPEECH_KEY = [System.Net.NetworkCredential]::new('', $speechSecret).Password
$env:AZURE_SPEECH_REGION = Read-Host 'Azure Speech region (vi du southeastasia)'
try {
  npm run audio:generate
} finally {
  Remove-Item Env:AZURE_SPEECH_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:AZURE_SPEECH_REGION -ErrorAction SilentlyContinue
  $speechSecret = $null
}
```

3. Script gọi REST API chính thức của Azure, cố định giọng Sonia, ngôn ngữ en-GB, tốc độ trung tính, âm lượng 0dB; xuất MP3 mono 24 kHz, 48 kbit/s vào `public/audio/sonia/001.mp3` … `100.mp3`. Không nhạc, không thêm câu thông báo, không thêm pause SSML. Có retry hữu hạn với lỗi quota tạm thời; file được ghi nguyên tử; khi lỗi giữ lại file đã tạo để chạy tiếp. Không in key hoặc nội dung lỗi Azure chứa thông tin tài khoản.
4. Lần chạy tiếp theo giữ file đang có. Dùng `npm run audio:generate -- --overwrite` nếu muốn tạo lại toàn bộ (sẽ tiêu thụ quota mới).
5. Chạy `npm run audio:check`, nghe kiểm tra từng file thật, đặc biệt 1, 27, 80, 99, 100: đúng Sonia, không rè/cắt chữ, không khoảng lặng dài, âm lượng tương đối đều. Công cụ kiểm tra frame và giải mã toàn bộ, không thay thế kiểm tra nghe.
6. Chạy `npm run build` để thử cục bộ. **Chỉ sau khi xác minh quyền phân phối**, mới xem xét cho phép commit MP3 và mở chặn deploy. Hiện bộ MP3 vẫn bị Git bỏ qua, không có thao tác public tự động. Không commit secret. Khi được phép host file, sử dụng bình thường không gọi API Azure.

Cũng có thể cung cấp sẵn 100 MP3 Sonia được tạo hợp lệ vào đúng thư mục rồi build. Công cụ không tự chứng minh danh tính giọng trong file được cung cấp; `generation.json` chỉ là thông tin nguồn của lượt tổng hợp, không phải chứng nhận. Không dùng Edge scraping hay endpoint không chính thức.

Tài liệu chính thức: [Azure REST TTS](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech), [giọng và ngôn ngữ hỗ trợ](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=text-to-speech).

## Âm thanh và ngoại tuyến

- Mỗi lần click vùng đếm chỉ xử lý một sự kiện `click`, không gắn đồng thời touch/click. Mọi lần chạm được nhận theo mặc định. Chống chạm nhầm tùy chọn sẽ chủ ý bỏ thao tác trong khoảng thời gian đã chọn.
- Bộ đếm cập nhật đồng bộ độc lập React render, lưu ngay; âm thanh chạy sau khi cập nhật. Dùng một đối tượng Audio duy nhất, dừng âm cũ, hủy TTS cũ, bỏ callback cũ. Không tạo hàng đợi đọc các số đã qua.
- Có bật/tắt, âm lượng, 0.75x/1x/1.25x/1.5x, nghe thử số 27, đọc khi giảm, MP3 hoặc Web Speech. Preview chủ động có thể phát dù công tắc đọc tự động đang tắt.
- Sau lần tải bản production thành công, service worker precache HTML, JS, CSS, icon và manifest để đếm offline. SW mới chờ đóng các tab cũ trước khi thay thế phiên bản, tránh trộn mã hai bản.
- Sau khi có đủ 100 file: ứng dụng tự kiểm tra và cache âm thanh, hoặc dùng **Cài đặt → Âm thanh → Tải 100 file để nghe offline**. Chờ đủ **100/100 trên thiết bị** trước khi ngắt mạng. Tải gián đoạn có thể tiếp tục, có tiến độ và không chấp nhận lỗi 404/HTML, file sai hash hay lỗi giải mã. Hỗ trợ byte range khi Chrome phát MP3 đã cache. Thư viện cache có revision theo nội dung, tránh phát nhầm file cũ sau khi thay bộ giọng.
- Cache trình duyệt có thể bị hệ điều hành xóa khi thiếu dung lượng hoặc người dùng xóa dữ liệu. TTS dự phòng chỉ offline nếu thiết bị có giọng offline phù hợp; ứng dụng không cam kết điều đó.
- Không nhận chạm khi điện thoại khóa màn hình. Wake Lock chỉ là yêu cầu giữ sáng trong lúc ứng dụng hiển thị và có thể bị hệ điều hành từ chối.

## Tính năng khác

Giảm/tăng, nhập số, hoàn tác (100 lần gần nhất trong phiên), mục tiêu tùy chỉnh, reset có xác nhận, xuất/nhập JSON có xác nhận, 6 theme, cỡ chữ, tắt sáng/chuyển động, giảm chuyển động theo hệ thống, rung tùy chọn, chống chạm nhầm, Wake Lock, toàn màn hình, tiết kiệm pin, nút cài PWA khi trình duyệt cho phép. Không có ảnh tôn giáo, font hoặc ảnh tải ngoài.

Màn hình chính theo mockup: tiêu đề nhỏ, ba cụm Đọc số / − số + / Cài đặt, vùng chạm lớn chiếm phần còn lại. Mục tiêu, hoàn tác, cài PWA và trạng thái thư viện Sonia nằm trong Settings để giữ màn hình đếm gọn. Hai màu tím đen và xanh lá dùng cùng bố cục; các theme khác vẫn hoạt động.

## Triển khai Vercel Hobby

Repository: `https://github.com/kenprovn/an-tam-counter.git`, nhánh `main`. Import repository trong Vercel và chọn:

| Thiết lập | Giá trị |
| --- | --- |
| Framework | Vite |
| Root Directory | `./` |
| Install | `npm install` |
| Build | `npm run build` |
| Output | `dist` |
| Environment variables | Không cần |

`vercel.json` đã cấu hình build và tránh giữ manifest/SW cũ trong HTTP cache. Không có serverless functions hay API lúc đếm. Hosting vẫn chịu quota và điều khoản của gói Vercel của bạn.

Trên Android: mở URL HTTPS trong Chrome → menu ⋮ → Cài đặt ứng dụng / Thêm vào màn hình chính. Mở ứng dụng ít nhất một lần khi có mạng, tải bộ giọng khi đã có, bật chế độ máy bay rồi kiểm tra lại. Localhost của máy tính không phải localhost của điện thoại.

## Cấu trúc

`src/components`: cài đặt và hộp thoại; `src/audio`: player, số tiếng Anh, cache; `src/utils`: bộ đếm và storage; `src/hooks`: Wake Lock; `scripts`: Azure generator, manifest MP3 và service worker; `tests`: logic đếm, âm thanh và cache offline.

Giới hạn kiểm thử: unit test dùng Audio/TTS giả lập để kiểm tra logic, không phải file giọng giả. Kiểm thử trình duyệt desktop ở viewport nhỏ không thay thế kiểm tra trên Android thật. Xem `docs/verification.md` để biết trạng thái được kiểm tra.
