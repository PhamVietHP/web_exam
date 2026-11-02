# Title Page

ExamShield: Secure Online Examination and Real-Time Academic Integrity Monitoring Platform

Detailed Software Engineering and Network Engineering Project Report

Prepared for a five-member student project team. Report language: English. Vietnamese notes are intentionally included for screenshot and diagram placement.

Prepared date: 2026-05-06. Source system reviewed from the existing frontend and backend repository at C:\Users\hanhn\Downloads\examshield_web\web_exam.


<div style="page-break-after: always;"></div>

# Declaration And Scope

This report documents the ExamShield web application from topic selection to implementation, system structure, demo flow, team timeline, cost estimation, Software Engineering (SE) analysis, Network Engineering (NE) analysis, and academic/technical references. The report is based on the actual repository structure, including the React/Vite frontend, Express backend, SQLite database, Socket.IO real-time monitoring, Google Identity integration, and Gmail-based notification modes.

[GHI CHÚ ẢNH - VI: Chèn ảnh bìa hoặc logo ExamShield ở trang này. Nên dùng ảnh giao diện đăng nhập hoặc dashboard để người đọc nhận diện đề tài ngay.]


<div style="page-break-after: always;"></div>

# Executive Summary

ExamShield is a full-stack web platform designed to help instructors create online exams, allow students to take exams through a controlled browser-based interface, and provide staff with real-time logs of suspicious behavior such as tab switching, copy attempts, shortcut use, and window focus loss. The application supports three roles: student, instructor, and administrator. It combines examination management, account management, profile verification, result reporting, and monitoring analytics.

The main engineering value of the project is not only the exam-taking screen but also the operational workflow around it: account approval, exam lifecycle states, submission locking, automatic score calculation, behavior evidence logging, result email delivery, CSV/PDF exports, and a deployable one-service Render configuration.


<div style="page-break-after: always;"></div>

# Detailed Table Of Contents

The detailed table of contents is generated from the final compact structure. The body uses 15 major chapters, and the detailed content is kept as subsections so the report is easier to scan.

```text
Front Matter
A. Title Page
B. Declaration And Scope
C. Executive Summary
D. Detailed Table Of Contents

1. Topic Selection and Rationale
   1.1 Project Context And Topic Selection

2. Problem Statement, Objectives, and Stakeholders
   2.1 Problem Statement
   2.2 Project Objectives
   2.3 Stakeholders

3. Requirements Analysis and Scope
   3.1 Functional Requirements
   3.2 Non-Functional Requirements
   3.3 Use Case Overview
   3.4 System Boundary

4. Overall System Architecture and Technology Stack
   4.1 High-Level Architecture
   4.2 Repository Structure
   4.3 Technology Stack

5. Frontend Architecture and Anti-Cheat UI
   5.1 Frontend Architecture
   5.2 Frontend Main Screens
   5.3 Frontend State Management
   5.4 Frontend Anti-Cheat Listeners

6. Backend Architecture and API Design
   6.1 Backend Architecture
   6.2 Backend API Surface
   6.3 Authentication Design
   6.4 Authorization Model

7. Database Design and Data Model
   7.1 Database Design
   7.2 Entity Relationship Explanation

8. Exam, Submission, and Scoring Workflows
   8.1 Exam Lifecycle
   8.2 Submission Workflow
   8.3 Score And Warning Calculation

9. Real-Time Monitoring, Email, OTP, and Notifications
   9.1 Real-Time Monitoring Design
   9.2 Email And OTP Design
   9.3 Notification Design

10. Software Engineering Analysis
   10.1 Software Engineering View
   10.2 SE Process And Quality Attributes

11. Network Engineering and Deployment
   11.1 Network Engineering View
   11.2 NE Logical Topology
   11.3 NE Protocols, Ports, And Security
   11.4 Deployment Architecture

12. Security, Privacy, and Proctoring Limits
   12.1 Security Analysis
   12.2 Privacy Analysis
   12.3 Limitations Of Browser-Based Proctoring

13. Demo Scenario
   13.1 Demo Preparation
   13.2 Demo Flow 1-2 Login, Roles, And Exam Creation
   13.3 Demo Flow 3-4 Taking Exam And Staff Monitoring
   13.4 Demo Flow 5 Profile And Gmail OTP

14. Team Plan, Testing, Cost, Risk, and Evaluation
   14.1 Five-Member Team Roles
   14.2 Project Timeline Overview
   14.3 Detailed Timeline By Member
   14.4 Sprint Deliverables
   14.5 Testing Plan
   14.6 Estimated Cost
   14.7 Risk Management
   14.8 Evaluation Against Objectives

15. Future Work, Conclusion, References, and Appendices
   15.1 Future Work
   15.2 Conclusion
   15.3 References 1 Official Documentation
   15.4 References 2 Security Standards
   15.5 References 3 Academic And Industry Literature
   15.6 Appendix A-B Source Mapping And Screenshot Checklist
   15.7 Appendix C-D Diagrams And Traceability
   15.8 Appendix E-F API Demo And Production Hardening
```

[GHI CHÚ ẢNH - VI: Nếu nộp bản Word, dùng References -> Table of Contents để tạo mục lục tự động từ Heading 1 và Heading 2. Bố cục bên dưới đã gộp nội dung thành 15 chương chính và các tiểu mục để bài nhìn gọn hơn.]


<div style="page-break-after: always;"></div>

# 1. Topic Selection and Rationale

## 1.1 Project Context And Topic Selection

Section A - Project Context

Online assessments became a common requirement for universities and training centers after the rapid expansion of hybrid and remote learning. Traditional online quiz tools are often sufficient for simple homework, but formal exams need stronger control over authentication, exam state, timing, one-time submission, evidence collection, and staff review. ExamShield was selected as a practical topic because it combines educational technology, security, real-time networking, database design, and user experience into one integrated web system.

