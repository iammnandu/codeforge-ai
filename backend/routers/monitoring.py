from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, List
import json
import asyncio
import base64
from datetime import datetime
import os
import sys
import importlib.util

from core.database import get_db, SessionLocal
from core.dependencies import get_current_user, require_organizer
from models.monitoring import MonitoringSession, MonitoringEvent
from models.user import User
from schemas.monitoring import MonitoringEventOut, SessionOut

router = APIRouter()

# In-memory registry: contest_id -> list of connected organizer WebSockets
proctor_connections: Dict[int, List[WebSocket]] = {}
# candidate_id -> their latest monitoring state
candidate_states: Dict[int, dict] = {}
pipeline_registry: Dict[int, any] = {}
violation_state: Dict[int, Dict[str, int]] = {}


def _load_monitoring_pipeline_class():
    agents_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ai_agents"))
    pipeline_path = os.path.join(agents_dir, "pipeline.py")

    if not os.path.exists(pipeline_path):
        raise RuntimeError(f"Monitoring pipeline not found at {pipeline_path}")

    if agents_dir not in sys.path:
        sys.path.insert(0, agents_dir)

    spec = importlib.util.spec_from_file_location("examai_monitoring_pipeline", pipeline_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load monitoring pipeline module spec")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.MonitoringPipeline


def _record_monitoring_event(session_id: int, event_type: str, severity: str, score_delta: float, details: dict = None):
    db = SessionLocal()
    try:
        session = db.query(MonitoringSession).filter(MonitoringSession.id == session_id).first()
        if not session:
            return
        event = MonitoringEvent(
            session_id=session_id,
            user_id=session.user_id,
            event_type=event_type,
            severity=severity,
            confidence=1.0,
            score_delta=score_delta,
            details=details or {},
        )
        db.add(event)
        session.suspicion_score = (session.suspicion_score or 0.0) + score_delta
        if severity in {"high", "critical"}:
            session.is_flagged = True
        db.commit()
    finally:
        db.close()


def _enforcement_action(session_id: int, flags: List[str], score: float):
    critical_set = {
        "cell_phone_detected",
        "cell_phone_in_room",
        "tablet_in_room",
        "multiple_faces",
        "multiple_people_in_room",
        "extra_monitor_detected",
    }
    has_critical = any(flag in critical_set for flag in flags)
    state = violation_state.setdefault(session_id, {"critical": 0, "multiple_faces": 0})

    if "multiple_faces" in flags:
        state["multiple_faces"] += 1

    if has_critical:
        state["critical"] += 1

    if state["multiple_faces"] >= 2:
        return {
            "action": "disqualify",
            "message": "Multiple people detected in camera repeatedly. This is malpractice. You are disqualified.",
        }
    if state["multiple_faces"] >= 1:
        return {
            "action": "pause",
            "message": "Multiple people detected in camera. This is malpractice. Contest is paused immediately.",
        }

    if score >= 90 or state["critical"] >= 3:
        return {
            "action": "disqualify",
            "message": "Malpractice detected repeatedly. You are disqualified from this contest.",
        }
    if state["critical"] >= 2:
        return {
            "action": "pause",
            "message": "Critical violation detected again. Contest is paused. Remove forbidden items and contact organizer.",
        }
    if state["critical"] >= 1:
        return {
            "action": "warning",
            "message": "Warning: forbidden object or malpractice signal detected. Remove it immediately.",
        }
    return None


@router.post("/sessions/start")
def start_monitoring_session(
    contest_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(MonitoringSession).filter_by(
        user_id=current_user.id, contest_id=contest_id, ended_at=None
    ).first()
    if existing:
        return {"session_id": existing.id}

    session = MonitoringSession(user_id=current_user.id, contest_id=contest_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id}


@router.post("/sessions/{session_id}/event")
def log_event(
    session_id: int,
    event_type: str,
    severity: str = "medium",
    confidence: float = 1.0,
    score_delta: float = 0,
    details: dict = None,
    db: Session = Depends(get_db),
):
    event = MonitoringEvent(
        session_id=session_id,
        user_id=0,  # filled from session
        event_type=event_type,
        severity=severity,
        confidence=confidence,
        score_delta=score_delta,
        details=details or {},
    )
    db.add(event)
    db.commit()
    return {"ok": True}


@router.get("/sessions/{contest_id}/all", response_model=List[SessionOut])
def get_all_sessions(
    contest_id: int,
    db: Session = Depends(get_db),
    organizer: User = Depends(require_organizer),
):
    return db.query(MonitoringSession).filter_by(contest_id=contest_id).all()


# ─── WebSocket: Candidate → Backend (sends frame + events) ───────────────────

@router.websocket("/ws/candidate/{session_id}")
async def candidate_ws(websocket: WebSocket, session_id: int):
    """
    Candidate browser connects here.
    Sends JSON frames: { type: 'frame'|'event', ... }
    Backend runs CV pipeline and broadcasts to organizer WS.
    """
    await websocket.accept()

    # Lazy import to avoid heavy load at startup
    MonitoringPipeline = _load_monitoring_pipeline_class()

    pipeline = pipeline_registry.get(session_id) or MonitoringPipeline(session_id=session_id)
    pipeline_registry[session_id] = pipeline

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "frame":
                # Decode base64 JPEG frame from browser
                frame_b64 = msg.get("frame", "")
                frame_bytes = base64.b64decode(frame_b64)
                import numpy as np
                import cv2
                nparr = np.frombuffer(frame_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is not None:
                    result = pipeline.process_frame(frame, session_id=session_id)
                    candidate_states[session_id] = result

                    if result.get("flags"):
                        for flag in result.get("flags", []):
                            severity = "medium"
                            score_delta = 2.0
                            if flag == "multiple_faces":
                                severity = "critical"
                                score_delta = 40.0
                            elif flag in {"cell_phone_detected", "cell_phone_in_room", "tablet_in_room", "multiple_people_in_room", "extra_monitor_detected"}:
                                severity = "high"
                                score_delta = 20.0

                            _record_monitoring_event(
                                session_id=session_id,
                                event_type=flag,
                                severity=severity,
                                score_delta=score_delta,
                                details={"source": "frame"},
                            )

                    action_payload = _enforcement_action(
                        session_id=session_id,
                        flags=result.get("flags", []),
                        score=result.get("suspicion_score", 0),
                    )
                    if action_payload and action_payload["action"] == "disqualify":
                        db = SessionLocal()
                        try:
                            session = db.query(MonitoringSession).filter(MonitoringSession.id == session_id).first()
                            if session:
                                session.is_flagged = True
                                session.ended_at = datetime.utcnow()
                                db.commit()
                        finally:
                            db.close()

                    # Broadcast to organizer dashboards for this contest
                    contest_id = msg.get("contest_id")
                    if contest_id and contest_id in proctor_connections:
                        broadcast = json.dumps({
                            "type": "update",
                            "session_id": session_id,
                            "user_id": msg.get("user_id"),
                            "username": msg.get("username"),
                            "suspicion_score": result.get("suspicion_score", 0),
                            "severity": result.get("severity", "clean"),
                            "flags": result.get("flags", []),
                            "agents": result.get("agent_results", {}),
                            "should_alert": result.get("should_alert", False),
                            "action": action_payload["action"] if action_payload else None,
                        })
                        dead = []
                        for ws in proctor_connections[contest_id]:
                            try:
                                await ws.send_text(broadcast)
                            except Exception:
                                dead.append(ws)
                        for ws in dead:
                            proctor_connections[contest_id].remove(ws)

                    await websocket.send_text(json.dumps({
                        "type": "result",
                        "suspicion_score": result.get("suspicion_score", 0),
                        "flags": result.get("flags", []),
                        "severity": result.get("severity", "clean"),
                        "action": action_payload["action"] if action_payload else None,
                        "message": action_payload["message"] if action_payload else None,
                    }))

            elif msg.get("type") == "room_scan":
                frame_b64 = msg.get("frame", "")
                frame_bytes = base64.b64decode(frame_b64)
                import numpy as np
                import cv2
                nparr = np.frombuffer(frame_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is not None:
                    scan_result = pipeline.run_room_scan(frame)
                    if scan_result.get("flags"):
                        for flag in scan_result.get("flags", []):
                            _record_monitoring_event(
                                session_id=session_id,
                                event_type=flag,
                                severity="high",
                                score_delta=scan_result.get("score_delta", 0.0),
                                details=scan_result,
                            )
                    await websocket.send_text(json.dumps({
                        "type": "scan_result",
                        **scan_result,
                    }))

            elif msg.get("type") == "calibration_capture":
                gaze_x, gaze_y = 0.5, 0.5

                frame_b64 = msg.get("frame")
                if frame_b64:
                    frame_bytes = base64.b64decode(frame_b64)
                    import numpy as np
                    import cv2
                    nparr = np.frombuffer(frame_bytes, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    if frame is not None:
                        result = pipeline.process_frame(frame, session_id=session_id)
                        candidate_states[session_id] = result
                        gaze = (result.get("agent_results", {}) or {}).get("gaze", {})
                        gaze_x = gaze.get("gaze_x", 0.5)
                        gaze_y = gaze.get("gaze_y", 0.5)
                else:
                    last = pipeline._last_result or {}
                    gaze = (last.get("agent_results", {}) or {}).get("gaze", {})
                    gaze_x = gaze.get("gaze_x", 0.5)
                    gaze_y = gaze.get("gaze_y", 0.5)

                calibration = pipeline.capture_calibration_corner(gaze_x=gaze_x, gaze_y=gaze_y)
                await websocket.send_text(json.dumps({
                    "type": "calibration_result",
                    **calibration,
                }))

            elif msg.get("type") == "behavior_event":
                # Browser-side events: tab_switch, paste, etc.
                pipeline.behavior_agent.add_event(msg.get("event"))
                await websocket.send_text(json.dumps({"type": "ack"}))

    except WebSocketDisconnect:
        pass
    finally:
        pipeline.release()
        pipeline_registry.pop(session_id, None)
        violation_state.pop(session_id, None)


# ─── WebSocket: Organizer → Backend (receive live updates) ───────────────────

@router.websocket("/ws/proctor/{contest_id}")
async def proctor_ws(websocket: WebSocket, contest_id: int):
    """Organizer connects to watch all candidates in real time."""
    await websocket.accept()
    if contest_id not in proctor_connections:
        proctor_connections[contest_id] = []
    proctor_connections[contest_id].append(websocket)

    # Send current state of all active candidates immediately
    for session_id, state in candidate_states.items():
        await websocket.send_text(json.dumps({
            "type": "snapshot",
            "session_id": session_id,
            **state,
        }))

    try:
        while True:
            await asyncio.sleep(30)  # Keep alive
            await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        proctor_connections[contest_id].remove(websocket)
