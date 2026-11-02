const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { Server } = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

loadLocalEnv();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 5000;
const DB_DIR = path.join(__dirname, 'database');
const DB_PATH = path.join(DB_DIR, 'examshield.sqlite');
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'examshield-dev-secret-change-me';
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS || 60 * 60 * 8);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleAuthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const MAIL_MODE = (process.env.MAIL_MODE || 'demo').toLowerCase();
const GMAIL_SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || process.env.GMAIL_USER || '';
const GMAIL_USER = process.env.GMAIL_USER || GMAIL_SENDER_EMAIL;
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN || '';
const ALLOW_GOOGLE_AUTO_CREATE_STUDENT = process.env.ALLOW_GOOGLE_AUTO_CREATE_STUDENT === 'true';

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const db = new sqlite3.Database(DB_PATH);

app.use(cors());
app.use(express.json({ limit: '16mb' }));

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const separatorIndex = line.indexOf('=');
    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = line.slice(separatorIndex + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function onRun(err) {
    if (err) reject(err); else resolve({ id: this.lastID, changes: this.changes });
  }));
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));
}
function signTokenPart(value) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(value).digest('base64url');
}
function createToken(user) {
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(JSON.stringify({
    id: user.id,
    role: user.role,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }));
  return `${header}.${payload}.${signTokenPart(`${header}.${payload}`)}`;
}
function parseToken(header) {
  if (!header) return null;
  const token = header.replace('Bearer ', '');
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) return null;
    const expected = signTokenPart(`${encodedHeader}.${encodedPayload}`);
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
    const auth = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!auth.exp || auth.exp < Math.floor(Date.now() / 1000)) return null;
    return auth;
  } catch { return null; }
}
function requireRole(roles = []) {
  return async (req, res, next) => {
    const auth = parseToken(req.headers.authorization || '');
    if (!auth) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (roles.length && !roles.includes(auth.role)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const user = await get('SELECT id, role, status FROM users WHERE id=?', [auth.id]);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (user.role !== auth.role) return res.status(403).json({ success: false, message: 'Role changed. Please login again.' });
    if (user.status === 'pending') return res.status(403).json({ success: false, message: 'Tai khoan dang cho xac nhan.' });
    if (user.status === 'locked' || user.status === 'disabled') return res.status(403).json({ success: false, message: 'Tai khoan dang bi khoa hoac vo hieu hoa.' });
    req.auth = auth;
    next();
  };
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('base64url');
  return `pbkdf2$120000$${salt}$${hash}`;
}
function isPasswordHash(value) {
  return typeof value === 'string' && value.startsWith('pbkdf2$');
}
function verifyPassword(password, stored) {
  if (!isPasswordHash(stored)) return String(password) === String(stored);
  const [, iterations, salt, hash] = stored.split('$');
  const candidate = crypto.pbkdf2Sync(String(password), salt, Number(iterations), 32, 'sha256').toString('base64url');
  const left = Buffer.from(candidate);
  const right = Buffer.from(hash);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function roleLabelBackend(role) {
  return role === 'student' ? 'Sinh viên' : role === 'instructor' ? 'Giảng viên' : role === 'admin' ? 'Admin' : role;
}
function toSafeUser(r) {
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    role: r.role,
    studentCode: r.student_code,
    className: r.class_name,
    phone: r.phone || '',
    gmail: r.gmail || '',
    avatarUrl: r.avatar_url || '',
    status: r.status || 'active',
    createdAt: r.created_at,
  };
}
function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function buildRawEmail({ from, to, subject, html, text }) {
  const boundary = 'examshield-' + Date.now();
  const safeSubject = Buffer.from(subject, 'utf8').toString('base64');
  const message = [
    'From: ExamShield <' + from + '>', 'To: ' + to, 'Subject: =?UTF-8?B?' + safeSubject + '?=', 'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary=\"' + boundary + '\"', '', '--' + boundary,
    'Content-Type: text/plain; charset=\"UTF-8\"', '', text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), '', '--' + boundary,
    'Content-Type: text/html; charset=\"UTF-8\"', '', html, '', '--' + boundary + '--'
  ].join('\n');
  return encodeBase64Url(message);
}
function getMailConfigStatus() {
  if (MAIL_MODE === 'smtp') {
    const missing = [];
    if (!GMAIL_USER) missing.push('GMAIL_USER');
    if (!GMAIL_SENDER_EMAIL) missing.push('GMAIL_SENDER_EMAIL');
    if (!GMAIL_APP_PASSWORD) missing.push('GMAIL_APP_PASSWORD');
    return {
      mode: MAIL_MODE,
      configured: missing.length === 0,
      missing,
      senderEmail: GMAIL_SENDER_EMAIL || null,
      smtpUser: GMAIL_USER || null,
    };
  }
  if (MAIL_MODE === 'gmail_api') {
    const missing = [];
    if (!GMAIL_SENDER_EMAIL) missing.push('GMAIL_SENDER_EMAIL');
    if (!GMAIL_CLIENT_ID) missing.push('GMAIL_CLIENT_ID');
    if (!GMAIL_CLIENT_SECRET) missing.push('GMAIL_CLIENT_SECRET');
    if (!GMAIL_REFRESH_TOKEN) missing.push('GMAIL_REFRESH_TOKEN');
    return {
      mode: MAIL_MODE,
      configured: missing.length === 0,
      missing,
      senderEmail: GMAIL_SENDER_EMAIL || null,
    };
  }
  return { mode: MAIL_MODE || 'demo', configured: false, missing: ['MAIL_MODE=smtp'], senderEmail: GMAIL_SENDER_EMAIL || null };
}
function toMailErrorMessage(error) {
  const parts = [];
  if (error?.code) parts.push(String(error.code));
  if (error?.responseCode) parts.push('SMTP ' + error.responseCode);
  if (error?.command) parts.push(String(error.command));
  if (error?.response) parts.push(String(error.response));
  if (!parts.length && error?.message) parts.push(error.message);
  return parts.join(' - ') || 'Unknown mail error';
}
function toUserMailErrorMessage(error) {
  const raw = toMailErrorMessage(error);
  const normalized = raw.toUpperCase();
  if (normalized.includes('ETIMEDOUT') || normalized.includes('ECONNRESET') || normalized.includes('CONN')) {
    return raw + '. Render Free blocks outbound SMTP ports 25/465/587, so Gmail SMTP cannot connect from this service. Use MAIL_MODE=gmail_api with GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN, or upgrade Render to a paid instance.';
  }
  if (normalized.includes('EAUTH') || normalized.includes('535') || normalized.includes('AUTH')) {
    return raw + '. Gmail rejected the SMTP login. Create a new Gmail App Password and put it in GMAIL_APP_PASSWORD.';
  }
  return raw;
}
async function sendGmailMessage({ to, subject, html, text }) {
  if (MAIL_MODE === 'smtp') {
    const missing = [];
    if (!GMAIL_USER) missing.push('GMAIL_USER');
    if (!GMAIL_SENDER_EMAIL) missing.push('GMAIL_SENDER_EMAIL');
    if (!GMAIL_APP_PASSWORD) missing.push('GMAIL_APP_PASSWORD');
    if (missing.length) {
      throw new Error('SMTP is not configured: missing ' + missing.join(', '));
    }
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
    try {
      const info = await transporter.sendMail({
        from: 'ExamShield <' + GMAIL_SENDER_EMAIL + '>',
        to,
        subject,
        text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        html,
      });
      return { sent: true, mode: 'smtp', messageId: info.messageId };
    } catch (error) {
      const message = toUserMailErrorMessage(error);
      console.error('[EMAIL SMTP ERROR]', message);
      const wrapped = new Error(message);
      wrapped.code = error?.code;
      wrapped.responseCode = error?.responseCode;
      throw wrapped;
    }
  }

  if (MAIL_MODE === 'gmail_api') {
    const missing = [];
    if (!GMAIL_SENDER_EMAIL) missing.push('GMAIL_SENDER_EMAIL');
    if (!GMAIL_CLIENT_ID) missing.push('GMAIL_CLIENT_ID');
    if (!GMAIL_CLIENT_SECRET) missing.push('GMAIL_CLIENT_SECRET');
    if (!GMAIL_REFRESH_TOKEN) missing.push('GMAIL_REFRESH_TOKEN');
    if (missing.length) {
      throw new Error('Gmail API is not configured: missing ' + missing.join(', '));
    }
    const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const raw = buildRawEmail({ from: GMAIL_SENDER_EMAIL, to, subject, html, text });
    const response = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    return { sent: true, mode: 'gmail_api', messageId: response.data.id };
  }

  console.log('[EMAIL DEMO] Would send email to ' + to + ': ' + subject);
  return { sent: false, mock: true, reason: 'MAIL_MODE=demo' };
}
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }
function secondsToHuman(seconds) { const safe = Math.max(0, Number(seconds) || 0); const h = Math.floor(safe / 3600); const m = Math.floor((safe % 3600) / 60); const sec = safe % 60; return h ? h + ' giờ ' + m + ' phút ' + sec + ' giây' : m + ' phút ' + sec + ' giây'; }
function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function otpEmailHtml({ name, code, gmail }) {
  return '<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#111827;">' +
    '<div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dbeafe;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,.08);">' +
    '<div style="background:#0f172a;color:#fff;padding:22px 24px;"><h2 style="margin:0 0 8px;">ExamShield - Xác thực Gmail</h2><p style="margin:0;color:#cbd5e1;">Mã OTP xác thực Gmail liên hệ trong hồ sơ cá nhân.</p></div>' +
    '<div style="padding:24px;"><p>Xin chào <b>' + escapeHtml(name || 'người dùng') + '</b>,</p>' +
    '<p>Bạn đang yêu cầu xác thực Gmail liên hệ: <b>' + escapeHtml(gmail) + '</b>.</p>' +
    '<div style="font-size:34px;letter-spacing:8px;font-weight:800;color:#2563eb;background:#eff6ff;border:1px dashed #60a5fa;border-radius:14px;padding:16px;text-align:center;margin:20px 0;">' + escapeHtml(code) + '</div>' +
    '<p>Mã này có hiệu lực trong <b>10 phút</b>. Không chia sẻ mã này cho người khác.</p>' +
    '<p style="margin-top:18px;color:#64748b;font-size:13px;">Email này được gửi tự động từ hệ thống ExamShield.</p></div></div></div>';
}

