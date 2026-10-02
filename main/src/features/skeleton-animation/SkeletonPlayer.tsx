import { useEffect, useMemo, useRef, useState } from 'react';
import { SKELETON } from './skeleton.config';
import { frameAt, P, processSkeleton, type HandState } from './processSkeleton';
import type { Pt, SkeletonClip } from './types';

/**
 * Pemutar animasi kerangka BISINDO dari rekaman asli (WL-BISINDO).
 * Ditampilkan TIDAK di-mirror, sama seperti di video aslinya: pasien melihat penanda isyarat
 * seperti orang yang berdiri di depannya.
 *
 * Catatan: animasi ini tetap berjalan walau "kurangi gerakan" aktif, karena gerakan
 * isyarat adalah isi informasinya, bukan dekorasi.
 */
const HAND_BONES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
const TIPS = new Set([4, 8, 12, 16, 20]);

type Props = {
  clip: SkeletonClip;
  /** Ganti angka ini untuk memutar ulang dari awal. */
  run?: number;
  onProgress?: (p: number) => void;
  onDone?: () => void;
  className?: string;
};

export function SkeletonPlayer({ clip, run = 0, onProgress, onDone, className }: Props) {
  const data = useMemo(() => processSkeleton(clip), [clip]);
  const [t, setT] = useState(0);
  const cb = useRef({ onProgress, onDone });
  cb.current = { onProgress, onDone };

  useEffect(() => {
    const total = SKELETON.holdStartMs + data.durationMs / SKELETON.speed + SKELETON.holdEndMs;
    const t0 = performance.now();
    let raf = 0;
    let done = false;
    const tick = (now: number) => {
      const elapsed = now - t0;
      const clipT = Math.min(data.durationMs, Math.max(0, (elapsed - SKELETON.holdStartMs) * SKELETON.speed));
      setT(clipT);
      cb.current.onProgress?.(Math.min(1, elapsed / total));
      if (elapsed >= total) {
        if (!done) cb.current.onDone?.();
        done = true;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    setT(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data, run]);

  const f = frameAt(data, t);
  const sw = data.shoulderW;
  const { x, y, w, h } = data.viewBox;
  const C = SKELETON.colors;
  const pose = f.pose;
  const bottom = y + h + sw;

  const shMid: Pt = [(pose[P.lSh][0] + pose[P.rSh][0]) / 2, (pose[P.lSh][1] + pose[P.rSh][1]) / 2];
  const torso = `M ${pose[P.rSh][0]} ${pose[P.rSh][1]} L ${pose[P.lSh][0]} ${pose[P.lSh][1]} L ${pose[P.lSh][0] + sw * 0.12} ${bottom} L ${pose[P.rSh][0] - sw * 0.12} ${bottom} Z`;

  // Lengan bawah disambung ke pergelangan tangan (lebih tepat dari pergelangan pose) bila tangan terlihat.
  const wrist = (slot: 0 | 1, poseIdx: number): Pt => {
    const hs = f.hands[slot];
    return hs && hs.alpha > 0.5 ? hs.pts[0] : pose[poseIdx];
  };
  const arm = (sh: number, el: number, wr: Pt) => `M ${pose[sh][0]} ${pose[sh][1]} L ${pose[el][0]} ${pose[el][1]} L ${wr[0]} ${wr[1]}`;

  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label={`Animasi isyarat BISINDO: ${clip.text}`}
    >
      {/* badan */}
      <path d={torso} fill={C.body} />
      <line x1={shMid[0]} y1={shMid[1]} x2={pose[P.nose][0]} y2={pose[P.nose][1]} stroke={C.body} strokeWidth={sw * 0.22} strokeLinecap="round" />
      <circle cx={pose[P.nose][0]} cy={pose[P.nose][1] - sw * 0.06} r={sw * 0.4} fill={C.body} />

      {/* lengan */}
      <g fill="none" stroke={C.arm} strokeWidth={sw * 0.13} strokeLinecap="round" strokeLinejoin="round">
        <path d={arm(P.lSh, P.lEl, wrist(0, P.lWr))} opacity={handAlpha(f.hands[0])} />
        <path d={arm(P.rSh, P.rEl, wrist(1, P.rWr))} opacity={handAlpha(f.hands[1])} />
      </g>

      {/* tangan */}
      {f.hands.map((hs, i) => (hs ? <Hand key={i} hand={hs} sw={sw} /> : null))}
    </svg>
  );
}

/** Lengan ikut redup bersama tangan yang istirahat, tapi tidak pernah hilang total. */
function handAlpha(h: HandState | null) {
  return 0.45 + 0.55 * (h?.alpha ?? SKELETON.restingAlpha);
}

function Hand({ hand, sw }: { hand: HandState; sw: number }) {
  const C = SKELETON.colors;
  const p = hand.pts;
  return (
    <g opacity={hand.alpha}>
      <g stroke={C.bone} strokeWidth={sw * 0.03} strokeLinecap="round">
        {HAND_BONES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={p[a][0]} y1={p[a][1]} x2={p[b][0]} y2={p[b][1]} />
        ))}
      </g>
      {p.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={sw * (TIPS.has(i) ? 0.03 : 0.022)} fill={TIPS.has(i) ? C.tip : C.joint} />
      ))}
    </g>
  );
}
