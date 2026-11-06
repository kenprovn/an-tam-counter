# Kiểm chứng triển khai

Ngày thực hiện: 06/11/2026 (Asia/Saigon).

## Đã kiểm tra bằng tự động

- 100 lần tăng liên tiếp tạo đúng dãy 1…100; tăng tiếp thành 101; giảm, chặn dưới 0, nhập 80, hoàn tác.
- Loại số âm, số thập phân, rỗng, ký tự, vô cực, giá trị vượt số nguyên an toàn.
- Lưu/khôi phục count + settings; xử lý storage hỏng hoặc hết quyền; chuẩn hóa dữ liệu nhập.
- Đường dẫn 001/080/100; văn bản chỉ gồm số, gồm Twenty-seven/One hundred.
- 100 lần yêu cầu phát, một Audio duy nhất, hủy giọng cũ; bỏ callback play lỗi cũ.
- Mute, volume/rate, fallback thiếu MP3, số >100, lỗi MP3, lỗi autoplay, voiceschanged đến trễ.
- Service worker trả app shell và MP3 range từ cache khi fetch mạng không hoạt động.

## Chưa thể xác nhận ở lần triển khai ban đầu

- Sonia thật: chưa có quyền truy cập resource Azure trong môi trường, 0/100 file.
- Chất lượng phát/độ đều âm lượng/khoảng lặng của file thật: cần tổng hợp và nghe kiểm tra.
- Tải và nghe đủ 100 MP3 offline trên Android thật: cần bộ MP3 thật và kiểm tra trên điện thoại.
- Offline Web Speech: phụ thuộc giọng cài trên từng thiết bị, không đảm bảo.
- Vercel production: chưa có phiên đăng nhập/token Vercel trong môi trường.

Unit test Audio dùng đối tượng mô phỏng trong bộ nhớ, không tạo hoặc phân phối MP3 giả.

## Kiểm tra trình duyệt desktop

- Bản production qua Vite preview: 100 lần click thực tế từ 0 đến 100 cho đúng 100; tiếp tục 101, giảm về 100.
- Nhập số âm hiển thị lỗi; nhập 80 và reload giữ đúng 80.
- Mở Settings/nghe thử/đổi theme không tăng số; bật/tắt đọc, đổi theme xanh lá và trở về tím hoạt động.
- Nghe thử khi thiếu MP3 hiển thị tên giọng dự phòng Microsoft David trên máy thử, không gắn nhãn là Sonia.
- Reset mở hộp xác nhận, xác nhận mới đặt về 0.
- Viewport 320 và 360 px: không có tràn ngang theo kích thước DOM; đã chụp giao diện tại `docs/mobile-preview.jpg`.
- Đã dừng tiến trình Vite preview, reload trang từ service worker cache thành công, số vẫn giữ 100, chạm tiếp lên 101. Đây là kiểm tra app shell khi máy chủ không truy cập được; không phải thử chế độ máy bay trên Android thật.
- Lần triển khai ban đầu: `npm test` có 12 kiểm thử đạt. `npm run build`: thành công. `npm run audio:check`: thất bại có chủ ý vì 0/100 MP3, đúng với trạng thái chưa có giọng thật.

## Cập nhật UI theo mockup

- Thay header kiểu editorial bằng tiêu đề gọn, icon nét sen, ba cụm Đọc số / − số + / Cài đặt. Bỏ slogan, thanh tiến độ và footer khỏi màn hình chính; mục tiêu, hoàn tác, cài PWA vẫn có trong Settings.
- Vùng chạm phủ phần còn lại của viewport, bo góc/viền nhẹ, icon ngón tay chạm, chữ lớn; theme tím và xanh được đồng bộ theo hai ảnh tham chiếu. Settings giữ drawer và bốn nhóm, tinh chỉnh typography, card, toggle và khoảng cách.
- Trình duyệt desktop: viewport 320×700 không tràn ngang hoặc cuộn dọc; vùng chạm khoảng 79%. Viewport 390×844 có vùng chạm khoảng 82%. Nút tăng/giảm có vùng chạm 44×44 px.
- Nhập 27 → chạm 28 → giảm 27 → reload vẫn 27. Mở Settings, nghe thử, đổi theme không làm tăng số. Nhập số nguyên an toàn lớn nhất không tràn toolbar tại 320px.
- Settings tại 320px có scrollWidth bằng clientWidth. Các input số/select dùng cỡ 16px trở lên để tránh zoom khi focus trên mobile. Chưa kiểm tra safe-area hoặc bàn phím trên điện thoại thật.
- Fallback khi thiếu MP3 vẫn hiển thị tên giọng Microsoft David của máy thử. Thư viện Sonia vẫn là 0/100; không tổng hợp hoặc tạo file MP3 giả.
- Thêm `npm run audio:plan`: dry-run liệt kê đúng 001…100, không cần key, không gọi mạng, không ghi file. Kiểm thử thiếu credentials xác nhận script thoát với thông báo rõ ràng.
- `npm test`: 14/14 đạt sau cập nhật; `npm run build`: thành công. Ảnh mới: `docs/mobile-preview.jpg`, `docs/ui-green.jpg`, `docs/settings-preview.jpg`.
- Bản production mới: 10 lần chạm từ 0 cho đúng 10; nhập 27 và reload vẫn 27. Sau khi dừng máy chủ preview, reload từ service worker vẫn mở được giao diện mới, chạm tăng từ 27 lên 28. Không xác nhận phát Sonia offline vì chưa có MP3 thật.

