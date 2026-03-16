# CodeForge AI — AI-Powered Secure Coding Examination Platform

> Multi-Agent Computer Vision Framework for Detecting Cheating in Online Coding Examinations

## Tech Stack

| Layer       | Technology                                                    |
| ----------- | ------------------------------------------------------------- |
| Frontend    | Next.js 14, TypeScript, TailwindCSS, ShadCN UI, Monaco Editor |
| Backend     | FastAPI (Python 3.11+), SQLAlchemy, Alembic                   |
| Database    | PostgreSQL                                                    |
| CV/AI       | OpenCV, MediaPipe, YOLOv8 (ultralytics), NumPy                |
| Auth        | JWT (python-jose), bcrypt                                     |
| Email       | FastAPI-Mail (SMTP)                                           |
| Real-time   | WebSockets (FastAPI native)                                   |
| Code Runner | subprocess sandbox (no Docker needed)                         |

---

## Quick Start

### 1. Clone & set up Python backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in DATABASE_URL, SECRET_KEY, SMTP credentials
```

### 3. Set up database

```bash
createdb codeforge_ai           # PostgreSQL must be running
alembic upgrade head
```

### 4. Run backend

```bash
uvicorn main:app --reload --port 8000
```

### 5. Set up frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000

---

## Project Structure

```
codeforge-ai/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example
│   ├── alembic/                   # DB migrations
│   ├── core/
│   │   ├── config.py              # Settings / env vars
│   │   ├── database.py            # SQLAlchemy engine & session
│   │   ├── security.py            # JWT, password hashing
│   │   └── dependencies.py        # FastAPI Depends helpers
│   ├── models/
│   │   ├── user.py
│   │   ├── contest.py
│   │   ├── problem.py
│   │   ├── submission.py
│   │   └── monitoring.py
│   ├── schemas/
│   │   ├── user.py
│   │   ├── contest.py
│   │   ├── problem.py
│   │   └── submission.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── contests.py
│   │   ├── problems.py
│   │   ├── submissions.py
│   │   ├── monitoring.py          # WebSocket proctor feed
│   │   └── users.py
│   └── services/
│       ├── code_runner.py         # Sandbox execution engine
│       ├── email_service.py       # Contest invite emails
│       └── contest_service.py
│
├── ai_agents/
│   ├── pipeline.py                # Orchestrator — runs all agents per frame
│   ├── agents/
│   │   ├── face_agent.py          # MediaPipe face detection & identity
│   │   ├── object_agent.py        # YOLOv8 phone/tablet/book detection
│   │   ├── gaze_agent.py          # Eye gaze & head pose estimation
│   │   ├── behavior_agent.py      # Keystroke & browser event analysis
│   │   ├── environment_agent.py   # Room scan & camera calibration
│   │   └── scoring_agent.py       # Weighted suspicion fusion
│   └── utils/
│       ├── frame_processor.py
│       └── calibration.py
│
└── frontend/                      # Next.js app (see frontend/README.md)
    ├── app/
    │   ├── page.tsx               # Landing page
    │   ├── (auth)/login/
    │   ├── (auth)/signup/
    │   ├── organizer/
    │   │   ├── dashboard/
    │   │   ├── contests/
    │   │   ├── problems/
    │   │   └── proctor/           # Live monitoring dashboard
    │   └── candidate/
    │       ├── dashboard/
    │       ├── practice/
    │       ├── contest/[id]/
    │       └── ide/               # Monaco coding IDE
    ├── components/
    │   ├── ui/                    # ShadCN components
    │   ├── editor/                # Monaco wrapper
    │   ├── monitoring/            # Webcam + suspicion UI
    │   └── contest/
    └── lib/
        ├── api.ts                 # Axios client
        ├── websocket.ts           # WS hook
        └── types.ts
```

---

## CV Proctoring — How It Works

The monitoring pipeline runs **5 parallel agents** on every webcam frame:

| Agent             | Model                   | Detects                                    |
| ----------------- | ----------------------- | ------------------------------------------ |
| Face Agent        | MediaPipe FaceDetection | No face, multiple faces, identity mismatch |
| Object Agent      | YOLOv8n                 | Phone, tablet, book, second laptop         |
| Gaze Agent        | MediaPipe FaceMesh      | Left/right/down gaze, head rotation        |
| Behavior Agent    | Rule engine             | Tab switch, paste burst, long idle         |
| Environment Agent | YOLOv8 + geometry       | Room scan objects, camera calibration      |

Outputs feed into **ScoringAgent** which maintains a rolling suspicion score per candidate. Scores stream live to the organizer via WebSocket.

### The Novel Trick: Camera Calibration for Off-Frame Detection

During the pre-exam environment scan, the candidate is asked to point their camera at each corner of their screen. This establishes a **homography matrix** between camera coordinates and screen coordinates. During the exam, any sudden head/gaze deviation is measured against this calibrated baseline — allowing detection of the candidate looking at a phone held **below or beside** the camera frame.
# codeforge-ai
