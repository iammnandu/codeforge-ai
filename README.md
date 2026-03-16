# CodeForge AI

AI-powered secure coding examination platform with role-based workflows (Organizer/Candidate), online coding IDE, automated judging, and real-time multi-agent proctoring.

## Table of Contents

- [What it does](#what-it-does)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Run the Platform](#run-the-platform)
- [Database Migration & Seed Data](#database-migration--seed-data)
- [API & WebSocket Map](#api--websocket-map)
- [Monitoring/Proctoring Pipeline](#monitoringproctoring-pipeline)
- [Troubleshooting](#troubleshooting)

## What it does

- Organizer can create contests, manage problems, invite candidates, and monitor live sessions.
- Candidate can join contests, solve problems in-browser, submit code, and view results.
- Backend evaluates code submissions and stores attempts/results.
- Monitoring pipeline analyzes webcam frames in real-time and streams alerts via WebSocket.

## Tech Stack

| Layer    | Technology                                                 |
| -------- | ---------------------------------------------------------- |
| Frontend | Next.js 14, TypeScript, TailwindCSS, Monaco Editor         |
| Backend  | FastAPI, SQLAlchemy, Alembic, Pydantic v2                  |
| Database | PostgreSQL                                                 |
| Auth     | JWT (`python-jose`), password hashing (`passlib` + bcrypt) |
| AI/CV    | OpenCV, MediaPipe, YOLOv8 (`ultralytics`), NumPy           |
| Realtime | FastAPI WebSockets                                         |
| Mail     | `fastapi-mail` (SMTP)                                      |

## Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│                         Next.js Frontend                        │
│  Candidate + Organizer dashboards, IDE, calibration UI, proctor │
└───────────────┬──────────────────────────────────────────────────┘
                │ HTTP (REST) / WS
┌───────────────▼──────────────────────────────────────────────────┐
│                         FastAPI Backend                         │
│  Routers: auth, users, contests, problems, submissions, monitor │
│  Services: code runner, email, scoring/event persistence        │
└───────────────┬──────────────────────────────────────────────────┘
                │ SQLAlchemy
┌───────────────▼──────────────────────────────────────────────────┐
│                            PostgreSQL                           │
│ Users, contests, participants, submissions, monitoring sessions │
└──────────────────────────────────────────────────────────────────┘

Realtime Monitoring Path:
Candidate Webcam → `/api/monitoring/ws/candidate/{session_id}`
→ `ai_agents/pipeline.py` (Face/Object/Gaze/Behavior/Environment agents)
→ Suspicion score + flags → Organizer live feed at `/api/monitoring/ws/proctor/{contest_id}`
```

## Project Structure

```text
codeforge-ai/
├── ai_agents/                  # CV/monitoring multi-agent pipeline
├── backend/                    # FastAPI + SQLAlchemy + Alembic
│   ├── core/                   # config, db, security, dependencies
│   ├── models/                 # SQLAlchemy models
│   ├── schemas/                # Pydantic schemas
│   ├── routers/                # REST + WebSocket endpoints
│   ├── services/               # code runner + email service
│   ├── alembic/                # migrations
│   ├── seed.py                 # sample data seeder
│   └── main.py                 # API entrypoint
├── frontend/                   # Next.js app router frontend
└── setup.sh                    # optional all-in-one setup script
```

## Local Setup

### Prerequisites

- Python 3.11+ recommended (3.9 may work with extra care; see Troubleshooting).
- Node.js 18+ and npm.
- PostgreSQL running locally.

### 1) Backend environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

If you are on Python 3.9 and dependency installation fails during bytecode compile:

```bash
pip install --no-compile -r requirements.txt
```

### 2) Configure backend `.env`

```bash
cp .env.example .env
```

Minimum required values in `backend/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/examai
SECRET_KEY=replace-with-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
FRONTEND_URL=http://localhost:3000
```

Optional SMTP settings are already in `.env.example`.

### 3) Frontend environment

```bash
cd ../frontend
npm install
cp .env.local.example .env.local
```

`frontend` uses:

- `NEXT_PUBLIC_API_URL` (default: `http://localhost:8000/api`)

## Run the Platform

Start in two terminals.

### Terminal A — Backend

```bash
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --port 8000
```

### Terminal B — Frontend

```bash
cd frontend
npm run dev
```

Open:

- Frontend: `http://localhost:3000`
- Backend API docs: `http://localhost:8000/docs`
- Backend health/root: `http://localhost:8000/`

## Database Migration & Seed Data

### Apply migrations

```bash
cd backend
source venv/bin/activate
alembic upgrade head
```

### Seed sample data (optional but recommended)

```bash
python seed.py
```

Seeded demo users:

- Organizer: `org@codeforgeai.com` / `password123`
- Candidate: `cand@codeforgeai.com` / `password123`

## API & WebSocket Map

Base URL: `http://localhost:8000/api`

### Auth

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`

### Users

- `GET /users/me`
- `PUT /users/me`
- `PUT /users/me/password`

### Contests

- `POST /contests/`
- `GET /contests/`
- `GET /contests/{contest_id}`
- `POST /contests/join`
- `POST /contests/{contest_id}/invite`
- `POST /contests/{contest_id}/problems/{problem_id}`
- `GET /contests/{contest_id}/leaderboard`
- `GET /contests/{contest_id}/results`
- `GET /contests/{contest_id}/results/me`
- ...plus organizer/admin contest lifecycle routes (publish/end/mark/feedback/detail)

### Problems

- `POST /problems/`
- `GET /problems/`
- `GET /problems/{problem_id}`
- `PUT /problems/{problem_id}/visibility`

### Submissions

- `POST /submissions/`
- `GET /submissions/my`
- `GET /submissions/{submission_id}`
- `PUT /submissions/{submission_id}/grade`

### Monitoring

- `POST /monitoring/sessions/start`
- `POST /monitoring/sessions/{session_id}/event`
- `GET /monitoring/sessions/{contest_id}/all`
- `WS /monitoring/ws/candidate/{session_id}`
- `WS /monitoring/ws/proctor/{contest_id}`

## Monitoring/Proctoring Pipeline

On each frame, pipeline combines multiple agents:

- Face Agent: missing face, multiple faces, identity mismatch
- Object Agent: phone/tablet/extra devices
- Gaze Agent: abnormal gaze/head rotation
- Behavior Agent: suspicious interaction patterns
- Environment Agent: room scan and calibration consistency

Agent outputs are fused into rolling suspicion score and flags, then persisted and streamed to organizer dashboards in near real-time.

## Troubleshooting

### 1) `ModuleNotFoundError: No module named 'psycopg2'`

Cause: `uvicorn` is running from global/conda Python instead of project `venv`.

Fix:

```bash
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --port 8000
```

Also verify:

```bash
which python
which uvicorn
```

Both should point inside `backend/venv`.

### 2) Dependency issues on Python 3.9

Use Python 3.11+ if possible. If constrained to 3.9:

```bash
pip install --no-compile -r requirements.txt
```

### 3) Database connection errors

- Ensure PostgreSQL is running.
- Verify `DATABASE_URL` in `backend/.env`.
- Run `alembic upgrade head` before starting backend.

### 4) CORS/API URL issues in browser

- Backend currently allows origin `http://localhost:3000`.
- Frontend default API URL is `http://localhost:8000/api`.
- Update `NEXT_PUBLIC_API_URL` if backend host/port differs.

---

## Notes

- This repository still contains a few legacy `examai` naming strings in env templates and variable names; functionality remains the same.
- `backend/yolov8n.pt` is included in repo and used by object/environment detection.

# codeforge-ai
