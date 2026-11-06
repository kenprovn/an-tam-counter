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

## Chưa thể xác nhận

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
- `npm test`: 12 kiểm thử đạt. `npm run build`: thành công. `npm run audio:check`: thất bại có chủ ý vì 0/100 MP3, đúng với trạng thái chưa có giọng thật.
