from __future__ import annotations

import html
import os
import re
import textwrap
import zipfile
from datetime import date


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT, "reports")
DOCX_PATH = os.path.join(OUT_DIR, "ExamShield_Detailed_Project_Report_EN_VI_Notes.docx")
ROOT_DOCX_PATH = os.path.join(ROOT, "ExamShield_Report_English_60Pages_VI_Notes.docx")
MD_PATH = os.path.join(OUT_DIR, "ExamShield_Detailed_Project_Report_EN_VI_Notes.md")


def wrap(text: str) -> str:
    return " ".join(textwrap.dedent(text).strip().split())


def bullet(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def code_block(text: str) -> str:
    return textwrap.dedent(text).strip("\n")


CHAPTERS = [
    ("Topic Selection and Rationale", [5]),
    ("Problem Statement, Objectives, and Stakeholders", [6, 7, 8]),
    ("Requirements Analysis and Scope", [9, 10, 11, 12]),
    ("Overall System Architecture and Technology Stack", [13, 14, 15]),
    ("Frontend Architecture and Anti-Cheat UI", [16, 17, 18, 19]),
    ("Backend Architecture and API Design", [20, 21, 22, 23]),
    ("Database Design and Data Model", [24, 25]),
    ("Exam, Submission, and Scoring Workflows", [26, 27, 28]),
    ("Real-Time Monitoring, Email, OTP, and Notifications", [29, 30, 31]),
    ("Software Engineering Analysis", [32, 33]),
    ("Network Engineering and Deployment", [34, 35, 36, 37]),
    ("Security, Privacy, and Proctoring Limits", [38, 39, 40]),
    ("Demo Scenario", [41, 42, 43, 44]),
    ("Team Plan, Testing, Cost, Risk, and Evaluation", [45, 46, 47, 48, 49, 50, 51, 52]),
    ("Future Work, Conclusion, References, and Appendices", [53, 54, 55, 56, 57, 58, 59, 60]),
]


def chapter_toc(pages: list[dict]) -> str:
    lines: list[str] = []
    lines.extend(
        [
            "Front Matter",
            "A. Title Page",
            "B. Declaration And Scope",
            "C. Executive Summary",
            "D. Detailed Table Of Contents",
            "",
        ]
    )
    for chapter_number, (chapter_title, page_numbers) in enumerate(CHAPTERS, start=1):
        lines.append(f"{chapter_number}. {chapter_title}")
        for sub_number, page_number in enumerate(page_numbers, start=1):
            if page_number > len(pages):
                continue
            title = pages[page_number - 1]["title"]
            lines.append(f"   {chapter_number}.{sub_number} {title}")
        lines.append("")
    return "\n".join(lines).strip()


def build_pages() -> list[dict]:
    today = date(2026, 5, 6).isoformat()
    pages: list[dict] = []

    def add(title: str, paragraphs: list[str], kind: str = "normal") -> None:
        pages.append({"title": title, "paragraphs": paragraphs, "kind": kind})

    add(
        "Title Page",
        [
            "ExamShield: Secure Online Examination and Real-Time Academic Integrity Monitoring Platform",
            "Detailed Software Engineering and Network Engineering Project Report",
            "Prepared for a five-member student project team. Report language: English. Vietnamese notes are intentionally included for screenshot and diagram placement.",
            f"Prepared date: {today}. Source system reviewed from the existing frontend and backend repository at C:\\Users\\hanhn\\Downloads\\examshield_web\\web_exam.",
        ],
        "title",
    )
    add(
        "Declaration And Scope",
        [
            wrap("""
            This report documents the ExamShield web application from topic selection to implementation, system structure, demo flow,
            team timeline, cost estimation, Software Engineering (SE) analysis, Network Engineering (NE) analysis, and academic/technical
            references. The report is based on the actual repository structure, including the React/Vite frontend, Express backend,
            SQLite database, Socket.IO real-time monitoring, Google Identity integration, and Gmail-based notification modes.
            """),
            "[GHI CHÚ ẢNH - VI: Chèn ảnh bìa hoặc logo ExamShield ở trang này. Nên dùng ảnh giao diện đăng nhập hoặc dashboard để người đọc nhận diện đề tài ngay.]",
        ],
    )
    add(
        "Executive Summary",
        [
            wrap("""
            ExamShield is a full-stack web platform designed to help instructors create online exams, allow students to take exams through
            a controlled browser-based interface, and provide staff with real-time logs of suspicious behavior such as tab switching,
            copy attempts, shortcut use, and window focus loss. The application supports three roles: student, instructor, and administrator.
            It combines examination management, account management, profile verification, result reporting, and monitoring analytics.
            """),
            wrap("""
            The main engineering value of the project is not only the exam-taking screen but also the operational workflow around it:
            account approval, exam lifecycle states, submission locking, automatic score calculation, behavior evidence logging, result
            email delivery, CSV/PDF exports, and a deployable one-service Render configuration.
            """),
        ],
    )
    add(
        "Detailed Table Of Contents",
        [
            "The detailed table of contents is generated after the report sections are arranged. The report is grouped into 15 major chapters, with the former 60 logical sections preserved as clear subsections.",
            "[GHI CHÚ ẢNH - VI: Nếu nộp bản Word, dùng References -> Table of Contents để tạo mục lục tự động từ Heading 1 và Heading 2. Bố cục bên dưới đã gộp nội dung thành 15 chương chính và các tiểu mục để bài nhìn gọn hơn.]",
        ],
    )
    add(
        "Project Context",
        [
            wrap("""
            Online assessments became a common requirement for universities and training centers after the rapid expansion of hybrid and
            remote learning. Traditional online quiz tools are often sufficient for simple homework, but formal exams need stronger control
            over authentication, exam state, timing, one-time submission, evidence collection, and staff review. ExamShield was selected
            as a practical topic because it combines educational technology, security, real-time networking, database design, and user
            experience into one integrated web system.
            """),
            wrap("""
            The project fits a student capstone or software engineering course because it has clear user roles, measurable workflows, data
            persistence, network communication, and realistic deployment concerns. It also provides enough scope for a five-person team:
            frontend, backend, database, security/anti-cheat, deployment/testing, and documentation can be divided without blocking one another.
            """),
        ],
    )
    add(
        "Topic Selection Process",
        [
            wrap("""
            The topic was selected through four evaluation criteria: social relevance, technical feasibility, demonstration value, and
            learning outcomes. Social relevance comes from the need to preserve academic integrity in online testing. Technical feasibility
            comes from using mature technologies such as React, Express, SQLite, Socket.IO, and Google/Gmail APIs. Demonstration value is
            high because the system can be shown live through role-based accounts and real-time monitoring events.
            """),
            code_block("""
            Topic alternatives considered:
            - Generic quiz management system: easier but weaker security value.
            - LMS clone: too broad for a small team.
            - Webcam AI proctoring: high privacy and model-complexity risk.
            - ExamShield browser-behavior monitoring: balanced scope, visible demo, lower privacy risk.
            """),
            "[GHI CHÚ SƠ ĐỒ - VI: Có thể chèn sơ đồ cây quyết định chọn đề tài, với 4 tiêu chí: nhu cầu thực tế, độ khó vừa đủ, demo rõ, có SE/NE.]",
        ],
    )
    add(
        "Problem Statement",
        [
            wrap("""
            Instructors need a way to create online exams, publish them to students, monitor suspicious behavior, and review results
            without manually collecting many disconnected files. Students need a clear exam interface that shows time remaining, questions,
            answer progress, and submission status. Administrators need account control and system oversight. The problem is therefore
            both pedagogical and technical: build a web-based examination platform that preserves usability while adding transparent
            monitoring and evidence logs.
            """),
            wrap("""
            ExamShield does not claim to eliminate all cheating. Browser-based monitoring cannot prove the physical environment around a
            student. The system is designed as a lightweight integrity layer: it records risk indicators, discourages casual misconduct,
            and gives staff structured evidence for review.
            """),
        ],
    )
    add(
        "Project Objectives",
        [
            bullet(
                [
                    "Build a role-based online examination platform for students, instructors, and administrators.",
                    "Allow staff to create, update, activate, finish, and review exams.",
                    "Allow students to start an active exam once, answer multiple-choice questions, and submit within the time limit.",
                    "Record anti-cheat behavior events and calculate warning counts.",
                    "Provide real-time staff monitoring through Socket.IO events.",
                    "Store exam data, accounts, logs, sessions, submissions, notifications, and email verification data in SQLite.",
                    "Support Google login and Gmail result/OTP delivery modes for realistic integration.",
                    "Deploy as one Render web service where Express serves the built React frontend.",
                ]
            ),
        ],
    )
    add(
        "Stakeholders",
        [
            code_block("""
            Stakeholder                  Main Need
            Student                      Take exam, see timer, submit answers, review own results.
            Instructor                   Create exams, manage students, monitor logs, review results.
            Administrator                Manage all accounts, approve/lock users, oversee system.
            School/Training Center       Improve exam integrity and reduce manual processing.
            Technical Team               Maintain code, database, deployment, and security settings.
            """),
            wrap("""
            The user interface currently reflects these stakeholders by separating login role selection, student exam screens, staff tabs,
            account panels, log tables, analytics panels, result detail panels, and profile verification features.
            """),
        ],
    )
    add(
        "Functional Requirements",
        [
            bullet(
                [
                    "FR1: Users can log in with email/password and role validation.",
                    "FR2: Google Identity login can authenticate users by Google credential and optionally create pending student accounts.",
                    "FR3: Users can view and update limited profile fields, including phone, Gmail, and avatar.",
                    "FR4: Gmail contact changes require OTP verification before saving.",
                    "FR5: Instructors/admins can create exams with title, subject, description, duration, status, and questions.",
                    "FR6: Exam questions include four options, a correct index, point value, and sort order.",
                    "FR7: Staff can import student lists and exam questions from CSV/JSON data.",
                    "FR8: Students can start active exams, answer questions, and submit once.",
                    "FR9: The backend calculates score, correct count, warning count, status, and time spent.",
                    "FR10: Staff can view behavior logs, results, dashboard stats, and result details.",
                    "FR11: The frontend can export CSV reports and print result details as PDF.",
                    "FR12: Notifications are created for important exam/account/result events.",
                ]
            ),
        ],
    )
    add(
        "Non-Functional Requirements",
        [
            bullet(
                [
                    "Usability: role-specific screens should be understandable without staff training.",
                    "Performance: API calls should be lightweight enough for demo classrooms and small deployments.",
                    "Reliability: submissions should be stored once and protected from duplicate submission.",
                    "Security: role-based access control must protect account, exam, log, and result endpoints.",
                    "Maintainability: frontend and backend code should use recognizable React and Express patterns.",
                    "Deployability: the system should run locally and deploy to Render with environment variables.",
                    "Privacy: anti-cheat monitoring should avoid high-risk webcam/microphone surveillance in the current design.",
                    "Auditability: suspicious events should be timestamped and visible in staff review screens.",
                ]
            ),
        ],
    )
    add(
        "Use Case Overview",
        [
            code_block("""
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
            """),
        ],
    )
    add(
        "System Boundary",
        [
            wrap("""
            ExamShield's system boundary includes the browser client, Express API server, Socket.IO real-time channel, SQLite database
            file, and optional external services from Google. The system does not include a learning management system, payment gateway,
            biometric identity verification, AI webcam classification, or institutional student information system. These are possible
            future integrations but are intentionally outside the current implementation scope.
            """),
            "[GHI CHÚ SƠ ĐỒ - VI: Vẽ boundary bằng hình chữ nhật lớn 'ExamShield System', bên ngoài có Google Identity, Gmail API/SMTP, Render Hosting và User Browser.]",
        ],
    )
    add(
        "High-Level Architecture",
        [
            code_block("""
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
            """),
            "[GHI CHÚ SƠ ĐỒ - VI: Dùng sơ đồ này làm Hình 1. Ghi chú màu xanh cho REST API, màu cam cho realtime Socket.IO, màu xám cho SQLite.]",
        ],
    )
    add(
        "Repository Structure",
        [
            code_block("""
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
            """),
            wrap("""
            The project is intentionally compact. The backend is centralized in one server file for a deploy-ready demo. The frontend is
            a single React application file with supporting CSS. For production, a future refactor should split routes, services, React
            components, and CSS modules.
            """),
        ],
    )
    add(
        "Technology Stack",
        [
            code_block("""
            Layer               Technology                         Purpose
            Frontend            React 18, Vite, Framer Motion       SPA UI, state, animation, build tooling
            Realtime Client     socket.io-client                    Staff dashboards receive live events
            Backend             Node.js 20, Express 4               REST API and static frontend serving
            Realtime Server     Socket.IO 4                         log:new, monitor:update, submission:new
            Database            SQLite 3                            file-based relational persistence
            Authentication      custom HMAC token + Google Identity role login and session token
            Email               Nodemailer SMTP or Gmail API         OTP and result email delivery
            Deployment          Render Web Service                  one-service deployment
            """),
        ],
    )
    add(
        "Frontend Architecture",
        [
            wrap("""
            The frontend entry point is `frontend/src/main.jsx`, which renders the React application. Most application behavior is in
            `frontend/src/App.jsx`. The UI uses React state hooks for screen state, selected role, authenticated user, exam data, account
            data, logs, results, notifications, profile OTP state, theme selection, and anti-cheat counters. It uses `useEffect` for
            session restoration, Google button mounting, socket subscriptions, timers, and browser event listeners.
            """),
            wrap("""
            Vite exposes frontend environment variables through `import.meta.env`. The code uses `VITE_API_BASE` and `VITE_SOCKET_URL`
            when available, otherwise it falls back to localhost in development and same-origin `/api` in production.
            """),
        ],
    )
    add(
        "Frontend Main Screens",
        [
            bullet(
                [
                    "Login screen: role selection, email/password login, optional Google Sign-In button, and demo account information.",
                    "Student dashboard: available exams, own result history, profile panel, notifications, and exam launch action.",
                    "Exam mode: sticky exam top bar, timer, question palette, answer options, anti-cheat warnings, and submit button.",
                    "Staff dashboard: exams, account management, logs, analytics, result table, detail review, CSV export, and notifications.",
                    "Profile panel: avatar upload/URL, phone update, Gmail contact OTP verification, and read-only identity fields.",
                ]
            ),
            "[GHI CHÚ ẢNH - VI: Chèn 5 ảnh màn hình: Login, Student Dashboard, Exam Mode, Staff Logs, Result Detail. Đặt tên Hình 2 đến Hình 6.]",
        ],
    )
    add(
        "Frontend State Management",
        [
            wrap("""
            The application uses local component state rather than Redux or a global store. This choice is acceptable for the project scope
            because all screens are inside a single-page application and the main user flows are linear. The key state groups include
            authentication (`token`, `user`, `role`), navigation (`screen`, `tab`), exam-taking (`selectedExam`, `questions`, `answers`,
            `timeLeft`, `antiCheat`), staff data (`accounts`, `logs`, `results`, `stats`), and profile verification (`profileForm`,
            `profileOtp`).
            """),
            wrap("""
            LocalStorage is used for session token/user restoration and exam draft answers. This improves user experience during refreshes,
            but it also means production hardening should consider safer token storage strategy, token revocation, and stricter expiration.
            """),
        ],
    )
    add(
        "Frontend Anti-Cheat Listeners",
        [
            wrap("""
            During exam mode, the frontend records suspicious browser-level events. The available event categories in the code are tab
            switching, copy attempt, shortcut usage, and window blur. When a violation is detected, the frontend calls the backend `/api/log`
            endpoint with exam id, type, detail, severity, and metadata. A throttle function reduces duplicate logs from repeated browser events.
            """),
            wrap("""
            This design is transparent and lightweight. It does not require webcam, microphone, desktop control, or invasive local system
            permissions. The tradeoff is that it cannot detect off-screen assistance, a second device, printed notes, or another person in
            the room.
            """),
        ],
    )
    add(
        "Backend Architecture",
        [
            wrap("""
            The backend is implemented in `backend/server.js` using Express for REST endpoints, Socket.IO for real-time events, sqlite3
            for persistence, crypto for HMAC token and password hashing, Google Auth Library for credential verification, Google APIs for
            Gmail API mode, and Nodemailer for SMTP mode. The backend creates the SQLite database directory if it does not exist and runs
            schema initialization at startup.
            """),
            wrap("""
            Express uses JSON request parsing with a 16 MB limit and permissive CORS for the demo. In production, CORS should be restricted
            to the deployed frontend origin and request limits should be reviewed according to expected import/avatar sizes.
            """),
        ],
    )
    add(
        "Backend API Surface",
        [
            code_block("""
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
            """),
        ],
    )
    add(
        "Authentication Design",
        [
            wrap("""
            Email/password login checks the selected role, verifies the password, rejects pending or locked accounts, and returns a signed
            token. The token format resembles JWT: base64url header, base64url payload, and HMAC-SHA256 signature. The payload includes
            user id, role, email, and expiration. Middleware `requireRole` parses the Authorization header, verifies the token, checks
            role membership, confirms the user still exists, and rejects pending/locked/disabled users.
            """),
            wrap("""
            Google login verifies the ID token with `OAuth2Client`. If a Google user already exists, the system can link `google_sub`.
            If the account does not exist and the role is student, the backend can create a pending or active student depending on
            `ALLOW_GOOGLE_AUTO_CREATE_STUDENT`.
            """),
        ],
    )
    add(
        "Authorization Model",
        [
            code_block("""
            Role          Allowed Areas
            student       own exams list, start active exam, submit once, own results, profile, notifications
            instructor    exams, student accounts, logs, results, dashboard, profile, notifications
            admin         all instructor functions plus broader account management, including instructor/admin accounts
            """),
            wrap("""
            Access control is enforced on the backend, not only by hiding buttons in the frontend. This is important because a user can
            call APIs directly with tools such as curl or browser devtools. The backend route middleware is therefore the main security gate.
            """),
        ],
    )
    add(
        "Database Design",
        [
            code_block("""
            users: id, full_name, email, password, role, student_code, class_name, phone, gmail, avatar_url, google_sub, status, created_at
            exams: id, title, subject, description, duration_minutes, status, created_by, created_at
            questions: id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_index, points, sort_order
            logs: id, user_id, exam_id, type, detail, severity, warning_value, metadata, created_at
            submissions: id, exam_id, student_id, score, correct_count, total_questions, warning_count, status, started_at, submitted_at, time_spent_seconds, result_email_sent, answers_json, anti_cheat_json
            exam_sessions: id, exam_id, student_id, started_at, last_activity_at
            notifications: id, user_id, actor_id, type, icon, title, message, is_read, created_at
            email_verifications: id, user_id, gmail, code, purpose, is_verified, used, expires_at, created_at, verified_at
            """),
            "[GHI CHÚ SƠ ĐỒ - VI: Chèn ERD. Đánh dấu khóa chính PK ở mỗi bảng, khóa ngoại exam_id/user_id/student_id, và unique constraint submissions(exam_id, student_id).]",
        ],
    )
    add(
        "Entity Relationship Explanation",
        [
            wrap("""
            A user can create exams if they are an instructor or admin. An exam owns many questions. A student creates one exam session
            per exam before submitting. A submission is unique by exam and student, which prevents repeated attempts. Logs connect a user
            and optionally an exam to timestamped behavior evidence. Notifications connect system events to users. Email verification
            stores OTP codes for profile Gmail changes.
            """),
            wrap("""
            The design favors auditability: raw answers and anti-cheat state are stored as JSON in submissions, while individual behavior
            events are stored in logs. This allows staff to see both the final score and the evidence timeline.
            """),
        ],
    )
    add(
        "Exam Lifecycle",
        [
            code_block("""
            Draft -> Active -> Finished
              |        |          |
              |        |          +-- students can no longer submit
              |        +------------- students can start and submit
              +---------------------- staff can prepare/edit before submissions
            """),
            wrap("""
            The backend prevents editing exam questions after submissions exist. This protects result history because changing questions
            after a student submits would make previous scores inconsistent. If an exam already has submissions, staff should create a new
            exam instead of editing question content.
            """),
        ],
    )
    add(
        "Submission Workflow",
        [
            code_block("""
            1. Student clicks Start.
            2. Backend validates exam status and duplicate submission.
            3. Backend creates or updates exam session.
            4. Frontend loads questions and starts timer.
            5. Student answers questions.
            6. Anti-cheat events are logged when triggered.
            7. Student submits.
            8. Backend calculates score, warning count, status, and time spent.
            9. Backend stores submission, sends result notification/email, emits realtime updates.
            """),
        ],
    )
    add(
        "Score And Warning Calculation",
        [
            wrap("""
            The score is calculated from earned points divided by total points and scaled to 10. The code counts a question as correct
            when the submitted selected index matches the stored correct index. The warning count is calculated from log rows for the same
            user and exam created after the session start, excluding the session-start event. If the warning count is at least 3, the
            submission status becomes flagged; otherwise it is submitted.
            """),
            wrap("""
            This threshold is simple enough for a demo and easy to explain to instructors. In future versions, the warning algorithm could
            use severity weighting, event decay, per-exam policy, and manual staff override.
            """),
        ],
    )
    add(
        "Real-Time Monitoring Design",
        [
            wrap("""
            The backend uses Socket.IO on top of the HTTP server. When logs are created, the backend emits `log:new`. When exam sessions
            start, it emits `monitor:update`. When submissions are created, it emits `submission:new`. The staff frontend subscribes to
            these events and refreshes relevant data. This creates a monitoring dashboard experience without forcing staff to manually
            reload the page.
            """),
            "[GHI CHÚ SƠ ĐỒ - VI: Sơ đồ sequence: Student browser -> POST /api/log -> Express inserts logs -> io.emit('log:new') -> Staff browser updates log table.]",
        ],
    )
    add(
        "Email And OTP Design",
        [
            wrap("""
            The backend supports three mail modes. `MAIL_MODE=demo` only logs mock emails so the project can run without credentials.
            `MAIL_MODE=smtp` sends email through Nodemailer with Gmail App Password. `MAIL_MODE=gmail_api` uses Google APIs with OAuth2
            refresh token and Gmail API `users.messages.send`. This layered design makes development and demonstration easier while still
            showing a path to real email delivery.
            """),
            wrap("""
            OTP verification is used when users update their Gmail contact field in the profile. The backend generates a six-digit code,
            stores it with expiry, sends it through the selected mail mode, and only allows saving a changed Gmail after successful verification.
            """),
        ],
    )
    add(
        "Notification Design",
        [
            wrap("""
            Notifications are stored in the `notifications` table and shown in the frontend notification bell. Events that create notifications
            include new exams, exam status changes, account approval needs, result creation, and email delivery outcome. This improves user
            awareness and makes the application feel operational instead of only transactional.
            """),
            wrap("""
            The notification read endpoint updates unread state for the current user. In production, this could be expanded with pagination,
            notification preferences, email digests, and admin audit filters.
            """),
        ],
    )
    add(
        "Software Engineering View",
        [
            wrap("""
            From a Software Engineering perspective, ExamShield demonstrates requirements analysis, role-based design, REST API design,
            relational data modeling, UI state management, validation, deployment configuration, and iterative feature delivery. The
            implementation is pragmatic for a student project because it uses a small number of files and familiar libraries. This reduces
            setup complexity and makes demonstration reliable.
            """),
            wrap("""
            The main SE risk is maintainability as features grow. The current `App.jsx` and `server.js` files are large. A future version
            should split backend routes by domain, extract services for auth/email/exam scoring, add a migration system, and split frontend
            components into folders such as `auth`, `student`, `staff`, `profile`, `exam`, and `shared`.
            """),
        ],
    )
    add(
        "SE Process Model",
        [
            code_block("""
            Recommended process: Iterative Incremental Development

            Iteration 1: authentication, roles, database seed, basic exam list
            Iteration 2: exam creation, questions, student exam-taking screen
            Iteration 3: submission scoring, results, staff result detail
            Iteration 4: anti-cheat logs, Socket.IO realtime dashboard
            Iteration 5: Google login, Gmail/OTP, deployment, documentation
            """),
            wrap("""
            The iterative model is appropriate because user workflows can be demonstrated after each iteration. It also reduces the risk
            of discovering integration problems too late.
            """),
        ],
    )
    add(
        "SE Quality Attributes",
        [
            code_block("""
            Quality Attribute    Current Support                          Improvement
            Usability            Role-based screens, timer, exports        user testing and accessibility review
            Security             role middleware, HMAC token, PBKDF2       standard JWT/bcrypt, rate limits, CSRF strategy
            Reliability          SQLite persistence, unique submissions     backup, migrations, transaction wrapping
            Maintainability      compact demo code                         modular route/component structure
            Testability          clear API endpoints                        automated unit/API/E2E tests
            Deployability        Render one-service config                  production DB and secret rotation
            """),
        ],
    )
    add(
        "Network Engineering View",
        [
            wrap("""
            From a Network Engineering perspective, ExamShield uses a standard client-server model. Browsers communicate with the Express
            backend through HTTP(S) REST requests for CRUD operations and WebSocket transport via Socket.IO for real-time monitoring. In
            local development, the frontend runs on port 5173 and the backend on port 5000. In production, the backend can serve the built
            frontend and expose `/api` on the same origin.
            """),
            wrap("""
            This architecture simplifies deployment because a single Render service can host both frontend static files and backend API.
            It also reduces CORS complexity in production, since frontend and backend can share the same domain.
            """),
        ],
    )
    add(
        "NE Logical Topology",
        [
            code_block("""
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
            """),
            "[GHI CHÚ SƠ ĐỒ - VI: Vẽ topology mạng với client ở hai mạng khác nhau, đi qua Internet đến Render. Ghi rõ HTTPS cho REST và WSS/WebSocket cho realtime.]",
        ],
    )
    add(
        "NE Protocols And Ports",
        [
            code_block("""
            Environment        Frontend URL              Backend/API URL              Realtime URL
            Local dev          http://localhost:5173     http://localhost:5000/api    http://localhost:5000
            Production         https://service.onrender.com /api same origin          same origin WebSocket

            Protocols:
            - HTTP/HTTPS: login, account, exam, result, notification APIs
            - WebSocket/Socket.IO: realtime log, monitor, submission events
            - SMTP or Gmail API HTTPS: outgoing email delivery
            - SQLite file I/O: local backend persistence
            """),
        ],
    )
    add(
        "NE Security Considerations",
        [
            bullet(
                [
                    "Use HTTPS in deployment so tokens and exam answers are encrypted in transit.",
                    "Restrict CORS to trusted frontend origins in production instead of wildcard origin.",
                    "Use environment variables for Google, Gmail, token secret, and mail credentials.",
                    "Rotate secrets if they are exposed and never commit real credentials.",
                    "Apply rate limiting to login, OTP sending, and submission endpoints in a production version.",
                    "Monitor Socket.IO connection counts during large exams.",
                    "Prefer an external production database for durability instead of ephemeral local storage on free hosting.",
                ]
            ),
        ],
    )
    add(
        "Deployment Architecture",
        [
            wrap("""
            The `render.yaml` file configures a Render web service using Node. Its build command installs backend dependencies, installs
            frontend dependencies, and builds the frontend. Its start command runs the backend. At runtime, the Express backend checks for
            `frontend/dist` and serves it as static files, with a wildcard route returning `index.html` for SPA navigation.
            """),
            code_block("""
            Build command:
            cd backend && npm install && cd ../frontend && npm install && npm run build

            Start command:
            cd backend && npm start
            """),
        ],
    )
    add(
        "Security Analysis",
        [
            wrap("""
            The most important security control in the current system is role-based authorization. Staff-only APIs are protected by
            `requireRole(['instructor', 'admin'])`, admin-only account updates are protected by `requireRole(['admin'])`, and student-only
            exam start/submission APIs are protected by `requireRole(['student'])`. This follows the OWASP principle that access control
            must be enforced server-side.
            """),
            wrap("""
            Password hashing uses PBKDF2 for newly created or updated passwords, while seed demo accounts include legacy plain values for
            convenience. Production should migrate all stored passwords to a modern password-hashing library such as bcrypt or argon2,
            enforce password policy, add login rate limiting, and disable demo credentials.
            """),
        ],
    )
    add(
        "Privacy Analysis",
        [
            wrap("""
            ExamShield's current monitoring focuses on browser behavior rather than webcam or microphone surveillance. This is a privacy-conscious
            design choice for a student project. It collects event type, detail, severity, warning value, metadata, timestamp, user id, and
            exam id. It does not collect video, audio, face images, room images, keystroke content, or desktop screen recordings.
            """),
            wrap("""
            The project should still disclose monitoring clearly before the exam starts. Students should know what events are recorded,
            why they are recorded, who can review them, and how long logs are retained.
            """),
        ],
    )
    add(
        "Limitations Of Browser-Based Proctoring",
        [
            bullet(
                [
                    "It cannot detect another device beside the student.",
                    "It cannot detect printed notes or another person in the room.",
                    "Browser events may create false positives due to accidental focus changes.",
                    "Students with accessibility tools may trigger shortcut or focus events unintentionally.",
                    "Network interruption can affect live monitoring, although submission data is still sent through REST.",
                    "LocalStorage exam drafts improve recovery but should be balanced against exam policy.",
                ]
            ),
        ],
    )
    add(
        "Demo Preparation",
        [
            code_block("""
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
            """),
            "[GHI CHÚ ẢNH - VI: Chèn ảnh terminal backend chạy ở port 5000 và frontend Vite chạy ở port 5173.]",
        ],
    )
    add(
        "Demo Flow 1 Login And Roles",
        [
            code_block("""
            Step 1: Open login page.
            Step 2: Select Student role and log in with student@example.com / 123456.
            Step 3: Confirm student dashboard shows available exams and result history.
            Step 4: Log out.
            Step 5: Select Instructor role and log in with instructor@example.com / 123456.
            Step 6: Confirm staff tabs are visible: exams, accounts, logs, results, analytics.
            """),
            "[GHI CHÚ ẢNH - VI: Ảnh login nên chụp rõ 3 nút vai trò: Sinh viên, Giảng viên, Admin.]",
        ],
    )
    add(
        "Demo Flow 2 Create Exam",
        [
            code_block("""
            Step 1: Instructor opens exam creation tab.
            Step 2: Enter title, subject, description, duration, and status.
            Step 3: Add at least 5 multiple-choice questions.
            Step 4: Save exam as draft.
            Step 5: Switch exam status to active.
            Step 6: Verify notification appears for students/admins.
            """),
            "[GHI CHÚ ẢNH - VI: Chèn ảnh form tạo đề và ảnh bảng đề thi sau khi chuyển sang trạng thái active.]",
        ],
    )
    add(
        "Demo Flow 3 Take Exam",
        [
            code_block("""
            Step 1: Student logs in.
            Step 2: Student starts an active exam.
            Step 3: Timer appears and questions are loaded.
            Step 4: Student answers questions.
            Step 5: Student intentionally switches tab or copies text once to show warning.
            Step 6: Student submits before time expires.
            Step 7: Result screen shows score, correct count, warning count, and email status.
            """),
            "[GHI CHÚ ẢNH - VI: Chèn ảnh màn hình thi có timer và palette câu hỏi. Không cần chụp thông tin nhạy cảm thật.]",
        ],
    )
    add(
        "Demo Flow 4 Staff Monitoring",
        [
            code_block("""
            Step 1: Keep instructor/admin dashboard open in another browser.
            Step 2: Student triggers anti-cheat event during exam.
            Step 3: Staff sees realtime log update.
            Step 4: Staff opens Logs tab and exports CSV.
            Step 5: Staff opens Results tab after submission.
            Step 6: Staff views result detail, question review, and session logs.
            """),
            "[GHI CHÚ ẢNH - VI: Chèn ảnh Logs tab có dòng 'Chuyển tab', 'Sao chép nội dung', hoặc 'Window Blur'.]",
        ],
    )
    add(
        "Demo Flow 5 Profile And Gmail OTP",
        [
            code_block("""
            Step 1: User opens Profile.
            Step 2: User changes Gmail contact.
            Step 3: User clicks Send OTP.
            Step 4: In demo mode, backend returns mock OTP; in SMTP/API mode, email is sent.
            Step 5: User enters OTP and verifies.
            Step 6: User saves profile.
            """),
            "[GHI CHÚ ẢNH - VI: Nếu chưa cấu hình Gmail thật, chụp mock OTP trong giao diện hoặc terminal để chứng minh luồng hoạt động.]",
        ],
    )
    add(
        "Five-Member Team Roles",
        [
            code_block("""
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
            """),
        ],
    )
    add(
        "Project Timeline Overview",
        [
            code_block("""
            Duration: 8 weeks

            Week 1: Topic selection, requirements, initial repository review
            Week 2: UI wireframe, database schema, API design
            Week 3: Authentication, role screens, seed data
            Week 4: Exam CRUD, question builder, import/export basics
            Week 5: Student exam mode, timer, submission, scoring
            Week 6: Anti-cheat logs, realtime monitoring, result detail
            Week 7: Google login, Gmail OTP/result email, deployment
            Week 8: Testing, bug fixing, report, slides, final demo rehearsal
            """),
            "[GHI CHÚ SƠ ĐỒ - VI: Tạo Gantt chart 8 tuần, mỗi thành viên một dòng. Dùng màu khác nhau cho Frontend, Backend, DB/Security, NE/QA, Documentation.]",
        ],
    )
    add(
        "Detailed Timeline By Member",
        [
            code_block("""
            Week | M1 Lead/SE        | M2 Frontend       | M3 Backend         | M4 DB/Security      | M5 NE/QA
            1    | topic + scope     | UI references     | API inventory      | data entities       | local setup
            2    | use cases         | wireframes        | route plan         | ERD draft           | topology plan
            3    | backlog           | login/dashboard   | auth/token         | user schema         | smoke tests
            4    | review            | exam builder      | exam CRUD          | questions schema    | API test cases
            5    | demo plan         | exam mode/timer   | submit/scoring     | submission model    | timing tests
            6    | risk review       | logs/results UI   | logs/socket emits  | warning policy      | realtime tests
            7    | deploy checklist  | profile OTP UI    | Google/Gmail       | OTP table/security  | Render deploy
            8    | report/slides     | UI polish         | bug fixes          | final audit         | demo rehearsal
            """),
        ],
    )
    add(
        "Sprint Deliverables",
        [
            bullet(
                [
                    "Sprint 1 deliverable: approved topic proposal, problem statement, requirement list, initial architecture.",
                    "Sprint 2 deliverable: login, role-based navigation, seeded users, basic exams list.",
                    "Sprint 3 deliverable: exam creation/editing, question storage, student exam mode.",
                    "Sprint 4 deliverable: scoring, result details, logs, Socket.IO realtime monitoring.",
                    "Sprint 5 deliverable: Gmail/Google integration, deployment, testing evidence, final report.",
                ]
            ),
        ],
    )
    add(
        "Testing Plan",
        [
            code_block("""
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
            """),
        ],
    )
    add(
        "Estimated Cost",
        [
            code_block("""
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
            """),
            wrap("""
            For a university course demo, the actual cash cost can be nearly zero because the repository uses open-source frameworks and
            free hosting tiers. For a production school deployment, the main cost is not software licenses but operational maintenance,
            hosting reliability, email delivery, data backup, support, and security review.
            """),
        ],
    )
    add(
        "Risk Management",
        [
            code_block("""
            Risk                         Impact                  Mitigation
            SQLite file lost on free host data loss               use PostgreSQL or backups in production
            Token secret left default     account compromise       require TOKEN_SECRET in deployment
            False positive anti-cheat     unfair review            staff manual review and clear policy
            Large single files            difficult maintenance    modular refactor
            Gmail credential error        no email delivery        demo fallback and admin warning
            Network interruption          realtime lag             REST submission remains source of truth
            """),
        ],
    )
    add(
        "Evaluation Against Objectives",
        [
            bullet(
                [
                    "Role-based workflows are implemented through frontend screens and backend middleware.",
                    "Exam CRUD and question management are implemented for instructor/admin roles.",
                    "Student exam start, timer, draft answer storage, submission, and result review are implemented.",
                    "Anti-cheat logs and warning-based flagged submissions are implemented.",
                    "Realtime monitoring is implemented with Socket.IO events.",
                    "SQLite schema covers accounts, exams, questions, logs, submissions, sessions, notifications, and OTP.",
                    "Google Identity and Gmail modes are supported through environment variables.",
                    "Render one-service deployment is documented and configured.",
                ]
            ),
        ],
    )
    add(
        "Future Work",
        [
            bullet(
                [
                    "Refactor frontend into reusable components and route-based pages.",
                    "Refactor backend into route modules, service modules, and validation middleware.",
                    "Move production persistence from SQLite to PostgreSQL with migrations.",
                    "Add automated tests: API tests, frontend component tests, and Playwright E2E tests.",
                    "Add rate limiting, CSRF strategy, stricter CORS, and security headers.",
                    "Add instructor-configurable anti-cheat thresholds per exam.",
                    "Add audit log retention policy and exportable integrity reports.",
                    "Add question bank, randomization, per-student variants, and exam access windows.",
                    "Add accessibility review for keyboard navigation and screen readers.",
                    "Add backup and restore process for production operations.",
                ]
            ),
        ],
    )
    add(
        "Conclusion",
        [
            wrap("""
            ExamShield is a practical full-stack online examination project with enough depth for both Software Engineering and Network
            Engineering analysis. It demonstrates how a modern web application can combine role-based authorization, relational data
            modeling, real-time events, email integration, deployment configuration, and browser-level academic-integrity logging.
            """),
            wrap("""
            The current implementation is appropriate for a course project and live demo. For production, the strongest next steps are
            modularization, automated testing, a production-grade database, stricter security controls, and a formal privacy policy for
            monitoring data.
            """),
        ],
    )
    add(
        "References 1 Official Documentation",
        [
            code_block("""
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
            """),
        ],
    )
    add(
        "References 2 Security Standards",
        [
            code_block("""
            [11] OWASP. "OWASP Top 10:2021." https://owasp.org/Top10/2021/
            [12] OWASP. "A01:2021 - Broken Access Control." https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/
            [13] OWASP Cheat Sheet Series. "Authentication Cheat Sheet." https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
            [14] OWASP Cheat Sheet Series. "Session Management Cheat Sheet." https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
            [15] NIST. "SP 800-63B Digital Identity Guidelines: Authentication and Lifecycle Management." https://pages.nist.gov/800-63-3/sp800-63b.html
            [16] MDN Web Docs. "Page Visibility API." https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
            """),
            wrap("""
            These sources support the report's discussion of access control, authentication, session management, browser visibility events,
            and secure web application design.
            """),
        ],
    )
    add(
        "References 3 Academic And Industry Literature",
        [
            code_block("""
            [17] Butler-Henderson, K., & Crawford, J. (2020). "A systematic review of online examinations: A pedagogical innovation for scalable authentication and integrity." Computers & Education, 159, 104024. https://doi.org/10.1016/j.compedu.2020.104024
            [18] Alguacil, M., Herranz-Zarzoso, N., Pernías, J. C., & Sabater-Grande, G. (2024). "Academic dishonesty and monitoring in online exams: a randomized field experiment." Journal of Computing in Higher Education, 36, 835-851. https://doi.org/10.1007/s12528-023-09378-x
            [19] Hylton, K., Levy, Y., & Dringus, L. P. (2016). "Utilizing webcam-based proctoring to deter misconduct in online exams." Computers & Education, 92-93, 53-63. https://doi.org/10.1016/j.compedu.2015.10.002
            [20] Khalil, M., Prinsloo, P., & Slade, S. (2022). "In the nexus of integrity and surveillance: Proctoring (re)considered." Journal of Computer Assisted Learning, 38(6), 1589-1602. https://doi.org/10.1111/jcal.12713
            [21] Balash, D. G., et al. (2021). "Examining the Examiners: Students' Privacy and Security Perceptions of Online Proctoring Services." arXiv:2106.05917. https://arxiv.org/abs/2106.05917
            """),
        ],
    )
    add(
        "Appendix A Source Code Mapping",
        [
            code_block("""
            frontend/src/App.jsx:
              login, session restore, Google button, student exam mode, staff dashboards, profile OTP UI, CSV/PDF export

            frontend/src/App.css:
              dark/light theme, responsive layouts, cards, tables, exam mode, profile panels, notification UI

            backend/server.js:
              Express server, SQLite schema, token auth, Google auth, Gmail/Nodemailer mail modes, APIs, Socket.IO events

            render.yaml:
              Render one-service build/start commands and environment variable template
            """),
        ],
    )
    add(
        "Appendix B Vietnamese Screenshot Checklist",
        [
            code_block("""
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
            """),
        ],
    )
    add(
        "Appendix C Diagram Checklist",
        [
            code_block("""
            [VI] Sơ đồ 1: System boundary - Browser, ExamShield, Google, Gmail, Render.
            [VI] Sơ đồ 2: High-level architecture - React, Express, Socket.IO, SQLite.
            [VI] Sơ đồ 3: ERD database - users, exams, questions, logs, submissions, sessions, notifications, OTP.
            [VI] Sơ đồ 4: Sequence start exam and submit exam.
            [VI] Sơ đồ 5: Sequence realtime anti-cheat log.
            [VI] Sơ đồ 6: Network topology local and production.
            [VI] Sơ đồ 7: Gantt chart 8 tuần cho 5 thành viên.
            """),
        ],
    )

    # Add compact page-level expansions so the document lands in the requested 50-60 page band.
    expansions = [
        ("Appendix D Requirement Traceability Matrix", code_block("""
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
        """)),
        ("Appendix E API Demo Checklist", code_block("""
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
        """)),
        ("Appendix F Production Hardening Checklist", bullet([
            "Require strong TOKEN_SECRET and never use the default development secret.",
            "Replace wildcard CORS with exact allowed origins.",
            "Use PostgreSQL or another managed production database.",
            "Migrate all legacy demo passwords to hashed storage.",
            "Add HTTP security headers through Helmet or equivalent middleware.",
            "Add rate limits for login, OTP, import, and submission endpoints.",
            "Add request validation schemas for API bodies.",
            "Add centralized error handling and structured logs.",
            "Add backup and restore runbook.",
            "Add privacy notice and retention rules for anti-cheat logs.",
        ])),
    ]
    for title, body in expansions:
        add(title, [body])

    def merge_pages(first_title: str, second_title: str, merged_title: str) -> None:
        first_index = next(i for i, p in enumerate(pages) if p["title"] == first_title)
        second_index = next(i for i, p in enumerate(pages) if p["title"] == second_title)
        if second_index < first_index:
            first_index, second_index = second_index, first_index
        first = pages[first_index]
        second = pages[second_index]
        first["title"] = merged_title
        first["paragraphs"] = (
            [f"Section A - {first_title}"]
            + first["paragraphs"]
            + [f"Section B - {second_title}"]
            + second["paragraphs"]
        )
        del pages[second_index]

    merge_pages("Project Context", "Topic Selection Process", "Project Context And Topic Selection")
    merge_pages("SE Process Model", "SE Quality Attributes", "SE Process And Quality Attributes")
    merge_pages("NE Protocols And Ports", "NE Security Considerations", "NE Protocols, Ports, And Security")
    merge_pages("Demo Flow 1 Login And Roles", "Demo Flow 2 Create Exam", "Demo Flow 1-2 Login, Roles, And Exam Creation")
    merge_pages("Demo Flow 3 Take Exam", "Demo Flow 4 Staff Monitoring", "Demo Flow 3-4 Taking Exam And Staff Monitoring")
    merge_pages("Appendix A Source Code Mapping", "Appendix B Vietnamese Screenshot Checklist", "Appendix A-B Source Mapping And Screenshot Checklist")
    merge_pages("Appendix C Diagram Checklist", "Appendix D Requirement Traceability Matrix", "Appendix C-D Diagrams And Traceability")
    merge_pages("Appendix E API Demo Checklist", "Appendix F Production Hardening Checklist", "Appendix E-F API Demo And Production Hardening")

    toc_page = next(p for p in pages if p["title"] == "Detailed Table Of Contents")
    toc_page["paragraphs"] = [
        "The detailed table of contents is generated from the final compact structure. The body uses 15 major chapters, and the detailed content is kept as subsections so the report is easier to scan.",
        code_block(chapter_toc(pages)),
        "[GHI CHÚ ẢNH - VI: Nếu nộp bản Word, dùng References -> Table of Contents để tạo mục lục tự động từ Heading 1 và Heading 2. Bố cục bên dưới đã gộp nội dung thành 15 chương chính và các tiểu mục để bài nhìn gọn hơn.]",
    ]

    return pages


def p_xml(text: str, style: str | None = None) -> str:
    escaped = html.escape(text)
    style_xml = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    preserve = ' xml:space="preserve"' if text.startswith(" ") or text.endswith(" ") else ""
    return f"<w:p>{style_xml}<w:r><w:t{preserve}>{escaped}</w:t></w:r></w:p>"


def cell_xml(text: str, header: bool = False) -> str:
    shading = '<w:shd w:fill="D9EAF7"/>' if header else ""
    bold_start = "<w:b/>" if header else ""
    escaped = html.escape(text)
    return (
        "<w:tc>"
        f"<w:tcPr><w:tcW w:w=\"2400\" w:type=\"dxa\"/>{shading}</w:tcPr>"
        "<w:p><w:r>"
        f"<w:rPr>{bold_start}<w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\"/><w:sz w:val=\"26\"/></w:rPr>"
        f"<w:t>{escaped}</w:t>"
        "</w:r></w:p>"
        "</w:tc>"
    )


def tbl_xml(rows: list[list[str]]) -> str:
    body: list[str] = [
        "<w:tbl>",
        "<w:tblPr>",
        '<w:tblW w:w="5000" w:type="pct"/>',
        '<w:tblBorders>'
        '<w:top w:val="single" w:sz="6" w:space="0" w:color="7F7F7F"/>'
        '<w:left w:val="single" w:sz="6" w:space="0" w:color="7F7F7F"/>'
        '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="7F7F7F"/>'
        '<w:right w:val="single" w:sz="6" w:space="0" w:color="7F7F7F"/>'
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
        '</w:tblBorders>',
        "</w:tblPr>",
    ]
    for row_index, row in enumerate(rows):
        body.append("<w:tr>")
        for cell in row:
            body.append(cell_xml(cell, header=row_index == 0))
        body.append("</w:tr>")
    body.append("</w:tbl>")
    body.append(p_xml(""))
    return "".join(body)


def parse_table_block(text: str) -> list[list[str]] | None:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) < 3:
        return None
    if all("|" in line for line in lines):
        rows = [[cell.strip() for cell in line.split("|")] for line in lines]
        rows = [[cell for cell in row if cell] for row in rows]
        return rows if min(len(row) for row in rows) >= 2 else None
    if any(line.startswith(("├", "│", "└", "web_exam/", "cd ", "http://", "https://")) for line in lines):
        return None
    rows = [re.split(r"\s{2,}", line) for line in lines]
    good_rows = [row for row in rows if len(row) >= 2]
    if len(good_rows) < len(lines) or max(len(row) for row in rows) > 5:
        return None
    col_count = max(len(row) for row in rows)
    normalized = [row + [""] * (col_count - len(row)) for row in rows]
    return normalized


