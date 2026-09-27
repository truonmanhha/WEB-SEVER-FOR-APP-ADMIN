# Kết quả kiểm tra · 27/09/2026

Đạt trên máy Windows với dữ liệu giả và thư mục test tạm riêng:

- `npm test`: 7 nhóm tests server/crypto, gồm ưu tiên biến Neon SV_MSG_DATABASE_URL/xác minh TLS, restart database PGlite, ACK không mất archive, quyền đọc/ghi, phiên đăng nhập, CSRF, giới hạn đăng nhập, expiry, phân trang, fixture giao thức dùng chung.
- `npm run test:ui`: Edge headless, desktop 1280px/mobile 390px, đăng nhập, OTP copy giả lập (không ghi clipboard máy), escape nội dung XSS, không lưu web storage, khóa 5 phút, đổi kết nối, database restart, pagehide.
- `npm audit`: không phát hiện lỗ hổng dependency tại thời điểm kiểm tra.
- Windows `TestBackend.bat`: 206 assertions, kiểm tra dữ liệu tài khoản/vault, migration lossless, backups, cookie/phone/relationships và phục hồi trong vault test riêng.
- Windows `TestUI.bat` trên staged EXE: đạt, gồm nút xuất mã xem web bị vô hiệu hóa khi chưa cấu hình, cùng các tính năng tài khoản hiện có.
- Windows `TestMessageSync.bat` với relay cũ: 26 assertions đạt.
- Windows `TestMessageSync.bat` với server web mới/PGlite: 26 assertions đạt, gồm xuất mã reader không chứa admin/writer, lưu trước ACK, retry, reopen và revoke.

Chưa xác minh: Vercel deployment thật, PostgreSQL provider/TLS/khóa nhiều instances, backup của provider, automation trên iPhone thật, đường truyền 4G/Wi-Fi. Không dùng kết quả local thay cho checklist sau deploy trong DEPLOY.md.

Không sử dụng, xóa hoặc sửa các file vault production. Database tests không kết nối DATABASE_URL production hay đọc `.env.local` riêng.
