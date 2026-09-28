/**
 * Guard rail auto-capture (PRD §9, PRD-FE §4.1).
 * WAJIB dikalibrasi di device asli sebelum demo. Pakai ?dev=1 untuk melihat nilai motion & timer secara live.
 */
export const CAPTURE = {
  handStableMs: 250, // debounce sebelum masuk RECORDING
  minRecordMs: 500, // di bawah ini = noise, buang, kembali IDLE
  maxRecordMs: 8000, // timeout paksa → tetap PROCESSING
  stillHoldMs: 1500, // rentang 1000–2000
  handLostMs: 500, // tangan hilang > ini = stop (toleransi flicker)
  motionWindowFrames: 10, // rata-rata perpindahan dari N frame terakhir
  motionThreshold: 0.008, // perpindahan landmark ternormalisasi per frame
  minHandConfidence: 0.6,
} as const;

export type CaptureConfig = { [K in keyof typeof CAPTURE]: number };
