import type { RefObject } from 'react';

/**
 * TODO (tim Modeling/FE capture): sambungkan MediaPipe Hands ke frameBus.
 *
 * Langkah yang disarankan:
 *   1. npm i @mediapipe/tasks-vision
 *   2. const vision = await FilesetResolver.forVisionTasks('<path wasm lokal / CDN>')
 *      const landmarker = await HandLandmarker.createFromOptions(vision, {
 *        baseOptions: { modelAssetPath: 'hand_landmarker.task', delegate: 'GPU' },
 *        runningMode: 'VIDEO', numHands: 2,
 *      })
 *   3. Loop requestAnimationFrame selama `enabled`:
 *        const r = landmarker.detectForVideo(video, now)
 *        const hands = r.landmarks.map(h => h.map(p => [p.x, p.y, p.z]))
 *        const score = Math.max(0, ...r.handedness.map(h => h[0]?.score ?? 0))
 *        frameBus.emit(hands.length ? { t: now, hands, score } : null, now)
 *      WAJIB tetap emit null saat tidak ada tangan agar stop "tangan hilang" terhitung.
 *   4. Cleanup: cancelAnimationFrame + landmarker.close() saat unmount.
 *
 * Selama belum diimplementasi, frame bisa disimulasikan lewat SimulatorPanel (?dev=1).
 */
export function useHandTracking(_video: RefObject<HTMLVideoElement | null>, _enabled: boolean) {
  return { ready: false, source: 'stub' as const };
}