function resultEmailHtml({ student, exam, score, correct, total, warningCount, status, startedAt, submittedAt, timeSpentSeconds, logs }) {
  const rows = (logs || []).map((log) => '<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">' + escapeHtml(log.created_at) + '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">' + escapeHtml(log.type) + '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">' + escapeHtml(log.detail) + '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">' + escapeHtml(log.severity) + '</td></tr>').join('');
  return '<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#111827;"><div style="max-width:760px;margin:auto;background:#fff;border:1px solid #dbeafe;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,.08);"><div style="background:#0f172a;color:#fff;padding:24px;"><h2 style="margin:0 0 8px;">ExamShield - Kết quả bài thi</h2><p style="margin:0;color:#cbd5e1;">Chi tiết điểm, log hành vi, ngày giờ và thời gian làm bài.</p></div><div style="padding:24px;"><h3 style="margin:0 0 12px;">' + escapeHtml(exam?.title || '') + ' (' + escapeHtml(exam?.subject || '') + ')</h3><table style="width:100%;border-collapse:collapse;margin-bottom:20px;"><tr><td style="padding:8px;font-weight:bold;">Sinh viên</td><td style="padding:8px;">' + escapeHtml(student?.full_name) + ' - ' + escapeHtml(student?.student_code || student?.email) + '</td></tr><tr><td style="padding:8px;font-weight:bold;">Điểm</td><td style="padding:8px;font-size:22px;font-weight:bold;color:#2563eb;">' + score + '/10</td></tr><tr><td style="padding:8px;font-weight:bold;">Số câu đúng</td><td style="padding:8px;">' + correct + '/' + total + '</td></tr><tr><td style="padding:8px;font-weight:bold;">Cảnh báo/vi phạm</td><td style="padding:8px;">' + warningCount + '</td></tr><tr><td style="padding:8px;font-weight:bold;">Trạng thái</td><td style="padding:8px;">' + (status === 'flagged' ? 'Bị gắn cờ' : 'Đã nộp') + '</td></tr><tr><td style="padding:8px;font-weight:bold;">Bắt đầu</td><td style="padding:8px;">' + escapeHtml(startedAt || 'Không có dữ liệu') + '</td></tr><tr><td style="padding:8px;font-weight:bold;">Nộp bài</td><td style="padding:8px;">' + escapeHtml(submittedAt) + '</td></tr><tr><td style="padding:8px;font-weight:bold;">Thời gian làm bài</td><td style="padding:8px;">' + secondsToHuman(timeSpentSeconds) + '</td></tr></table><h3>Log hành vi</h3><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;"><thead><tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;">Thời gian</th><th style="padding:8px;text-align:left;">Loại</th><th style="padding:8px;text-align:left;">Chi tiết</th><th style="padding:8px;text-align:left;">Mức</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4" style="padding:12px;color:#64748b;">Không có log vi phạm trong phiên thi.</td></tr>') + '</tbody></table><p style="margin-top:18px;color:#64748b;font-size:13px;">Email này được gửi tự động từ hệ thống ExamShield.</p></div></div></div>';
}

