"""
Monitoring Pipeline
===================
Orchestrates all agents per frame. Called by the WebSocket handler.

Flow per frame:
  1. FaceAgent      → face presence, count
  2. ObjectAgent    → phone, tablet, book detection
  3. GazeAgent      → eye gaze, head pose (uses calibration if available)
  4. BehaviorAgent  → browser/keyboard events (stateful, not per-frame)
  5. ScoringAgent   → fuse signals → suspicion score

Every CV_FRAME_SKIP frames (default: 3) to reduce CPU load.
"""
import numpy as np
import logging
from typing import Optional, Dict

from agents.face_agent        import FaceAgent
from agents.object_agent      import ObjectAgent
from agents.gaze_agent        import GazeAgent
from agents.behavior_agent    import BehaviorAgent
from agents.environment_agent import EnvironmentAgent
from agents.scoring_agent     import ScoringAgent

logger = logging.getLogger(__name__)

FRAME_SKIP = 1   # Process every frame for more reliable monitoring


class MonitoringPipeline:
    """
    One pipeline instance per connected candidate WebSocket.
    Instantiated in the WebSocket handler.
    """

    def __init__(self, session_id: int = 0):
        self.session_id = session_id
        self._frame_count = 0

        logger.info(f"[Pipeline] Initialising agents for session {session_id}")
        self.face_agent    = FaceAgent()
        self.object_agent  = ObjectAgent()
        self.gaze_agent    = GazeAgent()
        self.behavior_agent = BehaviorAgent()
        self.env_agent     = EnvironmentAgent()
        self.scoring_agent = ScoringAgent(session_id=session_id)

        self._last_result: Optional[dict] = None

    def set_calibration(self, homography: np.ndarray):
        """Provide calibration matrix computed during environment scan."""
        self.gaze_agent.set_calibration(homography)
        logger.info(f"[Pipeline] Calibration matrix applied for session {self.session_id}")

    def process_frame(self, frame: np.ndarray, session_id: int = None) -> dict:
        """
        Process a single BGR frame from the candidate's webcam.
        Returns a dict suitable for broadcasting to the proctor dashboard.
        """
        self._frame_count += 1

        # Return cached result for skipped frames
        if self._frame_count % FRAME_SKIP != 0:
            return self._last_result or self._empty_result()

        # ── Run all CV agents ─────────────────────────────────────────────────
        try:
            face_result   = self.face_agent.analyse(frame)
        except Exception as e:
            logger.error(f"[Pipeline] FaceAgent error: {e}")
            from agents.face_agent import FaceResult
            face_result = FaceResult()

        try:
            object_result = self.object_agent.analyse(frame)
        except Exception as e:
            logger.error(f"[Pipeline] ObjectAgent error: {e}")
            from agents.object_agent import ObjectResult
            object_result = ObjectResult()

        try:
            gaze_result   = self.gaze_agent.analyse(frame)
        except Exception as e:
            logger.error(f"[Pipeline] GazeAgent error: {e}")
            from agents.gaze_agent import GazeResult
            gaze_result = GazeResult()

        try:
            behavior_result = self.behavior_agent.analyse()
        except Exception as e:
            logger.error(f"[Pipeline] BehaviorAgent error: {e}")
            from agents.behavior_agent import BehaviorResult
            behavior_result = BehaviorResult()

        # ── Fuse with scoring agent ───────────────────────────────────────────
        scoring = self.scoring_agent.update(
            face_result, object_result, gaze_result, behavior_result
        )

        result = {
            "session_id":      session_id or self.session_id,
            "frame":           self._frame_count,
            "suspicion_score": scoring.suspicion_score,
            "severity":        scoring.severity,
            "flags":           scoring.flags,
            "should_alert":    scoring.should_alert,
            "critical_events": scoring.critical_events,
            "agent_results": {
                "face": {
                    "face_count":    face_result.face_count,
                    "face_present":  face_result.face_present,
                    "multiple":      face_result.multiple_faces,
                    "flags":         face_result.flags,
                },
                "objects": {
                    "detections":    [
                        {"class": d.class_name, "confidence": round(d.confidence, 2)}
                        for d in object_result.detections
                    ],
                    "phone":         object_result.phone_detected,
                    "flags":         object_result.flags,
                },
                "gaze": {
                    "gaze_x":        round(gaze_result.gaze_x, 3),
                    "gaze_y":        round(gaze_result.gaze_y, 3),
                    "yaw":           round(gaze_result.yaw, 1),
                    "pitch":         round(gaze_result.pitch, 1),
                    "on_screen":     gaze_result.gaze_on_screen,
                    "looking_away":  gaze_result.looking_away,
                    "flags":         gaze_result.flags,
                },
                "behavior": {
                    "tab_switches":  behavior_result.tab_switches,
                    "paste_events":  behavior_result.paste_events,
                    "flags":         behavior_result.flags,
                },
            },
        }

        self._last_result = result
        return result

    def run_room_scan(self, frame: np.ndarray) -> dict:
        """Called during the pre-exam room scan phase."""
        scan = self.env_agent.scan_frame(frame)
        object_scan = self.object_agent.analyse(frame)

        objects_found = list(scan.objects_found)
        flags = list(scan.flags)
        score_delta = float(scan.score_delta or 0)

        for detection in object_scan.detections:
            if detection.class_name not in objects_found:
                objects_found.append(detection.class_name)

        for flag in object_scan.flags:
            room_flag = flag.replace("_detected", "_in_room")
            if room_flag not in flags:
                flags.append(room_flag)

        score_delta += float(object_scan.score_delta or 0)

        return {
            "objects_found": objects_found,
            "people_count":  scan.people_count,
            "flags":         flags,
            "score_delta":   score_delta,
        }

    def capture_calibration_corner(self, gaze_x: float, gaze_y: float) -> dict:
        """Record a calibration corner from the gaze agent's current reading."""
        result = self.env_agent.capture_calibration_corner(gaze_x, gaze_y)
        if result["complete"] and result["homography"]:
            import numpy as np
            H = np.array(result["homography"])
            self.set_calibration(H)
        return result

    def _empty_result(self) -> dict:
        return {
            "session_id": self.session_id,
            "frame": self._frame_count,
            "suspicion_score": self.scoring_agent.current_score,
            "severity": "clean",
            "flags": [],
            "should_alert": False,
            "critical_events": [],
            "agent_results": {},
        }

    def release(self):
        """Clean up MediaPipe resources."""
        self.face_agent.release()
        self.gaze_agent.release()
