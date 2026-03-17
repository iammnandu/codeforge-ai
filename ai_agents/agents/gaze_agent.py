"""
Gaze & Head Pose Agent
======================
Uses MediaPipe FaceMesh (468 landmarks) to estimate:
  1. Eye gaze direction — are eyes looking at screen or away?
  2. Head pose (yaw / pitch / roll) — is candidate looking behind or down?

THE NOVEL TRICK — Off-frame device detection via calibrated gaze:
  During camera calibration the candidate points their camera at each screen
  corner. This gives us a homography matrix mapping gaze vectors to screen
  positions. During the exam, if gaze consistently maps OUTSIDE the screen
  bounds (e.g. to the desk area below the screen), that's a strong signal
  they're looking at a phone placed just out of frame.

  This works even when the phone is completely invisible to the camera —
  no existing consumer proctoring platform implements this.
"""
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, Tuple, List
import logging
import collections

logger = logging.getLogger(__name__)


@dataclass
class GazeResult:
    gaze_on_screen: bool = True
    gaze_x: float = 0.5          # 0 = left, 1 = right (normalised)
    gaze_y: float = 0.5          # 0 = top,  1 = bottom
    yaw:   float = 0.0            # degrees, + = right
    pitch: float = 0.0            # degrees, + = up
    roll:  float = 0.0            # degrees
    looking_away: bool = False
    flags: List[str] = field(default_factory=list)
    score_delta: float = 0.0


# MediaPipe FaceMesh landmark indices
LEFT_EYE_OUTER  = 33
LEFT_EYE_INNER  = 133
RIGHT_EYE_OUTER = 362
RIGHT_EYE_INNER = 263
LEFT_IRIS_CENTER  = 468   # requires refine_landmarks=True
RIGHT_IRIS_CENTER = 473

# 3D model points of a generic face (used for solvePnP)
MODEL_POINTS = np.array([
    (0.0,    0.0,    0.0),    # Nose tip
    (0.0,   -330.0, -65.0),   # Chin
    (-225.0, 170.0, -135.0),  # Left eye corner
    (225.0,  170.0, -135.0),  # Right eye corner
    (-150.0,-150.0, -125.0),  # Left mouth corner
    (150.0, -150.0, -125.0),  # Right mouth corner
], dtype=np.float64)

# Landmark indices that correspond to MODEL_POINTS (FaceMesh)
LANDMARK_INDICES = [1, 152, 226, 446, 57, 287]

# Gaze thresholds (degrees)
YAW_THRESHOLD   = 20.0   # > 20° turn = looking away sideways
PITCH_THRESHOLD = 22.0   # < -22° pitch = likely desk/phone look (less strict for normal typing)