The project fits a student capstone or software engineering course because it has clear user roles, measurable workflows, data persistence, network communication, and realistic deployment concerns. It also provides enough scope for a five-person team: frontend, backend, database, security/anti-cheat, deployment/testing, and documentation can be divided without blocking one another.

Section B - Topic Selection Process

The topic was selected through four evaluation criteria: social relevance, technical feasibility, demonstration value, and learning outcomes. Social relevance comes from the need to preserve academic integrity in online testing. Technical feasibility comes from using mature technologies such as React, Express, SQLite, Socket.IO, and Google/Gmail APIs. Demonstration value is high because the system can be shown live through role-based accounts and real-time monitoring events.

```text
Topic alternatives considered:
- Generic quiz management system: easier but weaker security value.
- LMS clone: too broad for a small team.
- Webcam AI proctoring: high privacy and model-complexity risk.
- ExamShield browser-behavior monitoring: balanced scope, visible demo, lower privacy risk.
```

[GHI CHÚ SƠ ĐỒ - VI: Có thể chèn sơ đồ cây quyết định chọn đề tài, với 4 tiêu chí: nhu cầu thực tế, độ khó vừa đủ, demo rõ, có SE/NE.]


<div style="page-break-after: always;"></div>

# 2. Problem Statement, Objectives, and Stakeholders

## 2.1 Problem Statement

Instructors need a way to create online exams, publish them to students, monitor suspicious behavior, and review results without manually collecting many disconnected files. Students need a clear exam interface that shows time remaining, questions, answer progress, and submission status. Administrators need account control and system oversight. The problem is therefore both pedagogical and technical: build a web-based examination platform that preserves usability while adding transparent monitoring and evidence logs.

ExamShield does not claim to eliminate all cheating. Browser-based monitoring cannot prove the physical environment around a student. The system is designed as a lightweight integrity layer: it records risk indicators, discourages casual misconduct, and gives staff structured evidence for review.

## 2.2 Project Objectives

```text
- Build a role-based online examination platform for students, instructors, and administrators.
- Allow staff to create, update, activate, finish, and review exams.
- Allow students to start an active exam once, answer multiple-choice questions, and submit within the time limit.
- Record anti-cheat behavior events and calculate warning counts.
- Provide real-time staff monitoring through Socket.IO events.
- Store exam data, accounts, logs, sessions, submissions, notifications, and email verification data in SQLite.
- Support Google login and Gmail result/OTP delivery modes for realistic integration.
- Deploy as one Render web service where Express serves the built React frontend.
```

## 2.3 Stakeholders

```text
Stakeholder                  Main Need
Student                      Take exam, see timer, submit answers, review own results.
Instructor                   Create exams, manage students, monitor logs, review results.
Administrator                Manage all accounts, approve/lock users, oversee system.
School/Training Center       Improve exam integrity and reduce manual processing.
Technical Team               Maintain code, database, deployment, and security settings.
```

The user interface currently reflects these stakeholders by separating login role selection, student exam screens, staff tabs, account panels, log tables, analytics panels, result detail panels, and profile verification features.


<div style="page-break-after: always;"></div>

# 3. Requirements Analysis and Scope

## 3.1 Functional Requirements

```text
- FR1: Users can log in with email/password and role validation.
- FR2: Google Identity login can authenticate users by Google credential and optionally create pending student accounts.
- FR3: Users can view and update limited profile fields, including phone, Gmail, and avatar.
- FR4: Gmail contact changes require OTP verification before saving.
- FR5: Instructors/admins can create exams with title, subject, description, duration, status, and questions.
- FR6: Exam questions include four options, a correct index, point value, and sort order.
- FR7: Staff can import student lists and exam questions from CSV/JSON data.
- FR8: Students can start active exams, answer questions, and submit once.
- FR9: The backend calculates score, correct count, warning count, status, and time spent.
- FR10: Staff can view behavior logs, results, dashboard stats, and result details.
- FR11: The frontend can export CSV reports and print result details as PDF.
- FR12: Notifications are created for important exam/account/result events.
```

## 3.2 Non-Functional Requirements

```text
- Usability: role-specific screens should be understandable without staff training.
- Performance: API calls should be lightweight enough for demo classrooms and small deployments.
- Reliability: submissions should be stored once and protected from duplicate submission.
- Security: role-based access control must protect account, exam, log, and result endpoints.
- Maintainability: frontend and backend code should use recognizable React and Express patterns.
- Deployability: the system should run locally and deploy to Render with environment variables.
- Privacy: anti-cheat monitoring should avoid high-risk webcam/microphone surveillance in the current design.
- Auditability: suspicious events should be timestamped and visible in staff review screens.
```

## 3.3 Use Case Overview

```text
Use Case UC-01: Login
Actor: Student, Instructor, Admin
Main flow: choose role -> enter credentials or Google login -> backend validates -> token returned -> UI loads role data.

Use Case UC-02: Create Exam
Actor: Instructor/Admin
Main flow: open exam form -> add questions -> save draft or active exam -> students/admin receive notification.

Use Case UC-03: Take Exam
Actor: Student
Main flow: start active exam -> backend creates session -> frontend loads questions -> anti-cheat listeners run -> submit.

Use Case UC-04: Monitor
Actor: Instructor/Admin
Main flow: suspicious event occurs -> backend inserts log -> Socket.IO emits update -> staff table refreshes.
```

## 3.4 System Boundary

ExamShield's system boundary includes the browser client, Express API server, Socket.IO real-time channel, SQLite database file, and optional external services from Google. The system does not include a learning management system, payment gateway, biometric identity verification, AI webcam classification, or institutional student information system. These are possible future integrations but are intentionally outside the current implementation scope.

[GHI CHÚ SƠ ĐỒ - VI: Vẽ boundary bằng hình chữ nhật lớn 'ExamShield System', bên ngoài có Google Identity, Gmail API/SMTP, Render Hosting và User Browser.]


