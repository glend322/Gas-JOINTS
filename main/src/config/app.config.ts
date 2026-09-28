/** Konfigurasi umum kiosk. Nilai dari .env bila ada. */
export const APP = {
  deviceId: import.meta.env.VITE_DEVICE_ID || 'kiosk-demo-1',
  /** Kosong = pakai mock service. */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, ''),
  landingUrl: import.meta.env.VITE_LANDING_URL || '/',
  /** Request ke BE dianggap gagal setelah ini → mode fallback (PRD-FE §3). */
  requestTimeoutMs: 4000,
  /** Lama RESULT_ACCEPT / RESULT_UNKNOWN tampil sebelum kembali ke IDLE. RESULT_CONFIRM menunggu aksi. */
  resultHoldMs: 7000,
  /** Jeda setelah TTS selesai sebelum mic boleh aktif lagi (cegah feedback loop, PRD-FE §7). */
  ttsCooldownMs: 300,
  /** Durasi placeholder video isyarat saat video_url belum tersedia. */
  placeholderVideoMs: 3500,
  speechLang: 'id-ID',
} as const;
