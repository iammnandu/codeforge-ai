"""
Behavior Agent
==============
Analyses behavioural signals that don't come from the camera:
  - Keyboard: paste bursts, sudden code dumps, idle → burst patterns
  - Browser: tab switching, window blur/focus, copy events
  - Typing pattern: WPM spikes indicating pasted code

These events are pushed from the browser via WebSocket (type: "behavior_event").
The agent maintains a rolling event buffer per session.
"""
import time
import collections
from dataclasses import dataclass, field
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

# Score weights
SCORE_TAB_SWITCH     = 15.0
SCORE_WINDOW_BLUR    = 10.0
SCORE_PASTE_SMALL    = 20.0   # < 50 chars pasted
SCORE_PASTE_LARGE    = 40.0   # >= 50 chars (entire function/solution)
SCORE_IDLE_BURST     = 25.0   # Long idle then instant code dump
SCORE_COPY_EVENT     = 5.0


@dataclass
class BehaviorResult:
    flags: List[str] = field(default_factory=list)
    score_delta: float = 0.0
    tab_switches: int = 0
    paste_events: int = 0
    window_blurs: int = 0


class BehaviorAgent:
    """Stateful per-session browser behaviour monitor."""

    # Rolling window for idle-burst detection (seconds)
    IDLE_THRESHOLD_S    = 60
    BURST_CHARS_MIN     = 80   # chars typed in < 5 seconds = suspicious

    def __init__(self):
        self._events: collections.deque = collections.deque(maxlen=500)
        self._last_keystroke_ts: Optional[float] = None
        self._chars_in_window: List[tuple] = []   # (timestamp, char_count)
        self._tab_switches: int = 0
        self._paste_events: int = 0
        self._window_blurs: int = 0

    def add_event(self, event: dict):
        """
        Called for each browser event pushed via WebSocket.
        Event format: { "type": "tab_switch"|"paste"|"window_blur"|..., "data": {...} }
        """
        if not event:
            return
        event["_ts"] = time.time()
        self._events.append(event)

        etype = event.get("type", "")

        if etype == "tab_switch":
            self._tab_switches += 1
            logger.info("[BehaviorAgent] Tab switch detected")

        elif etype == "window_blur":
            self._window_blurs += 1

        elif etype == "paste":
            self._paste_events += 1

        elif etype == "keydown":
            self._last_keystroke_ts = event["_ts"]
            char_count = event.get("data", {}).get("chars", 1)
            self._chars_in_window.append((event["_ts"], char_count))
            # Prune old entries (> 5 seconds ago)
            cutoff = event["_ts"] - 5.0
            self._chars_in_window = [(t, c) for t, c in self._chars_in_window if t > cutoff]

    def analyse(self) -> BehaviorResult:
        """
        Produce a BehaviorResult from accumulated events.
        Called every few seconds by the pipeline.
        """
        result = BehaviorResult(
            tab_switches=self._tab_switches,
            paste_events=self._paste_events,
            window_blurs=self._window_blurs,
        )

        # ── Tab switch ────────────────────────────────────────────────────────
        if self._tab_switches > 0:
            result.flags.append("tab_switch")
            result.score_delta += SCORE_TAB_SWITCH * min(self._tab_switches, 3)

        # ── Window blur ───────────────────────────────────────────────────────
        if self._window_blurs > 1:
            result.flags.append("window_blur")
            result.score_delta += SCORE_WINDOW_BLUR * min(self._window_blurs, 2)

        # ── Paste events ──────────────────────────────────────────────────────
        for event in list(self._events):
            if event.get("type") == "paste":
                chars = event.get("data", {}).get("chars", 0)
                if chars >= 50:
                    result.flags.append("paste_large")
                    result.score_delta += SCORE_PASTE_LARGE
                else:
                    result.flags.append("paste_small")
                    result.score_delta += SCORE_PASTE_SMALL

        # ── Idle → burst detection ─────────────────────────────────────────
        now = time.time()
        if self._last_keystroke_ts:
            idle_s = now - self._last_keystroke_ts
        else:
            idle_s = 0

        chars_5s = sum(c for _, c in self._chars_in_window)
        if idle_s > self.IDLE_THRESHOLD_S and chars_5s > self.BURST_CHARS_MIN:
            result.flags.append("idle_burst")
            result.score_delta += SCORE_IDLE_BURST
            logger.info(f"[BehaviorAgent] Idle-burst: {idle_s:.0f}s idle then {chars_5s} chars in 5s")

        # Reset per-cycle counters (don't double-count next frame)
        self._tab_switches   = 0
        self._window_blurs   = 0
        self._paste_events   = 0
        self._events.clear()

        return result