async function seedExam(title, subject, durationMinutes, createdBy, status, questionList) {
  const exam = await run(
    `INSERT INTO exams (title, subject, description, duration_minutes, status, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
    [title, subject, `${subject} secure exam`, durationMinutes, status, createdBy]
  );
  for (let i = 0; i < questionList.length; i += 1) {
    const q = questionList[i];
    await run(
      `INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_index, points, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [exam.id, q.question, q.options[0], q.options[1], q.options[2], q.options[3], q.correctIndex, q.points || 1, i + 1]
    );
  }
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    student_code TEXT UNIQUE,
    class_name TEXT,
    phone TEXT,
    gmail TEXT,
    avatar_url TEXT,
    google_sub TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  const userColumns = await all(`PRAGMA table_info(users)`);
  const names = userColumns.map((c) => c.name);
  for (const [column, definition] of [['phone', 'TEXT'], ['gmail', 'TEXT'], ['avatar_url', 'TEXT'], ['google_sub', 'TEXT'], ['status', "TEXT DEFAULT 'active'"]]) {
    if (!names.includes(column)) await run(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
  }

  await run(`CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    status TEXT DEFAULT 'draft',
    created_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_index INTEGER NOT NULL,
    points INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 1,
    FOREIGN KEY(exam_id) REFERENCES exams(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    exam_id INTEGER,
    type TEXT NOT NULL,
    detail TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    warning_value INTEGER DEFAULT 1,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    score REAL NOT NULL,
    correct_count INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    warning_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'submitted',
    started_at TEXT,
    submitted_at TEXT,
    time_spent_seconds INTEGER DEFAULT 0,
    result_email_sent INTEGER DEFAULT 0,
    answers_json TEXT,
    anti_cheat_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exam_id, student_id)
  )`);

  const submissionColumns = await all(`PRAGMA table_info(submissions)`);
  const submissionNames = submissionColumns.map((c) => c.name);
  for (const [column, definition] of [['started_at', 'TEXT'], ['submitted_at', 'TEXT'], ['time_spent_seconds', 'INTEGER DEFAULT 0'], ['result_email_sent', 'INTEGER DEFAULT 0']]) {
    if (!submissionNames.includes(column)) await run(`ALTER TABLE submissions ADD COLUMN ${column} ${definition}`);
  }

  await run(`CREATE TABLE IF NOT EXISTS exam_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exam_id, student_id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    actor_id INTEGER,
    type TEXT DEFAULT 'system',
    icon TEXT DEFAULT '🔔',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    gmail TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT DEFAULT 'profile_gmail',
    is_verified INTEGER DEFAULT 0,
    used INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    verified_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  const userCount = await get('SELECT COUNT(*) as count FROM users');
  if (!userCount?.count) {
    await run(
      `INSERT INTO users (full_name, email, password, role, student_code, class_name, phone, gmail, avatar_url, status) VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Phạm Văn Đức', 'student@example.com', '123456', 'student', 'SV001', 'KTPM01', '0901000001', 'student@gmail.com', '', 'active',
        'Nguyễn Thị Lan', 'student2@example.com', '123456', 'student', 'SV002', 'KTPM01', '0901000002', 'student2@gmail.com', '', 'active',
        'Giảng viên Demo', 'instructor@example.com', '123456', 'instructor', null, null, '0902000001', 'instructor@gmail.com', '', 'active',
        'Admin Demo', 'admin@example.com', '123456', 'admin', null, null, '0903000001', 'admin@gmail.com', '', 'active',
      ]
    );
  }

  const examCount = await get('SELECT COUNT(*) as count FROM exams');
  if (!examCount?.count) {
    const instructor = await get(`SELECT id FROM users WHERE email = 'instructor@example.com'`);
    await seedExam('Kiểm tra giữa kỳ: OWASP & Web Security', 'CS447', 45, instructor.id, 'active', [
      { question: 'OWASP Top 10 2021 đứng đầu là gì?', options: ['XSS', 'Broken Access Control', 'CSRF', 'Misconfiguration'], correctIndex: 1 },
      { question: 'Biện pháp tốt nhất chống SQL Injection?', options: ['Escaping thủ công', 'Prepared Statements', 'Ẩn lỗi SQL', 'Đổi port DB'], correctIndex: 1 },
      { question: 'Cookie HttpOnly giúp gì?', options: ['Chỉ HTTPS', 'JS không đọc được cookie', 'Cookie nặng hơn', 'Mã hóa DB'], correctIndex: 1 },
      { question: 'Header chống clickjacking?', options: ['X-Frame-Options', 'Server', 'Accept', 'ETag'], correctIndex: 0 },
      { question: 'CSP dùng chủ yếu để giảm?', options: ['DDoS', 'XSS', 'ARP', 'SMTP'], correctIndex: 1 },
    ]);
    await seedExam('Kiểm tra chương 4: TCP/IP Protocol', 'NET301', 60, instructor.id, 'finished', [
      { question: 'TCP thuộc tầng nào?', options: ['Ứng dụng', 'Vận chuyển', 'Mạng', 'Liên kết'], correctIndex: 1 },
      { question: 'Giao thức không kết nối?', options: ['TCP', 'UDP', 'TLS', 'SSH'], correctIndex: 1 },
      { question: 'Địa chỉ IP version hiện đại?', options: ['IPv2', 'IPv4/IPv6', 'IPX', 'ARP'], correctIndex: 1 },
    ]);
  }

  const legacyUsers = await all('SELECT id, password FROM users');
  for (const legacyUser of legacyUsers) {
    if (!isPasswordHash(legacyUser.password)) {
      await run('UPDATE users SET password=? WHERE id=?', [hashPassword(legacyUser.password), legacyUser.id]);
    }
  }
}

async function buildStats() {
  const exams = await get('SELECT COUNT(*) as count FROM exams');
  const students = await get("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
  const submissions = await get('SELECT COUNT(*) as count FROM submissions');
  const avgScore = await get('SELECT ROUND(AVG(score), 1) as avg FROM submissions');
  const violations = await get('SELECT COUNT(*) as count FROM logs');
  const examRows = await all(`SELECT e.id, e.title, e.subject, e.status, e.duration_minutes, e.created_at,
      (SELECT COUNT(*) FROM users u WHERE u.role = 'student') as participants,
      (SELECT COUNT(*) FROM submissions sub WHERE sub.exam_id = e.id) as submittedCount,
      (SELECT COUNT(*) FROM logs l WHERE l.exam_id = e.id AND l.warning_value > 0) as violationCount
    FROM exams e ORDER BY e.id DESC`);
  return { overview: { totalExams: exams.count, totalStudents: students.count, totalSubmissions: submissions.count, averageScore: avgScore.avg || 0, totalViolations: violations.count }, exams: examRows };
}
async function broadcastStats() { io.emit('stats:update', await buildStats()); }

async function createNotifications({ roles = [], userIds = [], actorId = null, type = 'system', icon = '🔔', title, message }) {
  const roleList = Array.isArray(roles) ? roles.filter(Boolean) : [];
  const idList = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  if (!title || !message || (!roleList.length && !idList.length)) return [];
  const clauses = [];
  const params = [];
  if (roleList.length) {
    clauses.push('role IN (' + roleList.map(() => '?').join(',') + ')');
    params.push(...roleList);
  }
  if (idList.length) {
    clauses.push('id IN (' + idList.map(() => '?').join(',') + ')');
    params.push(...idList);
  }
  const targets = await all('SELECT id FROM users WHERE ' + clauses.join(' OR '), params);
  const uniqueIds = [...new Set(targets.map((u) => u.id))];
  const created = [];
  for (const userId of uniqueIds) {
    const result = await run(`INSERT INTO notifications (user_id, actor_id, type, icon, title, message) VALUES (?, ?, ?, ?, ?, ?)`, [userId, actorId, type, icon, title, message]);
    const row = await get('SELECT * FROM notifications WHERE id=?', [result.id]);
    created.push(row);
  }
  if (created.length) io.emit('notification:new', { targetUserIds: uniqueIds, notifications: created });
  return created;
}
io.on('connection', (socket) => socket.emit('connected', { ok: true }));

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'ExamShield backend is running.' }));
app.get('/api/mail/status', requireRole(['instructor', 'admin']), (_req, res) => {
  res.json({ success: true, mail: getMailConfigStatus() });
});
app.post('/api/mail/test', requireRole(['instructor', 'admin']), async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE id=?', [req.auth.id]);
    const to = String(req.body?.to || user?.gmail || user?.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ success: false, message: 'Invalid test email address.' });
    const status = getMailConfigStatus();
    if (!status.configured) return res.status(400).json({ success: false, message: 'Mail is not configured: missing ' + status.missing.join(', '), mail: status });
    const result = await sendGmailMessage({
      to,
      subject: 'ExamShield - SMTP test',
      text: 'ExamShield SMTP test email. If you received this, mail delivery is working.',
      html: '<p>ExamShield SMTP test email.</p><p>If you received this, mail delivery is working.</p>',
    });
    res.json({ success: true, message: 'Test email sent.', emailInfo: result, mail: status });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Mail test failed: ' + error.message, mail: getMailConfigStatus() });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const user = await get('SELECT * FROM users WHERE email = ? AND role = ?', [email, role]);
    if (!user || !verifyPassword(password, user.password)) return res.status(401).json({ success: false, message: 'Sai tài khoản, mật khẩu hoặc vai trò.' });
    if (!isPasswordHash(user.password)) await run('UPDATE users SET password=? WHERE id=?', [hashPassword(password), user.id]);
    if (user.status === 'pending') return res.status(403).json({ success: false, message: 'Tài khoản đang chờ giảng viên/admin xác nhận.' });
    if (user.status === 'locked' || user.status === 'disabled') return res.status(403).json({ success: false, message: 'Tài khoản đang bị khóa hoặc vô hiệu hóa.' });
    res.json({ success: true, token: createToken(user), user: toSafeUser(user) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, role } = req.body;
    if (!GOOGLE_CLIENT_ID || !googleAuthClient) return res.status(400).json({ success: false, message: 'Backend chưa cấu hình GOOGLE_CLIENT_ID.' });
    if (!credential) return res.status(400).json({ success: false, message: 'Thiếu Google credential.' });
    const ticket = await googleAuthClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = payload?.email;
    if (!email || !payload?.email_verified) return res.status(401).json({ success: false, message: 'Gmail chưa xác thực hoặc không có email.' });
    let user = await get('SELECT * FROM users WHERE email=? OR gmail=?', [email, email]);

    // Sinh viên chưa có tài khoản: đăng ký bằng Gmail và chờ giảng viên/admin duyệt.
    if (!user && role === 'student') {
      const codeSuffix = Date.now().toString().slice(-6);
      const result = await run("INSERT INTO users (full_name, email, password, role, student_code, class_name, phone, gmail, avatar_url, google_sub, status) VALUES (?, ?, ?, 'student', ?, ?, '', ?, ?, ?, 'pending')", [payload.name || email, email, hashPassword('GOOGLE_PENDING'), 'PENDING' + codeSuffix, 'Chờ duyệt', email, payload.picture || '', payload.sub]);
      user = await get('SELECT * FROM users WHERE id=?', [result.id]);
      await createNotifications({ roles: ['admin', 'instructor'], actorId: user.id, type: 'account_pending', icon: '🕒', title: 'Sinh viên đăng ký Gmail chờ duyệt', message: user.full_name + ' (' + email + ') vừa đăng ký tài khoản sinh viên bằng Gmail. Vui lòng vào tab Tài khoản để xác nhận.' });
      await broadcastStats();
      return res.status(202).json({ success: false, pending: true, message: 'Đăng ký Gmail thành công. Tài khoản đang chờ giảng viên/admin xác nhận.' });
    }

    if (!user && ALLOW_GOOGLE_AUTO_CREATE_STUDENT) {
      const result = await run("INSERT INTO users (full_name, email, password, role, student_code, class_name, phone, gmail, avatar_url, google_sub, status) VALUES (?, ?, ?, 'student', ?, ?, '', ?, ?, ?, 'active')", [payload.name || email, email, hashPassword('GOOGLE_LOGIN'), 'SV' + Date.now().toString().slice(-6), 'AUTO', email, payload.picture || '', payload.sub]);
      user = await get('SELECT * FROM users WHERE id=?', [result.id]);
      await createNotifications({ roles: ['admin'], actorId: user.id, type: 'account', icon: '🆕', title: 'Tài khoản Google mới', message: user.full_name + ' vừa được tạo tự động qua Google Login.' });
      await broadcastStats();
    }
    if (!user) return res.status(403).json({ success: false, message: 'Gmail này chưa có tài khoản trong hệ thống. Nếu là sinh viên, hãy chọn vai trò Sinh viên rồi đăng ký bằng Google để chờ duyệt.' });
    if (role && role !== user.role) return res.status(403).json({ success: false, message: 'Tài khoản Google này thuộc vai trò ' + roleLabelBackend(user.role) + ', không phải ' + roleLabelBackend(role) + '.' });
    if (user.status === 'pending') return res.status(403).json({ success: false, pending: true, message: 'Tài khoản đang chờ giảng viên/admin xác nhận.' });
    if (user.status === 'locked' || user.status === 'disabled') return res.status(403).json({ success: false, message: 'Tài khoản đang bị khóa hoặc vô hiệu hóa.' });
    await run('UPDATE users SET google_sub=COALESCE(google_sub, ?), avatar_url=COALESCE(NULLIF(avatar_url, ""), ?), gmail=COALESCE(NULLIF(gmail, ""), ?) WHERE id=?', [payload.sub, payload.picture || '', email, user.id]);
    user = await get('SELECT * FROM users WHERE id=?', [user.id]);
    res.json({ success: true, token: createToken(user), user: toSafeUser(user) });
  } catch (error) { res.status(500).json({ success: false, message: 'Google login lỗi: ' + error.message }); }
});

