"""
Suspicion Scoring Agent
=======================
Fuses signals from all agents into a single 0-100 suspicion score per session.

Design principles:
  - Score is cumulative but decays over time (fair to candidates)
  - Each signal has a weight and a cooldown to prevent double-counting
  - Critical events (phone detected, multiple faces) are logged immediately
  - Score above threshold triggers a proctor alert
"""
import time
import collections
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

# Maximum suspicion score
MAX_SCORE = 100.0

# Score decay rate — loses 0.5 points per second when no violations
DECAY_RATE = 0.3

# Per-event cooldowns in seconds (prevents same event spamming the score)
EVENT_COOLDOWNS: Dict[str, float] = {
    "face_missing":          3.0,
    "multiple_faces":        5.0,
    "low_face_confidence":  10.0,
    "cell_phone_detected":   5.0,
    "book_detected":        30.0,
    "gaze_left":             2.0,
    "gaze_right":            2.0,
    "gaze_down":             2.0,
    "gaze_off_screen":       2.0,
    "sustained_gaze_away":   5.0,
    "tab_switch":            2.0,
    "window_blur":           2.0,
    "paste_large":          10.0,
    "paste_small":          10.0,
    "idle_burst":           20.0,
    "multiple_people_in_room": 60.0,
    "extra_monitor_detected":  60.0,
}

# Severity classification
CRITICAL_FLAGS = {"cell_phone_detected", "multiple_faces", "multiple_people_in_room"}
HIGH_FLAGS     = {"gaze_off_screen", "paste_large", "idle_burst", "extra_monitor_detected"}
MEDIUM_FLAGS   = {"face_missing", "tab_switch", "sustained_gaze_away"}


@dataclass
class ScoringResult:
    suspicion_score: float
    delta: float
    flags: List[str]
    severity: str           # "clean" | "low" | "medium" | "high" | "critical"
    critical_events: List[str] = field(default_factory=list)
    should_alert: bool = False


class ScoringAgent:
    """Maintains rolling suspicion score and emits alerts."""

    ALERT_THRESHOLD = 70.0

    def __init__(self, session_id: int = 0):
        self.session_id = session_id
        self._score: float = 0.0
        self._last_update: float = time.time()
        self._cooldowns: Dict[str, float] = {}     # flag → timestamp last applied
        self._history: collections.deque = collections.deque(maxlen=200)

    def update(
        self,
        face_result,
        object_result,
        gaze_result,
        behavior_result,
        env_result=None,
    ) -> ScoringResult:
        now = time.time()

        # ── Decay since last frame ────────────────────────────────────────────
        elapsed = now - self._last_update
        self._score = max(0.0, self._score - DECAY_RATE * elapsed)
        self._last_update = now

        # ── Collect all flags from agents ─────────────────────────────────────
        all_flags = (
            list(face_result.flags) +
            list(object_result.flags) +
            list(gaze_result.flags) +
            list(behavior_result.flags) +
            (list(env_result.flags) if env_result else [])
        )

        # ── Apply score deltas with cooldown ──────────────────────────────────
        total_delta = 0.0
        applied_flags = []
        critical_events = []

        for flag in all_flags:
            # Respect per-flag cooldown
            last_time = self._cooldowns.get(flag, 0.0)
            cooldown  = EVENT_COOLDOWNS.get(flag, 5.0)
            if now - last_time < cooldown:
                continue

            # Find which agent contributed the delta for this flag
            delta = self._flag_to_delta(flag, face_result, object_result, gaze_result, behavior_result, env_result)
            self._score = min(MAX_SCORE, self._score + delta)
            total_delta += delta
            self._cooldowns[flag] = now
            applied_flags.append(flag)

            if flag in CRITICAL_FLAGS:
                critical_events.append(flag)
                logger.warning(f"[ScoringAgent] CRITICAL event: {flag} (session {self.session_id})")

        # ── Determine severity ────────────────────────────────────────────────
        severity = self._classify_severity(applied_flags, self._score)

        result = ScoringResult(
            suspicion_score=round(self._score, 1),
            delta=round(total_delta, 1),
            flags=applied_flags,
            severity=severity,
            critical_events=critical_events,
            should_alert=self._score >= self.ALERT_THRESHOLD,
        )

        self._history.append({
            "ts": now,
            "score": self._score,
            "flags": applied_flags,
        })

        return result

    def _flag_to_delta(self, flag, face_r, obj_r, gaze_r, behav_r, env_r) -> float:
        """Extract the per-agent delta for a given flag."""
        all_results = [face_r, obj_r, gaze_r, behav_r]
        if env_r:
            all_results.append(env_r)
        # Use the first agent that contains this flag and has a non-zero delta
        for agent_result in all_results:
            if flag in getattr(agent_result, "flags", []):
                return getattr(agent_result, "score_delta", 0.0) / max(len(agent_result.flags), 1)
        return 5.0   # default delta if flag found but no delta

    def _classify_severity(self, flags: List[str], score: float) -> str:
        if any(f in CRITICAL_FLAGS for f in flags) or score >= 80:
            return "critical"
        if any(f in HIGH_FLAGS for f in flags) or score >= 60:
            return "high"
        if any(f in MEDIUM_FLAGS for f in flags) or score >= 35:
            return "medium"
        if score >= 10:
            return "low"
        return "clean"

    @property
    def current_score(self) -> float:
        return round(self._score, 1)

    def get_history(self) -> list:
        return list(self._history)

    def reset(self):
        self._score = 0.0
        self._cooldowns.clear()
        self._history.clear()
