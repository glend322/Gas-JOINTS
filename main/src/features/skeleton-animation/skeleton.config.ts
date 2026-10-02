/**
 * Pengaturan animasi kerangka. Ubah angka di sini, tidak perlu menyentuh komponen.
 */
export const SKELETON = {
  /** 1 = kecepatan asli video. 0.75 = sedikit lebih pelan agar lebih mudah diikuti. */
  speed: 1,
  /** Tahan pose awal sebelum bergerak (ms). */
  holdStartMs: 400,
  /** Tahan pose akhir setelah selesai (ms). */
  holdEndMs: 700,
  /** Celah deteksi tangan sampai sekian frame diisi interpolasi agar tidak berkedip. */
  maxGapFrames: 8,
  /** Tangan dianggap "istirahat" bila pergelangan lebih dari N lebar bahu di bawah garis bahu (aturan ML). */
  restBelowShoulders: 1.35,
  /** Opasitas tangan yang sedang istirahat (0 = disembunyikan). */
  restingAlpha: 0.28,
  /** Jarak tepi tampilan di sekitar badan, dalam satuan lebar bahu. */
  paddingShoulders: 0.45,
  colors: {
    body: '#3C3489',
    arm: '#7F77DD',
    bone: '#CECBF6',
    joint: '#FFFFFF',
    tip: '#AFA9EC',
  },
} as const;
