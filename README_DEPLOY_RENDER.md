# ExamShield - Render Deploy Ready

Bản này đã được sửa để deploy lên Render bằng **1 Web Service**:

- Backend Express chạy chính.
- Frontend React build ra `frontend/dist`.
- Backend tự serve `frontend/dist` khi deploy.
- Frontend production gọi API bằng `/api`, không còn gọi `localhost`.
- Socket.IO production dùng cùng domain Render.
- Có `render.yaml` để deploy nhanh.
- Email có 3 chế độ: `demo`, `smtp`, `gmail_api`.

## 1. Chạy local trên Windows

Backend:

```bash
cd backend
npm install
copy .env.example .env
npm start
```

Frontend:

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Mở:

```text
http://localhost:5173
```

Tài khoản demo:

```text
student@example.com / 123456
student2@example.com / 123456
instructor@example.com / 123456
admin@example.com / 123456
```

## 2. Deploy lên Render bằng GitHub

### Bước 1: Đưa source lên GitHub

Tạo repo GitHub rồi push toàn bộ thư mục này lên.

### Bước 2: Tạo Web Service trên Render

Render Dashboard → New → Web Service → chọn repo GitHub.

Cấu hình:

```text
Runtime: Node
Root Directory: để trống
Build Command:
cd backend && npm install && cd ../frontend && npm install && npm run build

Start Command:
cd backend && npm start
```

Hoặc dùng sẵn file `render.yaml` trong repo.

### Bước 3: Thêm Environment Variables

Tối thiểu để web chạy:

```env
PORT=10000
NODE_ENV=production
MAIL_MODE=demo
ALLOW_GOOGLE_AUTO_CREATE_STUDENT=false
```

Nếu muốn gửi OTP/kết quả thật bằng Gmail App Password:

```env
MAIL_MODE=smtp
GMAIL_SENDER_EMAIL=yourgmail@gmail.com
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password
```

Nếu muốn hiện nút đăng nhập Google:

```env
GOOGLE_CLIENT_ID=your_google_oauth_web_client_id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your_google_oauth_web_client_id.apps.googleusercontent.com
```

Lưu ý: `VITE_GOOGLE_CLIENT_ID` phải có trước lúc Render build frontend. Nếu thêm sau thì bấm Manual Deploy lại.

## 3. Cấu hình Gmail gửi OTP/kết quả

Cách dễ nhất cho đồ án là Gmail App Password:

1. Vào Google Account.
2. Security → bật 2-Step Verification.
3. Security → App Passwords.
4. Tạo App Password cho Mail.
5. Copy mã 16 ký tự đưa vào Render Environment:

```env
MAIL_MODE=smtp
GMAIL_SENDER_EMAIL=yourgmail@gmail.com
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

Sau đó restart/redeploy service.

## 4. Lưu ý SQLite trên Render Free

Bản này dùng SQLite để demo. Trên Render Free, file database local có thể mất khi service restart/redeploy. Với đồ án demo thì ổn. Nếu muốn chạy lâu dài, nên đổi sang PostgreSQL.

## 5. Kiểm tra sau deploy

Mở link Render:

```text
https://ten-service.onrender.com
```

Test:

1. Login admin: `admin@example.com / 123456`.
2. Tạo đề.
3. Chuyển đề sang trạng thái active.
4. Login sinh viên.
5. Làm bài, chuyển tab/copy để test log.
6. Submit bài.
7. Kiểm tra kết quả và email nếu đã cấu hình SMTP.

## Cập nhật: đăng ký sinh viên bằng Gmail và duyệt tài khoản

Bản này hỗ trợ luồng:

1. Sinh viên chọn vai trò **Sinh viên** ở trang đăng nhập.
2. Sinh viên bấm **Đăng nhập bằng Google** bằng Gmail cá nhân.
3. Nếu Gmail chưa có trong hệ thống, backend tự tạo tài khoản sinh viên ở trạng thái `pending`.
4. Giảng viên/Admin nhận thông báo và vào tab **Tài khoản**.
5. Bấm **Xác nhận** để chuyển tài khoản sang `active`.
6. Sinh viên đăng nhập Google lại để vào hệ thống.

Lưu ý: Render cần có cả hai biến:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

Sau khi thêm/sửa biến môi trường, hãy bấm **Manual Deploy → Deploy latest commit**.
