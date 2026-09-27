# Secure Vault · Message Bridge

Web riêng để xem/sao chép mã và tin nhắn iPhone, đồng thời làm server đồng bộ cho app Windows hiện có. Source ở thư mục này độc lập với thư mục APP ADMIN. Bạn tự deploy; chưa có dịch vụ production được tạo.

## Đã có

- Trang đăng nhập bằng mật khẩu, giới hạn lượt đăng nhập và cookie phiên HttpOnly/SameSite Strict. Mật khẩu bạn đặt đã được băm scrypt trong `.env.local` riêng; không có mật khẩu rõ trong source.
- Xem toàn bộ tin, nút sao chép dãy số 4–8 chữ số (nhận diện ứng viên OTP, không đảm bảo mọi số đều là OTP), sao chép nội dung, tìm kiếm, tải tin cũ hơn và cập nhật mỗi 10 giây khi tab đang mở.
- Server PostgreSQL bền vững, tương thích giao thức `/api/v2` của app iOS/Windows. PC nhận và ACK không làm mất bản web: giữ tối đa 7 ngày kể từ thời điểm gửi. Hết hạn không hiển thị; xóa vật lý khi có lần gửi mới/tạo ghép đôi hoặc khi gọi tác vụ prune.
- Tin AES-256-CBC + HMAC-SHA256; trình duyệt kiểm tra HMAC trước giải mã. Khóa xem web được bọc AES-256-GCM bằng khóa dẫn xuất PBKDF2-SHA256 từ mật khẩu, 310.000 vòng. Server không lưu khóa giải mã dạng rõ.
- Khi mở trang phải đăng nhập lại. Không lưu tin, khóa hay mật khẩu trong localStorage/sessionStorage. Tự khóa sau 5 phút không thao tác (kiểm tra mỗi 10 giây); phiên server tối đa 1 giờ. Tab nền ngừng polling; đóng/rời trang xóa nội dung trong bộ nhớ trang. Clipboard là trách nhiệm của người dùng, không thể bảo đảm xóa clipboard khi trình duyệt đóng.

## Giới hạn cần biết

iOS không cho app tự đọc tất cả SMS trong hộp thư. App iPhone vẫn phải có automation Shortcuts phù hợp để chuyển tin đến app và gửi server. Web không gỡ được giới hạn iOS, không nhận hộ tin WhatsApp, không đồng bộ vault/mật khẩu/cookie. Cần kiểm thử iPhone thật, mạng 4G/Wi-Fi, quyền Shortcuts và trạng thái nền sau deploy; hiện mới xác minh server và client Windows bằng dữ liệu giả trong thư mục tạm.

Mỗi kênh giới hạn 500 tin chưa được PC nhận, 5.000 tin còn hạn trên web; tối đa 200 kênh. Không coi đây là kho lưu trữ vĩnh viễn. Các giới hạn chống lạm dụng không thay thế tường lửa/WAF ở provider.

## Chạy / deploy

Đọc [DEPLOY.md](DEPLOY.md). Cần Node 24 và PostgreSQL riêng. Không lưu database trong filesystem tạm của Vercel. Không upload `.env.local` hoặc thư mục APP ADMIN lên GitHub. `.gitignore` và `.vercelignore` đã loại file bí mật.

```powershell
npm ci
npm run db:migrate
npm start
```

`.env.local` chưa có DATABASE_URL; khi chưa cấu hình web báo server chưa sẵn sàng, không tạo database giả để dùng production. Trang login dùng HTTPS trên Vercel; local chỉ 127.0.0.1. Không dùng URL local để ghép iPhone.

## Kiểm thử

```powershell
npm test
npm run test:ui
```

Tests tạo PostgreSQL PGlite trong thư mục TEMP có tên riêng, chỉ dùng mật khẩu/tin giả. Kiểm tra đăng nhập, session/CSRF, giới hạn thử mật khẩu qua restart, quyền đọc/ghi, pairing, ACK + archive, retry không trùng tin, phân trang, expiry, giới hạn payload, fixture giao thức .NET/iOS, AES/HMAC, giao diện desktop/mobile, chống XSS, khóa và cấu hình qua restart. UI dùng Edge headless với profile tạm, không ghi clipboard hệ điều hành.

PGlite chỉ có một kết nối, tests thay advisory lock bằng no-op và tuần tự hóa giao dịch. Khóa/đồng thời nhiều Vercel instances, TLS Postgres thật và cấu hình Vercel phải kiểm tra riêng sau deploy. Không dùng tests này để tuyên bố đã kiểm thử iPhone thật.

## An toàn dữ liệu

Schema chỉ thêm bảng/index IF NOT EXISTS, không drop hoặc truncate. Tin chỉ ACK sau khi Windows đã lưu local thành công; retry cùng ID và ciphertext được chấp nhận ngay cả sau ACK. Thiết bị khác không chiếm được kênh đã ghép đôi. Database lưu hash token, ciphertext tin và cấu hình viewer được mã hóa.

Giữ `.env.local` cùng file sync DPAPI của Windows ở nơi riêng an toàn; database backup một mình không đủ để giải mã tin nếu mất khóa. Dùng backup/PITR của provider, không tạo database mới cho mỗi deployment. Đổi URL/domain cần đổi SV_PUBLIC_ORIGIN và kết nối app. Đổi mật khẩu cần hash mới và bọc lại mã kết nối bằng mật khẩu mới; không xóa bảng tin. Thu hồi kênh trong app là thao tác xóa có xác nhận và sẽ xóa tin của kênh trên server.

Đây là bộ source chuẩn bị deploy, không phải cam kết không bao giờ mất dữ liệu khi database bị xóa, hết thời hạn lưu hoặc mất khóa.