<div style="page-break-after: always;"></div>

# 4. Overall System Architecture and Technology Stack

## 4.1 High-Level Architecture

```text
Student / Instructor / Admin Browser
            |
            | HTTPS / WebSocket
            v
React + Vite Frontend  <---- Socket.IO events ---->  Express + Socket.IO Backend
            |                                      |
            | REST JSON API                         | sqlite3 library
            v                                      v
      /api endpoints                       examshield.sqlite
                                                  |
                       Optional external services: Google Identity, Gmail SMTP/API
```

[GHI CHÚ SƠ ĐỒ - VI: Dùng sơ đồ này làm Hình 1. Ghi chú màu xanh cho REST API, màu cam cho realtime Socket.IO, màu xám cho SQLite.]

## 4.2 Repository Structure

```text
web_exam/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── App.css
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── package-lock.json
├── render.yaml
├── README.md
├── README_DEPLOY_RENDER.md
├── README_DEPLOY_GMAIL.md
├── sample_exam_questions.csv
└── sample_exam_questions.json
```

The project is intentionally compact. The backend is centralized in one server file for a deploy-ready demo. The frontend is a single React application file with supporting CSS. For production, a future refactor should split routes, services, React components, and CSS modules.

## 4.3 Technology Stack

```text
Layer               Technology                         Purpose
Frontend            React 18, Vite, Framer Motion       SPA UI, state, animation, build tooling
Realtime Client     socket.io-client                    Staff dashboards receive live events
Backend             Node.js 20, Express 4               REST API and static frontend serving
Realtime Server     Socket.IO 4                         log:new, monitor:update, submission:new
Database            SQLite 3                            file-based relational persistence
Authentication      custom HMAC token + Google Identity role login and session token
Email               Nodemailer SMTP or Gmail API         OTP and result email delivery
Deployment          Render Web Service                  one-service deployment
```


<div style="page-break-after: always;"></div>

# 5. Frontend Architecture and Anti-Cheat UI

## 5.1 Frontend Architecture

The frontend entry point is `frontend/src/main.jsx`, which renders the React application. Most application behavior is in `frontend/src/App.jsx`. The UI uses React state hooks for screen state, selected role, authenticated user, exam data, account data, logs, results, notifications, profile OTP state, theme selection, and anti-cheat counters. It uses `useEffect` for session restoration, Google button mounting, socket subscriptions, timers, and browser event listeners.

Vite exposes frontend environment variables through `import.meta.env`. The code uses `VITE_API_BASE` and `VITE_SOCKET_URL` when available, otherwise it falls back to localhost in development and same-origin `/api` in production.

## 5.2 Frontend Main Screens

```text
- Login screen: role selection, email/password login, optional Google Sign-In button, and demo account information.
- Student dashboard: available exams, own result history, profile panel, notifications, and exam launch action.
- Exam mode: sticky exam top bar, timer, question palette, answer options, anti-cheat warnings, and submit button.
- Staff dashboard: exams, account management, logs, analytics, result table, detail review, CSV export, and notifications.
- Profile panel: avatar upload/URL, phone update, Gmail contact OTP verification, and read-only identity fields.
```

[GHI CHÚ ẢNH - VI: Chèn 5 ảnh màn hình: Login, Student Dashboard, Exam Mode, Staff Logs, Result Detail. Đặt tên Hình 2 đến Hình 6.]

## 5.3 Frontend State Management

The application uses local component state rather than Redux or a global store. This choice is acceptable for the project scope because all screens are inside a single-page application and the main user flows are linear. The key state groups include authentication (`token`, `user`, `role`), navigation (`screen`, `tab`), exam-taking (`selectedExam`, `questions`, `answers`, `timeLeft`, `antiCheat`), staff data (`accounts`, `logs`, `results`, `stats`), and profile verification (`profileForm`, `profileOtp`).

LocalStorage is used for session token/user restoration and exam draft answers. This improves user experience during refreshes, but it also means production hardening should consider safer token storage strategy, token revocation, and stricter expiration.

## 5.4 Frontend Anti-Cheat Listeners

During exam mode, the frontend records suspicious browser-level events. The available event categories in the code are tab switching, copy attempt, shortcut usage, and window blur. When a violation is detected, the frontend calls the backend `/api/log` endpoint with exam id, type, detail, severity, and metadata. A throttle function reduces duplicate logs from repeated browser events.

This design is transparent and lightweight. It does not require webcam, microphone, desktop control, or invasive local system permissions. The tradeoff is that it cannot detect off-screen assistance, a second device, printed notes, or another person in the room.


<div style="page-break-after: always;"></div>

# 6. Backend Architecture and API Design

## 6.1 Backend Architecture

The backend is implemented in `backend/server.js` using Express for REST endpoints, Socket.IO for real-time events, sqlite3 for persistence, crypto for HMAC token and password hashing, Google Auth Library for credential verification, Google APIs for Gmail API mode, and Nodemailer for SMTP mode. The backend creates the SQLite database directory if it does not exist and runs schema initialization at startup.

Express uses JSON request parsing with a 16 MB limit and permissive CORS for the demo. In production, CORS should be restricted to the deployed frontend origin and request limits should be reviewed according to expected import/avatar sizes.

## 6.2 Backend API Surface

```text
Authentication and profile:
POST /api/login
POST /api/auth/google
GET  /api/me
PUT  /api/me/profile
POST /api/me/profile/send-gmail-otp
POST /api/me/profile/verify-gmail-otp

Staff and accounts:
GET/POST /api/accounts
POST     /api/accounts/import-students
PUT      /api/accounts/:id/approve
PUT/DELETE /api/accounts/:id

Exams and monitoring:
GET/POST /api/exams
GET/PUT/DELETE /api/exams/:id
PUT  /api/exams/:id/status
POST /api/exams/:id/start
POST /api/log
GET  /api/logs

Results and dashboard:
POST /api/submit
GET  /api/results
GET  /api/results/:id
GET  /api/my-results
GET  /api/my-results/:id
GET  /api/dashboard/stats
```