class GazeAgent:
    def __init__(self, calibration_matrix: Optional[np.ndarray] = None):
        """
        calibration_matrix: 3x3 homography mapping gaze→screen coords.
                            If None, use simple threshold-based detection.
        """
        self._mesh = None
        self._calibration = calibration_matrix
        self._away_buffer = collections.deque(maxlen=10)  # temporal smoothing
        self._init_mesh()

    def _init_mesh(self):
        try:
            import mediapipe as mp
            self._mp_mesh = mp.solutions.face_mesh
            self._mesh = self._mp_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,   # enables iris tracking (landmarks 468-477)
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            logger.info("[GazeAgent] MediaPipe FaceMesh loaded")
        except ImportError:
            logger.warning("[GazeAgent] mediapipe not installed")

    def set_calibration(self, matrix: np.ndarray):
        """Provide the homography from the environment scan step."""
        self._calibration = matrix

    def analyse(self, frame: np.ndarray) -> GazeResult:
        result = GazeResult()
        if self._mesh is None:
            return result

        import cv2
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mesh_result = self._mesh.process(rgb)

        if not mesh_result.multi_face_landmarks:
            return result

        landmarks = mesh_result.multi_face_landmarks[0].landmark
        lm = [(lm.x * w, lm.y * h, lm.z * w) for lm in landmarks]

        # ── Head Pose Estimation ──────────────────────────────────────────────
        yaw, pitch, roll = self._estimate_pose(lm, w, h)
        result.yaw   = yaw
        result.pitch = pitch
        result.roll  = roll

        # ── Gaze Direction via Iris Position ─────────────────────────────────
        if len(lm) > RIGHT_IRIS_CENTER:
            gaze_x, gaze_y = self._iris_gaze(lm)
            result.gaze_x = gaze_x
            result.gaze_y = gaze_y

            # Apply calibration homography if available
            if self._calibration is not None:
                screen_x, screen_y = self._apply_homography(gaze_x, gaze_y)
                result.gaze_x = screen_x
                result.gaze_y = screen_y
                # If mapped gaze falls outside [0,1] screen bounds → off-screen
                off_screen = not (0.0 <= screen_x <= 1.0 and 0.0 <= screen_y <= 1.0)
                if off_screen:
                    result.flags.append("gaze_off_screen")
                    result.score_delta += 12.0
            else:
                # Simple geometric check
                if gaze_x < 0.25:
                    result.flags.append("gaze_left")
                    result.score_delta += 8.0
                elif gaze_x > 0.75:
                    result.flags.append("gaze_right")
                    result.score_delta += 8.0

        # ── Head Pose Flags ───────────────────────────────────────────────────
        if abs(yaw) > YAW_THRESHOLD:
            direction = "gaze_right" if yaw > 0 else "gaze_left"
            result.flags.append(direction)
            result.score_delta += min(abs(yaw) - YAW_THRESHOLD, 20.0) * 0.5

        if pitch < -PITCH_THRESHOLD:
            # Pitching down = looking at desk/phone below frame
            result.flags.append("gaze_down")
            result.score_delta += min(abs(pitch) - PITCH_THRESHOLD, 12.0) * 0.25
            logger.debug(f"[GazeAgent] Downward pitch detected: {pitch:.1f}°")

        # Temporal smoothing — flag as "looking away" only if sustained
        is_away = len(result.flags) > 0
        self._away_buffer.append(is_away)
        sustained = sum(self._away_buffer) >= 6   # 6/10 recent frames

        if sustained:
            result.looking_away = True
            if "sustained_gaze_away" not in result.flags:
                result.flags.append("sustained_gaze_away")
                result.score_delta += 4.0

        return result

    def _estimate_pose(self, lm, w: int, h: int) -> Tuple[float, float, float]:
        """Estimate yaw/pitch/roll using solvePnP."""
        import cv2
        image_points = np.array(
            [(lm[i][0], lm[i][1]) for i in LANDMARK_INDICES],
            dtype=np.float64,
        )
        focal = w
        camera_matrix = np.array([
            [focal, 0,     w / 2],
            [0,     focal, h / 2],
            [0,     0,     1    ],
        ], dtype=np.float64)
        dist_coeffs = np.zeros((4, 1))

        success, rvec, tvec = cv2.solvePnP(
            MODEL_POINTS, image_points, camera_matrix, dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not success:
            return 0.0, 0.0, 0.0

        rmat, _ = cv2.Rodrigues(rvec)
        angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
        yaw, pitch, roll = angles[1], angles[0], angles[2]
        return float(yaw), float(pitch), float(roll)

    def _iris_gaze(self, lm) -> Tuple[float, float]:
        """
        Estimate gaze direction from iris centre vs eye corners.
        Returns (x, y) in [0, 1] where (0.5, 0.5) = looking straight.
        """
        # Left eye
        l_outer = np.array(lm[LEFT_EYE_OUTER][:2])
        l_inner = np.array(lm[LEFT_EYE_INNER][:2])
        l_iris  = np.array(lm[LEFT_IRIS_CENTER][:2])
        l_ratio = np.linalg.norm(l_iris - l_outer) / (np.linalg.norm(l_inner - l_outer) + 1e-6)

        # Right eye
        r_outer = np.array(lm[RIGHT_EYE_OUTER][:2])
        r_inner = np.array(lm[RIGHT_EYE_INNER][:2])
        r_iris  = np.array(lm[RIGHT_IRIS_CENTER][:2])
        r_ratio = np.linalg.norm(r_iris - r_outer) / (np.linalg.norm(r_inner - r_outer) + 1e-6)

        gaze_x = (l_ratio + r_ratio) / 2.0
        # Y gaze: use average iris y relative to eye height
        eye_h_l = abs(lm[159][1] - lm[145][1]) + 1e-6
        gaze_y  = (lm[LEFT_IRIS_CENTER][1] - lm[145][1]) / eye_h_l

        return float(np.clip(gaze_x, 0, 1)), float(np.clip(gaze_y, 0, 1))

    def _apply_homography(self, gaze_x: float, gaze_y: float) -> Tuple[float, float]:
        """Map raw gaze (0-1) through calibration homography to screen space."""
        pt = np.array([[[gaze_x, gaze_y]]], dtype=np.float32)
        import cv2
        mapped = cv2.perspectiveTransform(pt, self._calibration)
        return float(mapped[0][0][0]), float(mapped[0][0][1])

    def release(self):
        if self._mesh:
            self._mesh.close()
