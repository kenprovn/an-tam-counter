# Hồ sơ quyền phát hành âm thanh

`sonia-publication.json` chỉ được tạo tại đây sau khi người có thẩm quyền đã xác minh quyền host công khai **đúng bộ file** trong `public/audio/sonia/`.

Chưa có hồ sơ được duyệt cho bộ MP3 hiện tại. Không sao chép một xác nhận của bộ khác hoặc đặt `confirmed: true` chỉ để vượt qua build.

Chạy `npm run audio:publication-draft` để tạo bản nháp **chưa được duyệt** trong `.local/`, có SHA-256 của cả 100 file. Quy trình xác minh và triển khai nằm ở [docs/audio-deployment.md](../docs/audio-deployment.md). Hồ sơ không chứa API key, hóa đơn, số tài khoản hoặc tài liệu nhạy cảm; dùng mã tham chiếu đến bằng chứng được lưu riêng.
