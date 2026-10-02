import { SKELETON } from './skeleton.config';
import type { Pt, SkeletonClip } from './types';

/**
 * Merapikan data mentah supaya animasinya halus dan benar:
 *  1. Koordinat 0..1 → piksel (rasio asli video tetap terjaga).
 *  2. Tangan kiri/kanan ditentukan dari pergelangan pose terdekat, BUKAN label "side"
 *     (label MediaPipe kadang tertukar, misalnya di t=433 dan t=567).
 *  3. Celah tangan hilang sesaat diisi interpolasi.
 *  4. Tangan yang istirahat di bawah dibuat transparan.
 *  5. Area tampilan (viewBox) dihitung dari gerakan supaya badan selalu terlihat utuh.
 */

// Posisi di array pose (lihat posePoints [0,11,12,13,14,15,16])
export const P = { nose: 0, lSh: 1, rSh: 2, lEl: 3, rEl: 4, lWr: 5, rWr: 6 } as const;

export type HandState = { pts: Pt[]; alpha: number };
/** slot 0 = tangan kiri penanda isyarat (dekat pergelangan pose 15), slot 1 = kanan (pose 16) */
export type Frame = { t: number; pose: Pt[]; hands: [HandState | null, HandState | null] };
export type ProcessedClip = {
  frames: Frame[];
  durationMs: number;
  shoulderW: number;
  viewBox: { x: number; y: number; w: number; h: number };
};

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a: number, b: number, w: number) => a + (b - a) * w;
const lerpPts = (a: Pt[], b: Pt[], w: number): Pt[] => a.map((p, i) => [lerp(p[0], b[i][0], w), lerp(p[1], b[i][1], w)]);

export function processSkeleton(clip: SkeletonClip): ProcessedClip {
  const W = clip.width;
  const H = clip.height;
  const px = (p: Pt): Pt => [p[0] * W, p[1] * H];

  // 1. pose ke piksel, isi frame tanpa pose dengan pose terdekat
  const poses: (Pt[] | null)[] = clip.frames.map((f) => (f.pose ? f.pose.map(px) : null));
  let lastPose = poses.find(Boolean) ?? Array.from({ length: 7 }, () => [W / 2, H / 2] as Pt);
  const pose = poses.map((p) => (p ? (lastPose = p) : lastPose));

  const shoulderWs = pose.map((p) => dist(p[P.lSh], p[P.rSh])).sort((a, b) => a - b);
  const shoulderW = shoulderWs[Math.floor(shoulderWs.length / 2)] || W * 0.15;

  // 2. tetapkan slot tangan dari pergelangan pose terdekat
  const slots: [Pt[] | null, Pt[] | null][] = clip.frames.map((f, i) => {
    const hs = f.hands.map((h) => h.pts.map(px));
    const lw = pose[i][P.lWr];
    const rw = pose[i][P.rWr];
    if (hs.length === 0) return [null, null];
    if (hs.length === 1) return dist(hs[0][0], lw) <= dist(hs[0][0], rw) ? [hs[0], null] : [null, hs[0]];
    const straight = dist(hs[0][0], lw) + dist(hs[1][0], rw);
    const swapped = dist(hs[1][0], lw) + dist(hs[0][0], rw);
    return straight <= swapped ? [hs[0], hs[1]] : [hs[1], hs[0]];
  });

  // 3. isi celah pendek per slot
  for (const s of [0, 1] as const) {
    let i = 0;
    while (i < slots.length) {
      if (slots[i][s]) {
        i++;
        continue;
      }
      let j = i;
      while (j < slots.length && !slots[j][s]) j++;
      const before = i - 1;
      const gap = j - i;
      if (before >= 0 && j < slots.length && gap <= SKELETON.maxGapFrames) {
        const a = slots[before][s]!;
        const b = slots[j][s]!;
        for (let k = i; k < j; k++) slots[k][s] = lerpPts(a, b, (k - before) / (j - before));
      }
      i = j;
    }
  }

  // 4. alpha: tangan istirahat dibuat transparan
  const frames: Frame[] = clip.frames.map((f, i) => {
    const sy = (pose[i][P.lSh][1] + pose[i][P.rSh][1]) / 2;
    const restLine = sy + SKELETON.restBelowShoulders * shoulderW;
    const hand = (pts: Pt[] | null): HandState | null =>
      pts ? { pts, alpha: pts[0][1] > restLine ? SKELETON.restingAlpha : 1 } : null;
    return { t: f.t, pose: pose[i], hands: [hand(slots[i][0]), hand(slots[i][1])] };
  });

  // 5. viewBox dari semua titik yang terlihat jelas + kepala, dibatasi tepi video
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (p: Pt) => {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  };
  for (const fr of frames) {
    fr.pose.forEach(add);
    add([fr.pose[P.nose][0], fr.pose[P.nose][1] - shoulderW * 0.6]); // puncak kepala
    for (const h of fr.hands) if (h && h.alpha === 1) h.pts.forEach(add);
  }
  const pad = SKELETON.paddingShoulders * shoulderW;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(W, maxX + pad);
  maxY = Math.min(H, maxY + pad * 0.5);

  return {
    frames,
    durationMs: clip.durationMs,
    shoulderW,
    viewBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
  };
}

/** Pose pada waktu t (ms), diinterpolasi di antara dua frame terdekat. */
export function frameAt(clip: ProcessedClip, t: number): Frame {
  const fs = clip.frames;
  if (t <= fs[0].t) return fs[0];
  if (t >= fs[fs.length - 1].t) return fs[fs.length - 1];
  let i = 0;
  while (i < fs.length - 2 && fs[i + 1].t < t) i++;
  const a = fs[i];
  const b = fs[i + 1];
  const w = (t - a.t) / (b.t - a.t || 1);
  const hand = (ha: HandState | null, hb: HandState | null): HandState | null => {
    if (ha && hb) return { pts: lerpPts(ha.pts, hb.pts, w), alpha: lerp(ha.alpha, hb.alpha, w) };
    if (ha) return { pts: ha.pts, alpha: ha.alpha * (1 - w) }; // memudar keluar
    if (hb) return { pts: hb.pts, alpha: hb.alpha * w }; // memudar masuk
    return null;
  };
  return { t, pose: lerpPts(a.pose, b.pose, w), hands: [hand(a.hands[0], b.hands[0]), hand(a.hands[1], b.hands[1])] };
}
