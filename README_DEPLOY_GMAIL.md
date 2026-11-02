# ExamShield - Google Login + Gmail API + Deploy Ready

## Chức năng mới

- Đăng nhập bằng Google/Gmail qua Google Identity Services.
- Khi sinh viên nộp bài, hệ thống gửi email kết quả qua Gmail API.
- Email gồm: điểm, số câu đúng, số vi phạm/log, thời gian bắt đầu, thời gian nộp bài, tổng thời gian làm bài.
- Nếu chưa cấu hình Gmail API, hệ thống vẫn chạy và lưu kết quả bình thường, nhưng chỉ log mock email trên terminal backend.
- Backend có thể serve luôn frontend sau khi `npm run build`, phù hợp deploy một service.

## Chạy local

### Backend

```bash
cd backend
npm install
copy .env.example .env
npm start
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Mở: `http://localhost:5173`

## Tài khoản demo

```text
student@example.com / 123456
student2@example.com / 123456
instructor@example.com / 123456
admin@example.com / 123456
```

## Cấu hình Google Login

Trong Google Cloud Console, tạo OAuth Client loại Web Application. Sau đó thêm:

- Authorized JavaScript origins:
  - Local: `http://localhost:5173`
  - Deploy: domain web sau khi deploy
- Authorized redirect URIs:
  - Với Google Identity Services dạng button này thường không cần redirect URI riêng, nhưng có thể thêm domain backend nếu cần cho Gmail OAuth.

Điền Client ID vào:

Backend `.env`:

```env
GOOGLE_CLIENT_ID=...
```

Frontend `.env`:

```env
VITE_GOOGLE_CLIENT_ID=...
```

Lưu ý: Gmail đăng nhập chỉ cho vào hệ thống nếu Gmail đó đã có tài khoản trong database. Nếu muốn tự tạo tài khoản sinh viên mới qua Google Login, đổi:

```env
ALLOW_GOOGLE_AUTO_CREATE_STUDENT=true
```

## Cấu hình Gmail API gửi kết quả

Bật Gmail API trong Google Cloud Console, tạo OAuth consent/OAuth client, lấy refresh token có quyền gửi mail. Sau đó điền backend `.env`:

```env
GMAIL_SENDER_EMAIL=your_gmail@gmail.com
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
```

Nếu thiếu các biến này, app vẫn chạy nhưng email chỉ mock trên terminal backend.

## Deploy

Project có sẵn `render.yaml`. Có thể deploy lên Render dạng Web Service.

Build command:

```bash
cd backend && npm install && cd ../frontend && npm install && npm run build
```

Start command:

```bash
cd backend && npm start
```

Sau khi deploy xong, thêm domain web vào Authorized JavaScript origins của Google OAuth Client, rồi set các biến môi trường trên Render.

## Ghi chú quan trọng

- SQLite phù hợp demo đồ án. Production thật nên dùng PostgreSQL/MySQL.
- Mật khẩu demo đang lưu plain text để dễ test. Production thật nên dùng bcrypt/JWT chuẩn.
- Gmail API cần credential riêng của bạn; người khác không thể deploy/gửi mail thay nếu không có quyền Google Cloud/Gmail.


## Gmail OTP xác thực trong Profile

Bản này có thêm chức năng xác thực Gmail liên hệ ở trang Profile:

1. Người dùng vào Profile.
2. Nhập Gmail liên hệ mới, ví dụ `ten@gmail.com`.
3. Bấm **Gửi OTP**.
4. Hệ thống gửi mã OTP 6 số qua Gmail API.
5. Người dùng nhập mã và bấm **Xác thực**.
6. Sau khi xác thực thành công mới được bấm **Lưu profile** để cập nhật Gmail mới.

Nếu chưa cấu hình Gmail API, backend vẫn tạo mã OTP demo và trả về `mockOtp` để test local. Khi deploy thật, cần cấu hình đầy đủ các biến `GMAIL_SENDER_EMAIL`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.