app.get('/api/me', requireRole(['student', 'instructor', 'admin']), async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = ?', [req.auth.id]);
  res.json({ success: true, user: toSafeUser(user) });
});

app.get('/api/notifications', requireRole(['student', 'instructor', 'admin']), async (req, res) => {
  const rows = await all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 80', [req.auth.id]);
  res.json({ success: true, notifications: rows.map((r) => ({ id: r.id, type: r.type, icon: r.icon, title: r.title, message: r.message, isRead: !!r.is_read, createdAt: r.created_at })) });
});
app.put('/api/notifications/read', requireRole(['student', 'instructor', 'admin']), async (req, res) => {
  await run('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.auth.id]);
  res.json({ success: true, message: 'Đã đánh dấu đã đọc.' });
});
app.post('/api/me/profile/send-gmail-otp', requireRole(['student', 'instructor', 'admin']), async (req, res) => {
  try {
    const { gmail = '' } = req.body;
    const normalizedGmail = String(gmail).trim().toLowerCase();
    if (!normalizedGmail || !/^[^\s@]+@gmail\.com$/i.test(normalizedGmail)) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Gmail hợp lệ, ví dụ: ten@gmail.com.' });
    }
    const user = await get('SELECT * FROM users WHERE id=?', [req.auth.id]);
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await run('UPDATE email_verifications SET used=1 WHERE user_id=? AND purpose=? AND gmail=? AND used=0', [req.auth.id, 'profile_gmail', normalizedGmail]);
    await run('INSERT INTO email_verifications (user_id, gmail, code, purpose, expires_at) VALUES (?, ?, ?, ?, ?)', [req.auth.id, normalizedGmail, code, 'profile_gmail', expiresAt]);
    const html = otpEmailHtml({ name: user?.full_name, code, gmail: normalizedGmail });
    let emailResult = { sent: false };
    try { emailResult = await sendGmailMessage({ to: normalizedGmail, subject: 'ExamShield - Mã OTP xác thực Gmail', html, text: 'Mã OTP ExamShield của bạn là: ' + code + '. Mã có hiệu lực trong 10 phút.' }); }
    catch (mailError) { emailResult = { sent: false, error: mailError.message }; console.error('Gmail OTP send failed:', mailError.message); }
    if (!emailResult.sent && !emailResult.mock) {
      return res.status(502).json({ success: false, message: 'Khong gui duoc OTP qua Gmail: ' + (emailResult.error || 'mail send failed'), expiresAt, emailSent: false, emailError: emailResult.error || 'mail send failed' });
    }
    await createNotifications({ userIds: [req.auth.id], actorId: req.auth.id, type: 'profile_otp', icon: '📧', title: 'Đã gửi mã xác thực Gmail', message: 'Mã OTP đã được gửi tới ' + normalizedGmail + '. Vui lòng nhập mã trong Profile để xác thực.' });
    res.json({ success: true, message: emailResult.sent ? 'Đã gửi mã OTP về Gmail.' : 'Đã tạo mã OTP ở chế độ demo.', expiresAt, emailSent: !!emailResult.sent, mockOtp: emailResult.mock ? code : undefined });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/me/profile/verify-gmail-otp', requireRole(['student', 'instructor', 'admin']), async (req, res) => {
  try {
    const { gmail = '', code = '' } = req.body;
    const normalizedGmail = String(gmail).trim().toLowerCase();
    const normalizedCode = String(code).trim();
    if (!normalizedGmail || !normalizedCode) return res.status(400).json({ success: false, message: 'Thiếu Gmail hoặc mã OTP.' });
    const row = await get(`SELECT * FROM email_verifications
      WHERE user_id=? AND gmail=? AND code=? AND purpose='profile_gmail' AND used=0
      ORDER BY id DESC LIMIT 1`, [req.auth.id, normalizedGmail, normalizedCode]);
    if (!row) return res.status(400).json({ success: false, message: 'Mã OTP không đúng hoặc đã được dùng.' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ success: false, message: 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.' });
    const existed = await get('SELECT id FROM users WHERE id<>? AND (email=? OR gmail=?)', [req.auth.id, normalizedGmail, normalizedGmail]);
    if (existed) return res.status(409).json({ success: false, message: 'Gmail này đã được dùng bởi tài khoản khác.' });
    await run('UPDATE email_verifications SET is_verified=1, used=1, verified_at=CURRENT_TIMESTAMP WHERE id=?', [row.id]);
    await run('UPDATE users SET email=?, gmail=? WHERE id=?', [normalizedGmail, normalizedGmail, req.auth.id]);
    const updated = await get('SELECT * FROM users WHERE id=?', [req.auth.id]);
    await createNotifications({ userIds: [req.auth.id], actorId: req.auth.id, type: 'profile_verified', icon: '✅', title: 'Gmail đã được xác thực', message: 'Gmail liên hệ ' + normalizedGmail + ' đã được xác thực thành công.' });
    res.json({ success: true, message: 'Xác thực Gmail thành công. Email đăng nhập đã được đổi theo Gmail mới.', user: toSafeUser(updated) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.put('/api/me/profile', requireRole(['student', 'instructor', 'admin']), async (req, res) => {
  const { phone = '', gmail = '', avatarUrl = '' } = req.body;
  const normalizedGmail = String(gmail).trim().toLowerCase();
  const current = await get('SELECT * FROM users WHERE id=?', [req.auth.id]);
  const currentGmail = String(current?.gmail || '').trim().toLowerCase();
  const currentEmail = String(current?.email || '').trim().toLowerCase();
  if (normalizedGmail) {
    const existed = await get('SELECT id FROM users WHERE id<>? AND (email=? OR gmail=?)', [req.auth.id, normalizedGmail, normalizedGmail]);
    if (existed) return res.status(409).json({ success: false, message: 'Gmail này đã được dùng bởi tài khoản khác.' });
  }
  if (normalizedGmail && normalizedGmail !== currentGmail) {
    const verified = await get(`SELECT * FROM email_verifications
      WHERE user_id=? AND gmail=? AND purpose='profile_gmail' AND is_verified=1 AND used=0 AND datetime(expires_at) > datetime('now')
      ORDER BY id DESC LIMIT 1`, [req.auth.id, normalizedGmail]);
    if (!verified) return res.status(400).json({ success: false, message: 'Gmail mới chưa được xác thực OTP. Hãy bấm gửi mã và xác thực trước khi lưu profile.' });
    await run('UPDATE email_verifications SET used=1 WHERE id=?', [verified.id]);
  }
  const nextEmail = normalizedGmail || currentEmail;
  await run('UPDATE users SET phone=?, gmail=?, email=?, avatar_url=? WHERE id=?', [phone, normalizedGmail, nextEmail, avatarUrl, req.auth.id]);
  const updated = await get('SELECT * FROM users WHERE id=?', [req.auth.id]);
  await createNotifications({ roles: ['admin'], actorId: req.auth.id, type: 'profile', icon: '👤', title: 'Cập nhật hồ sơ', message: `${updated.full_name} vừa cập nhật avatar/số điện thoại/Gmail liên hệ.` });
  res.json({ success: true, message: normalizedGmail ? 'Đã cập nhật hồ sơ và email đăng nhập theo Gmail đã xác thực.' : 'Đã cập nhật hồ sơ.', user: toSafeUser(updated) });
});

app.get('/api/accounts', requireRole(['instructor', 'admin']), async (req, res) => {
  const where = req.auth.role === 'admin' ? '' : "WHERE role='student'";
  const rows = await all(`SELECT * FROM users ${where} ORDER BY id DESC`);
  res.json({ success: true, accounts: rows.map(toSafeUser) });
});
app.post('/api/accounts', requireRole(['instructor', 'admin']), async (req, res) => {
  const { fullName, email, password = '123456', role = 'student', studentCode = null, className = null, phone = '', gmail = '', avatarUrl = '', status = 'active' } = req.body;
  if (req.auth.role === 'instructor' && role !== 'student') return res.status(403).json({ success: false, message: 'Giảng viên chỉ được thêm tài khoản sinh viên.' });
  if (!['student', 'instructor', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ.' });
  if (!fullName || !email || !password) return res.status(400).json({ success: false, message: 'Thiếu họ tên, email hoặc mật khẩu.' });
  const result = await run(`INSERT INTO users (full_name, email, password, role, student_code, class_name, phone, gmail, avatar_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [fullName, email, hashPassword(password), role, role === 'student' ? studentCode : null, role === 'student' ? className : null, phone, gmail, avatarUrl, status]);
  const actor = await get('SELECT full_name FROM users WHERE id=?', [req.auth.id]);
  await createNotifications({ userIds: [result.id], actorId: req.auth.id, type: 'account', icon: '🆕', title: 'Tài khoản mới được tạo', message: `Tài khoản ${fullName} đã được tạo. Bạn có thể đăng nhập bằng email được cấp.` });
  await createNotifications({ roles: ['admin'], actorId: req.auth.id, type: 'account', icon: '👥', title: 'Tài khoản mới', message: `${actor?.full_name || 'Người dùng'} vừa tạo tài khoản ${roleLabelBackend(role)}: ${fullName}.` });
  await broadcastStats();
  res.json({ success: true, message: role === 'student' ? 'Đã thêm tài khoản sinh viên.' : `Đã thêm tài khoản ${role}.` });
});
app.post('/api/accounts/import-students', requireRole(['instructor', 'admin']), async (req, res) => {
  const students = Array.isArray(req.body.students) ? req.body.students : [];
  if (!students.length) return res.status(400).json({ success: false, message: 'Danh sách sinh viên trống.' });
  if (students.length > 500) return res.status(400).json({ success: false, message: 'Chỉ import tối đa 500 sinh viên mỗi lần.' });

  let created = 0;
  let skipped = 0;
  const errors = [];
  for (let i = 0; i < students.length; i += 1) {
    const item = students[i] || {};
    const fullName = String(item.fullName || item.name || item.hoTen || '').trim();
    const email = String(item.email || '').trim().toLowerCase();
    const password = String(item.password || '123456').trim() || '123456';
    const studentCode = String(item.studentCode || item.mssv || item.code || '').trim() || null;
    const className = String(item.className || item.class || item.lop || '').trim() || null;
    const phone = String(item.phone || item.sdt || '').trim();
    const gmail = String(item.gmail || '').trim().toLowerCase();
    if (!fullName || !email) {
      skipped += 1;
      errors.push({ row: i + 1, message: 'Thiếu họ tên hoặc email.' });
      continue;
    }
    try {
      const existed = await get('SELECT id FROM users WHERE email=? OR (student_code IS NOT NULL AND student_code=?)', [email, studentCode]);
      if (existed) {
        skipped += 1;
        errors.push({ row: i + 1, email, message: 'Email hoặc mã sinh viên đã tồn tại.' });
        continue;
      }
      await run(`INSERT INTO users (full_name, email, password, role, student_code, class_name, phone, gmail, avatar_url, status)
        VALUES (?, ?, ?, 'student', ?, ?, ?, ?, '', 'active')`, [fullName, email, hashPassword(password), studentCode, className, phone, gmail]);
      created += 1;
    } catch (error) {
      skipped += 1;
      errors.push({ row: i + 1, email, message: error.message });
    }
  }
  const actor = await get('SELECT full_name FROM users WHERE id=?', [req.auth.id]);
  await createNotifications({ roles: ['admin'], actorId: req.auth.id, type: 'account_import', icon: '👥', title: 'Import danh sách sinh viên', message: `${actor?.full_name || 'Người dùng'} vừa import ${created} sinh viên, bỏ qua ${skipped} dòng.` });
  await broadcastStats();
  res.json({ success: true, message: `Đã import ${created} sinh viên. Bỏ qua ${skipped} dòng.`, created, skipped, errors: errors.slice(0, 50) });
});
app.put('/api/accounts/:id/approve', requireRole(['instructor', 'admin']), async (req, res) => {
  const account = await get('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!account) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
  if (account.role !== 'student') return res.status(403).json({ success: false, message: 'Chỉ tài khoản sinh viên mới cần giảng viên xác nhận.' });
  await run("UPDATE users SET status='active', student_code=CASE WHEN student_code LIKE 'PENDING%' THEN 'SV' || substr('000000' || id, -6) ELSE student_code END, class_name=CASE WHEN class_name='Chờ duyệt' THEN 'Chưa phân lớp' ELSE class_name END WHERE id=?", [req.params.id]);
  const approver = await get('SELECT full_name FROM users WHERE id=?', [req.auth.id]);
  const updated = await get('SELECT * FROM users WHERE id=?', [req.params.id]);
  await createNotifications({ userIds: [updated.id], actorId: req.auth.id, type: 'account_approved', icon: '✅', title: 'Tài khoản đã được xác nhận', message: (approver?.full_name || 'Giảng viên/Admin') + ' đã xác nhận tài khoản của bạn. Bây giờ bạn có thể đăng nhập bằng Google.' });
  await createNotifications({ roles: ['admin'], actorId: req.auth.id, type: 'account_approved', icon: '✅', title: 'Tài khoản sinh viên đã duyệt', message: (approver?.full_name || 'Người dùng') + ' đã duyệt tài khoản sinh viên ' + updated.full_name + '.' });
  await broadcastStats();
  res.json({ success: true, message: 'Đã xác nhận tài khoản sinh viên.', account: toSafeUser(updated) });
});
app.put('/api/accounts/:id', requireRole(['admin']), async (req, res) => {
  const { fullName, email, password = '', role = 'student', studentCode = null, className = null, phone = '', gmail = '', avatarUrl = '', status = 'active' } = req.body;
  const nextPassword = String(password || '').trim();
  if (nextPassword) {
    await run(`UPDATE users SET full_name=?, email=?, password=?, role=?, student_code=?, class_name=?, phone=?, gmail=?, avatar_url=?, status=? WHERE id=?`,
      [fullName, email, hashPassword(nextPassword), role, role === 'student' ? studentCode : null, role === 'student' ? className : null, phone, gmail, avatarUrl, status, req.params.id]);
  } else {
    await run(`UPDATE users SET full_name=?, email=?, role=?, student_code=?, class_name=?, phone=?, gmail=?, avatar_url=?, status=? WHERE id=?`,
      [fullName, email, role, role === 'student' ? studentCode : null, role === 'student' ? className : null, phone, gmail, avatarUrl, status, req.params.id]);
  }
  await broadcastStats();
  res.json({ success: true, message: 'Đã cập nhật tài khoản.' });
});
app.delete('/api/accounts/:id', requireRole(['admin']), async (req, res) => {
  if (Number(req.params.id) === req.auth.id) return res.status(400).json({ success: false, message: 'Không thể tự xóa tài khoản đang đăng nhập.' });
  await run('DELETE FROM users WHERE id=?', [req.params.id]);
  await broadcastStats();
  res.json({ success: true, message: 'Đã xóa tài khoản.' });
});

app.get('/api/students', requireRole(['admin', 'instructor']), async (_req, res) => {
  const rows = await all(`SELECT * FROM users WHERE role='student' ORDER BY id DESC`);
  res.json({ success: true, students: rows.map(toSafeUser) });
});

app.get('/api/exams', requireRole(['student', 'instructor', 'admin']), async (_req, res) => {
  const rows = await all(`SELECT e.*, COUNT(q.id) as question_count FROM exams e LEFT JOIN questions q ON q.exam_id=e.id GROUP BY e.id ORDER BY e.id DESC`);
  res.json({ success: true, exams: rows.map((r) => ({ id: r.id, title: r.title, subject: r.subject, description: r.description, durationMinutes: r.duration_minutes, status: r.status, questionCount: r.question_count, createdAt: r.created_at })) });
});
app.get('/api/exams/:id', requireRole(['student', 'instructor', 'admin']), async (req, res) => {
  const exam = await get('SELECT * FROM exams WHERE id=?', [req.params.id]);
  if (!exam) return res.status(404).json({ success: false, message: 'Không tìm thấy đề thi.' });
  if (req.auth.role === 'student' && exam.status !== 'active') return res.status(403).json({ success: false, message: 'Đề thi chưa mở hoặc đã kết thúc.' });
  const questions = await all('SELECT * FROM questions WHERE exam_id=? ORDER BY sort_order ASC, id ASC', [req.params.id]);
  const session = req.auth.role === 'student' ? await get('SELECT started_at FROM exam_sessions WHERE exam_id=? AND student_id=?', [req.params.id, req.auth.id]) : null;
  const startedAt = session?.started_at || null;
  const startedMs = startedAt ? new Date(startedAt).getTime() : 0;
  const elapsedSeconds = Number.isFinite(startedMs) && startedMs ? Math.max(0, Math.round((Date.now() - startedMs) / 1000)) : 0;
  const remainingSeconds = req.auth.role === 'student' && startedAt ? Math.max(0, (Number(exam.duration_minutes) || 0) * 60 - elapsedSeconds) : null;
  res.json({ success: true, exam: { id: exam.id, title: exam.title, subject: exam.subject, description: exam.description, durationMinutes: exam.duration_minutes, status: exam.status }, session: { startedAt, elapsedSeconds, remainingSeconds }, questions: questions.map((q) => ({ id: q.id, question: q.question_text, options: [q.option_a, q.option_b, q.option_c, q.option_d], correctIndex: req.auth.role === 'student' ? undefined : q.correct_index, points: q.points })) });
});
app.post('/api/exams', requireRole(['instructor', 'admin']), async (req, res) => {
  const { title, subject, description = '', durationMinutes = 45, status = 'draft', questions = [] } = req.body;
  if (!title || !subject || !Array.isArray(questions) || !questions.length) return res.status(400).json({ success: false, message: 'Thiếu dữ liệu đề thi hoặc câu hỏi.' });
  const exam = await run(`INSERT INTO exams (title, subject, description, duration_minutes, status, created_by) VALUES (?, ?, ?, ?, ?, ?)`, [title, subject, description, durationMinutes, status, req.auth.id]);
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    await run(`INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_index, points, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [exam.id, q.question, q.options[0], q.options[1], q.options[2], q.options[3], q.correctIndex, q.points || 1, i + 1]);
  }
  const creator = await get('SELECT full_name FROM users WHERE id=?', [req.auth.id]);
  await createNotifications({ roles: ['student', 'admin'], actorId: req.auth.id, type: 'exam', icon: '📝', title: status === 'active' ? 'Đề thi mới đã mở' : 'Đề thi mới được tạo', message: `${creator?.full_name || 'Giảng viên'} vừa tạo đề ${title} (${subject}).` });
  await broadcastStats();
  res.json({ success: true, message: 'Tạo đề thi thành công.', examId: exam.id });
});
app.put('/api/exams/:id', requireRole(['instructor', 'admin']), async (req, res) => {
  const { title, subject, description = '', durationMinutes = 45, status = 'draft', questions = [] } = req.body;
  const exam = await get('SELECT * FROM exams WHERE id=?', [req.params.id]);
  if (!exam) return res.status(404).json({ success: false, message: 'Không tìm thấy đề thi.' });
  const submitted = await get('SELECT COUNT(*) as count FROM submissions WHERE exam_id=?', [req.params.id]);
  if (submitted?.count) return res.status(409).json({ success: false, message: 'Đề thi đã có bài nộp, không thể sửa câu hỏi. Hãy tạo đề mới để giữ lịch sử kết quả.' });
  if (!title || !subject || !Array.isArray(questions) || !questions.length) return res.status(400).json({ success: false, message: 'Thiếu dữ liệu đề thi hoặc câu hỏi.' });
  await run('UPDATE exams SET title=?, subject=?, description=?, duration_minutes=?, status=? WHERE id=?', [title, subject, description, Number(durationMinutes) || 45, status, req.params.id]);
  await run('DELETE FROM questions WHERE exam_id=?', [req.params.id]);
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    await run(`INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_index, points, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [req.params.id, q.question, q.options[0], q.options[1], q.options[2], q.options[3], q.correctIndex, q.points || 1, i + 1]);
  }
  await createNotifications({ roles: ['admin'], actorId: req.auth.id, type: 'exam_update', icon: '📝', title: 'Đề thi đã được cập nhật', message: `Đề ${title} (${subject}) vừa được cập nhật.` });
  await broadcastStats();
  res.json({ success: true, message: 'Đã cập nhật đề thi.' });
});
app.delete('/api/exams/:id', requireRole(['instructor', 'admin']), async (req, res) => {
  const exam = await get('SELECT * FROM exams WHERE id=?', [req.params.id]);
  if (!exam) return res.status(404).json({ success: false, message: 'Không tìm thấy đề thi.' });
  const submitted = await get('SELECT COUNT(*) as count FROM submissions WHERE exam_id=?', [req.params.id]);
  if (submitted?.count) return res.status(409).json({ success: false, message: 'Đề thi đã có bài nộp, không thể xóa. Hãy chuyển sang trạng thái kết thúc.' });
  await run('DELETE FROM questions WHERE exam_id=?', [req.params.id]);
  await run('DELETE FROM exam_sessions WHERE exam_id=?', [req.params.id]);
  await run('DELETE FROM logs WHERE exam_id=?', [req.params.id]);
  await run('DELETE FROM exams WHERE id=?', [req.params.id]);
  await broadcastStats();
  res.json({ success: true, message: 'Đã xóa đề thi.' });
});
app.put('/api/exams/:id/status', requireRole(['instructor', 'admin']), async (req, res) => {
  const nextStatus = req.body.status || 'draft';
  await run('UPDATE exams SET status=? WHERE id=?', [nextStatus, req.params.id]);
  const exam = await get('SELECT title, subject FROM exams WHERE id=?', [req.params.id]);
  await createNotifications({ roles: ['student', 'admin'], actorId: req.auth.id, type: 'exam_status', icon: nextStatus === 'active' ? '✅' : nextStatus === 'finished' ? '⏹️' : '📝', title: 'Cập nhật trạng thái đề thi', message: `Đề ${exam?.title || req.params.id} đã được chuyển sang trạng thái ${nextStatus}.` });
  await broadcastStats();
  res.json({ success: true, message: 'Đã cập nhật trạng thái đề thi.' });
});

app.post('/api/log', requireRole(['student', 'instructor', 'admin']), async (req, res) => {
  const { examId = null, type, detail, severity = 'medium', warningValue = 1, metadata = {} } = req.body;
  const safeWarningValue = req.auth.role === 'student' ? Math.max(0, Math.min(5, Number(warningValue) || 1)) : 0;
  const result = await run(`INSERT INTO logs (user_id, exam_id, type, detail, severity, warning_value, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`, [req.auth.id, examId, type, detail, severity, safeWarningValue, JSON.stringify(metadata)]);
  const user = await get('SELECT full_name, student_code, email FROM users WHERE id=?', [req.auth.id]);
  const exam = examId ? await get('SELECT title FROM exams WHERE id=?', [examId]) : null;
  const payload = { id: result.id, studentName: user?.full_name || user?.email, studentCode: user?.student_code, examTitle: exam?.title, type, detail, severity, createdAt: new Date().toISOString() };
  io.emit('log:new', payload);
  await broadcastStats();
  res.json({ success: true, message: 'Đã ghi log.' });
});
app.get('/api/logs', requireRole(['instructor', 'admin']), async (_req, res) => {
  const rows = await all(`SELECT l.*, u.full_name, u.student_code, e.title as exam_title FROM logs l LEFT JOIN users u ON u.id = l.user_id LEFT JOIN exams e ON e.id = l.exam_id ORDER BY l.id DESC LIMIT 200`);
  res.json({ success: true, logs: rows.map((r) => ({ id: r.id, studentName: r.full_name, studentCode: r.student_code, examTitle: r.exam_title, type: r.type, detail: r.detail, severity: r.severity, createdAt: r.created_at })) });
});
app.post('/api/exams/:id/start', requireRole(['student']), async (req, res) => {
  const exam = await get('SELECT * FROM exams WHERE id=?', [req.params.id]);
  if (!exam) return res.status(404).json({ success: false, message: 'Không tìm thấy đề thi.' });
  if (exam.status !== 'active') return res.status(400).json({ success: false, message: 'Đề chưa mở.' });
  const existingSubmission = await get('SELECT id FROM submissions WHERE exam_id=? AND student_id=?', [exam.id, req.auth.id]);
  if (existingSubmission) return res.status(409).json({ success: false, message: 'Bạn đã nộp bài thi này, không thể làm lại.' });
  await run(`INSERT OR REPLACE INTO exam_sessions (id, exam_id, student_id, started_at, last_activity_at) VALUES ((SELECT id FROM exam_sessions WHERE exam_id=? AND student_id=?), ?, ?, COALESCE((SELECT started_at FROM exam_sessions WHERE exam_id=? AND student_id=?), CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)`, [exam.id, req.auth.id, exam.id, req.auth.id, exam.id, req.auth.id]);
  await run(`INSERT INTO logs (user_id, exam_id, type, detail, severity, warning_value, metadata) VALUES (?, ?, ?, ?, 'low', 0, ?)`, [req.auth.id, exam.id, 'Session Started', `Sinh viên bắt đầu làm đề ${exam.title}`, JSON.stringify({ phase: 'start' })]);
  io.emit('monitor:update', { examId: exam.id, userId: req.auth.id, action: 'started' });
  res.json({ success: true, message: 'Bắt đầu thi.' });
});
app.post('/api/submit', requireRole(['student']), async (req, res) => {
  try {
    const { examId, answers = {}, antiCheatState = {} } = req.body;
    const questions = await all('SELECT * FROM questions WHERE exam_id=? ORDER BY sort_order ASC, id ASC', [examId]);
    const exam = await get('SELECT * FROM exams WHERE id=?', [examId]);
    if (!exam) return res.status(404).json({ success: false, message: 'Không tìm thấy đề thi.' });
    if (exam.status !== 'active') return res.status(400).json({ success: false, message: 'Đề thi chưa mở hoặc đã kết thúc.' });
    const existingSubmission = await get('SELECT id FROM submissions WHERE exam_id=? AND student_id=?', [examId, req.auth.id]);
    if (existingSubmission) return res.status(409).json({ success: false, message: 'Bạn đã nộp bài thi này, không thể nộp lại.' });
    const student = await get('SELECT * FROM users WHERE id=?', [req.auth.id]);
    const session = await get('SELECT * FROM exam_sessions WHERE exam_id=? AND student_id=?', [examId, req.auth.id]);
    if (!session) return res.status(400).json({ success: false, message: 'Phiên thi không hợp lệ. Hãy bắt đầu bài thi trước khi nộp.' });
    const submittedAt = new Date().toISOString();
    const startedAt = session.started_at;
    const startedTime = new Date(startedAt).getTime();
    const timeSpentSeconds = Number.isFinite(startedTime) ? Math.max(0, Math.round((Date.now() - startedTime) / 1000)) : 0;
    if (timeSpentSeconds > ((Number(exam.duration_minutes) || 0) * 60) + 60) return res.status(400).json({ success: false, message: 'Đã quá thời gian nộp bài.' });
    let correct = 0;
    let earnedPoints = 0;
    let totalPoints = 0;
    questions.forEach((q) => {
      const points = Number(q.points) || 1;
      totalPoints += points;
      if (Number(answers[q.id]) === q.correct_index) {
        correct += 1;
        earnedPoints += points;
      }
    });
    const score = Number(((earnedPoints / Math.max(totalPoints, 1)) * 10).toFixed(1));
    const warningRow = await get(`SELECT COALESCE(SUM(warning_value), 0) as total FROM logs
      WHERE user_id=? AND exam_id=? AND datetime(created_at) >= datetime(?) AND type <> 'Session Started'`,
      [req.auth.id, examId, startedAt]);
    const warningCount = Number(warningRow?.total || 0);
    const status = warningCount >= 3 ? 'flagged' : 'submitted';
    await run(`INSERT INTO submissions (exam_id, student_id, score, correct_count, total_questions, warning_count, status, started_at, submitted_at, time_spent_seconds, result_email_sent, answers_json, anti_cheat_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`, [examId, req.auth.id, score, correct, questions.length, warningCount, status, startedAt, submittedAt, timeSpentSeconds, JSON.stringify(answers), JSON.stringify({ ...antiCheatState, serverWarningCount: warningCount, totalPoints, earnedPoints })]);
    await run(`INSERT INTO logs (user_id, exam_id, type, detail, severity, warning_value, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`, [req.auth.id, examId, 'Exam Submitted', 'Sinh viên nộp bài với điểm ' + score, status === 'flagged' ? 'high' : 'low', 0, JSON.stringify({ score, antiCheatState, timeSpentSeconds, warningCount })]);
    const sessionLogs = await all('SELECT * FROM logs WHERE user_id=? AND exam_id=? AND datetime(created_at) >= datetime(?) ORDER BY id ASC', [req.auth.id, examId, startedAt]);
    const targetEmail = student.gmail || student.email;
    const emailSubject = 'ExamShield - Kết quả bài thi ' + (exam?.subject || '');
    const emailHtml = resultEmailHtml({ student, exam, score, correct, total: questions.length, warningCount, status, startedAt, submittedAt, timeSpentSeconds, logs: sessionLogs });
    let emailResult = { sent: false };
    try { emailResult = await sendGmailMessage({ to: targetEmail, subject: emailSubject, html: emailHtml }); } catch (mailError) { emailResult = { sent: false, error: mailError.message }; console.error('Gmail send failed:', mailError.message); }
    await run('UPDATE submissions SET result_email_sent=? WHERE exam_id=? AND student_id=?', [emailResult.sent ? 1 : 0, examId, req.auth.id]);
    await createNotifications({ userIds: [req.auth.id], actorId: req.auth.id, type: 'result', icon: emailResult.sent ? '📧' : '🧾', title: emailResult.sent ? 'Đã gửi kết quả qua Gmail' : 'Kết quả đã được lưu', message: emailResult.sent ? 'Kết quả bài ' + exam?.title + ' đã được gửi về ' + targetEmail + '.' : 'Kết quả bài ' + exam?.title + ' đã được lưu. Gmail chưa gửi do chưa cấu hình API hoặc lỗi gửi.' });
    io.emit('submission:new', { studentId: req.auth.id, examId, score, warningCount, emailSent: emailResult.sent }); await broadcastStats();
    res.json({ success: true, score, correct, total: questions.length, warningCount, flagged: status === 'flagged', timeSpentSeconds, emailSent: emailResult.sent, emailError: emailResult.sent ? undefined : (emailResult.reason || emailResult.error || 'mail is not configured'), emailInfo: emailResult });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.get('/api/results', requireRole(['instructor', 'admin']), async (_req, res) => {
  const rows = await all(`SELECT sub.*, u.full_name, u.student_code, e.title as exam_title, e.subject FROM submissions sub JOIN users u ON u.id=sub.student_id JOIN exams e ON e.id=sub.exam_id ORDER BY sub.id DESC`);
  res.json({ success: true, results: rows.map((r) => ({ id: r.id, studentName: r.full_name, studentCode: r.student_code, examTitle: r.exam_title, subject: r.subject, score: r.score, correctCount: r.correct_count, totalQuestions: r.total_questions, warningCount: r.warning_count, status: r.status, startedAt: r.started_at, submittedAt: r.submitted_at, timeSpentSeconds: r.time_spent_seconds, emailSent: !!r.result_email_sent, createdAt: r.created_at })) });
});
app.get('/api/my-results', requireRole(['student']), async (req, res) => {
  const rows = await all(`SELECT sub.*, e.title as exam_title, e.subject
    FROM submissions sub JOIN exams e ON e.id=sub.exam_id
    WHERE sub.student_id=?
    ORDER BY sub.id DESC`, [req.auth.id]);
  res.json({ success: true, results: rows.map((r) => ({
    id: r.id,
    examId: r.exam_id,
    examTitle: r.exam_title,
    subject: r.subject,
    score: r.score,
    correctCount: r.correct_count,
    totalQuestions: r.total_questions,
    warningCount: r.warning_count,
    status: r.status,
    startedAt: r.started_at,
    submittedAt: r.submitted_at,
    timeSpentSeconds: r.time_spent_seconds,
    emailSent: !!r.result_email_sent,
    createdAt: r.created_at,
  })) });
});
app.get('/api/my-results/:id', requireRole(['student']), async (req, res) => {
  const row = await get(`SELECT sub.*, u.full_name, u.student_code, u.email, e.title as exam_title, e.subject
    FROM submissions sub JOIN users u ON u.id=sub.student_id JOIN exams e ON e.id=sub.exam_id
    WHERE sub.id=? AND sub.student_id=?`, [req.params.id, req.auth.id]);
  if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy bài nộp.' });
  let answers = {};
  try { answers = JSON.parse(row.answers_json || '{}'); } catch { answers = {}; }
  const questions = await all('SELECT * FROM questions WHERE exam_id=? ORDER BY sort_order ASC, id ASC', [row.exam_id]);
  const logs = await all('SELECT * FROM logs WHERE user_id=? AND exam_id=? AND datetime(created_at) >= datetime(?) ORDER BY id ASC', [row.student_id, row.exam_id, row.started_at || row.created_at]);
  res.json({
    success: true,
    result: {
      id: row.id,
      studentName: row.full_name,
      studentCode: row.student_code,
      email: row.email,
      examTitle: row.exam_title,
      subject: row.subject,
      score: row.score,
      correctCount: row.correct_count,
      totalQuestions: row.total_questions,
      warningCount: row.warning_count,
      status: row.status,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      timeSpentSeconds: row.time_spent_seconds,
      questions: questions.map((q) => {
        const selectedIndex = answers[q.id];
        return {
          id: q.id,
          question: q.question_text,
          options: [q.option_a, q.option_b, q.option_c, q.option_d],
          selectedIndex: selectedIndex === undefined ? null : Number(selectedIndex),
          correctIndex: q.correct_index,
          points: q.points,
          isCorrect: Number(selectedIndex) === q.correct_index,
        };
      }),
      logs: logs.map((log) => ({ id: log.id, type: log.type, detail: log.detail, severity: log.severity, warningValue: log.warning_value, createdAt: log.created_at })),
    },
  });
});
app.get('/api/results/:id', requireRole(['instructor', 'admin']), async (req, res) => {
  const row = await get(`SELECT sub.*, u.full_name, u.student_code, u.email, e.title as exam_title, e.subject
    FROM submissions sub JOIN users u ON u.id=sub.student_id JOIN exams e ON e.id=sub.exam_id WHERE sub.id=?`, [req.params.id]);
  if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy bài nộp.' });
  let answers = {};
  try { answers = JSON.parse(row.answers_json || '{}'); } catch { answers = {}; }
  const questions = await all('SELECT * FROM questions WHERE exam_id=? ORDER BY sort_order ASC, id ASC', [row.exam_id]);
  const logs = await all('SELECT * FROM logs WHERE user_id=? AND exam_id=? AND datetime(created_at) >= datetime(?) ORDER BY id ASC', [row.student_id, row.exam_id, row.started_at || row.created_at]);
  res.json({
    success: true,
    result: {
      id: row.id,
      studentName: row.full_name,
      studentCode: row.student_code,
      email: row.email,
      examTitle: row.exam_title,
      subject: row.subject,
      score: row.score,
      correctCount: row.correct_count,
      totalQuestions: row.total_questions,
      warningCount: row.warning_count,
      status: row.status,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      timeSpentSeconds: row.time_spent_seconds,
      questions: questions.map((q) => {
        const selectedIndex = answers[q.id];
        return {
          id: q.id,
          question: q.question_text,
          options: [q.option_a, q.option_b, q.option_c, q.option_d],
          selectedIndex: selectedIndex === undefined ? null : Number(selectedIndex),
          correctIndex: q.correct_index,
          points: q.points,
          isCorrect: Number(selectedIndex) === q.correct_index,
        };
      }),
      logs: logs.map((log) => ({ id: log.id, type: log.type, detail: log.detail, severity: log.severity, warningValue: log.warning_value, createdAt: log.created_at })),
    },
  });
});
app.get('/api/dashboard/stats', requireRole(['instructor', 'admin']), async (_req, res) => res.json({ success: true, ...(await buildStats()) }));

const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

initDb().then(() => server.listen(PORT, async () => {
  await broadcastStats();
  console.log(`ExamShield backend running on http://localhost:${PORT}`);
})).catch((error) => { console.error(error); process.exit(1); });
