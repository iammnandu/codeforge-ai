"""
Object Detection Agent
======================
Uses YOLOv8n (nano) to detect forbidden objects in the camera frame:
  - Mobile phone / smartphone
  - Tablet
  - Second laptop / notebook
  - Book / notebook (paper)
  - Earbuds / headphones

The COCO class IDs for these objects are used directly from YOLOv8
pretrained on COCO dataset — no custom training needed.
"""
import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple
import logging
import os

logger = logging.getLogger(__name__)

# COCO class names relevant to cheating detection
FORBIDDEN_CLASSES = {
    67: "cell phone",
    73: "laptop",      # second laptop
    74: "mouse",
    63: "laptop",
    76: "keyboard",
    84: "book",
    85: "clock",
}

SCORE_MAP = {
    "cell phone": 40.0,
    "laptop":     25.0,
    "book":       15.0,
    "tablet":     35.0,
    "remote":     10.0,
}


@dataclass
class DetectedObject:
    class_name: str
    confidence: float
    bbox: Tuple[int, int, int, int]   # x1, y1, x2, y2 (pixel coords)


@dataclass
class ObjectResult:
    detections: List[DetectedObject] = field(default_factory=list)
    flags: List[str] = field(default_factory=list)
    score_delta: float = 0.0
    phone_detected: bool = False
    book_detected: bool = False


class ObjectAgent:
    """YOLOv8-based forbidden object detection agent."""

    CONFIDENCE_THRESHOLD = 0.25

    def __init__(self):
        self._model = None
        self._load_model()

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

            # Downloads yolov8n.pt (~6MB) automatically on first run
            self._model = YOLO(model_path)
            logger.info("[ObjectAgent] YOLOv8n loaded")
            return
        except ImportError:
            logger.warning("[ObjectAgent] ultralytics not installed — object detection disabled")
            self._model = None
            return
        except Exception as first_error:
            # Torch >=2.6 changed torch.load default weights_only=True.
            # For our trusted local model checkpoint, retry with weights_only=False.
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
                    logger.info("[ObjectAgent] YOLOv8n loaded with torch compatibility fallback")
                    return
                finally:
                    torch.load = original_torch_load
            except Exception as e:
                logger.warning(f"[ObjectAgent] Failed to load YOLOv8 after compatibility fallback: {e}")
                logger.warning(f"[ObjectAgent] Initial load error: {first_error}")
                self._model = None
                return

    def analyse(self, frame: np.ndarray) -> ObjectResult:
        result = ObjectResult()

        if self._model is None:
            return result

        try:
            # Run inference (verbose=False suppresses per-frame logs)
            predictions = self._model(frame, verbose=False, conf=self.CONFIDENCE_THRESHOLD)

            for pred in predictions:
                boxes = pred.boxes
                if boxes is None:
                    continue

                for box in boxes:
                    cls_id = int(box.cls[0])
                    conf   = float(box.conf[0])
                    x1, y1, x2, y2 = map(int, box.xyxy[0])

                    # Only care about forbidden classes
                    class_name = pred.names.get(cls_id, "")
                    if class_name not in SCORE_MAP:
                        continue

                    obj = DetectedObject(
                        class_name=class_name,
                        confidence=conf,
                        bbox=(x1, y1, x2, y2),
                    )
                    result.detections.append(obj)

                    flag = class_name.replace(" ", "_")
                    if flag not in result.flags:
                        result.flags.append(f"{flag}_detected")

                    result.score_delta += SCORE_MAP.get(class_name, 10.0) * conf

                    if class_name == "cell phone":
                        result.phone_detected = True
                    if class_name == "book":
                        result.book_detected = True

        except Exception as e:
            logger.error(f"[ObjectAgent] Inference error: {e}")

        return result
