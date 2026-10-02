/** Format file JSON hasil `ml/scripts/export_skeleton.py`. Koordinat 0..1 dari gambar asli (belum di-mirror). */
export type Pt = [x: number, y: number];

export type SkeletonClip = {
  phraseId: string;
  text: string;
  clip: string;
  source: string;
  fps: number;
  durationMs: number;
  width: number;
  height: number;
  mirrored: boolean;
  /** Indeks MediaPipe Pose: [hidung, bahu kiri, bahu kanan, siku kiri, siku kanan, pergelangan kiri, pergelangan kanan] */
  posePoints: number[];
  frames: { t: number; pose: Pt[] | null; hands: { side: 'Left' | 'Right'; pts: Pt[] }[] }[];
};