def page_break_xml() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def document_xml(pages: list[dict]) -> str:
    body: list[str] = []

    def append_paragraphs(page: dict) -> None:
        for paragraph in page["paragraphs"]:
            if paragraph.startswith("- "):
                for line in paragraph.splitlines():
                    body.append(p_xml(line, "ListParagraph"))
            elif "\n" in paragraph:
                table_rows = parse_table_block(paragraph)
                if table_rows:
                    body.append(tbl_xml(table_rows))
                    continue
                for line in paragraph.splitlines():
                    body.append(p_xml(line, "Code"))
            elif paragraph.startswith("[GHI "):
                body.append(p_xml(paragraph, "Note"))
            else:
                body.append(p_xml(paragraph, "Normal"))

    title_page = pages[0]
    body.append(p_xml(title_page["title"], "Title"))
    append_paragraphs(title_page)
    body.append(page_break_xml())

    for front_page in pages[1:4]:
        body.append(p_xml(front_page["title"], "Heading1"))
        append_paragraphs(front_page)
        if front_page["title"] == "Detailed Table Of Contents":
            body.append(page_break_xml())

    for chapter_number, (chapter_title, page_numbers) in enumerate(CHAPTERS, start=1):
        body.append(p_xml(f"{chapter_number}. {chapter_title}", "Heading1"))
        for sub_number, page_number in enumerate(page_numbers, start=1):
            if page_number > len(pages):
                continue
            page = pages[page_number - 1]
            body.append(p_xml(f"{chapter_number}.{sub_number} {page['title']}", "Heading2"))
            append_paragraphs(page)
        if chapter_number != len(CHAPTERS):
            body.append(page_break_xml())
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    {''.join(body)}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>'''


def styles_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="26"/></w:rPr>
    <w:pPr><w:spacing w:after="120" w:line="312" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="32"/></w:rPr>
    <w:pPr><w:spacing w:after="240"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:b/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="1F4E79"/><w:sz w:val="28"/></w:rPr>
    <w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="160" w:after="180"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:b/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="404040"/><w:sz w:val="26"/></w:rPr>
    <w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="120" w:after="100"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:i/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="666666"/><w:sz w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="360" w:hanging="180"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Code">
    <w:name w:val="Code"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="26"/></w:rPr>
    <w:pPr><w:spacing w:after="40"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Note">
    <w:name w:val="Vietnamese Note"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="C00000"/><w:sz w:val="26"/></w:rPr>
  </w:style>
</w:styles>'''


