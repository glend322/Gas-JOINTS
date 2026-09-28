/** Tipe bersama untuk seluruh fitur kiosk. Bentuk data mengikuti kontrak API di PRD-FE §3. */

export type Landmark = [x: number, y: number, z: number];

/** Satu frame hasil hand tracking. `hands` berisi 0–2 tangan, masing-masing 21 landmark. */
export type HandFrame = {
  t: number;
  hands: Landmark[][];
  /** Confidence deteksi tangan tertinggi di frame ini (0–1). */
  score: number;
};

export type Direction = 'sign_to_text' | 'speech_to_sign';
export type MatchAction = 'accepted' | 'confirmed' | 'escalated_to_jbi';

export type MatchResult = {
  phraseId: string | null;
  phraseText: string | null;
  confidence: number;
  action: MatchAction;
  /** Hanya untuk arah speech_to_sign. */
  videoUrl?: string | null;
};

export type LogEntry = {
  id: string;
  deviceId: string;
  direction: Direction;
  predictedPhraseId: string | null;
  confidence: number;
  resultedAction: MatchAction;
  createdAt: number;
  /** 'match' = dicatat endpoint match (BE), 'user' = aksi pengguna dikirim FE via /api/logs. */
  source: 'match' | 'user';
};

export type Speaker = 'pasien' | 'petugas';
export type Channel = 'isyarat' | 'suara' | 'ketik' | 'pilih-manual';

/** Riwayat percakapan sesi ini. Hanya di memori, hilang saat halaman dimuat ulang (PRD §17). */
export type ConversationItem = {
  id: string;
  from: Speaker | 'sistem';
  text: string;
  channel?: Channel;
  confidence?: number;
  at: number;
};

export type TabId = 'pasien' | 'petugas' | 'percakapan';

/** Alasan sebuah sisi beralih ke mode ketik/pilih manual (PRD-FE §8). */
export type FallbackReason = 'camera' | 'mic' | 'backend';
