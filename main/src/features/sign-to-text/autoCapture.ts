import { CAPTURE, type CaptureConfig } from '@/config/capture.config';
import type { HandFrame, Landmark } from '@/types/kiosk';

/**
 * State machine auto-capture (PRD §9, PRD-FE §4.1) sebagai fungsi MURNI:
 *   stepCapture(state, frame | null, now) → { state, event? }
 * Tidak menyentuh DOM/kamera sehingga bisa di-unit-test dengan frame sintetis.
 *
 * IDLE ──tangan──▶ HAND_DETECTED ──stabil ≥ handStableMs──▶ RECORDING ──stop──▶ (event 'stop' | 'noise')
 *                      └─tangan hilang─▶ IDLE (event 'falseStart')
 * PROCESSING & RESULT dikelola useSignFlow, bukan di sini.
 */
export type CapturePhase = 'IDLE' | 'HAND_DETECTED' | 'RECORDING';
export type StopReason = 'still' | 'handLost' | 'timeout';

export type CaptureState = {
  phase: CapturePhase;
  detectedAt: number | null;
  recordStart: number | null;
  lastHandAt: number | null;
  stillSince: number | null;
  prevHands: Landmark[][] | null;
  motions: number[];
  frames: HandFrame[];
  avgMotion: number;
};

export type CaptureEvent =
  | { type: 'falseStart' }
  | { type: 'recordingStarted' }
  | { type: 'stop'; reason: StopReason; frames: HandFrame[]; durationMs: number }
  | { type: 'noise'; reason: StopReason; durationMs: number };

export const initialCapture = (): CaptureState => ({
  phase: 'IDLE',
  detectedAt: null,
  recordStart: null,
  lastHandAt: null,
  stillSince: null,
  prevHands: null,
  motions: [],
  frames: [],
  avgMotion: 0,
});

/** Rata-rata perpindahan euclidean landmark yang berpasangan antar dua frame. */
export function frameMotion(a: Landmark[][], b: Landmark[][]) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  let count = 0;
  for (let h = 0; h < n; h++) {
    const len = Math.min(a[h].length, b[h].length);
    for (let i = 0; i < len; i++) {
      const dx = a[h][i][0] - b[h][i][0];
      const dy = a[h][i][1] - b[h][i][1];
      sum += Math.hypot(dx, dy);
      count++;
    }
  }
  return count ? sum / count : 0;
}

function finish(s: CaptureState, reason: StopReason, now: number, cfg: CaptureConfig) {
  const end = reason === 'handLost' ? (s.lastHandAt ?? now) : now;
  const durationMs = end - (s.recordStart ?? end);
  const event: CaptureEvent =
    durationMs < cfg.minRecordMs ? { type: 'noise', reason, durationMs } : { type: 'stop', reason, frames: s.frames, durationMs };
  // Buffer dibuang dari state (privasi, PRD-FE §9).
  return { state: initialCapture(), event };
}

export function stepCapture(
  s: CaptureState,
  frame: HandFrame | null,
  now: number,
  cfg: CaptureConfig = CAPTURE,
): { state: CaptureState; event?: CaptureEvent } {
  const hasHand = !!frame && frame.hands.length > 0 && frame.score >= cfg.minHandConfidence;

  switch (s.phase) {
    case 'IDLE': {
      if (!hasHand) return { state: s };
      return { state: { ...initialCapture(), phase: 'HAND_DETECTED', detectedAt: now, lastHandAt: now, prevHands: frame!.hands } };
    }

    case 'HAND_DETECTED': {
      if (!hasHand) return { state: initialCapture(), event: { type: 'falseStart' } };
      if (now - (s.detectedAt ?? now) >= cfg.handStableMs) {
        return {
          state: { ...s, phase: 'RECORDING', recordStart: now, lastHandAt: now, frames: [frame!], prevHands: frame!.hands, motions: [] },
          event: { type: 'recordingStarted' },
        };
      }
      return { state: { ...s, lastHandAt: now, prevHands: frame!.hands } };
    }

    case 'RECORDING': {
      let next = s;
      if (hasHand) {
        const m = s.prevHands ? frameMotion(s.prevHands, frame!.hands) : 0;
        const motions = [...s.motions, m].slice(-cfg.motionWindowFrames);
        const avg = motions.reduce((a, b) => a + b, 0) / motions.length;
        const isStill = avg < cfg.motionThreshold;
        next = {
          ...s,
          lastHandAt: now,
          prevHands: frame!.hands,
          motions,
          avgMotion: avg,
          frames: [...s.frames, frame!],
          // Timer diam reset setiap gerakan melewati ambang → jeda alami tidak memutus rekaman.
          stillSince: isStill ? (s.stillSince ?? now) : null,
        };
      } else if (now - (s.lastHandAt ?? now) > cfg.handLostMs) {
        return finish(s, 'handLost', now, cfg);
      }

      if (now - (next.recordStart ?? now) >= cfg.maxRecordMs) return finish(next, 'timeout', now, cfg);
      if (next.stillSince !== null && now - next.stillSince >= cfg.stillHoldMs) return finish(next, 'still', now, cfg);
      return { state: next };
    }
  }
}

/** Angka untuk overlay debug kalibrasi (?dev=1). */
export function captureDebug(s: CaptureState, now: number) {
  return {
    phase: s.phase,
    avgMotion: s.avgMotion,
    stillMs: s.stillSince !== null ? now - s.stillSince : 0,
    lostMs: s.phase === 'RECORDING' && s.lastHandAt !== null ? Math.max(0, now - s.lastHandAt) : 0,
    durationMs: s.recordStart !== null ? now - s.recordStart : 0,
    frameCount: s.frames.length,
  };
}
export type CaptureDebug = ReturnType<typeof captureDebug>;
