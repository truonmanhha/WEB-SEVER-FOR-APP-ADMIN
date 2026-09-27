# Kết quả kiểm tra · 27/09/2026

Đạt trên máy Windows với dữ liệu giả và thư mục test tạm riêng:

- `npm test`: 9 nhóm tests server/crypto, thêm đăng ký bằng mật khẩu, retry không nhân đôi thiết bị, danh sách khóa đọc mã hóa, phân tách channel và migration không mất kết nối cũ; cùng Neon/TLS, quyền đọc/ghi, CSRF, giới hạn đăng nhập, ACK/archive/expiry/phân trang.
- `npm run test:ui`: Edge headless, desktop 1280px/mobile 390px; cả luồng cũ và danh sách nhiều thiết bị tự xuất hiện, chuyển khung tin không trộn nội dung, tên thiết bị XSS chỉ là text, không tràn ngang mobile, không lưu web storage, khóa 5 phút, restart và pagehide.
- `npm audit`: không phát hiện lỗ hổng dependency tại thời điểm kiểm tra.
- Windows `TestBackend.bat`: 206 assertions, kiểm tra dữ liệu tài khoản/vault, migration lossless, backups, cookie/phone/relationships và phục hồi trong vault test riêng.
- Windows `TestUI.bat` trên staged EXE: đạt, gồm nút xuất mã xem web bị vô hiệu hóa khi chưa cấu hình, cùng các tính năng tài khoản hiện có.
- Windows `TestMessageSync.bat` với relay cũ: 26 assertions đạt.
- Windows `TestMessageSync.bat` với server web mới/PGlite: 26 assertions đạt, gồm xuất mã reader không chứa admin/writer, lưu trước ACK, retry, reopen và revoke.
- Windows `TestWebDevices.bat`: 6 assertions đạt, Node tạo wrapper version 2 và .NET xác minh HMAC/giải mã PBKDF2/AES, tách tin hai thiết bị, DPAPI, stop/lock, restart sau ACK, password sai không ghi đè.
- iOS GitHub Actions [36306620300](https://github.com/truonmanhha/APP-ADMIN-FOR-IOS-/actions/runs/36306620300): 13 XCTest, 0 lỗi; build iPhone ARM64 và artifact IPA unsigned thành công. SHA-256 IPA: `5021c77231eb68eb7aa1ccb981c04864f2cbfe6196f9faf2d3d24e8ead2f8349`. Chưa cài/test thiết bị thật.
- Production ngày 27/09/2026: web đã deploy luồng thiết bị, `/health` 200/protocol 2, `/api/web/devices` 401 khi chưa đăng nhập. Có kết nối Neon thật với TLS xác minh; không đưa tin test vào database production.

Chưa xác minh: khóa nhiều PostgreSQL instances, backup/khôi phục provider, đăng ký trên iPhone thật, automation khi khóa màn hình và đường truyền 4G/Wi-Fi. Không dùng kết quả local thay cho kiểm thử điện thoại thật.

Không sử dụng, xóa hoặc sửa các file vault production. Database tests không kết nối DATABASE_URL production hay đọc `.env.local` riêng.
