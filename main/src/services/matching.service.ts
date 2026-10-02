import { APP } from '@/config/app.config';
import { decideAction } from '@/config/confidence.config';
import { officerPhrases, patientPhrases, phraseById } from '@/data/phrases.mock';
import type { HandFrame, MatchResult } from '@/types/kiosk';
import { logsService } from './logs.service';

/**
 * Service matching. FE TIDAK memanggil model langsung, semua lewat BE (PRD-FE §3).
 * - VITE_API_BASE_URL kosong → mockMatchingService (bisa dikendalikan SimulatorPanel).
 * - VITE_API_BASE_URL terisi → httpMatchingService sesuai kontrak PRD-FE §3.1 & §3.2.
 */
export interface MatchingService {
  matchSign(sequence: HandFrame[], durationMs: number): Promise<MatchResult>;
  matchText(utterance: string): Promise<MatchResult>;
}

export class MatchingError extends Error {
  constructor(
    message: string,
    public kind: 'timeout' | 'network' | 'server',
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------- HTTP (asli)

type ApiMatchResponse = {
  phrase_id: string | null;
  phrase_text: string | null;
  confidence: number;
  action: MatchResult['action'];
  video_url?: string | null;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), APP.requestTimeoutMs);
  try {
    const res = await fetch(`${APP.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new MatchingError(`HTTP ${res.status}`, 'server');
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof MatchingError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') throw new MatchingError('Timeout', 'timeout');
    throw new MatchingError('Network error', 'network');
  } finally {
    clearTimeout(timer);
  }
}

const fromApi = (r: ApiMatchResponse): MatchResult => ({
  phraseId: r.phrase_id,
  phraseText: r.phrase_text,
  confidence: r.confidence,
  action: r.action,
  videoUrl: r.video_url ?? null,
});

export const httpMatchingService: MatchingService = {
  async matchSign(sequence, durationMs) {
    const t0 = sequence[0]?.t ?? 0;
    const r = await post<ApiMatchResponse>('/api/match/sign', {
      device_id: APP.deviceId,
      sequence: sequence.map((f) => ({ t: Math.round(f.t - t0), landmarks: f.hands.flat() })),
      duration_ms: Math.round(durationMs),
    });
    return fromApi(r);
  },
  async matchText(utterance) {
    const r = await post<ApiMatchResponse>('/api/match/text', { device_id: APP.deviceId, utterance });
    return fromApi(r);
  },
};

// ---------------------------------------------------------------- Mock

/** Diubah oleh SimulatorPanel (?dev=1). */
export const mockControls = {
  /** null = acak. Nilai 0–1 memaksa confidence. */
  forcedConfidence: null as number | null,
  /** null = acak 400–1200 ms. */
  delayMs: null as number | null,
  failBackend: false,
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () => mockControls.delayMs ?? 400 + Math.random() * 800;

function randomConfidence() {
  const r = Math.random();
  if (r < 0.6) return 0.86 + Math.random() * 0.1;
  if (r < 0.85) return 0.62 + Math.random() * 0.2;
  return 0.3 + Math.random() * 0.25;
}

async function simulateNetwork() {
  const d = randomDelay();
  if (mockControls.failBackend) {
    await wait(Math.min(d, APP.requestTimeoutMs));
    throw new MatchingError('Mock backend dimatikan', 'network');
  }
  if (d > APP.requestTimeoutMs) {
    await wait(APP.requestTimeoutMs);
    throw new MatchingError('Timeout', 'timeout');
  }
  await wait(d);
}

/** Pengganti embedding untuk mock: proporsi keyword frasa yang muncul di ucapan (cocok prefix). */
function keywordSimilarity(utterance: string, keywords: string[]) {
  const tokens = utterance.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  // startsWith: "obatnya" cocok "obat". endsWith: "makasih" cocok "kasih".
  const hit = keywords.filter((k) => tokens.some((t) => t.startsWith(k) || t.endsWith(k))).length;
  return hit / keywords.length;
}

function buildResult(phraseId: string | null, confidence: number, direction: 'sign_to_text' | 'speech_to_sign'): MatchResult {
  const action = decideAction(confidence);
  const phrase = action === 'escalated_to_jbi' ? null : phraseById(phraseId);
  const result: MatchResult = {
    phraseId: phrase?.id ?? null,
    phraseText: phrase?.text ?? null,
    confidence,
    action,
    videoUrl: direction === 'speech_to_sign' ? (phrase?.videoUrl ?? null) : undefined,
  };
  logsService.add({ direction, predictedPhraseId: phraseId, confidence, resultedAction: action, source: 'match' });
  return result;
}

export const mockMatchingService: MatchingService = {
  async matchSign() {
    await simulateNetwork();
    const pick = patientPhrases[Math.floor(Math.random() * patientPhrases.length)];
    return buildResult(pick.id, mockControls.forcedConfidence ?? randomConfidence(), 'sign_to_text');
  },
  async matchText(utterance) {
    await simulateNetwork();
    let best = officerPhrases[0];
    let bestScore = -1;
    for (const p of officerPhrases) {
      const s = keywordSimilarity(utterance, p.keywords);
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    const conf = mockControls.forcedConfidence ?? Math.min(0.97, 0.3 + 0.75 * bestScore);
    return buildResult(best.id, conf, 'speech_to_sign');
  },
};

export const matchingService: MatchingService = APP.apiBaseUrl ? httpMatchingService : mockMatchingService;
export const isMockBackend = !APP.apiBaseUrl;
