# Deploy Vercel và nối app

## 1. Upload đúng thư mục

Tạo repo chỉ chứa source của `WEB SEVER FOR APP ADMIN`, hoặc import thư mục này qua Vercel CLI. Không lấy cả APP ADMIN: thư mục đó có dữ liệu vault thật. Không upload `.env.local`, node_modules hay test-results. Đừng gửi khóa quản trị hoặc mã kết nối web qua chat/GitHub.

Giữ bản riêng của `.env.local`: đã có hash của mật khẩu bạn yêu cầu và khóa quản trị ngẫu nhiên. File đó KHÔNG chứa mật khẩu rõ. Khi thêm biến môi trường vào Vercel, copy giá trị sau dấu `=` chứ không copy cả dòng. Không gửi chúng cho người khác.

## 2. Database bền vững

Trong project Vercel → Storage → Marketplace, nối Neon/PostgreSQL (hoặc PostgreSQL tương thích khác) vào project. Gói miễn phí/provider có giới hạn; bạn tự chọn gói. Dùng database riêng cho production, bật backup/PITR nếu gói hỗ trợ. Preview/staging phải dùng database khác, không chạy thử vào production.

Lấy connection string **pooled** được provider cấp. TLS phải xác minh chứng chỉ; ưu tiên `sslmode=verify-full` với CA hợp lệ. Không đặt `rejectUnauthorized:false`. DATABASE_URL có user/password database là bí mật.

## 3. Vercel settings

- Runtime Node.js 24.x. Project dùng Express zero-config (`server.mjs` default export Express). Giữ root directory ở thư mục web, không đặt Output Directory thành `public` hoặc deploy dạng static-only.
- Production environment variables:

| Biến | Giá trị |
| --- | --- |
| DATABASE_URL | Connection string PostgreSQL production |
| SV_PUBLIC_ORIGIN | URL production HTTPS, ví dụ `https://ten-project.vercel.app`, không dấu `/` cuối, không đường dẫn/query |
| SV_WEB_PASSWORD_HASH | Giá trị hash từ `.env.local` riêng |
| SV_RELAY_ADMIN_TOKEN | Giá trị token ngẫu nhiên từ `.env.local` riêng |

Deploy lần đầu để biết domain nếu cần, điền SV_PUBLIC_ORIGIN rồi redeploy. Domain/app URL phải trùng hoàn toàn. Source không có token production hardcode. Cookie Secure chỉ hoạt động HTTPS.

Cold start đầu tiên tự chạy schema thêm bảng/index, không xóa dữ liệu. Có thể chạy `npm run db:migrate` với env database đúng trước deploy. Không chạy tests/migration thử vào database production. Nếu `/health` không trả `{ok:true,protocol:2}`, kiểm tra database/env. Khi chưa cấu hình đầy đủ trả 503, không âm thầm đổi sang storage tạm.

## 4. Nối Windows và iPhone

1. Mở bản SecureVault.exe đã cập nhật. Vào SMS → Cài & ghép đôi. Nhập URL production và SV_RELAY_ADMIN_TOKEN. Nút Tạo ghép đôi tạo kênh mới và giữ khóa mã hóa trên PC.
2. Nếu đã có kênh ở relay cũ, endpoint đang khóa theo kênh. Thu hồi sẽ xóa tin server/local của kênh sau xác nhận; cân nhắc lưu những tin cần giữ trước, rồi tạo kênh mới ở URL Vercel. Không thu hồi chỉ để thử nghiệm. Dữ liệu tài khoản vault không bị thay đổi.
3. App iOS quét QR ghép đôi trong vòng 15 phút. QR chứa quyền ghi và khóa mã hóa, không chụp/gửi người khác. Cài app iOS và Shortcuts là quy trình riêng; web này không thay thế chữ ký iOS và chưa có link TestFlight public.
4. Bật đồng bộ trên Windows, vault phải mở khóa. Mỗi 10 giây PC nhận tin mới và tin tồn khi PC tắt/mất mạng trong thời hạn 7 ngày.
5. Trên iPhone cấu hình automation nhận tin trong Shortcuts theo README của source iOS. App cần mạng Internet để gửi; không hứa nhận mọi tin khi iOS hạn chế automation/nền.

## 5. Xem tin trên web

1. Mở URL production và nhập mật khẩu đã đặt. Không cần nhập mật khẩu vault Windows.
2. Trong PC bấm **Sao chép mã kết nối web**, trở về web dán vào ô Mã kết nối web → Kết nối an toàn. Mã chỉ chứa quyền đọc + khóa giải mã, không chứa admin token hoặc quyền ghi.
3. Các lần sau đăng nhập là mở được hộp tin. Khóa xem được lưu mã hóa trong database. Dữ liệu chỉ giải mã trong trình duyệt.
4. Bấm số màu xanh để copy mã, hoặc Sao chép nội dung. Dùng Khóa web khi xong. Muốn đổi kênh chọn Đổi kết nối rồi đăng nhập lại.

Mật khẩu web là tài khoản dùng chung cho chủ app, không phải hệ thống đa người dùng. Biết mật khẩu và có cấu hình viewer đã lưu thì đọc được tin. Không chia sẻ mật khẩu/domain cấu hình cho người không được phép; cân nhắc password manager, WAF và bảo vệ tài khoản Vercel/database.

## 6. Checklist sau deploy (chưa thực hiện)

- Truy cập API web khi chưa đăng nhập phải trả 401, mật khẩu sai bị từ chối.
- Gửi SMS thử không nhạy cảm từ iPhone đang dùng 4G; PC trên Wi-Fi nhận đúng nội dung.
- Tắt/khóa PC, gửi tin, mở khóa PC nhận backlog; web vẫn xem được sau ACK.
- Redeploy, đăng nhập lại: kênh/cấu hình/tin còn nguyên trong cùng database.
- Kiểm tra expiry 7 ngày và backup/PITR của provider. Tin hết hạn không còn dùng được như dữ liệu lưu lâu dài; mã OTP thật thường hết hạn sớm hơn rất nhiều.
- Nếu gặp lỗi, không reset/drop database hay xóa file vault để sửa. Giữ bản backup và kiểm tra env/logs không in secrets.

Tài liệu nền tảng: [Express trên Vercel](https://vercel.com/docs/frameworks/backend/express), [Vercel Storage](https://vercel.com/docs/storage), [Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js), [Automation nhận tin iOS](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios).
