# Thiết bị và hộp tin riêng

## Sử dụng bản mới

1. Cập nhật app iPhone bằng bản IPA mới (ký lại bằng AltStore như bản trước). Không gỡ app cũ để cập nhật. IPA unsigned không phải link cài trực tiếp/TestFlight.
2. iPhone chưa ghép đôi: nhập tên thiết bị và mật khẩu web → **Kết nối web**. URL production được cấu hình sẵn. Sau đăng ký, app lưu quyền gửi trong Keychain và tự dùng lại; không lưu mật khẩu.
3. Đăng nhập web: thiết bị tự xuất hiện ở danh sách. Bấm một thiết bị để xem hộp tin riêng. Danh sách thiết bị làm mới khoảng 30 giây, tin của thiết bị đang chọn khoảng 10 giây.
4. PC → SMS & WhatsApp → **Thiết bị • Web** → nhập mật khẩu web → **Kết nối web** một lần. PC lưu cấu hình qua Windows DPAPI; mở khóa vault thì tự nhận danh sách thiết bị và tin chờ. Khóa app thì dừng đọc/ACK và ẩn nội dung.
5. iPhone gửi thử nội dung bằng Dán/Gửi. Muốn chuyển SMS mới, tự thiết lập automation Phím tắt → Tin nhắn → **Chuyển tin nhắn sang Secure Vault**, truyền nội dung đầu vào. iOS không cho app đọc tất cả lịch sử SMS; chạy nền/khóa màn hình cần kiểm tra trên iPhone thật.

Đây là hộp tin nhận theo thiết bị, không phải chat hai chiều gửi SMS từ web. Không có WhatsApp ingestion tự động. Khi offline, app giữ tối đa 200 bản mã và retry khi iOS cho app/Shortcut chạy. Tin trên web giữ tối đa 7 ngày, không phải kho vĩnh viễn.

## Bảo toàn dữ liệu và giao thức

- API v2 và kết nối QR/web viewer version 1 vẫn hoạt động. Bản mới không tự thu hồi, xóa hoặc thay ghép đôi cũ. iPhone đã ghép QR vẫn dùng kết nối cũ; không hủy ghép đôi để thử bản mới khi còn tin chờ.
- Migration PostgreSQL chỉ thêm bảng `sv_devices`. Không reset bảng cũ, không xóa `sv_web_config` hoặc tin hiện có.
- Điện thoại tự tạo UUID channel, read/write token riêng và hai khóa mã hóa/toàn vẹn ngẫu nhiên. Sau xác thực mật khẩu, server lưu hash token và wrapper; server không được nhận khóa mã hóa tin dạng rõ.
- Wrapper version 2: PBKDF2-SHA256 310.000 vòng, salt 16 byte, đầu ra 64 byte; 32 byte đầu AES-256-CBC/PKCS7, 32 byte cuối HMAC-SHA256. MAC trên `SV-DEVICE-KEYS-1\nsalt\niv\nciphertext`. HMAC được xác minh trước giải mã. Reader JSON vẫn là 6 trường viewer version 1, không có writer/admin token.
- Native registration được retry bằng cùng identity/key sau response mất. Không tạo thêm khung tin, không thay wrapper đã lưu trong retry. Pending đăng ký nằm trong Keychain, không chứa mật khẩu.
- Đăng nhập web có cookie HttpOnly/Secure/SameSite, CSRF và giới hạn thử mật khẩu. Phiên native chỉ đọc danh sách wrapper, token được hash và hết hạn sau 1 giờ. Password/OTP/private keys không ghi log hay URL.
- Không đổi mật khẩu web hoặc làm mất Keychain/DPAPI khi chưa có bản sao khóa. Mật khẩu mới không giải mã được wrapper cũ; đổi mật khẩu cần luồng bọc lại khóa, không xóa database để xử lý.

## Kiểm thử

Tests chỉ dùng PostgreSQL/PGlite và thư mục Windows tạm. `npm test`, `npm run test:ui`, backend/WPF smoke tests, v2 integration và `TestWebDevices.bat` bao gồm hai hộp tin tách biệt, Unicode, đăng ký retry, bảo toàn legacy config, restart sau ACK, password sai không ghi đè, HMAC giả bị từ chối, khóa không lộ nội dung và desktop/mobile layout. iOS XCTest/build ARM64 chạy qua GitHub Actions; không thay thế kiểm thử iPhone thật.
