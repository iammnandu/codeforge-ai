"""
Face Detection Agent
====================
Uses MediaPipe FaceDetection to detect:
  - No face present (candidate left camera)
  - Multiple faces (someone else looking over)
  - Face confidence drop (identity mismatch proxy)

Returns a structured result dict consumed by the ScoringAgent.
"""
import numpy as np
from dataclasses import dataclass, field
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class FaceResult:
    face_count: int = 0
    face_present: bool = False
    multiple_faces: bool = False
    primary_confidence: float = 0.0
    face_bbox: Optional[tuple] = None        # (x, y, w, h) normalised 0-1
    flags: list = field(default_factory=list)
    score_delta: float = 0.0


class FaceAgent:
    """MediaPipe-based face detection agent."""

    SCORE_NO_FACE       = 20.0
    SCORE_MULTIPLE      = 50.0
    SCORE_LOW_CONF      = 5.0
    CONFIDENCE_THRESH   = 0.75

    def __init__(self):
        self._detector = None
        self._init_detector()

    def _init_detector(self):
        try:
            import mediapipe as mp
            self._mp_fd = mp.solutions.face_detection
            self._detector = self._mp_fd.FaceDetection(
                model_selection=0,          # 0 = short range (< 2m), 1 = full range
                min_detection_confidence=0.5,
            )
            logger.info("[FaceAgent] MediaPipe FaceDetection loaded")
        except ImportError:
            logger.warning("[FaceAgent] mediapipe not installed — using fallback")
            self._detector = None

    def analyse(self, frame: np.ndarray) -> FaceResult:
        """
        Analyse a single BGR frame.
        Returns FaceResult with flags and score contribution.
        """
        result = FaceResult()

        if self._detector is None:
            return self._fallback(frame, result)

        import cv2
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        detection_result = self._detector.process(rgb)

        if not detection_result.detections:
            result.face_present = False
            result.face_count = 0
            result.flags.append("face_missing")
            result.score_delta += self.SCORE_NO_FACE
            return result

        detections = detection_result.detections
        result.face_count = len(detections)
        result.face_present = True

        # Best detection (highest confidence)
        best = max(detections, key=lambda d: d.score[0])
        result.primary_confidence = best.score[0]

        bbox = best.location_data.relative_bounding_box
        result.face_bbox = (bbox.xmin, bbox.ymin, bbox.width, bbox.height)

        if result.face_count > 1:
            result.multiple_faces = True
            result.flags.append("multiple_faces")
            result.score_delta += self.SCORE_MULTIPLE

        if result.primary_confidence < self.CONFIDENCE_THRESH:
            result.flags.append("low_face_confidence")
            result.score_delta += self.SCORE_LOW_CONF

        return result

    def _fallback(self, frame: np.ndarray, result: FaceResult) -> FaceResult:
        """OpenCV Haar cascade fallback when mediapipe is unavailable."""
        import cv2
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))

        result.face_count = len(faces)
        result.face_present = len(faces) > 0

        if not result.face_present:
            result.flags.append("face_missing")
            result.score_delta += self.SCORE_NO_FACE
        elif len(faces) > 1:
            result.multiple_faces = True
            result.flags.append("multiple_faces")
            result.score_delta += self.SCORE_MULTIPLE

        return result

    def release(self):
        if self._detector:
            self._detector.close()