## 6.3 Authentication Design

Email/password login checks the selected role, verifies the password, rejects pending or locked accounts, and returns a signed token. The token format resembles JWT: base64url header, base64url payload, and HMAC-SHA256 signature. The payload includes user id, role, email, and expiration. Middleware `requireRole` parses the Authorization header, verifies the token, checks role membership, confirms the user still exists, and rejects pending/locked/disabled users.

Google login verifies the ID token with `OAuth2Client`. If a Google user already exists, the system can link `google_sub`. If the account does not exist and the role is student, the backend can create a pending or active student depending on `ALLOW_GOOGLE_AUTO_CREATE_STUDENT`.

## 6.4 Authorization Model

```text
Role          Allowed Areas
student       own exams list, start active exam, submit once, own results, profile, notifications
instructor    exams, student accounts, logs, results, dashboard, profile, notifications
admin         all instructor functions plus broader account management, including instructor/admin accounts
```

Access control is enforced on the backend, not only by hiding buttons in the frontend. This is important because a user can call APIs directly with tools such as curl or browser devtools. The backend route middleware is therefore the main security gate.


<div style="page-break-after: always;"></div>

# 7. Database Design and Data Model

## 7.1 Database Design

```text
users: id, full_name, email, password, role, student_code, class_name, phone, gmail, avatar_url, google_sub, status, created_at
exams: id, title, subject, description, duration_minutes, status, created_by, created_at
questions: id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_index, points, sort_order
logs: id, user_id, exam_id, type, detail, severity, warning_value, metadata, created_at
submissions: id, exam_id, student_id, score, correct_count, total_questions, warning_count, status, started_at, submitted_at, time_spent_seconds, result_email_sent, answers_json, anti_cheat_json
exam_sessions: id, exam_id, student_id, started_at, last_activity_at
notifications: id, user_id, actor_id, type, icon, title, message, is_read, created_at
email_verifications: id, user_id, gmail, code, purpose, is_verified, used, expires_at, created_at, verified_at
```

[GHI CHÚ SƠ ĐỒ - VI: Chèn ERD. Đánh dấu khóa chính PK ở mỗi bảng, khóa ngoại exam_id/user_id/student_id, và unique constraint submissions(exam_id, student_id).]

## 7.2 Entity Relationship Explanation

A user can create exams if they are an instructor or admin. An exam owns many questions. A student creates one exam session per exam before submitting. A submission is unique by exam and student, which prevents repeated attempts. Logs connect a user and optionally an exam to timestamped behavior evidence. Notifications connect system events to users. Email verification stores OTP codes for profile Gmail changes.

The design favors auditability: raw answers and anti-cheat state are stored as JSON in submissions, while individual behavior events are stored in logs. This allows staff to see both the final score and the evidence timeline.


<div style="page-break-after: always;"></div>

# 8. Exam, Submission, and Scoring Workflows

## 8.1 Exam Lifecycle

```text
Draft -> Active -> Finished
  |        |          |
  |        |          +-- students can no longer submit
  |        +------------- students can start and submit
  +---------------------- staff can prepare/edit before submissions
```

The backend prevents editing exam questions after submissions exist. This protects result history because changing questions after a student submits would make previous scores inconsistent. If an exam already has submissions, staff should create a new exam instead of editing question content.

## 8.2 Submission Workflow

```text
1. Student clicks Start.
2. Backend validates exam status and duplicate submission.
3. Backend creates or updates exam session.
4. Frontend loads questions and starts timer.
5. Student answers questions.
6. Anti-cheat events are logged when triggered.
7. Student submits.
8. Backend calculates score, warning count, status, and time spent.
9. Backend stores submission, sends result notification/email, emits realtime updates.
```

## 8.3 Score And Warning Calculation

The score is calculated from earned points divided by total points and scaled to 10. The code counts a question as correct when the submitted selected index matches the stored correct index. The warning count is calculated from log rows for the same user and exam created after the session start, excluding the session-start event. If the warning count is at least 3, the submission status becomes flagged; otherwise it is submitted.

This threshold is simple enough for a demo and easy to explain to instructors. In future versions, the warning algorithm could use severity weighting, event decay, per-exam policy, and manual staff override.


<div style="page-break-after: always;"></div>

# 9. Real-Time Monitoring, Email, OTP, and Notifications

## 9.1 Real-Time Monitoring Design

The backend uses Socket.IO on top of the HTTP server. When logs are created, the backend emits `log:new`. When exam sessions start, it emits `monitor:update`. When submissions are created, it emits `submission:new`. The staff frontend subscribes to these events and refreshes relevant data. This creates a monitoring dashboard experience without forcing staff to manually reload the page.

[GHI CHÚ SƠ ĐỒ - VI: Sơ đồ sequence: Student browser -> POST /api/log -> Express inserts logs -> io.emit('log:new') -> Staff browser updates log table.]

## 9.2 Email And OTP Design

The backend supports three mail modes. `MAIL_MODE=demo` only logs mock emails so the project can run without credentials. `MAIL_MODE=smtp` sends email through Nodemailer with Gmail App Password. `MAIL_MODE=gmail_api` uses Google APIs with OAuth2 refresh token and Gmail API `users.messages.send`. This layered design makes development and demonstration easier while still showing a path to real email delivery.

OTP verification is used when users update their Gmail contact field in the profile. The backend generates a six-digit code, stores it with expiry, sends it through the selected mail mode, and only allows saving a changed Gmail after successful verification.

## 9.3 Notification Design

Notifications are stored in the `notifications` table and shown in the frontend notification bell. Events that create notifications include new exams, exam status changes, account approval needs, result creation, and email delivery outcome. This improves user awareness and makes the application feel operational instead of only transactional.

