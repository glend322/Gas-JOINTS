"""Live webcam demo: webcam -> MediaPipe -> auto-capture -> model -> text on screen.

Usage (from ml/):
    .venv\\Scripts\\python.exe scripts\\live_demo.py [--camera 0]
Keys: q = quit, r = reset to IDLE.

Frames are fed to MediaPipe un-mirrored (like the dataset); only the preview is mirrored.
"""
from __future__ import annotations

import argparse
import json
import time

import cv2
import numpy as np

from bisindo.config import load_config
from bisindo.extract import Extractor
from bisindo.predict import Predictor
from bisindo.schema import empty_arrays
from bisindo.visualize import draw


def raised_hands(a: dict, aspect: float, rest_y: float) -> np.ndarray:
    """Mask of detected hands in frame 0 that are not hanging at rest (same rule as features.rest_mask_y)."""
    m = a["hand_mask"][0].copy()
    if not a["pose_mask"][0]:
        return m
    ls, rs = a["pose"][0, 11], a["pose"][0, 12]
    width = abs(ls[0] - rs[0]) * aspect
    if width < 1e-3:
        return m
    shoulder_y = (ls[1] + rs[1]) / 2
    for j in range(2):
        if m[j] and (a["hands"][0, j, 0, 1] - shoulder_y) / width > rest_y:
            m[j] = False
    return m


class AutoCapture:
    """Auto-capture state machine (PRD §9): debounce, pre-roll, flicker grace, still / hand-lost / timeout stop."""

    def __init__(self, c: dict):
        self.c = c
        self.reset()

    def reset(self):
        self.state = "IDLE"
        self.t_detect = self.t_rec = self.t_lost = self.t_still = None
        self.buf: list[int] = []
        self.prev = None
        self.motion: list[float] = []

    def step(self, t: float, has_hand: bool, pts: np.ndarray | None, idx: int) -> str | None:
        """Returns 'process' or 'discard' when a recording ends."""
        c = self.c
        if self.state == "IDLE":
            if has_hand:
                self.state, self.t_detect, self.t_last_hand, self.buf = "HAND_DETECTED", t, t, [idx]
            return None
        if self.state == "HAND_DETECTED":
            if not has_hand:
                # tolerate a short detector flicker; a hand really gone = false start
                if t - self.t_last_hand > c.get("detect_grace_ms", 150):
                    self.reset()
                return None
            self.t_last_hand = t
            self.buf.append(idx)  # pre-roll: debounce frames belong to the sign
            if t - self.t_detect >= c["hand_stable_ms"]:
                self.state, self.t_rec = "RECORDING", t
            return None
        self.buf.append(idx)
        if has_hand:
            self.t_lost = None
            if self.prev is not None and pts is not None and self.prev.shape == pts.shape:
                self.motion.append(float(np.linalg.norm(pts - self.prev, axis=-1).mean()))
                self.motion = self.motion[-c["motion_window_frames"]:]
            self.prev = pts
            avg = np.mean(self.motion) if self.motion else 1.0
            if avg < c["motion_threshold"]:
                self.t_still = self.t_still or t
            else:
                self.t_still = None
        else:
            self.t_lost = self.t_lost or t
        dur = t - self.t_rec
        stop = (
            (self.t_still is not None and t - self.t_still >= c["still_hold_ms"])
            or (self.t_lost is not None and t - self.t_lost > c["hand_lost_ms"])
            or dur >= c["max_record_ms"]
        )
        if stop:
            # from the first detected hand; the hand-lost wait is not part of the gesture
            effective = (self.t_lost if self.t_lost is not None else t) - self.t_detect
            return "process" if effective >= c["min_record_ms"] else "discard"
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera", type=int, default=0)
    args = ap.parse_args()
    cfg = load_config()
    cap_cfg = cfg["capture"]
    predictor = Predictor()

    cam = cv2.VideoCapture(args.camera)
    ex = Extractor(cfg)
    ac = AutoCapture(cap_cfg)
    frames_a: list[dict] = []
    result, result_t = None, 0.0
    t0 = time.time()
    while True:
        ok, bgr = cam.read()
        if not ok:
            break
        h, w = bgr.shape[:2]
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        t_ms = int((time.time() - t0) * 1000)
        a = empty_arrays(1)
        ex.process_frame(rgb, t_ms, a, 0)
        a["t_ms"][0] = t_ms
        frames_a.append(a)
        active = raised_hands(a, w / h, cfg["features"]["rest_mask_y"])  # resting hands don't count
        has = bool(active.any())
        pts = a["hands"][0][active][..., :2].reshape(-1, 2) if has else None
        ev = ac.step(t_ms, has, pts, len(frames_a) - 1)
        if ev == "process":
            idx = ac.buf
            seq_a = {k: np.concatenate([frames_a[i][k] for i in idx]) for k in frames_a[0]}
            seq_a.update(width=np.int32(w), height=np.int32(h), mirrored=np.bool_(False))
            tq = time.time()
            result = predictor.predict_arrays(seq_a)
            result["latency_ms"] = int((time.time() - tq) * 1000)
            print(json.dumps({k: result.get(k) for k in ("phraseId", "confidence", "action", "latency_ms")}),
                  [(t["label"], t["confidence"]) for t in result["topK"]])
            result_t = time.time()
            ac.reset()
            frames_a = []
        elif ev == "discard":
            ac.reset()
            frames_a = []
        if ac.state == "IDLE" and len(frames_a) > 30:
            frames_a = frames_a[-1:]  # keep memory bounded; buffer is discarded between captures
            ac.buf = []

        view = cv2.flip(draw(rgb, a, 0), 1)
        color = (0, 0, 255) if ac.state == "RECORDING" else (200, 200, 200)
        if ac.state == "RECORDING":
            cv2.rectangle(view, (2, 2), (w - 3, h - 3), color, 6)
        cv2.putText(view, ac.state, (10, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
        if result and time.time() - result_t < cap_cfg["result_hold_ms"] / 1000:
            txt = f"{result['action'].upper()}: {result.get('label') or 'tidak dikenal'} ({result['confidence']:.0%})"
            cv2.putText(view, txt, (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 2)
        cv2.imshow("BISINDO live demo", view)
        k = cv2.waitKey(1) & 0xFF
        if k == ord("q"):
            break
        if k == ord("r"):
            ac.reset()
            frames_a = []
    ex.close()
    cam.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