## Tích hợp bộ MP3 người dùng cung cấp — 06/11/2026

- Có đủ 001.mp3…100.mp3, 100 hash SHA-256 khác nhau, 1.121.472 byte (~1,07 MiB). Không tạo lại, đổi tên hoặc sửa file gốc.
- Kiểm tra cấu trúc MPEG Layer III và giải mã PCM của cả 100 file: không rỗng, không chỉ im lặng, không có lỗi decoder. Các file là mono 24 kHz; mẫu 027 có thời lượng 1,872 giây theo FFprobe.
- Windows Speech Recognizer cục bộ, grammar gồm 100 số: sáu mẫu 1/2/27/80/99/100 khớp văn bản, confidence 0,928–0,981. Đây là nhận dạng máy, không phải nghe trực tiếp; không xác nhận danh tính người/giọng Sonia hoặc quyền phân phối. Báo cáo chi tiết ở `.local/audio-review/recognition.json`.
- Trình duyệt desktop 390×844: kiểm tra giải mã và hash đạt 100/100, cache đủ 100/100. Với sáu số trên, đặt count = n−1 rồi chạm: count = n; sự kiện media `ended` báo đúng 001/002/027/080/099/100.mp3. Không dùng TTS trong sáu lượt này.
- Đã dừng tiến trình Vite preview, reload từ service worker và phát lại cả sáu mẫu đến sự kiện `ended` thành công. Đây là kiểm tra offline audio thực tế khi origin server không truy cập được, không chỉ đếm offline. Chưa thử chế độ máy bay/Android thật.
- Offline: thay volume sang 75%, rate 1,25x, nghe thử 027 phát đến hết; khôi phục 80%/1x. Số 101 dùng TTS dự phòng; giảm về 100 vẫn đúng. Nhập 0 rồi chạm 20 lần liên tiếp: count 20, file cuối 020.mp3 phát đến hết.
- 320×700: scrollWidth = viewport width, scrollHeight = viewport height. Không chỉnh CSS hoặc bố cục UI.
- Các file âm thanh vẫn bị `.gitignore` bỏ qua; Git không track MP3 nào trong public/audio/sonia. Không commit/push/deploy bộ này vì chưa có căn cứ xác minh quyền phân phối. Thêm chặn build Vercel khi có MP3 cục bộ và loại file lỗi khỏi dist.
- Báo cáo riêng tư: `.local/sonia-validation.json`, `.local/browser-audio-review.json`; ảnh bằng chứng `.local/sonia-offline-proof.jpg`.
- Kiểm tra cuối: `npm run audio:check` đạt 100/100; `npm test` đạt 21/21; `npm run build` thành công. Cả 100 MP3 trong dist có SHA-256 trùng file nguồn, không tái tạo hoặc thay đổi dữ liệu âm thanh.

## Kiểm tra bản phát hành chỉ có mã nguồn

- Manifest sinh tự động được bỏ khỏi Git index, vẫn giữ nguyên bản local. Không có MP3 binary nào trong commit; test signal được mã hóa trong JavaScript, không phải giọng Sonia.
- Checkout từ Git index sang thư mục kiểm tra riêng, không có 100 MP3 cục bộ; `npm ci`, 21/21 test và build với `VERCEL=1` đều thành công. Manifest của bản này có 0/100 file, dist không chứa MP3.
- `/build-info.json` ghi commit SHA và số MP3 thực sự trong bản build; không thêm thành phần giao diện.
- Đối chiếu SHA-256 trước/sau chuẩn bị phát hành: đủ 100 MP3 cục bộ, tổng 1.121.472 byte, không đổi.