The notification read endpoint updates unread state for the current user. In production, this could be expanded with pagination, notification preferences, email digests, and admin audit filters.


<div style="page-break-after: always;"></div>

# 10. Software Engineering Analysis

## 10.1 Software Engineering View

From a Software Engineering perspective, ExamShield demonstrates requirements analysis, role-based design, REST API design, relational data modeling, UI state management, validation, deployment configuration, and iterative feature delivery. The implementation is pragmatic for a student project because it uses a small number of files and familiar libraries. This reduces setup complexity and makes demonstration reliable.

The main SE risk is maintainability as features grow. The current `App.jsx` and `server.js` files are large. A future version should split backend routes by domain, extract services for auth/email/exam scoring, add a migration system, and split frontend components into folders such as `auth`, `student`, `staff`, `profile`, `exam`, and `shared`.

## 10.2 SE Process And Quality Attributes

Section A - SE Process Model

```text
Recommended process: Iterative Incremental Development

Iteration 1: authentication, roles, database seed, basic exam list
Iteration 2: exam creation, questions, student exam-taking screen
Iteration 3: submission scoring, results, staff result detail
Iteration 4: anti-cheat logs, Socket.IO realtime dashboard
Iteration 5: Google login, Gmail/OTP, deployment, documentation
```

The iterative model is appropriate because user workflows can be demonstrated after each iteration. It also reduces the risk of discovering integration problems too late.

Section B - SE Quality Attributes

```text
Quality Attribute    Current Support                          Improvement
Usability            Role-based screens, timer, exports        user testing and accessibility review
Security             role middleware, HMAC token, PBKDF2       standard JWT/bcrypt, rate limits, CSRF strategy
Reliability          SQLite persistence, unique submissions     backup, migrations, transaction wrapping
Maintainability      compact demo code                         modular route/component structure
Testability          clear API endpoints                        automated unit/API/E2E tests
Deployability        Render one-service config                  production DB and secret rotation
```


<div style="page-break-after: always;"></div>

# 11. Network Engineering and Deployment

## 11.1 Network Engineering View

From a Network Engineering perspective, ExamShield uses a standard client-server model. Browsers communicate with the Express backend through HTTP(S) REST requests for CRUD operations and WebSocket transport via Socket.IO for real-time monitoring. In local development, the frontend runs on port 5173 and the backend on port 5000. In production, the backend can serve the built frontend and expose `/api` on the same origin.

This architecture simplifies deployment because a single Render service can host both frontend static files and backend API. It also reduces CORS complexity in production, since frontend and backend can share the same domain.

## 11.2 NE Logical Topology

```text
[Student LAN/Wi-Fi]      [Instructor LAN/Wi-Fi]
        |                         |
        +----------- Internet ----+
                    |
              HTTPS/WSS 443
                    |
             Render Web Service
                    |
     Node.js Express + Socket.IO process
                    |
             Local SQLite file
```

[GHI CHÚ SƠ ĐỒ - VI: Vẽ topology mạng với client ở hai mạng khác nhau, đi qua Internet đến Render. Ghi rõ HTTPS cho REST và WSS/WebSocket cho realtime.]

## 11.3 NE Protocols, Ports, And Security

Section A - NE Protocols And Ports

```text
Environment        Frontend URL              Backend/API URL              Realtime URL
Local dev          http://localhost:5173     http://localhost:5000/api    http://localhost:5000
Production         https://service.onrender.com /api same origin          same origin WebSocket

Protocols:
- HTTP/HTTPS: login, account, exam, result, notification APIs
- WebSocket/Socket.IO: realtime log, monitor, submission events
- SMTP or Gmail API HTTPS: outgoing email delivery
- SQLite file I/O: local backend persistence
```

Section B - NE Security Considerations

```text
- Use HTTPS in deployment so tokens and exam answers are encrypted in transit.
- Restrict CORS to trusted frontend origins in production instead of wildcard origin.
- Use environment variables for Google, Gmail, token secret, and mail credentials.
- Rotate secrets if they are exposed and never commit real credentials.
- Apply rate limiting to login, OTP sending, and submission endpoints in a production version.
- Monitor Socket.IO connection counts during large exams.
- Prefer an external production database for durability instead of ephemeral local storage on free hosting.
```

## 11.4 Deployment Architecture

The `render.yaml` file configures a Render web service using Node. Its build command installs backend dependencies, installs frontend dependencies, and builds the frontend. Its start command runs the backend. At runtime, the Express backend checks for `frontend/dist` and serves it as static files, with a wildcard route returning `index.html` for SPA navigation.

```text
Build command:
cd backend && npm install && cd ../frontend && npm install && npm run build

Start command:
cd backend && npm start
```


<div style="page-break-after: always;"></div>

# 12. Security, Privacy, and Proctoring Limits

## 12.1 Security Analysis

The most important security control in the current system is role-based authorization. Staff-only APIs are protected by `requireRole(['instructor', 'admin'])`, admin-only account updates are protected by `requireRole(['admin'])`, and student-only exam start/submission APIs are protected by `requireRole(['student'])`. This follows the OWASP principle that access control must be enforced server-side.

Password hashing uses PBKDF2 for newly created or updated passwords, while seed demo accounts include legacy plain values for convenience. Production should migrate all stored passwords to a modern password-hashing library such as bcrypt or argon2, enforce password policy, add login rate limiting, and disable demo credentials.

## 12.2 Privacy Analysis

ExamShield's current monitoring focuses on browser behavior rather than webcam or microphone surveillance. This is a privacy-conscious design choice for a student project. It collects event type, detail, severity, warning value, metadata, timestamp, user id, and exam id. It does not collect video, audio, face images, room images, keystroke content, or desktop screen recordings.

The project should still disclose monitoring clearly before the exam starts. Students should know what events are recorded, why they are recorded, who can review them, and how long logs are retained.

