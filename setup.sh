#!/usr/bin/env bash
# ExamAI — Full Stack Setup Script
# Run this from the root of the examai/ folder

set -e
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ███████╗██╗  ██╗ █████╗ ███╗   ███╗ █████╗ ██╗"
echo "  ██╔════╝╚██╗██╔╝██╔══██╗████╗ ████║██╔══██╗██║"
echo "  █████╗   ╚███╔╝ ███████║██╔████╔██║███████║██║"
echo "  ██╔══╝   ██╔██╗ ██╔══██║██║╚██╔╝██║██╔══██║██║"
echo "  ███████╗██╔╝ ██╗██║  ██║██║ ╚═╝ ██║██║  ██║██║"
echo "  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝"
echo -e "${NC}"
echo -e "${GREEN}AI-Powered Secure Coding Examination Platform${NC}"
echo "=================================================="
echo ""

# ─── Check Prerequisites ────────────────────────────────────────────────────
echo -e "${YELLOW}[1/6] Checking prerequisites…${NC}"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $1 found"
  else
    echo -e "  ${RED}✗${NC} $1 not found — please install it"
    exit 1
  fi
}

check_cmd python3
check_cmd node
check_cmd npm
check_cmd psql
echo ""

# ─── Backend Setup ───────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/6] Setting up Python backend…${NC}"
cd backend

if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo -e "  ${GREEN}✓${NC} Virtual environment created"
fi

source venv/bin/activate
echo -e "  ${GREEN}✓${NC} Virtual environment activated"

pip install -q -r requirements.txt
echo -e "  ${GREEN}✓${NC} Python dependencies installed"

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo -e "  ${YELLOW}⚠${NC}  .env created from template — edit it with your DB credentials"
fi

cd ..
echo ""

# ─── Database Setup ──────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/6] Setting up PostgreSQL database…${NC}"
echo -e "  ${CYAN}Creating 'examai' database (if not exists)…${NC}"

if psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw examai; then
  echo -e "  ${GREEN}✓${NC} Database 'examai' already exists"
else
  createdb -U postgres examai 2>/dev/null && \
    echo -e "  ${GREEN}✓${NC} Database 'examai' created" || \
    echo -e "  ${YELLOW}⚠${NC}  Could not auto-create DB. Run: createdb examai"
fi

echo -e "  Running migrations…"
cd backend
source venv/bin/activate
alembic upgrade head 2>&1 | tail -5
echo -e "  ${GREEN}✓${NC} Database schema ready"
cd ..
echo ""

# ─── Frontend Setup ───────────────────────────────────────────────────────────
echo -e "${YELLOW}[4/6] Setting up Next.js frontend…${NC}"
cd frontend

npm install --silent
echo -e "  ${GREEN}✓${NC} Node modules installed"

if [ ! -f ".env.local" ]; then
  cp .env.local.example .env.local
  echo -e "  ${GREEN}✓${NC} .env.local created"
fi

cd ..
echo ""

# ─── CV Dependencies Note ─────────────────────────────────────────────────────
echo -e "${YELLOW}[5/6] CV/AI model notes…${NC}"
echo -e "  ${CYAN}YOLOv8 (yolov8n.pt) downloads automatically on first run (~6MB)${NC}"
echo -e "  ${CYAN}MediaPipe models download automatically on first use${NC}"
echo -e "  To pre-download YOLOv8:${NC}"
echo -e "    cd backend && source venv/bin/activate"
echo -e "    python3 -c \"from ultralytics import YOLO; YOLO('yolov8n.pt')\""
echo ""

# ─── Start Instructions ───────────────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Ready to launch!${NC}"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗"
echo -e "║         START THE APPLICATION                    ║"
echo -e "╠══════════════════════════════════════════════════╣"
echo -e "║                                                  ║"
echo -e "║  Terminal 1 — Backend:                           ║"
echo -e "║    cd backend                                    ║"
echo -e "║    source venv/bin/activate                      ║"
echo -e "║    uvicorn main:app --reload --port 8000         ║"
echo -e "║                                                  ║"
echo -e "║  Terminal 2 — Frontend:                          ║"
echo -e "║    cd frontend                                   ║"
echo -e "║    npm run dev                                   ║"
echo -e "║                                                  ║"
echo -e "║  Open: http://localhost:3000                     ║"
echo -e "║  API docs: http://localhost:8000/docs            ║"
echo -e "║                                                  ║"
echo -e "╠══════════════════════════════════════════════════╣"
echo -e "║  Default test accounts (after seeding):          ║"
echo -e "║    Organizer: org@examai.com / password123       ║"
echo -e "║    Candidate: cand@examai.com / password123      ║"
echo -e "╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Research Title:${NC}"
echo -e "  'Multi-Agent Computer Vision Framework for Detecting"
echo -e "   Cheating in Online Coding Examinations'"
echo ""
