import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const socket = io(SOCKET_URL, { autoConnect: true });
const SESSION_TOKEN_KEY = 'examshield-session-token';
const SESSION_USER_KEY = 'examshield-session-user';
const EXAM_DRAFT_PREFIX = 'examshield-exam-draft';

const defaultQuestion = () => ({ question: '', options: ['', '', '', ''], correctIndex: 0, points: 1 });
const emptyExamForm = { title: '', subject: '', description: '', durationMinutes: 45, status: 'draft', questions: [defaultQuestion(), defaultQuestion()] };
const emptyAccountForm = { fullName: '', email: '', password: '123456', role: 'student', studentCode: '', className: '', phone: '', gmail: '', avatarUrl: '', status: 'active' };
const antiCheatDefaults = { tabSwitches: 0, copyAttempts: 0, shortcutEvents: 0, blurEvents: 0 };

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
}
function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(safe % 60).toString().padStart(2, '0');
  return h ? `${String(h).padStart(2, '0')}:${m}:${s}` : `${m}:${s}`;
}
function statLabel(status) {
  return status === 'active' ? 'Đang chạy' : status === 'finished' ? 'Đã kết thúc' : 'Bản nháp';
}
function roleLabel(role) {
  return role === 'student' ? 'Sinh viên' : role === 'instructor' ? 'Giảng viên' : role === 'admin' ? 'Admin' : role;
}
function logTypeLabel(type) {
  const labels = {
    'Session Started': 'Bắt đầu phiên thi',
    'Exam Submitted': 'Nộp bài thi',
    'Tab Switching': 'Chuyển tab',
    'Copy Attempt': 'Sao chép nội dung',
    'Shortcut Used': 'Dùng phím tắt',
    'Window Blur': 'Rời khỏi cửa sổ thi',
  };
  return labels[type] || type;
}
function logDetailLabel(detail) {
  if (!detail) return detail;
  const exact = {
    'Nguoi dung chuyen tab hoac thu nho cua so.': 'Người dùng chuyển tab hoặc thu nhỏ cửa sổ.',
    'Nguoi dung thuc hien thao tac copy trong luc thi.': 'Người dùng thực hiện thao tác sao chép trong lúc thi.',
    'Cua so thi mat focus.': 'Cửa sổ thi mất focus.',
  };
  if (exact[detail]) return exact[detail];
  if (detail.startsWith('Nguoi dung dung to hop ')) {
    return detail.replace('Nguoi dung dung to hop ', 'Người dùng dùng tổ hợp ').replace(' trong luc thi.', ' trong lúc thi.');
  }
  if (detail.startsWith('Student started exam ')) {
    return detail.replace('Student started exam ', 'Sinh viên bắt đầu làm đề ');
  }
  if (detail.startsWith('Student submitted exam with score ')) {
    return detail.replace('Student submitted exam with score ', 'Sinh viên nộp bài với điểm ');
  }
  return detail;
}
function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, '').trim());
}
function normalizeStudentImportHeader(header) {
  const key = String(header || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    hoten: 'fullName',
    hovaten: 'fullName',
    fullname: 'fullName',
    name: 'fullName',
    email: 'email',
    mail: 'email',
    masinhvien: 'studentCode',
    mssv: 'studentCode',
    studentcode: 'studentCode',
    code: 'studentCode',
    lop: 'className',
    class: 'className',
    classname: 'className',
    sodienthoai: 'phone',
    dienthoai: 'phone',
    sdt: 'phone',
    phone: 'phone',
    gmail: 'gmail',
    matkhau: 'password',
    password: 'password',
  };
  return aliases[key] || header;
}
function parseStudentImport(text, fileName = '') {
  if (fileName.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : (parsed.students || []);
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map(normalizeStudentImportHeader);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return headers.reduce((row, header, index) => ({ ...row, [header]: cells[index] || '' }), {});
  });
}
function examDraftKey(userId, examId) {
  return `${EXAM_DRAFT_PREFIX}:${userId}:${examId}`;
}
function readExamDraft(userId, examId) {
  try {
    return JSON.parse(localStorage.getItem(examDraftKey(userId, examId)) || '{}');
  } catch { return {}; }
}
function saveExamDraft(userId, examId, answers) {
  if (!userId || !examId) return;
  localStorage.setItem(examDraftKey(userId, examId), JSON.stringify({ answers, savedAt: new Date().toISOString() }));
}
function clearExamDraft(userId, examId) {
  if (!userId || !examId) return;
  localStorage.removeItem(examDraftKey(userId, examId));
}
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function escapePrintHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function exportResultPdf(detail) {
  const rows = (detail.questions || []).map((q, index) => `
    <section class="question ${q.isCorrect ? 'correct' : 'wrong'}">
      <h3>Câu ${index + 1}: ${escapePrintHtml(q.question)}</h3>
      <div class="badge ${q.isCorrect ? 'ok' : 'bad'}">${q.isCorrect ? 'Đúng' : 'Sai'}</div>
      <ol type="A">
        ${(q.options || []).map((option, optionIndex) => {
          const marks = [
            optionIndex === q.correctIndex ? 'Đáp án đúng' : '',
            optionIndex === q.selectedIndex ? 'Đã chọn' : '',
          ].filter(Boolean).join(' · ');
          return `<li class="${optionIndex === q.correctIndex ? 'right' : ''} ${optionIndex === q.selectedIndex ? 'selected' : ''}">${escapePrintHtml(option)}${marks ? `<strong>${marks}</strong>` : ''}</li>`;
        }).join('')}
      </ol>
    </section>
  `).join('');
  const logs = (detail.logs || []).map((log) => `<tr><td>${escapePrintHtml(formatDate(log.createdAt))}</td><td>${escapePrintHtml(logTypeLabel(log.type))}</td><td>${escapePrintHtml(logDetailLabel(log.detail))}</td><td>${escapePrintHtml(log.severity || 'medium')}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapePrintHtml(detail.examTitle)} - PDF</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111827;margin:28px;line-height:1.45} h1{margin:0 0 8px;font-size:26px} h2{font-size:18px;margin:24px 0 10px}.meta{border:1px solid #dbeafe;border-radius:10px;padding:14px;background:#f8fafc;margin:16px 0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.box{border:1px solid #e5e7eb;border-radius:8px;padding:10px}.box strong{display:block;font-size:20px;color:#2563eb}.question{break-inside:avoid;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin:12px 0}.question h3{font-size:15px;margin:0 0 10px}.badge{display:inline-block;border-radius:999px;padding:4px 10px;font-weight:700;font-size:12px}.ok{background:#dcfce7;color:#166534}.bad{background:#fee2e2;color:#991b1b} li{padding:7px 9px;margin:6px 0;border-radius:7px}.right{background:#dcfce7}.selected{outline:2px solid #2563eb} li strong{float:right;font-size:12px;color:#1d4ed8} table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #e5e7eb;padding:8px;text-align:left} th{background:#eff6ff}@media print{button{display:none} body{margin:18px}}
    </style></head><body>
      <h1>ExamShield - Báo cáo kết quả bài thi</h1>
      <div class="meta"><b>${escapePrintHtml(detail.examTitle)}</b><br>${escapePrintHtml(detail.subject || '')}<br>Sinh viên: ${escapePrintHtml(detail.studentName)} · ${escapePrintHtml(detail.studentCode || detail.email || '')}</div>
      <div class="grid"><div class="box"><span>Điểm</span><strong>${escapePrintHtml(detail.score)}/10</strong></div><div class="box"><span>Số câu đúng</span><strong>${escapePrintHtml(detail.correctCount)}/${escapePrintHtml(detail.totalQuestions)}</strong></div><div class="box"><span>Cảnh báo</span><strong>${escapePrintHtml(detail.warningCount)}</strong></div><div class="box"><span>Thời gian</span><strong>${escapePrintHtml(formatTime(detail.timeSpentSeconds || 0))}</strong></div></div>
      <h2>Chi tiết câu hỏi</h2>${rows}
      <h2>Log trong phiên</h2><table><thead><tr><th>Thời gian</th><th>Loại</th><th>Chi tiết</th><th>Mức</th></tr></thead><tbody>${logs || '<tr><td colspan="4">Không có log.</td></tr>'}</tbody></table>
      <script>window.onload=()=>{window.focus();window.print();}</script>
    </body></html>`;
  const win = window.open('', '_blank', 'width=980,height=760');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
function avatarText(user) {
  return (user?.fullName || user?.email || 'U').trim().charAt(0).toUpperCase();
}

export default function App() {
  const [screen, setScreen] = useState('login');
  const [role, setRole] = useState('student');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('exams');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('examshield-theme') || 'dark');

  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [antiCheat, setAntiCheat] = useState(antiCheatDefaults);
  const [studentLogs, setStudentLogs] = useState([]);
  const [examResult, setExamResult] = useState(null);
  const [warningPopup, setWarningPopup] = useState('');
  const lastViolationRef = useRef({ signature: '', at: 0 });

  const [examForm, setExamForm] = useState(emptyExamForm);
  const [editingExamId, setEditingExamId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [profileForm, setProfileForm] = useState({ phone: '', gmail: '', avatarUrl: '' });
  const [profileOtp, setProfileOtp] = useState({ code: '', sent: false, verified: false, mockOtp: '', expiresAt: '', loading: false });
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [studentResults, setStudentResults] = useState([]);
  const [studentResultDetail, setStudentResultDetail] = useState(null);
  const [resultDetail, setResultDetail] = useState(null);
  const [stats, setStats] = useState({ overview: { totalExams: 0, totalStudents: 0, totalSubmissions: 0, averageScore: 0, totalViolations: 0 }, exams: [] });
  const [notifications, setNotifications] = useState([]);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const analyticsByType = useMemo(() => {
    const map = {};
    logs.forEach((log) => { map[log.type] = (map[log.type] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [logs]);
  const unreadNotifications = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('examshield-theme', theme);
  }, [theme]);

  useEffect(() => {
    const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!savedToken) return undefined;

    let cancelled = false;
    async function restoreSession() {
      setLoading(true);
      setMessage('Đang khôi phục phiên đăng nhập...');
      const data = await api('/me', {}, savedToken);
      if (cancelled) return;
      if (!data.success) {
        clearSavedSession();
        setLoading(false);
        setMessage('');
        return;
      }

      setToken(savedToken);
      saveSession(savedToken, data.user);
      syncUserProfile(data.user);
      if (data.user.role === 'student') await loadStudentData(savedToken);
      else await loadCommonData(savedToken);
      await loadNotifications(savedToken);
      if (cancelled) return;
      setTab('exams');
      if (data.user.role === 'student') setScreen('student');
      else {
        await loadStaffData(savedToken);
        if (!cancelled) setScreen('staff');
      }
      if (!cancelled) {
        setMessage('');
        setLoading(false);
      }
    }

    restoreSession().catch(() => {
      if (!cancelled) {
        clearSavedSession();
        setLoading(false);
        setMessage('');
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (screen !== 'login' || !GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;
    const mountGoogleButton = () => {
      if (cancelled || !window.google?.accounts?.id) return;
      const target = document.getElementById('google-signin-button');
      if (!target) return;
      target.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (response?.credential) await handleGoogleLogin(response.credential);
        },
      });
      window.google.accounts.id.renderButton(target, {
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        width: 340,
        text: 'signin_with',
        shape: 'pill',
      });
    };
    if (window.google?.accounts?.id) mountGoogleButton();
    else {
      const existed = document.querySelector('script[data-google-identity="true"]');
      if (existed) existed.addEventListener('load', mountGoogleButton, { once: true });
      else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleIdentity = 'true';
        script.onload = mountGoogleButton;
        document.head.appendChild(script);
      }
    }
    return () => { cancelled = true; };
  }, [screen, theme, role]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  function saveSession(nextToken, nextUser) {
    localStorage.setItem(SESSION_TOKEN_KEY, nextToken);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(nextUser));
  }

  function clearSavedSession() {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
  }

  async function api(path, options = {}, auth = token) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(options.headers || {}) },
      ...options,
    });
    return res.json();
  }

  function syncUserProfile(nextUser) {
    setUser(nextUser);
    setProfileForm({ phone: nextUser.phone || '', gmail: nextUser.gmail || '', avatarUrl: nextUser.avatarUrl || '' });
    setProfileOtp({ code: '', sent: false, verified: false, mockOtp: '', expiresAt: '', loading: false });
  }

  function showWarning(text) {
    setWarningPopup(text);
    window.clearTimeout(showWarning.timer);
    showWarning.timer = window.setTimeout(() => setWarningPopup(''), 2800);
  }

  function shouldThrottleViolation(type, detail) {
    const now = Date.now();
    const signature = `${type}::${detail}`;
    if (lastViolationRef.current.signature === signature && now - lastViolationRef.current.at < 1500) return true;
    lastViolationRef.current = { signature, at: now };
    return false;
  }

  async function loadCommonData(auth = token) {
    const examData = await api('/exams', {}, auth);
    if (examData.success) setExams(examData.exams || []);
  }

  async function loadStudentData(auth = token) {
    const [examData, resultData] = await Promise.all([
      api('/exams', {}, auth),
      api('/my-results', {}, auth),
    ]);
    if (examData.success) setExams(examData.exams || []);
    if (resultData.success) setStudentResults(resultData.results || []);
  }

  async function loadNotifications(auth = token) {
    const data = await api('/notifications', {}, auth);
    if (data.success) setNotifications(data.notifications || []);
  }

  async function markNotificationsRead() {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    await api('/notifications/read', { method: 'PUT' });
  }

  async function loadStaffData(auth = token) {
    const [accountData, logData, resultData, statData, examData] = await Promise.all([
      api('/accounts', {}, auth), api('/logs', {}, auth), api('/results', {}, auth), api('/dashboard/stats', {}, auth), api('/exams', {}, auth),
    ]);
    if (accountData.success) setAccounts(accountData.accounts || []);
    if (logData.success) setLogs(logData.logs || []);
    if (resultData.success) setResults(resultData.results || []);
    if (statData.success) setStats({ overview: statData.overview, exams: statData.exams });
    if (examData.success) setExams(examData.exams || []);
  }

  async function handleLogin() {
    setLoading(true);
    setMessage('');
    const data = await api('/login', { method: 'POST', body: JSON.stringify({ ...loginForm, role }) }, '');
    setLoading(false);
    if (!data.success) {
      setMessage(data.message || 'Đăng nhập thất bại.');
      return;
    }
    setToken(data.token);
    saveSession(data.token, data.user);
    syncUserProfile(data.user);
    if (data.user.role === 'student') await loadStudentData(data.token);
    else await loadCommonData(data.token);
    await loadNotifications(data.token);
    setTab('exams');
    if (data.user.role === 'student') setScreen('student');
    else {
      await loadStaffData(data.token);
      setScreen('staff');
    }
  }


  async function handleGoogleLogin(credential) {
    setLoading(true);
    setMessage('');
    const data = await api('/auth/google', { method: 'POST', body: JSON.stringify({ credential, role }) }, '');
    setLoading(false);
    if (!data.success) {
      setMessage(data.message || 'Đăng nhập Google thất bại. Nếu là sinh viên mới, hãy chọn Sinh viên và đăng ký bằng Google để chờ duyệt.');
      return;
    }
    setToken(data.token);
    saveSession(data.token, data.user);
    syncUserProfile(data.user);
    if (data.user.role === 'student') await loadStudentData(data.token);
    else await loadCommonData(data.token);
    await loadNotifications(data.token);
    setTab('exams');
    if (data.user.role === 'student') setScreen('student');
    else {
      await loadStaffData(data.token);
      setScreen('staff');
    }
  }

  function logout() {
    clearSavedSession();
    setScreen('login');
    setRole('student');
    setLoginForm({ email: '', password: '' });
    setMessage('');
    setToken('');
    setUser(null);
    setSelectedExam(null);
    setQuestions([]);
    setAnswers({});
    setExamResult(null);
    setStudentLogs([]);
    setWarningCount(0);
    setAntiCheat(antiCheatDefaults);
    setWarningPopup('');
    setAccounts([]);
    setStudentResults([]);
    setStudentResultDetail(null);
    setAccountForm(emptyAccountForm);
    setEditingAccountId(null);
    setEditingExamId(null);
    setResultDetail(null);
    setProfileForm({ phone: '', gmail: '', avatarUrl: '' });
    setNotifications([]);
    setNotificationOpen(false);
  }

  async function startExam(exam) {
    const starter = await api(`/exams/${exam.id}/start`, { method: 'POST' });
    if (!starter.success) {
      setMessage(starter.message || 'Không thể bắt đầu thi.');
      return;
    }
    const data = await api(`/exams/${exam.id}`);
    if (!data.success) return;
    setSelectedExam(data.exam);
    setQuestions(data.questions || []);
    const draft = readExamDraft(user?.id, data.exam.id);
    setAnswers(draft.answers || {});
    setWarningCount(0);
    setAntiCheat(antiCheatDefaults);
    setStudentLogs([{ type: 'Session Started', detail: `Bắt đầu làm đề ${data.exam.title}`, createdAt: new Date().toISOString() }]);
    setExamResult(null);
    setWarningPopup('');
    setTimeLeft(Number.isFinite(Number(data.session?.remainingSeconds)) ? Math.max(0, Number(data.session.remainingSeconds)) : (data.exam.durationMinutes || 45) * 60);
    setScreen('exam');
  }

  async function logViolation(type, detail, stateKey, severity = 'high') {
    if (!selectedExam) return;
    if (shouldThrottleViolation(type, detail)) return;
    setWarningCount((prev) => {
      const next = prev + 1;
      if (next >= 3) showWarning('Hệ thống đã ghi nhận nhiều cảnh báo trong phiên thi.');
      return next;
    });
    if (stateKey) setAntiCheat((prev) => ({ ...prev, [stateKey]: (prev[stateKey] || 0) + 1 }));
    const localEntry = { type, detail, createdAt: new Date().toISOString() };
    setStudentLogs((prev) => [localEntry, ...prev].slice(0, 20));
    showWarning('Hệ thống đã ghi nhận một hành vi cần lưu ý.');
    await api('/log', { method: 'POST', body: JSON.stringify({ examId: selectedExam.id, type, detail, severity, metadata: { stateKey } }) });
  }

  async function submitExam() {
    if (!selectedExam) return;
    const data = await api('/submit', { method: 'POST', body: JSON.stringify({ examId: selectedExam.id, answers, antiCheatState: antiCheat, warningCount }) });
    if (!data.success) {
      setMessage(data.message || 'Không thể nộp bài.');
      showWarning(data.message || 'Không thể nộp bài.');
      return;
    }
    setExamResult(data);
    clearExamDraft(user?.id, selectedExam.id);
    setScreen('result');
    await loadStudentData();
  }

  async function approveAccount(id) {
    const data = await api(`/accounts/${id}/approve`, { method: 'PUT' });
    if (data.success) {
      await loadStaffData();
      await loadNotifications();
      setMessage(data.message || 'Đã xác nhận tài khoản sinh viên.');
    } else setMessage(data.message || 'Không thể xác nhận tài khoản.');
  }
  async function saveExam() {
    const filteredQuestions = examForm.questions.filter((q) => q.question.trim() && q.options.every((o) => o.trim()));
    const payload = { ...examForm, durationMinutes: Number(examForm.durationMinutes), questions: filteredQuestions.map((q) => ({ question: q.question, options: q.options, correctIndex: Number(q.correctIndex), points: Number(q.points || 1) })) };
    const data = await api(editingExamId ? `/exams/${editingExamId}` : '/exams', { method: editingExamId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    if (!data.success) {
      setMessage(data.message || 'Không thể tạo đề.');
      return;
    }
    setMessage(editingExamId ? 'Đã cập nhật đề thi.' : 'Tạo đề thi thành công.');
    setExamForm(emptyExamForm);
    setEditingExamId(null);
    await loadStaffData();
    setTab('exams');
  }

  async function editExam(exam) {
    const data = await api(`/exams/${exam.id}`);
    if (!data.success) {
      setMessage(data.message || 'Không tải được đề thi.');
      return;
    }
    setEditingExamId(exam.id);
    setExamForm({
      title: data.exam.title || '',
      subject: data.exam.subject || '',
      description: data.exam.description || '',
      durationMinutes: data.exam.durationMinutes || 45,
      status: data.exam.status || 'draft',
      questions: (data.questions || []).map((q) => ({ question: q.question, options: q.options || ['', '', '', ''], correctIndex: Number(q.correctIndex || 0), points: Number(q.points || 1) })),
    });
    setTab('create');
    setMessage('');
  }

  async function deleteExam(exam) {
    if (!window.confirm(`Xóa đề thi "${exam.title}"?`)) return;
    const data = await api(`/exams/${exam.id}`, { method: 'DELETE' });
    if (!data.success) {
      setMessage(data.message || 'Không thể xóa đề thi.');
      return;
    }
    setMessage(data.message || 'Đã xóa đề thi.');
    await loadStaffData();
  }

  async function viewResultDetail(id) {
    const data = await api(`/results/${id}`);
    if (data.success) setResultDetail(data.result);
    else setMessage(data.message || 'Không tải được chi tiết bài làm.');
  }

  async function viewStudentResultDetail(id) {
    const data = await api(`/my-results/${id}`);
    if (data.success) setStudentResultDetail(data.result);
    else setMessage(data.message || 'Không tải được chi tiết bài làm.');
  }

  async function toggleExamStatus(exam, nextStatus) {
    const data = await api(`/exams/${exam.id}/status`, { method: 'PUT', body: JSON.stringify({ status: nextStatus }) });
    if (data.success) {
      setMessage('Đã cập nhật trạng thái đề thi.');
      await loadStaffData();
    }
  }

  async function sendProfileGmailOtp() {
    const gmail = String(profileForm.gmail || '').trim().toLowerCase();
    if (!gmail) { setMessage('Vui lòng nhập Gmail liên hệ trước khi gửi OTP.'); return; }
    setProfileOtp((prev) => ({ ...prev, loading: true }));
    const data = await api('/me/profile/send-gmail-otp', { method: 'POST', body: JSON.stringify({ gmail }) });
    setProfileOtp((prev) => ({ ...prev, loading: false }));
    if (data.success) {
      setProfileOtp({ code: '', sent: true, verified: false, mockOtp: data.mockOtp || '', expiresAt: data.expiresAt || '', loading: false });
      await loadNotifications();
      setMessage(data.message || 'Đã gửi mã OTP về Gmail.');
    } else setMessage(data.message || 'Không thể gửi OTP.');
  }

  async function verifyProfileGmailOtp() {
    const gmail = String(profileForm.gmail || '').trim().toLowerCase();
    if (!gmail || !profileOtp.code) { setMessage('Vui lòng nhập Gmail và mã OTP.'); return; }
    setProfileOtp((prev) => ({ ...prev, loading: true }));
    const data = await api('/me/profile/verify-gmail-otp', { method: 'POST', body: JSON.stringify({ gmail, code: profileOtp.code }) });
    setProfileOtp((prev) => ({ ...prev, loading: false }));
    if (data.success) {
      if (data.user) {
        syncUserProfile(data.user);
        saveSession(token, data.user);
      } else setProfileOtp((prev) => ({ ...prev, verified: true, loading: false }));
      await loadNotifications();
      setMessage(data.message || 'Xác thực Gmail thành công.');
    } else setMessage(data.message || 'Xác thực OTP thất bại.');
  }

  async function saveProfile() {
    const data = await api('/me/profile', { method: 'PUT', body: JSON.stringify(profileForm) });
    if (data.success) {
      syncUserProfile(data.user);
      saveSession(token, data.user);
      await loadNotifications();
      setMessage(data.message || 'Đã cập nhật hồ sơ cá nhân.');
    } else setMessage(data.message || 'Không thể cập nhật hồ sơ.');
  }

  async function saveAccount() {
    const normalized = { ...accountForm, role: user.role === 'instructor' ? 'student' : accountForm.role };
    const path = editingAccountId ? `/accounts/${editingAccountId}` : '/accounts';
    const method = editingAccountId ? 'PUT' : 'POST';
    const data = await api(path, { method, body: JSON.stringify(normalized) });
    if (data.success) {
      setAccountForm({ ...emptyAccountForm, role: 'student' });
      setEditingAccountId(null);
      await loadStaffData();
      setMessage(data.message || 'Đã lưu tài khoản.');
    } else setMessage(data.message || 'Không thể lưu tài khoản.');
  }

  async function importStudentsFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const students = parseStudentImport(await file.text(), file.name);
      if (!students.length) {
        setMessage('File không có sinh viên hợp lệ. Dùng CSV có dòng tiêu đề hoặc JSON có mảng students.');
        return;
      }
      const data = await api('/accounts/import-students', { method: 'POST', body: JSON.stringify({ students }) });
      if (data.success) {
        await loadStaffData();
        await loadNotifications();
        setMessage(data.message || `Đã import ${data.created || 0} sinh viên.`);
      } else setMessage(data.message || 'Không thể import danh sách sinh viên.');
    } catch (error) {
      setMessage('Không đọc được file. Hãy kiểm tra định dạng CSV/JSON.');
    } finally {
      event.target.value = '';
    }
  }

  async function deleteAccount(id) {
    if (!window.confirm('Xóa tài khoản này?')) return;
    const data = await api(`/accounts/${id}`, { method: 'DELETE' });
    if (data.success) {
      await loadStaffData();
      setMessage('Đã xóa tài khoản.');
    } else setMessage(data.message || 'Không thể xóa tài khoản.');
  }

  useEffect(() => {
    if (screen !== 'exam') return undefined;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'exam' || !selectedExam || !user?.id) return;
    saveExamDraft(user.id, selectedExam.id, answers);
  }, [answers, screen, selectedExam, user]);

  useEffect(() => {
    if (screen !== 'exam') return undefined;
    const handleVisibility = () => { if (document.hidden) logViolation('Tab Switching', 'Người dùng chuyển tab hoặc thu nhỏ cửa sổ.', 'tabSwitches'); };
    const handleCopy = () => logViolation('Copy Attempt', 'Người dùng thực hiện thao tác sao chép trong lúc thi.', 'copyAttempts');
    const handleKeyUp = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v'].includes(e.key.toLowerCase())) logViolation('Shortcut Used', `Người dùng dùng tổ hợp ${e.key.toUpperCase()} trong lúc thi.`, 'shortcutEvents');
    };
    const handleBlur = () => logViolation('Window Blur', 'Cửa sổ thi mất focus.', 'blurEvents');
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('copy', handleCopy);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('copy', handleCopy);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [screen, selectedExam]);

  useEffect(() => {
    const onNewLog = (entry) => setLogs((prev) => [entry, ...prev].slice(0, 200));
    const onStats = (data) => setStats(data);
    const onSubmission = async () => {
      if (user?.role === 'student') await loadStudentData();
      else if (user?.role === 'instructor' || user?.role === 'admin') await loadStaffData();
    };
    const onNotification = (payload) => {
      if (!user?.id || !payload?.targetUserIds?.includes(user.id)) return;
      const mapped = (payload.notifications || []).map((item) => ({ id: item.id, type: item.type, icon: item.icon, title: item.title, message: item.message, isRead: !!item.is_read, createdAt: item.created_at }));
      setNotifications((prev) => [...mapped, ...prev].slice(0, 80));
      if (mapped[0]) showWarning(`${mapped[0].icon || '🔔'} ${mapped[0].title}: ${mapped[0].message}`);
    };
    socket.on('log:new', onNewLog);
    socket.on('stats:update', onStats);
    socket.on('submission:new', onSubmission);
    socket.on('notification:new', onNotification);
    return () => {
      socket.off('log:new', onNewLog);
      socket.off('stats:update', onStats);
      socket.off('submission:new', onSubmission);
      socket.off('notification:new', onNotification);
    };
  }, [user]);

  return (
    <div className="app-shell">
      <div className="grid-bg" />
      {warningPopup && <div className="warning-popup">{warningPopup}</div>}

      {screen === 'login' && (
        <div className="login-screen">
          <motion.section className="login-shell" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <div className="login-hero">
              <div>
                <div className="logo-mark">🛡️</div>
                <p className="eyebrow">SECURE ONLINE EXAMINATION</p>
                <h1>ExamShield</h1>
                <p className="muted hero-text">Hệ thống thi trực tuyến có backend, database, tạo đề thi, giám sát hành vi, profile người dùng và phân quyền tài khoản.</p>
              </div>
              <div className="login-feature-grid">
                <MiniBox label="Backend" value="Express" />
                <MiniBox label="Database" value="SQLite" />
                <MiniBox label="Realtime" value="Socket.IO" />
              </div>
            </div>

            <div className="login-panel card">
              <p className="eyebrow">Đăng nhập hệ thống</p>
              <h2>Nhập tài khoản</h2>
              <p className="muted">Chọn đúng vai trò, sau đó nhập email và mật khẩu để vào dashboard.</p>
              <div className="role-pills login-roles">
                {['student', 'instructor', 'admin'].map((item) => (
                  <button key={item} className={`pill ${role === item ? 'active' : ''}`} onClick={() => setRole(item)}>{roleLabel(item)}</button>
                ))}
              </div>
              <label className="field-label">Email / Tài khoản</label>
              <input className="login-input" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="VD: instructor@example.com" autoComplete="username" />
              <label className="field-label">Mật khẩu</label>
              <div className="password-wrap">
                <input className="login-input" type={showPassword ? 'text' : 'password'} value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Nhập mật khẩu" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Ẩn' : 'Hiện'}</button>
              </div>
              <button className="primary-btn full" onClick={handleLogin} disabled={loading || !loginForm.email.trim() || !loginForm.password.trim()}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
              <div className="login-divider"><span>hoặc</span></div>
              {GOOGLE_CLIENT_ID ? (
                <div id="google-signin-button" className="google-signin-slot" />
              ) : (
                <div className="google-disabled-note">Google Login chưa bật. Thêm <b>VITE_GOOGLE_CLIENT_ID</b> vào frontend/.env để dùng.</div>
              )}
              {message && <div className="notice">{message}</div>}
              <div className="google-register-hint">
                Sinh viên chưa có tài khoản có thể đăng ký bằng Google. Sau khi đăng ký, giảng viên hoặc admin sẽ xác nhận tài khoản trong tab Tài khoản.
              </div>
            </div>
          </motion.section>
        </div>
      )}

      {screen === 'student' && user && (
        <div className="page-wrap">
          <Topbar user={user} logout={logout} theme={theme} toggleTheme={toggleTheme} openProfile={() => setTab('profile')} notifications={notifications} unreadCount={unreadNotifications} notificationOpen={notificationOpen} setNotificationOpen={setNotificationOpen} markNotificationsRead={markNotificationsRead} />
          <section className="content-wrap">
            <div className="hero card">
              <div>
                <p className="eyebrow">Khu vực sinh viên</p>
                <h2>Xin chào, {user.fullName}</h2>
                <p className="muted">Chọn đề đang mở để bắt đầu. Hệ thống sẽ ghi log nếu bạn chuyển tab, copy hoặc rời khỏi cửa sổ thi.</p>
              </div>
              <div className="hero-mini-grid"><MiniBox label="MSSV" value={user.studentCode || '—'} /><MiniBox label="Lớp" value={user.className || '—'} /><MiniBox label="Đề khả dụng" value={String(exams.filter((e) => e.status === 'active').length)} /></div>
            </div>

            <div className="tab-row compact-tabs"><button className={`tab-btn ${tab === 'exams' ? 'active' : ''}`} onClick={() => setTab('exams')}>Đề thi</button><button className={`tab-btn ${tab === 'my-results' ? 'active' : ''}`} onClick={() => setTab('my-results')}>Kết quả của tôi</button><button className={`tab-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Hồ sơ cá nhân</button></div>
            {tab === 'exams' && <ExamList exams={exams} startExam={startExam} />}
            {tab === 'my-results' && <StudentResultsPanel results={studentResults} resultDetail={studentResultDetail} viewResultDetail={viewStudentResultDetail} closeResultDetail={() => setStudentResultDetail(null)} />}
            {tab === 'profile' && <ProfilePanel user={user} profileForm={profileForm} setProfileForm={setProfileForm} saveProfile={saveProfile} profileOtp={profileOtp} setProfileOtp={setProfileOtp} sendProfileGmailOtp={sendProfileGmailOtp} verifyProfileGmailOtp={verifyProfileGmailOtp} />}
            {message && <div className="notice">{message}</div>}
          </section>
        </div>
      )}

      {screen === 'exam' && selectedExam && (
        <div className="page-wrap exam-mode">
          <header className="exam-top">
            <div><p className="eyebrow">{selectedExam.subject}</p><h2>{selectedExam.title}</h2><p className="muted">Đã trả lời {answeredCount}/{questions.length} câu</p><div className="exam-progress"><span style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} /></div></div>
            <div className="timer-box">{formatTime(timeLeft)}</div>
            <button className="danger-btn" onClick={submitExam}>Nộp bài</button>
          </header>
          <section className="exam-layout">
            <div className="card side-panel"><h3>Bảng câu hỏi</h3><div className="question-palette">{questions.map((q, idx) => <button key={q.id} className={answers[q.id] !== undefined ? 'answered' : ''} onClick={() => document.getElementById(`question-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{idx + 1}</button>)}</div><h3>Giám sát chống gian lận</h3><ul className="mini-list"><li>Cảnh báo: <strong>{warningCount}</strong></li><li>Chuyển tab: <strong>{antiCheat.tabSwitches}</strong></li><li>Sao chép: <strong>{antiCheat.copyAttempts}</strong></li><li>Phím tắt: <strong>{antiCheat.shortcutEvents}</strong></li><li>Mất focus: <strong>{antiCheat.blurEvents}</strong></li></ul><div className="log-box">{studentLogs.map((item, idx) => <div key={`${item.type}-${idx}`} className="log-line">[{formatDate(item.createdAt)}] {logTypeLabel(item.type)}</div>)}</div></div>
            <div className="card question-wrap">{questions.map((q, idx) => <div id={`question-${q.id}`} key={q.id} className="question-card"><p className="eyebrow">Câu {idx + 1}</p><h3>{q.question}</h3><div className="option-grid">{q.options.map((option, optionIndex) => <button key={optionIndex} className={`option-btn ${Number(answers[q.id]) === optionIndex ? 'active' : ''}`} onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optionIndex }))}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div></div>)}</div>
          </section>
        </div>
      )}

      {screen === 'result' && examResult && (
        <div className="center-wrap"><div className="card result-card"><p className="eyebrow">Kết quả bài thi</p><h2>{selectedExam?.title}</h2><div className="stats-grid four"><MetricCard label="Điểm" value={String(examResult.score)} /><MetricCard label="Đúng" value={`${examResult.correct}/${examResult.total}`} /><MetricCard label="Vi phạm" value={String(examResult.warningCount)} /><MetricCard label="Trạng thái" value={examResult.flagged ? 'Bị gắn cờ' : 'Đã nộp'} compact /></div><div className="button-row left"><button className="secondary-btn" onClick={() => setScreen('student')}>Về trang chủ</button><button className="primary-btn" onClick={() => window.print()}>In kết quả</button></div></div></div>
      )}

      {screen === 'staff' && user && (
        <div className="page-wrap">
          <Topbar user={user} logout={logout} theme={theme} toggleTheme={toggleTheme} openProfile={() => setTab('profile')} notifications={notifications} unreadCount={unreadNotifications} notificationOpen={notificationOpen} setNotificationOpen={setNotificationOpen} markNotificationsRead={markNotificationsRead} />
          <section className="content-wrap">
            <div className="hero card"><div><p className="eyebrow">Dashboard giảng viên / quản trị</p><h2>Dashboard giám sát thi</h2><p className="muted">Theo dõi đề thi, tạo đề mới, kiểm tra log vi phạm, quản lý tài khoản và cập nhật profile trong cùng một giao diện.</p></div><div className="hero-mini-grid"><MiniBox label="Vai trò" value={roleLabel(user.role)} /><MiniBox label="Tổng đề thi" value={String(stats.overview.totalExams)} /><MiniBox label="Tổng cảnh báo" value={String(stats.overview.totalViolations)} /></div></div>
            <div className="stats-grid four"><MetricCard label="Sinh viên" value={String(stats.overview.totalStudents)} /><MetricCard label="Bài nộp" value={String(stats.overview.totalSubmissions)} /><MetricCard label="Điểm TB" value={String(stats.overview.averageScore)} /><MetricCard label="Vi phạm" value={String(stats.overview.totalViolations)} /></div>
            <div className="tab-row">{['exams', 'create', 'results', 'logs', 'analytics', 'accounts', 'profile'].map((item) => <button key={item} className={`tab-btn ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>{item === 'exams' ? 'Đề thi' : item === 'create' ? 'Tạo đề' : item === 'results' ? 'Kết quả' : item === 'logs' ? 'Log hành vi' : item === 'analytics' ? 'Thống kê' : item === 'accounts' ? 'Tài khoản' : 'Profile'}</button>)}</div>

            {tab === 'exams' && <StaffExamTable stats={stats} toggleExamStatus={toggleExamStatus} editExam={editExam} deleteExam={deleteExam} />}
            {tab === 'create' && <CreateExamPanel examForm={examForm} setExamForm={setExamForm} saveExam={saveExam} editingExamId={editingExamId} cancelEditExam={() => { setEditingExamId(null); setExamForm(emptyExamForm); }} />}
            {tab === 'results' && <ResultsTable results={results} viewResultDetail={viewResultDetail} resultDetail={resultDetail} closeResultDetail={() => setResultDetail(null)} />}
            {tab === 'logs' && <LogsTable logs={logs} />}
            {tab === 'analytics' && <AnalyticsPanel analyticsByType={analyticsByType} />}
            {tab === 'accounts' && <AccountsPanel user={user} accounts={accounts} accountForm={accountForm} setAccountForm={setAccountForm} editingAccountId={editingAccountId} setEditingAccountId={setEditingAccountId} saveAccount={saveAccount} deleteAccount={deleteAccount} approveAccount={approveAccount} importStudentsFile={importStudentsFile} />}
            {tab === 'profile' && <ProfilePanel user={user} profileForm={profileForm} setProfileForm={setProfileForm} saveProfile={saveProfile} profileOtp={profileOtp} setProfileOtp={setProfileOtp} sendProfileGmailOtp={sendProfileGmailOtp} verifyProfileGmailOtp={verifyProfileGmailOtp} />}
            {message && <div className="notice">{message}</div>}
          </section>
        </div>
      )}
    </div>
  );
}

function ExamList({ exams, startExam }) {
  const [query, setQuery] = useState('');
  const filtered = exams.filter((exam) => `${exam.title} ${exam.subject} ${exam.description}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="section-head list-head"><div><div className="section-title">Danh sách đề thi</div><p className="muted">Lọc theo tên đề, môn học hoặc mô tả.</p></div><input className="toolbar-input" placeholder="Tìm đề thi..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
    {!filtered.length && <div className="card empty-state">Không có đề thi phù hợp.</div>}
    <div className="grid two">{filtered.map((exam) => <div key={exam.id} className={`card exam-card exam-card-polished ${exam.status}`}><div className="exam-card-head"><p className="subject-tag">{exam.subject}</p><span className={`status ${exam.status}`}>{statLabel(exam.status)}</span></div><h3>{exam.title}</h3><p className="muted">{exam.description}</p><div className="meta-row"><span>{exam.questionCount} câu</span><span>{exam.durationMinutes} phút</span></div><button className="primary-btn" disabled={exam.status !== 'active'} onClick={() => startExam(exam)}>{exam.status === 'active' ? 'Bắt đầu thi' : 'Chưa mở'}</button></div>)}</div>
  </>;
}

function StudentResultsPanel({ results, resultDetail, viewResultDetail, closeResultDetail }) {
  return <div className="grid"><div className="card table-card">
    <div className="section-head">
      <div><h3>Kết quả của tôi</h3><p className="muted">Xem lại điểm, thời gian nộp, cảnh báo và trạng thái gửi email.</p></div>
      <button className="primary-btn" disabled={!results.length} onClick={() => downloadCsv('ket-qua-cua-toi.csv', ['Đề thi', 'Môn', 'Điểm', 'Đúng', 'Tổng câu', 'Cảnh báo', 'Trạng thái', 'Thời gian làm', 'Email', 'Nộp lúc'], results.map((item) => [item.examTitle, item.subject, item.score, item.correctCount, item.totalQuestions, item.warningCount, item.status === 'flagged' ? 'Bị gắn cờ' : 'Đã nộp', formatTime(item.timeSpentSeconds || 0), item.emailSent ? 'Đã gửi' : 'Chưa gửi', formatDate(item.submittedAt || item.createdAt)]))}>Xuất CSV</button>
    </div>
    {!results.length ? <div className="empty-state">Bạn chưa có bài nộp nào.</div> : (
      <table>
        <thead><tr><th>Đề thi</th><th>Môn</th><th>Điểm</th><th>Đúng</th><th>Cảnh báo</th><th>Trạng thái</th><th>Thời gian làm</th><th>Email</th><th>Nộp lúc</th><th>Hành động</th></tr></thead>
        <tbody>{results.map((item) => <tr key={item.id}>
          <td>{item.examTitle}</td>
          <td>{item.subject}</td>
          <td><strong>{item.score}/10</strong></td>
          <td>{item.correctCount}/{item.totalQuestions}</td>
          <td>{item.warningCount}</td>
          <td><span className={`status ${item.status === 'flagged' ? 'warning' : 'active'}`}>{item.status === 'flagged' ? 'Bị gắn cờ' : 'Đã nộp'}</span></td>
          <td>{formatTime(item.timeSpentSeconds || 0)}</td>
          <td>{item.emailSent ? 'Đã gửi' : 'Chưa gửi'}</td>
          <td>{formatDate(item.submittedAt || item.createdAt)}</td>
          <td><button className="secondary-btn" onClick={() => viewResultDetail(item.id)}>Chi tiết</button></td>
        </tr>)}</tbody>
      </table>
    )}
  </div>{resultDetail && <ResultDetailPanel detail={resultDetail} close={closeResultDetail} />}</div>;
}

function StaffExamTable({ stats, toggleExamStatus, editExam, deleteExam }) {
  return <div className="card table-card"><div className="section-head"><h3>Danh sách đề thi</h3></div><table><thead><tr><th>Đề thi</th><th>Môn</th><th>Thời lượng</th><th>Tham gia</th><th>Nộp bài</th><th>Vi phạm</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>{stats.exams.map((exam) => <tr key={exam.id}><td>{exam.title}</td><td>{exam.subject}</td><td>{exam.duration_minutes} phút</td><td>{exam.participants}</td><td>{exam.submittedCount}</td><td>{exam.violationCount}</td><td><span className={`status ${exam.status}`}>{statLabel(exam.status)}</span></td><td><div className="button-row left compact"><button className="secondary-btn" onClick={() => editExam(exam)}>Sửa</button><button className="ghost-btn" onClick={() => deleteExam(exam)}>Xóa</button>{exam.status !== 'active' && <button className="secondary-btn" onClick={() => toggleExamStatus(exam, 'active')}>Mở đề</button>}{exam.status !== 'finished' && <button className="danger-btn" onClick={() => toggleExamStatus(exam, 'finished')}>Kết thúc</button>}</div></td></tr>)}</tbody></table></div>;
}

function CreateExamPanel({ examForm, setExamForm, saveExam, editingExamId, cancelEditExam }) {
  const [questionTarget, setQuestionTarget] = useState(String(examForm.questions.length || 1));
  const [importNote, setImportNote] = useState('');
  const [autoShuffleImport, setAutoShuffleImport] = useState(true);

  useEffect(() => {
    setQuestionTarget(String(examForm.questions.length || 1));
  }, [examForm.questions.length]);

  function makeQuestionList(count) {
    const safeCount = Math.max(1, Math.min(200, Number(count) || 1));
    const current = examForm.questions || [];
    const next = Array.from({ length: safeCount }, (_, index) => current[index] || defaultQuestion());
    setExamForm({ ...examForm, questions: next });
    setQuestionTarget(String(safeCount));
    setImportNote(`Đã tạo khung ${safeCount} câu hỏi.`);
  }

  function shuffleOneQuestion(question) {
    const options = question.options || [];
    const correctText = options[Number(question.correctIndex || 0)] || '';
    const shuffled = options
      .map((text) => ({ text, rand: Math.random() }))
      .sort((a, b) => a.rand - b.rand)
      .map((item) => item.text);
    const correctIndex = Math.max(0, shuffled.findIndex((text) => text === correctText));
    return { ...question, options: shuffled, correctIndex };
  }

  function shuffleAllAnswers() {
    setExamForm({ ...examForm, questions: examForm.questions.map(shuffleOneQuestion) });
    setImportNote('Đã tráo thứ tự đáp án A/B/C/D cho toàn bộ câu hỏi. Đáp án đúng vẫn được giữ chính xác.');
  }

  function normalizeQuestion(item) {
    const question = item.question || item.cauHoi || item['Câu hỏi'] || item['question'] || '';
    const options = item.options || [item.A, item.B, item.C, item.D] || [item.a, item.b, item.c, item.d];
    let correct = item.correctIndex ?? item.correct ?? item.answer ?? item.dapAn ?? item['Đáp án đúng'];
    if (typeof correct === 'string') {
      const upper = correct.trim().toUpperCase();
      correct = ['A', 'B', 'C', 'D'].includes(upper) ? ['A', 'B', 'C', 'D'].indexOf(upper) : Number(upper);
    }
    return {
      question: String(question || '').trim(),
      options: (options || ['', '', '', '']).slice(0, 4).map((x) => String(x || '').trim()),
      correctIndex: Number.isFinite(Number(correct)) ? Math.max(0, Math.min(3, Number(correct))) : 0,
      points: Number(item.points || item.diem || 1),
    };
  }

  function parseCsvQuestions(text) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const start = lines[0]?.toLowerCase().includes('question') || lines[0]?.toLowerCase().includes('câu') ? 1 : 0;
    return lines.slice(start).map((line) => {
      const cols = line.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
      return normalizeQuestion({ question: cols[0], A: cols[1], B: cols[2], C: cols[3], D: cols[4], correct: cols[5] || 'A' });
    });
  }

  async function importExamFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let imported = [];
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : parsed.questions;
        imported = (list || []).map(normalizeQuestion);
      } else {
        imported = parseCsvQuestions(text);
      }
      imported = imported.filter((q) => q.question && q.options.every(Boolean));
      if (autoShuffleImport) imported = imported.map(shuffleOneQuestion);
      if (!imported.length) {
        setImportNote('File không có câu hỏi hợp lệ. Dùng định dạng: question,A,B,C,D,correct hoặc JSON có mảng questions.');
        return;
      }
      setExamForm({ ...examForm, questions: imported });
      setQuestionTarget(String(imported.length));
      setImportNote(`Đã import ${imported.length} câu từ file ${file.name}${autoShuffleImport ? ' và đã tráo đáp án.' : '.'}`);
      event.target.value = '';
    } catch (err) {
      setImportNote('Không đọc được file đề. Hãy kiểm tra lại định dạng JSON/CSV.');
    }
  }

  return (
    <div className="card form-card create-exam-card">
      <div className="section-head stacked">
        <div>
          <p className="eyebrow">Question Bank Builder</p>
          <h3>{editingExamId ? 'Sửa đề thi' : 'Tạo đề thi mới'}</h3>
          <p className="muted form-note">Có thể nhập số câu muốn tạo, import file đề sẵn và tráo đáp án A/B/C/D để tạo các phiên bản đề khác nhau.</p>
        </div>
      </div>

      <div className="form-grid two">
        <input placeholder="Tiêu đề đề thi" value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} />
        <input placeholder="Môn học" value={examForm.subject} onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })} />
        <input placeholder="Mô tả ngắn" value={examForm.description} onChange={(e) => setExamForm({ ...examForm, description: e.target.value })} />
        <input type="number" min="1" placeholder="Thời lượng" value={examForm.durationMinutes} onChange={(e) => setExamForm({ ...examForm, durationMinutes: e.target.value })} />
        <select value={examForm.status} onChange={(e) => setExamForm({ ...examForm, status: e.target.value })}>
          <option value="draft">Bản nháp</option>
          <option value="active">Mở ngay</option>
        </select>
      </div>

      <div className="question-tools">
        <div className="tool-box">
          <label className="field-label">Số câu muốn tạo</label>
          <div className="inline-control">
            <input type="number" min="1" max="200" value={questionTarget} onChange={(e) => setQuestionTarget(e.target.value)} />
            <button className="secondary-btn" onClick={() => makeQuestionList(questionTarget)}>Tạo số câu</button>
          </div>
          <p className="muted small">Ví dụ nhập 20 → hệ thống tự tạo 20 khung câu hỏi trống.</p>
        </div>

        <div className="tool-box import-box">
          <label className="field-label">Import file đề sẵn</label>
          <input type="file" accept=".json,.csv,.txt" onChange={importExamFile} />
          <label className="check-row"><input type="checkbox" checked={autoShuffleImport} onChange={(e) => setAutoShuffleImport(e.target.checked)} /> Tự tráo đáp án sau khi import</label>
          <p className="muted small">Hỗ trợ JSON hoặc CSV: question,A,B,C,D,correct.</p>
        </div>

        <div className="tool-box">
          <label className="field-label">Tráo đáp án</label>
          <button className="primary-btn full" onClick={shuffleAllAnswers}>🔀 Tráo đáp án toàn bộ</button>
          <p className="muted small">Đáp án đúng được tính lại theo vị trí mới, phù hợp tạo nhiều mã đề.</p>
        </div>
      </div>

      {importNote && <div className="notice">{importNote}</div>}

      <div className="question-builder">
        {examForm.questions.map((question, index) => (
          <div key={index} className="question-builder-card">
            <div className="question-builder-head">
              <h4>Câu hỏi {index + 1}</h4>
              <div className="button-row left compact">
                <button className="ghost-btn" onClick={() => {
                  const next = [...examForm.questions];
                  next[index] = shuffleOneQuestion(next[index]);
                  setExamForm({ ...examForm, questions: next });
                }}>Tráo câu này</button>
                {examForm.questions.length > 1 && <button className="ghost-btn" onClick={() => setExamForm((prev) => ({ ...prev, questions: prev.questions.filter((_, i) => i !== index) }))}>Xóa</button>}
              </div>
            </div>
            <textarea rows="2" placeholder="Nội dung câu hỏi" value={question.question} onChange={(e) => { const next = [...examForm.questions]; next[index].question = e.target.value; setExamForm({ ...examForm, questions: next }); }} />
            <div className="form-grid two">
              {question.options.map((option, optionIndex) => (
                <input key={optionIndex} placeholder={`Đáp án ${String.fromCharCode(65 + optionIndex)}`} value={option} onChange={(e) => { const next = [...examForm.questions]; next[index].options[optionIndex] = e.target.value; setExamForm({ ...examForm, questions: next }); }} />
              ))}
              <select value={question.correctIndex} onChange={(e) => { const next = [...examForm.questions]; next[index].correctIndex = Number(e.target.value); setExamForm({ ...examForm, questions: next }); }}>
                <option value={0}>Đáp án đúng: A</option>
                <option value={1}>Đáp án đúng: B</option>
                <option value={2}>Đáp án đúng: C</option>
                <option value={3}>Đáp án đúng: D</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="button-row left">
        <button className="secondary-btn" onClick={() => {
          setExamForm((prev) => ({ ...prev, questions: [...prev.questions, defaultQuestion()] }));
          setQuestionTarget(String((examForm.questions.length || 0) + 1));
        }}>+ Thêm câu hỏi</button>
        {editingExamId && <button className="secondary-btn" onClick={cancelEditExam}>Hủy sửa</button>}
        <button className="primary-btn" onClick={saveExam}>{editingExamId ? 'Lưu thay đổi' : 'Lưu đề thi'}</button>
      </div>
    </div>
  );
}

function ResultsTable({ results, viewResultDetail, resultDetail, closeResultDetail }) {
  return <div className="grid"><div className="card table-card"><div className="section-head"><h3>Kết quả bài thi</h3><button className="primary-btn" disabled={!results.length} onClick={() => downloadCsv('ket-qua-bai-thi.csv', ['Sinh viên', 'MSSV', 'Đề thi', 'Môn', 'Điểm', 'Đúng', 'Tổng câu', 'Vi phạm', 'Trạng thái', 'Bắt đầu', 'Nộp lúc', 'Thời gian làm', 'Email'], results.map((item) => [item.studentName, item.studentCode, item.examTitle, item.subject, item.score, item.correctCount, item.totalQuestions, item.warningCount, item.status === 'flagged' ? 'Bị gắn cờ' : 'Đã nộp', formatDate(item.startedAt), formatDate(item.submittedAt || item.createdAt), formatTime(item.timeSpentSeconds || 0), item.emailSent ? 'Đã gửi' : 'Chưa gửi']))}>Xuất CSV</button></div><table><thead><tr><th>Sinh viên</th><th>MSSV</th><th>Đề thi</th><th>Điểm</th><th>Vi phạm</th><th>Trạng thái</th><th>Thời gian</th><th>Hành động</th></tr></thead><tbody>{results.map((item) => <tr key={item.id}><td>{item.studentName}</td><td>{item.studentCode}</td><td>{item.examTitle}</td><td>{item.score}</td><td>{item.warningCount}</td><td>{item.status === 'flagged' ? 'Bị gắn cờ' : 'Đã nộp'}</td><td>{formatDate(item.createdAt)}</td><td><button className="secondary-btn" onClick={() => viewResultDetail(item.id)}>Chi tiết</button></td></tr>)}</tbody></table></div>{resultDetail && <ResultDetailPanel detail={resultDetail} close={closeResultDetail} />}</div>;
}

function ResultDetailPanel({ detail, close }) {
  return <div className="card form-card result-detail-panel">
    <div className="section-head"><div><p className="eyebrow">Chi tiết bài làm</p><h3>{detail.examTitle}</h3><p className="muted">{detail.studentName} · {detail.studentCode || detail.email} · {detail.score}/10 · {detail.correctCount}/{detail.totalQuestions} câu đúng · {detail.warningCount} cảnh báo</p></div><div className="button-row left"><button className="primary-btn" onClick={() => exportResultPdf(detail)}>Xuất PDF</button><button className="secondary-btn" onClick={close}>Đóng</button></div></div>
    <div className="question-review-list">
      {(detail.questions || []).map((q, index) => <div key={q.id} className={`question-review-card ${q.isCorrect ? 'correct' : 'wrong'}`}>
        <div className="question-builder-head"><h4>Câu {index + 1}: {q.question}</h4><span className={`status ${q.isCorrect ? 'active' : 'warning'}`}>{q.isCorrect ? 'Đúng' : 'Sai'}</span></div>
        <div className="option-grid">{q.options.map((option, optionIndex) => <div key={optionIndex} className={`option-btn review-option ${optionIndex === q.correctIndex ? 'correct-answer' : ''} ${optionIndex === q.selectedIndex ? 'selected-answer' : ''}`}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</div>)}</div>
      </div>)}
    </div>
    <h3>Log trong phiên</h3>
    <div className="log-box">{(detail.logs || []).map((log) => <div key={log.id} className="log-line">[{formatDate(log.createdAt)}] {logTypeLabel(log.type)} · {logDetailLabel(log.detail)}</div>)}</div>
  </div>;
}

function LogsTable({ logs }) {
  return <div className="card table-card"><div className="section-head"><h3>Log hành vi realtime</h3><button className="primary-btn" disabled={!logs.length} onClick={() => downloadCsv('log-hanh-vi.csv', ['Thời gian', 'Sinh viên', 'MSSV', 'Đề thi', 'Loại', 'Chi tiết', 'Mức độ'], logs.map((log) => [formatDate(log.createdAt), log.studentName || '', log.studentCode || '', log.examTitle || '', logTypeLabel(log.type), logDetailLabel(log.detail), log.severity || 'medium']))}>Xuất CSV</button></div><table><thead><tr><th>Thời gian</th><th>Sinh viên</th><th>Đề thi</th><th>Loại</th><th>Chi tiết</th><th>Mức độ</th></tr></thead><tbody>{logs.map((log, idx) => <tr key={log.id || idx}><td>{formatDate(log.createdAt)}</td><td>{log.studentName || '—'}</td><td>{log.examTitle || '—'}</td><td>{logTypeLabel(log.type)}</td><td>{logDetailLabel(log.detail)}</td><td>{log.severity || 'medium'}</td></tr>)}</tbody></table></div>;
}

function AnalyticsPanel({ analyticsByType }) {
  return <div className="grid two"><div className="card form-card"><h3>Thống kê log</h3><div className="analytics-list">{analyticsByType.map(([name, count]) => <div className="analytic-row" key={name}><span>{logTypeLabel(name)}</span><strong>{count}</strong></div>)}</div></div><div className="card form-card"><h3>Tổng quan giám sát</h3><ul className="mini-list"><li>Xem kết quả và các hành vi đáng ngờ.</li><li>Dữ liệu realtime được cập nhật qua Socket.IO.</li><li>Dùng tab Log hành vi để đối chiếu bằng chứng chống gian lận.</li><li>Cảnh báo của sinh viên được ghi nhận ngay trong phiên thi.</li></ul></div></div>;
}

function accountStatusLabel(status) {
  return status === 'pending' ? 'Chờ duyệt' : status === 'locked' ? 'Bị khóa' : status === 'disabled' ? 'Vô hiệu' : 'Hoạt động';
}

function AccountsPanel({ user, accounts, accountForm, setAccountForm, editingAccountId, setEditingAccountId, saveAccount, deleteAccount, approveAccount, importStudentsFile }) {
  const effectiveRole = user.role === 'instructor' ? 'student' : accountForm.role;
  const pendingCount = accounts.filter((account) => account.status === 'pending').length;
  return <div className="grid two">
    <div className="card form-card">
      <h3>{editingAccountId ? 'Cập nhật tài khoản' : user.role === 'instructor' ? 'Thêm tài khoản sinh viên' : 'Thêm tài khoản mới'}</h3>
      <p className="muted form-note">Sinh viên có thể đăng ký bằng Google và sẽ ở trạng thái <b>Chờ duyệt</b>. Giảng viên hoặc Admin xác nhận thì sinh viên mới đăng nhập được.</p>
      {pendingCount > 0 && <div className="pending-alert">🕒 Có <strong>{pendingCount}</strong> tài khoản sinh viên đang chờ xác nhận.</div>}
      <div className="tool-box import-box">
        <label className="field-label">Import danh sách sinh viên</label>
        <input type="file" accept=".csv,.txt,.json" onChange={importStudentsFile} />
        <p className="muted small">Có thể xuất Excel sang CSV. Cột hỗ trợ: fullName, email, studentCode, className, phone, gmail, password.</p>
      </div>
      <div className="form-grid one">
        <input placeholder="Họ tên" value={accountForm.fullName} onChange={(e) => setAccountForm({ ...accountForm, fullName: e.target.value })} />
        <input placeholder="Email đăng nhập" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} />
        <input placeholder="Mật khẩu" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} />
        <select value={effectiveRole} disabled={user.role === 'instructor' || editingAccountId} onChange={(e) => setAccountForm({ ...accountForm, role: e.target.value })}>
          <option value="student">Sinh viên</option>
          {user.role === 'admin' && <option value="instructor">Giảng viên</option>}
          {user.role === 'admin' && <option value="admin">Admin</option>}
        </select>
        {effectiveRole === 'student' && <>
          <input placeholder="Mã sinh viên" value={accountForm.studentCode || ''} onChange={(e) => setAccountForm({ ...accountForm, studentCode: e.target.value })} />
          <input placeholder="Lớp" value={accountForm.className || ''} onChange={(e) => setAccountForm({ ...accountForm, className: e.target.value })} />
        </>}
        <input placeholder="Số điện thoại" value={accountForm.phone || ''} onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })} />
        <input placeholder="Gmail liên hệ" value={accountForm.gmail || ''} onChange={(e) => setAccountForm({ ...accountForm, gmail: e.target.value })} />
        <input placeholder="Avatar URL" value={accountForm.avatarUrl || ''} onChange={(e) => setAccountForm({ ...accountForm, avatarUrl: e.target.value })} />
      </div>
      <div className="button-row left"><button className="primary-btn" onClick={saveAccount}>{editingAccountId ? 'Lưu thay đổi' : 'Thêm tài khoản'}</button><button className="secondary-btn" onClick={() => { setAccountForm({ ...emptyAccountForm, role: 'student' }); setEditingAccountId(null); }}>Reset</button></div>
    </div>
    <div className="card table-card slim">
      <div className="section-head"><h3>{user.role === 'instructor' ? 'Danh sách sinh viên' : 'Danh sách tài khoản'}</h3><button className="primary-btn" disabled={!accounts.length} onClick={() => downloadCsv(user.role === 'instructor' ? 'danh-sach-sinh-vien.csv' : 'danh-sach-tai-khoan.csv', ['Họ tên', 'Vai trò', 'Email', 'Mã sinh viên', 'Lớp', 'Số điện thoại', 'Gmail', 'Trạng thái', 'Ngày tạo'], accounts.map((account) => [account.fullName, roleLabel(account.role), account.email, account.studentCode || '', account.className || '', account.phone || '', account.gmail || '', accountStatusLabel(account.status), formatDate(account.createdAt)]))}>Xuất CSV</button></div>
      <table>
        <thead><tr><th>Avatar</th><th>Họ tên</th><th>Vai trò</th><th>Email</th><th>Thông tin</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
        <tbody>{accounts.map((account) => <tr key={account.id} className={account.status === 'pending' ? 'pending-row' : ''}>
          <td><AvatarBubble user={account} small /></td>
          <td>{account.fullName}</td>
          <td><span className="status draft">{roleLabel(account.role)}</span></td>
          <td>{account.email}</td>
          <td>{account.role === 'student' ? `${account.studentCode || '—'} · ${account.className || '—'}` : account.gmail || '—'}</td>
          <td><span className={`status ${account.status === 'pending' ? 'warning' : 'active'}`}>{accountStatusLabel(account.status)}</span></td>
          <td><div className="button-row left compact">
            {account.status === 'pending' && account.role === 'student' && <button className="primary-btn" onClick={() => approveAccount(account.id)}>Xác nhận</button>}
            {user.role === 'admin' && <button className="secondary-btn" onClick={() => { setEditingAccountId(account.id); setAccountForm({ ...emptyAccountForm, ...account, password: '' }); }}>Sửa</button>}
            {user.role === 'admin' && <button className="danger-btn" onClick={() => deleteAccount(account.id)}>Xóa</button>}
            {user.role === 'instructor' && account.status !== 'pending' && <span className="muted small">Chỉ xem</span>}
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
function Topbar({ user, logout, theme, toggleTheme, openProfile, notifications, unreadCount, notificationOpen, setNotificationOpen, markNotificationsRead }) {
  return (
    <div className="topbar">
      <div>
        <div className="brand"><span className="brand-icon">🛡️</span> ExamShield</div>
        <div className="topbar-sub">Xin chào, {user.fullName} · {roleLabel(user.role)}</div>
      </div>
      <div className="user-row">
        <span className="online-dot">● Online</span>
        <button className="theme-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️ Sáng' : '🌙 Tối'}</button>
        <NotificationBell notifications={notifications} unreadCount={unreadCount} notificationOpen={notificationOpen} setNotificationOpen={setNotificationOpen} markNotificationsRead={markNotificationsRead} />
        <button className="user-chip profile-chip" onClick={openProfile} title="Xem hồ sơ cá nhân">
          <AvatarBubble user={user} />
          <div><strong>{user.fullName}</strong><div className="muted small">{roleLabel(user.role)} · Profile</div></div>
        </button>
        <button className="secondary-btn" onClick={logout}>Đăng xuất</button>
      </div>
    </div>
  );
}

function NotificationBell({ notifications = [], unreadCount = 0, notificationOpen, setNotificationOpen, markNotificationsRead }) {
  const latest = notifications.slice(0, 8);
  async function handleOpen() {
    const next = !notificationOpen;
    setNotificationOpen(next);
    if (next && unreadCount) await markNotificationsRead();
  }
  return (
    <div className="notification-wrap">
      <button className={'bell-btn ' + (unreadCount ? 'has-unread' : '')} onClick={handleOpen} title="Thông báo hệ thống">
        <span className="bell-icon">🔔</span>
        {unreadCount > 0 && <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {notificationOpen && (
        <div className="notification-panel">
          <div className="notification-head"><strong>Thông báo</strong><span>{notifications.length} mục</span></div>
          {!latest.length && <div className="empty-notification">Chưa có thông báo mới.</div>}
          {latest.map((item) => (
            <div key={item.id} className={'notification-item ' + (item.isRead ? '' : 'unread')}>
              <div className="notification-icon">{item.icon || '🔔'}</div>
              <div><strong>{item.title}</strong><p>{item.message}</p><span>{formatDate(item.createdAt)}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AvatarBubble({ user, small = false }) {
  const src = user?.avatarUrl || user?.avatar_url || '';
  return <div className={`avatar ${small ? 'small-avatar' : ''}`}>{src ? <img src={src} alt="avatar" /> : <span>{avatarText(user)}</span>}</div>;
}

function ProfilePanel({ user, profileForm, setProfileForm, saveProfile, profileOtp, setProfileOtp, sendProfileGmailOtp, verifyProfileGmailOtp }) {
  function handleAvatarFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Vui lòng chọn file ảnh.'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Ảnh nên nhỏ hơn 2MB để lưu ổn định trong SQLite demo.'); return; }
    const reader = new FileReader();
    reader.onload = () => setProfileForm({ ...profileForm, avatarUrl: reader.result });
    reader.readAsDataURL(file);
  }
  function updateProfileGmail(value) {
    setProfileForm({ ...profileForm, gmail: value });
    setProfileOtp({ code: '', sent: false, verified: false, mockOtp: '', expiresAt: '', loading: false });
  }
  const currentGmail = String(user.gmail || '').trim().toLowerCase();
  const nextGmail = String(profileForm.gmail || '').trim().toLowerCase();
  const gmailChanged = nextGmail && nextGmail !== currentGmail;
  return (
    <div className="profile-grid">
      <div className="card profile-card">
        <div className="profile-head"><AvatarBubble user={{ ...user, avatarUrl: profileForm.avatarUrl }} /><div><p className="eyebrow">Hồ sơ cá nhân</p><h3>{user.fullName}</h3><p className="muted">Bạn chỉ được cập nhật avatar, số điện thoại và Gmail liên hệ.</p></div></div>
        <div className="readonly-grid"><ReadOnly label="Họ và tên" value={user.fullName} /><ReadOnly label="Email đăng nhập" value={user.email} /><ReadOnly label="Vai trò" value={roleLabel(user.role)} /><ReadOnly label="Mã định danh" value={user.studentCode || `USER-${user.id}`} /><ReadOnly label="Lớp" value={user.className || '—'} /><ReadOnly label="Trạng thái" value={user.status || 'active'} /><ReadOnly label="Ngày tạo" value={formatDate(user.createdAt)} /></div>
      </div>
      <div className="card form-card profile-edit-card">
        <h3>Cập nhật thông tin được phép</h3>
        <p className="muted form-note">Có thể upload avatar từ thư viện cá nhân. Các trường quan trọng như họ tên, mã định danh, vai trò và trạng thái chỉ được xem.</p>
        <label className="field-label">Upload avatar từ máy cá nhân</label>
        <div className="avatar-upload-row"><AvatarBubble user={{ ...user, avatarUrl: profileForm.avatarUrl }} /><label className="upload-avatar-btn">Chọn ảnh từ thư viện<input type="file" accept="image/*" onChange={handleAvatarFile} /></label></div>
        <label className="field-label">Hoặc Avatar URL</label>
        <input placeholder="Dán link ảnh avatar hoặc giữ ảnh đã upload" value={profileForm.avatarUrl} onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })} />
        <label className="field-label">Số điện thoại</label>
        <input placeholder="VD: 0901234567" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
        <label className="field-label">Gmail liên hệ</label>
        <div className="gmail-verify-row">
          <input placeholder="VD: ten@gmail.com" value={profileForm.gmail} onChange={(e) => updateProfileGmail(e.target.value)} />
          <button className="secondary-btn otp-send-btn" type="button" disabled={!nextGmail || profileOtp.loading} onClick={sendProfileGmailOtp}>{profileOtp.loading ? 'Đang gửi...' : 'Gửi OTP'}</button>
        </div>
        <div className="otp-panel">
          <div className="otp-status-line">
            {gmailChanged ? <span className={profileOtp.verified ? 'verify-ok' : 'verify-warn'}>{profileOtp.verified ? '✅ Gmail mới đã xác thực OTP' : '⚠️ Gmail mới cần xác thực OTP trước khi lưu'}</span> : <span className="verify-ok">✅ Gmail hiện tại đã lưu trong hệ thống</span>}
          </div>
          {profileOtp.sent && !profileOtp.verified && (
            <>
              <div className="otp-input-row">
                <input className="otp-input" placeholder="Nhập mã OTP 6 số" value={profileOtp.code} maxLength={6} onChange={(e) => setProfileOtp({ ...profileOtp, code: e.target.value.replace(/\D/g, '') })} />
                <button className="primary-btn otp-verify-btn" type="button" disabled={profileOtp.loading || profileOtp.code.length < 6} onClick={verifyProfileGmailOtp}>Xác thực</button>
              </div>
              {profileOtp.expiresAt && <p className="muted small">Mã hết hạn: {formatDate(profileOtp.expiresAt)}</p>}
              {profileOtp.mockOtp && <p className="otp-demo-code">Mã demo do MAIL_MODE=demo: <strong>{profileOtp.mockOtp}</strong></p>}
            </>
          )}
        </div>
        <div className="button-row left"><button className="primary-btn" onClick={saveProfile} disabled={gmailChanged && !profileOtp.verified}>Lưu profile</button></div>
      </div>
    </div>
  );
}

function ReadOnly({ label, value }) {
  return <div className="readonly-box"><span>{label}</span><strong>{value || '—'}</strong></div>;
}

function MetricCard({ label, value, compact = false }) {
  return <div className={`card metric-card ${compact ? 'compact' : ''}`}><div className={`metric-value ${compact ? 'text' : ''}`}>{value}</div><div className="muted">{label}</div></div>;
}

function MiniBox({ label, value }) {
  return <div className="mini-box"><span>{label}</span><strong>{value}</strong></div>;
}