## 12.3 Limitations Of Browser-Based Proctoring

```text
- It cannot detect another device beside the student.
- It cannot detect printed notes or another person in the room.
- Browser events may create false positives due to accidental focus changes.
- Students with accessibility tools may trigger shortcut or focus events unintentionally.
- Network interruption can affect live monitoring, although submission data is still sent through REST.
- LocalStorage exam drafts improve recovery but should be balanced against exam policy.
```


<div style="page-break-after: always;"></div>

# 13. Demo Scenario

## 13.1 Demo Preparation

```text
Local backend:
cd backend
npm install
npm start

Local frontend:
cd frontend
npm install
npm run dev

Browser:
http://localhost:5173

Demo accounts:
student@example.com / 123456
student2@example.com / 123456
instructor@example.com / 123456
admin@example.com / 123456
```

[GHI CHÚ ẢNH - VI: Chèn ảnh terminal backend chạy ở port 5000 và frontend Vite chạy ở port 5173.]

## 13.2 Demo Flow 1-2 Login, Roles, And Exam Creation

Section A - Demo Flow 1 Login And Roles

```text
Step 1: Open login page.
Step 2: Select Student role and log in with student@example.com / 123456.
Step 3: Confirm student dashboard shows available exams and result history.
Step 4: Log out.
Step 5: Select Instructor role and log in with instructor@example.com / 123456.
Step 6: Confirm staff tabs are visible: exams, accounts, logs, results, analytics.
```

[GHI CHÚ ẢNH - VI: Ảnh login nên chụp rõ 3 nút vai trò: Sinh viên, Giảng viên, Admin.]

Section B - Demo Flow 2 Create Exam

```text
Step 1: Instructor opens exam creation tab.
Step 2: Enter title, subject, description, duration, and status.
Step 3: Add at least 5 multiple-choice questions.
Step 4: Save exam as draft.
Step 5: Switch exam status to active.
Step 6: Verify notification appears for students/admins.
```

[GHI CHÚ ẢNH - VI: Chèn ảnh form tạo đề và ảnh bảng đề thi sau khi chuyển sang trạng thái active.]

## 13.3 Demo Flow 3-4 Taking Exam And Staff Monitoring

Section A - Demo Flow 3 Take Exam

```text
Step 1: Student logs in.
Step 2: Student starts an active exam.
Step 3: Timer appears and questions are loaded.
Step 4: Student answers questions.
Step 5: Student intentionally switches tab or copies text once to show warning.
Step 6: Student submits before time expires.
Step 7: Result screen shows score, correct count, warning count, and email status.
```

[GHI CHÚ ẢNH - VI: Chèn ảnh màn hình thi có timer và palette câu hỏi. Không cần chụp thông tin nhạy cảm thật.]

Section B - Demo Flow 4 Staff Monitoring

```text
Step 1: Keep instructor/admin dashboard open in another browser.
Step 2: Student triggers anti-cheat event during exam.
Step 3: Staff sees realtime log update.
Step 4: Staff opens Logs tab and exports CSV.
Step 5: Staff opens Results tab after submission.
Step 6: Staff views result detail, question review, and session logs.
```

[GHI CHÚ ẢNH - VI: Chèn ảnh Logs tab có dòng 'Chuyển tab', 'Sao chép nội dung', hoặc 'Window Blur'.]

## 13.4 Demo Flow 5 Profile And Gmail OTP

```text
Step 1: User opens Profile.
Step 2: User changes Gmail contact.
Step 3: User clicks Send OTP.
Step 4: In demo mode, backend returns mock OTP; in SMTP/API mode, email is sent.
Step 5: User enters OTP and verifies.
Step 6: User saves profile.
```

[GHI CHÚ ẢNH - VI: Nếu chưa cấu hình Gmail thật, chụp mock OTP trong giao diện hoặc terminal để chứng minh luồng hoạt động.]


<div style="page-break-after: always;"></div>

# 14. Team Plan, Testing, Cost, Risk, and Evaluation

## 14.1 Five-Member Team Roles

```text
Member 1 - Project Lead / SE Analyst:
  requirements, use cases, schedule, documentation, final presentation.
Member 2 - Frontend Developer:
  React screens, responsive UI, exam mode, profile and staff panels.
Member 3 - Backend Developer:
  Express APIs, authentication, scoring, account/exam/result logic.
Member 4 - Database and Security Engineer:
  SQLite schema, RBAC review, anti-cheat logging, OTP workflow.
Member 5 - Network/Deployment/QA Engineer:
  Socket.IO, Render deployment, environment variables, test cases, demo script.
```

## 14.2 Project Timeline Overview

```text
Duration: 8 weeks

Week 1: Topic selection, requirements, initial repository review
Week 2: UI wireframe, database schema, API design
Week 3: Authentication, role screens, seed data
Week 4: Exam CRUD, question builder, import/export basics
Week 5: Student exam mode, timer, submission, scoring
Week 6: Anti-cheat logs, realtime monitoring, result detail
Week 7: Google login, Gmail OTP/result email, deployment
Week 8: Testing, bug fixing, report, slides, final demo rehearsal
```

[GHI CHÚ SƠ ĐỒ - VI: Tạo Gantt chart 8 tuần, mỗi thành viên một dòng. Dùng màu khác nhau cho Frontend, Backend, DB/Security, NE/QA, Documentation.]

## 14.3 Detailed Timeline By Member

```text
Week | M1 Lead/SE        | M2 Frontend       | M3 Backend         | M4 DB/Security      | M5 NE/QA
1    | topic + scope     | UI references     | API inventory      | data entities       | local setup
2    | use cases         | wireframes        | route plan         | ERD draft           | topology plan
3    | backlog           | login/dashboard   | auth/token         | user schema         | smoke tests
4    | review            | exam builder      | exam CRUD          | questions schema    | API test cases
5    | demo plan         | exam mode/timer   | submit/scoring     | submission model    | timing tests
6    | risk review       | logs/results UI   | logs/socket emits  | warning policy      | realtime tests
7    | deploy checklist  | profile OTP UI    | Google/Gmail       | OTP table/security  | Render deploy
8    | report/slides     | UI polish         | bug fixes          | final audit         | demo rehearsal
```

