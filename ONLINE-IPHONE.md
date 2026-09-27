# iPhone online, không cần dây

## Luồng chính

1. Safari trên iPhone mở `https://web-sever-for-app-admin.vercel.app/download` → Mở app iPhone online.
2. Chia sẻ → Thêm vào Màn hình chính. Mở biểu tượng Secure Vault mới tạo **trước khi ghép**. Safari và app Màn hình chính có kho dữ liệu riêng; quét trong app đã cài để chỉ phải quét một lần.
3. Trên PC đăng nhập web → Tạo QR ghép iPhone. Trong app iPhone nhấn Quét QR kết nối, cấp quyền camera, quét mã.
4. Kết nối lưu trong IndexedDB của app, không có thời hạn 15 phút. 15 phút chỉ áp dụng QR chưa được ghép. App PC đăng nhập web một lần ở Thiết bị • Web để nhận các thiết bị và tin.
5. Mỗi thiết bị là một cuộc trò chuyện riêng. App gửi khi đang mở/có mạng; mất mạng giữ hàng đợi mã hóa, gửi lại khi mở hoặc có mạng.

## Cập nhật

App web lấy HTML/JS mới từ web mỗi lần mở/tải lại khi online. Không cần ký, dây, Apple ID hay AltStore. Cache offline chỉ chứa tài nguyên app công khai; không cache API, mật khẩu, khóa hoặc nội dung tin. Update không xóa IndexedDB, cấu hình, hàng đợi hoặc database server. Giữ nguyên origin, manifest ID `/phone.html`, tên database và schema để không tách kho dữ liệu khi update.

Ghi hàng đợi và đăng ký kết nối dùng transaction IndexedDB nguyên tử. Hai cửa sổ/app chạy chồng trong lúc cập nhật không được ghi đè tin mới bằng snapshot cũ; chỉ xóa đúng ID tin sau khi server đã chấp nhận bản mã. API chống trùng ID nên retry không tạo tin trùng.

Không xóa dữ liệu Safari/app, không gỡ app để cập nhật. Không hứa kết nối sống vĩnh viễn: mất dữ liệu thiết bị, thu hồi quyền, đổi domain hoặc lỗi hệ điều hành có thể cần ghép lại.

## Giới hạn iOS

PWA không đọc tự động Messages/WhatsApp, không chạy nền liên tục và không có native App Intent để Shortcuts gọi. Luồng hoàn toàn online này là **Dán → Gửi**, không được quảng cáo là tự nhận mọi SMS. Bản IPA native cũ là tùy chọn riêng, cần ký/gia hạn qua AltStore và không thuộc luồng cài online không dây.

## Bảo mật & dữ liệu

QR chứa khóa gửi/mã hóa nhưng không chứa mật khẩu web/admin/quyền đọc. Khóa nằm trong fragment, không gửi fragment đến server và được gỡ khỏi thanh địa chỉ ngay khi mở. Renderer/decoder QR được bundle tại cùng origin, không gửi QR cho dịch vụ ngoài. Server chỉ lưu token băm và khóa đọc được bọc AES-CBC/HMAC/PBKDF2. Tin AES-CBC/HMAC theo protocol 2, server lưu ciphertext tối đa 7 ngày. Browser IndexedDB lưu khóa thiết bị cục bộ, không phải iOS Keychain; bảo vệ thiết bị và tài khoản Vercel, tránh mã script không tin cậy trên cùng origin.

Migrations chỉ thêm bảng `sv_pairing_viewers`, không reset dữ liệu cũ. Các file vault Windows không thuộc triển khai này và không được upload.

## Kiểm tra

- `npm test`: backend/protocol, CSRF, QR hết hạn, ghép một lần vẫn hoạt động sau expiry/restart, giữ dữ liệu legacy.
- `npm run test:ui`: web cũ, nhiều thiết bị, decode QR thật, mất response đầu rồi retry cùng ID, reload/update không cần QR, hàng đợi offline mã hóa, download SHA/size.
- Thử thật trên iPhone còn cần: cài Màn hình chính trước, quét bằng camera trong app, gửi tin không nhạy cảm bằng 4G, mở lại sau update, khóa/mở PC. Test Chromium không thay thế Safari/iPhone thật.

Nguồn nền tảng: [Apple: cài website thành app](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios), [WebKit: Safari 17.2, chỉ cookies được sao chép khi cài app](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/), [WebKit: chính sách lưu trữ](https://webkit.org/blog/14403/updates-to-storage-policy/).
