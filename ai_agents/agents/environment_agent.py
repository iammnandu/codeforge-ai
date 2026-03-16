"""
Environment Scan Agent
======================
Two responsibilities:

1. PRE-EXAM ROOM SCAN
   Candidate slowly pans camera around their workspace.
   YOLOv8 detects any forbidden objects in the environment.
   Multiple people, monitors, phones on desk, etc.

2. CAMERA CALIBRATION (the novel technique)
   Candidate points camera at each corner of their screen.
   We detect screen corner markers (ArUco markers or bright corners)
   and compute the homography matrix between screen-space and
   camera-space. This is later used by GazeAgent to detect
   off-frame gaze (phone below the desk, for example).

   Corner detection protocol:
     1. Show 4 bright markers on screen corners
     2. Ask candidate to point camera at each in order
     3. Record gaze/head vector at each corner
     4. Compute homography: screen_corners → gaze_vectors
"""
import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
import logging
import os

logger = logging.getLogger(__name__)


@dataclass
class ScanResult:
    objects_found: List[str] = field(default_factory=list)
    people_count: int = 0
    extra_monitors: int = 0
    flags: List[str] = field(default_factory=list)
    score_delta: float = 0.0
    scan_complete: bool = False


@dataclass
class CalibrationState:
    """Tracks progress through the 4-corner calibration sequence."""
    corners_needed: int = 4
    corners_captured: List[Tuple[float, float]] = field(default_factory=list)
    screen_corners: List[Tuple[float, float]] = field(
        default_factory=lambda: [(0.0, 0.0), (1.0, 0.0), (0.0, 1.0), (1.0, 1.0)]
    )   # TL, TR, BL, BR in normalised screen space
    homography: Optional[np.ndarray] = None
    is_complete: bool = False

    def add_corner(self, gaze_x: float, gaze_y: float) -> bool:
        """Add a captured gaze vector for the current corner."""
        idx = len(self.corners_captured)
        if idx >= self.corners_needed:
            return True
        self.corners_captured.append((gaze_x, gaze_y))
        logger.info(f"[Calibration] Corner {idx+1}/4 captured: ({gaze_x:.3f}, {gaze_y:.3f})")
        if len(self.corners_captured) == self.corners_needed:
            self._compute_homography()
        return self.is_complete

    def _compute_homography(self):
        """Compute homography from screen corners to gaze space."""
        import cv2
        src = np.array(self.screen_corners, dtype=np.float32)
        dst = np.array(self.corners_captured, dtype=np.float32)
        H, status = cv2.findHomography(src, dst)
        if H is not None:
            self.homography = H
            self.is_complete = True
            logger.info("[Calibration] Homography computed successfully")
        else:
            logger.warning("[Calibration] Homography computation failed")


class EnvironmentAgent:
    """Room scan and camera calibration agent."""

    def __init__(self):
        self._model = None
        self._load_model()
        self.calibration = CalibrationState()

    def _load_model(self):
        model_path = "yolov8n.pt"
        fallback_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/yolov8n.pt"))
        if not os.path.exists(model_path) and os.path.exists(fallback_path):
            model_path = fallback_path

        try:
            from ultralytics import YOLO
            try:
                from torch.serialization import add_safe_globals
                from ultralytics.nn.tasks import DetectionModel
                add_safe_globals([DetectionModel])
            except Exception:
                pass

            self._model = YOLO(model_path)
            logger.info("[EnvironmentAgent] YOLOv8n loaded for room scan")
            return
        except ImportError:
            logger.warning("[EnvironmentAgent] ultralytics not installed — room scan object detection disabled")
            self._model = None
            return
        except Exception as first_error:
            try:
                import torch
                from ultralytics import YOLO

                original_torch_load = torch.load

                def _patched_torch_load(*args, **kwargs):
                    kwargs.setdefault("weights_only", False)
                    return original_torch_load(*args, **kwargs)

                torch.load = _patched_torch_load
                try:
                    self._model = YOLO(model_path)
                    logger.info("[EnvironmentAgent] YOLO loaded with torch compatibility fallback")
                    return
                finally:
                    torch.load = original_torch_load
            except Exception as e:
                logger.warning(f"[EnvironmentAgent] YOLO unavailable after compatibility fallback: {e}")
                logger.warning(f"[EnvironmentAgent] Initial load error: {first_error}")
                self._model = None
                return

    def scan_frame(self, frame: np.ndarray) -> ScanResult:
        """
        Analyse a single frame from the room scan phase.
        Should be called on every frame during the 10-second pre-exam scan.
        """
        result = ScanResult()
        if self._model is None:
            result.scan_complete = True
            return result

        try:
            preds = self._model(frame, verbose=False, conf=0.30)
            monitor_count = 0

            for pred in preds:
                if pred.boxes is None:
                    continue
                for box in pred.boxes:
                    cls_id     = int(box.cls[0])
                    class_name = pred.names.get(cls_id, "")
                    conf       = float(box.conf[0])

                    if class_name == "person":
                        result.people_count += 1
                    elif class_name in ("cell phone", "tablet", "remote"):
                        result.objects_found.append(class_name)
                        flag_name = "cell_phone_in_room" if class_name == "remote" else f"{class_name.replace(' ', '_')}_in_room"
                        result.flags.append(flag_name)
                        result.score_delta += 30.0
                    elif class_name in ("tv", "monitor", "laptop"):
                        monitor_count += 1
                    elif class_name in ("book", "notebook"):
                        result.objects_found.append(class_name)

            if result.people_count > 1:
                result.flags.append("multiple_people_in_room")
                result.score_delta += 40.0

            if monitor_count > 1:
                result.extra_monitors = monitor_count - 1
                result.flags.append("extra_monitor_detected")
                result.score_delta += 35.0

        except Exception as e:
            logger.error(f"[EnvironmentAgent] Scan error: {e}")

        result.scan_complete = True
        return result

    def capture_calibration_corner(self, gaze_x: float, gaze_y: float) -> dict:
        """
        Called when candidate confirms they're looking at the next corner marker.
        Returns { complete, corner_index, homography }
        """
        self.calibration.add_corner(gaze_x, gaze_y)
        return {
            "complete": self.calibration.is_complete,
            "corner_index": len(self.calibration.corners_captured),
            "homography": self.calibration.homography.tolist()
                          if self.calibration.homography is not None else None,
        }

    def get_homography(self) -> Optional[np.ndarray]:
        return self.calibration.homography

    def reset_calibration(self):
        self.calibration = CalibrationState()