def content_types_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''


def rels_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''


def document_rels_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''


def write_docx(path: str, pages: list[dict]) -> None:
    replacements = {
        "[Content_Types].xml": content_types_xml(),
        "_rels/.rels": rels_xml(),
        "word/_rels/document.xml.rels": document_rels_xml(),
        "word/document.xml": document_xml(pages),
        "word/styles.xml": styles_xml(),
    }
    temp_path = path + ".tmp"
    existing_names: set[str] = set()
    with zipfile.ZipFile(temp_path, "w", compression=zipfile.ZIP_DEFLATED) as target:
        if os.path.exists(path):
            with zipfile.ZipFile(path, "r") as source:
                for item in source.infolist():
                    if item.filename in replacements:
                        continue
                    existing_names.add(item.filename)
                    target.writestr(item, source.read(item.filename))
        for filename, content in replacements.items():
            if filename not in existing_names:
                target.writestr(filename, content)
    os.replace(temp_path, path)


def write_markdown(pages: list[dict]) -> None:
    chunks: list[str] = []
    for page in pages[:4]:
        chunks.append(f"# {page['title']}\n")
        for paragraph in page["paragraphs"]:
            if "\n" in paragraph:
                chunks.append("```text\n" + paragraph + "\n```\n")
            else:
                chunks.append(paragraph + "\n")
        chunks.append("\n<div style=\"page-break-after: always;\"></div>\n")

    for chapter_number, (chapter_title, page_numbers) in enumerate(CHAPTERS, start=1):
        chunks.append(f"# {chapter_number}. {chapter_title}\n")
        for sub_number, page_number in enumerate(page_numbers, start=1):
            if page_number > len(pages):
                continue
            page = pages[page_number - 1]
            chunks.append(f"## {chapter_number}.{sub_number} {page['title']}\n")
            for paragraph in page["paragraphs"]:
                if "\n" in paragraph:
                    chunks.append("```text\n" + paragraph + "\n```\n")
                else:
                    chunks.append(paragraph + "\n")
        if chapter_number != len(CHAPTERS):
            chunks.append("\n<div style=\"page-break-after: always;\"></div>\n")
    with open(MD_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(chunks))


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    pages = build_pages()
    write_docx(DOCX_PATH, pages)
    write_docx(ROOT_DOCX_PATH, pages)
    write_markdown(pages)
    print(f"Wrote {len(pages)} logical pages")
    print(DOCX_PATH)
    print(ROOT_DOCX_PATH)
    print(MD_PATH)


if __name__ == "__main__":
    main()