## 14.4 Sprint Deliverables

```text
- Sprint 1 deliverable: approved topic proposal, problem statement, requirement list, initial architecture.
- Sprint 2 deliverable: login, role-based navigation, seeded users, basic exams list.
- Sprint 3 deliverable: exam creation/editing, question storage, student exam mode.
- Sprint 4 deliverable: scoring, result details, logs, Socket.IO realtime monitoring.
- Sprint 5 deliverable: Gmail/Google integration, deployment, testing evidence, final report.
```

## 14.5 Testing Plan

```text
Test Area             Example Test
Authentication        wrong role cannot log in; locked/pending user rejected
Authorization         student cannot call staff endpoints
Exam CRUD             staff can create active/draft exams; cannot edit after submission
Submission            duplicate submit rejected; late submit rejected after grace period
Scoring               correct index and point calculation match expected score
Anti-cheat logs       tab switch/copy/blur create logs and warning count
Realtime              staff receives log:new and submission:new events
Email/OTP             mock mode works; SMTP/API failure does not break submission
Deployment            production frontend calls /api, not localhost
```

## 14.6 Estimated Cost

```text
Item                                      Estimated Cost (USD)       Note
Development labor, 5 students x 8 weeks   0 academic cost / 3,200     if valued at $10/hour x 8h/week
Render free web service                   0                           demo deployment
Domain name                               10-15/year                  optional
Gmail account / Google Cloud basic        0                           within free/demo use
Email sending                             0-20/month                  depends on volume and provider
Database                                  0 demo / 5-20/month         SQLite demo; PostgreSQL for production
Monitoring/log storage                    0 demo / 5-25/month         optional production add-on
SSL certificate                           0                           included by Render/custom provider
Testing devices/browsers                  0-200                       optional if using existing laptops
Total demo cash cost                      0-15                        excluding student labor
Total small production monthly estimate   10-65/month                 excluding labor and institutional support
```

For a university course demo, the actual cash cost can be nearly zero because the repository uses open-source frameworks and free hosting tiers. For a production school deployment, the main cost is not software licenses but operational maintenance, hosting reliability, email delivery, data backup, support, and security review.

## 14.7 Risk Management

```text
Risk                         Impact                  Mitigation
SQLite file lost on free host data loss               use PostgreSQL or backups in production
Token secret left default     account compromise       require TOKEN_SECRET in deployment
False positive anti-cheat     unfair review            staff manual review and clear policy
Large single files            difficult maintenance    modular refactor
Gmail credential error        no email delivery        demo fallback and admin warning
Network interruption          realtime lag             REST submission remains source of truth
```

## 14.8 Evaluation Against Objectives

```text
- Role-based workflows are implemented through frontend screens and backend middleware.
- Exam CRUD and question management are implemented for instructor/admin roles.
- Student exam start, timer, draft answer storage, submission, and result review are implemented.
- Anti-cheat logs and warning-based flagged submissions are implemented.
- Realtime monitoring is implemented with Socket.IO events.
- SQLite schema covers accounts, exams, questions, logs, submissions, sessions, notifications, and OTP.
- Google Identity and Gmail modes are supported through environment variables.
- Render one-service deployment is documented and configured.
```


<div style="page-break-after: always;"></div>

# 15. Future Work, Conclusion, References, and Appendices

## 15.1 Future Work

```text
- Refactor frontend into reusable components and route-based pages.
- Refactor backend into route modules, service modules, and validation middleware.
- Move production persistence from SQLite to PostgreSQL with migrations.
- Add automated tests: API tests, frontend component tests, and Playwright E2E tests.
- Add rate limiting, CSRF strategy, stricter CORS, and security headers.
- Add instructor-configurable anti-cheat thresholds per exam.
- Add audit log retention policy and exportable integrity reports.
- Add question bank, randomization, per-student variants, and exam access windows.
- Add accessibility review for keyboard navigation and screen readers.
- Add backup and restore process for production operations.
```

## 15.2 Conclusion

ExamShield is a practical full-stack online examination project with enough depth for both Software Engineering and Network Engineering analysis. It demonstrates how a modern web application can combine role-based authorization, relational data modeling, real-time events, email integration, deployment configuration, and browser-level academic-integrity logging.

The current implementation is appropriate for a course project and live demo. For production, the strongest next steps are modularization, automated testing, a production-grade database, stricter security controls, and a formal privacy policy for monitoring data.

## 15.3 References 1 Official Documentation

```text
[1] React Documentation. "React: The library for web and native user interfaces." https://react.dev/
[2] React Documentation. "Built-in React Hooks." https://react.dev/reference/react/hooks
[3] Vite Documentation. "Env Variables and Modes." https://vite.dev/guide/env-and-mode
[4] Express Documentation. "Routing." https://expressjs.com/en/guide/routing.html
[5] Express Documentation. "Using middleware." https://expressjs.com/en/guide/using-middleware
[6] Socket.IO Documentation. "Emitting events." https://socket.io/docs/v4/emitting-events/
[7] SQLite Documentation. "About SQLite." https://www.sqlite.org/about.html
[8] SQLite Documentation. "SQLite Is Serverless." https://sqlite.org/serverless.html
[9] Google for Developers. "Sign in with Google for Web - Overview." https://developers.google.com/identity/gsi/web/guides/overview
[10] Google for Developers. "Gmail API users.messages.send." https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send
```

## 15.4 References 2 Security Standards

