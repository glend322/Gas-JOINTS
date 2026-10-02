import label10 from './data/label_10.json';
import type { SkeletonClip } from './types';

/**
 * Daftar animasi kerangka yang sudah tersedia, dikunci dengan phraseId (sama dengan id label ML).
 * Untuk menambah kata baru:
 *   1. Jalankan `ml/scripts/export_skeleton.py --label <nomor>`.
 *   2. Salin JSON hasilnya ke folder data/ di sini.
 *   3. Import dan daftarkan di bawah.
 * Saat ini HANYA "Terima kasih" (label_10). Frasa lain tetap memakai placeholder.
 */
const CLIPS: Record<string, SkeletonClip> = {
  label_10: label10 as unknown as SkeletonClip,
};

export function getSkeletonClip(phraseId: string | null | undefined): SkeletonClip | null {
  return phraseId ? (CLIPS[phraseId] ?? null) : null;
}