```text
[11] OWASP. "OWASP Top 10:2021." https://owasp.org/Top10/2021/
[12] OWASP. "A01:2021 - Broken Access Control." https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/
[13] OWASP Cheat Sheet Series. "Authentication Cheat Sheet." https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
[14] OWASP Cheat Sheet Series. "Session Management Cheat Sheet." https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
[15] NIST. "SP 800-63B Digital Identity Guidelines: Authentication and Lifecycle Management." https://pages.nist.gov/800-63-3/sp800-63b.html
[16] MDN Web Docs. "Page Visibility API." https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
```

These sources support the report's discussion of access control, authentication, session management, browser visibility events, and secure web application design.

## 15.5 References 3 Academic And Industry Literature

```text
[17] Butler-Henderson, K., & Crawford, J. (2020). "A systematic review of online examinations: A pedagogical innovation for scalable authentication and integrity." Computers & Education, 159, 104024. https://doi.org/10.1016/j.compedu.2020.104024
[18] Alguacil, M., Herranz-Zarzoso, N., Pernías, J. C., & Sabater-Grande, G. (2024). "Academic dishonesty and monitoring in online exams: a randomized field experiment." Journal of Computing in Higher Education, 36, 835-851. https://doi.org/10.1007/s12528-023-09378-x
[19] Hylton, K., Levy, Y., & Dringus, L. P. (2016). "Utilizing webcam-based proctoring to deter misconduct in online exams." Computers & Education, 92-93, 53-63. https://doi.org/10.1016/j.compedu.2015.10.002
[20] Khalil, M., Prinsloo, P., & Slade, S. (2022). "In the nexus of integrity and surveillance: Proctoring (re)considered." Journal of Computer Assisted Learning, 38(6), 1589-1602. https://doi.org/10.1111/jcal.12713
[21] Balash, D. G., et al. (2021). "Examining the Examiners: Students' Privacy and Security Perceptions of Online Proctoring Services." arXiv:2106.05917. https://arxiv.org/abs/2106.05917
```

## 15.6 Appendix A-B Source Mapping And Screenshot Checklist

Section A - Appendix A Source Code Mapping

```text
frontend/src/App.jsx:
  login, session restore, Google button, student exam mode, staff dashboards, profile OTP UI, CSV/PDF export

frontend/src/App.css:
  dark/light theme, responsive layouts, cards, tables, exam mode, profile panels, notification UI

backend/server.js:
  Express server, SQLite schema, token auth, Google auth, Gmail/Nodemailer mail modes, APIs, Socket.IO events

render.yaml:
  Render one-service build/start commands and environment variable template
```

Section B - Appendix B Vietnamese Screenshot Checklist

```text
[VI] Ảnh 1: Trang đăng nhập, chọn vai trò.
[VI] Ảnh 2: Dashboard sinh viên có danh sách đề thi.
[VI] Ảnh 3: Màn hình làm bài có timer và câu hỏi.
[VI] Ảnh 4: Popup cảnh báo khi chuyển tab/copy.
[VI] Ảnh 5: Dashboard giảng viên/admin.
[VI] Ảnh 6: Form tạo đề thi.
[VI] Ảnh 7: Bảng log realtime.
[VI] Ảnh 8: Bảng kết quả và chi tiết bài làm.
[VI] Ảnh 9: Profile và OTP Gmail.
[VI] Ảnh 10: Terminal chạy backend/frontend hoặc trang Render sau deploy.
```

## 15.7 Appendix C-D Diagrams And Traceability

Section A - Appendix C Diagram Checklist

```text
[VI] Sơ đồ 1: System boundary - Browser, ExamShield, Google, Gmail, Render.
[VI] Sơ đồ 2: High-level architecture - React, Express, Socket.IO, SQLite.
[VI] Sơ đồ 3: ERD database - users, exams, questions, logs, submissions, sessions, notifications, OTP.
[VI] Sơ đồ 4: Sequence start exam and submit exam.
[VI] Sơ đồ 5: Sequence realtime anti-cheat log.
[VI] Sơ đồ 6: Network topology local and production.
[VI] Sơ đồ 7: Gantt chart 8 tuần cho 5 thành viên.
```

Section B - Appendix D Requirement Traceability Matrix

```text
Requirement     Implementation Evidence
FR1             POST /api/login and role selector in App.jsx
FR2             POST /api/auth/google and Google Identity button mounting
FR3             PUT /api/me/profile and ProfilePanel
FR4             email_verifications table and OTP endpoints
FR5             POST /api/exams and CreateExamPanel
FR6             questions table and question builder state
FR7             importStudentsFile and importExamFile
FR8             POST /api/exams/:id/start and exam mode
FR9             POST /api/submit scoring logic
FR10            /api/logs, /api/results, /api/dashboard/stats
FR11            downloadCsv and exportResultPdf
FR12            notifications table and NotificationBell
```

## 15.8 Appendix E-F API Demo And Production Hardening

Section A - Appendix E API Demo Checklist

```text
1. GET /api/health returns backend status.
2. POST /api/login returns token and user.
3. GET /api/exams returns available exams for current role.
4. POST /api/exams creates an exam as instructor/admin.
5. PUT /api/exams/:id/status activates the exam.
6. POST /api/exams/:id/start creates a student session.
7. POST /api/log records a suspicious event.
8. POST /api/submit creates a submission and result.
9. GET /api/results returns staff result table.
10. GET /api/my-results returns student result history.
```

Section B - Appendix F Production Hardening Checklist

```text
- Require strong TOKEN_SECRET and never use the default development secret.
- Replace wildcard CORS with exact allowed origins.
- Use PostgreSQL or another managed production database.
- Migrate all legacy demo passwords to hashed storage.
- Add HTTP security headers through Helmet or equivalent middleware.
- Add rate limits for login, OTP, import, and submission endpoints.
- Add request validation schemas for API bodies.
- Add centralized error handling and structured logs.
- Add backup and restore runbook.
- Add privacy notice and retention rules for anti-cheat logs.
```
