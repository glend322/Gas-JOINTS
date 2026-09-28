/**
 * Kosakata demo (PRD §7). Ini data mock untuk FE. Sumber kebenaran nanti tabel `phrases` di Supabase.
 * - `speaker`: siapa yang biasanya menyampaikan frasa. Pasien → dicocokkan dari isyarat, petugas → dari suara.
 * - `keywords`: HANYA untuk mock matchText (pengganti embedding). BE asli memakai sentence embedding.
 * - `videoUrl`: diisi URL Supabase Storage. null = placeholder video.
 */
export type Category = 'Pendaftaran' | 'Keluhan' | 'Obat' | 'Administrasi' | 'Fallback';

export type Phrase = {
  id: string;
  text: string;
  category: Category;
  speaker: 'pasien' | 'petugas' | 'keduanya';
  keywords: string[];
  videoUrl: string | null;
};

export const PHRASES: Phrase[] = [
  // Pasien → petugas (isyarat)
  { id: 'p-berobat', text: 'Saya ingin berobat', category: 'Pendaftaran', speaker: 'pasien', keywords: ['ingin', 'berobat'], videoUrl: null },
  { id: 'p-janji', text: 'Saya punya janji', category: 'Pendaftaran', speaker: 'pasien', keywords: ['punya', 'janji'], videoUrl: null },
  { id: 'p-sakit-sini', text: 'Saya sakit di sini', category: 'Keluhan', speaker: 'pasien', keywords: ['sakit', 'sini'], videoUrl: null },
  { id: 'p-demam', text: 'Saya demam', category: 'Keluhan', speaker: 'pasien', keywords: ['demam', 'panas'], videoUrl: null },
  { id: 'p-pusing', text: 'Saya pusing', category: 'Keluhan', speaker: 'pasien', keywords: ['pusing'], videoUrl: null },
  { id: 'p-alergi', text: 'Saya alergi obat ini', category: 'Obat', speaker: 'pasien', keywords: ['alergi', 'obat'], videoUrl: null },
  { id: 'p-resep', text: 'Saya butuh resep', category: 'Obat', speaker: 'pasien', keywords: ['butuh', 'resep'], videoUrl: null },

  // Petugas → pasien (suara → video isyarat)
  { id: 's-berapa-hari', text: 'Sudah berapa hari?', category: 'Keluhan', speaker: 'petugas', keywords: ['sudah', 'berapa', 'hari', 'lama'], videoUrl: null },
  { id: 's-cara-minum', text: 'Obat diminum 3 kali sehari', category: 'Obat', speaker: 'petugas', keywords: ['obat', 'minum', 'kali', 'sehari'], videoUrl: null },
  { id: 's-kontrol', text: 'Kapan kontrol berikutnya?', category: 'Administrasi', speaker: 'keduanya', keywords: ['kontrol', 'kapan', 'lagi', 'berikutnya'], videoUrl: null },
  { id: 's-ruang-obat', text: 'Di mana ruang obat?', category: 'Administrasi', speaker: 'keduanya', keywords: ['mana', 'ruang', 'obat', 'apotek'], videoUrl: null },
  { id: 's-tunggu', text: 'Silakan tunggu dipanggil', category: 'Pendaftaran', speaker: 'petugas', keywords: ['tunggu', 'dipanggil', 'duduk', 'antre'], videoUrl: null },

  // Fallback (wajib ada)
  { id: 'f-tidak-mengerti', text: 'Saya tidak mengerti', category: 'Fallback', speaker: 'keduanya', keywords: ['tidak', 'mengerti', 'paham'], videoUrl: null },
  { id: 'f-ulangi', text: 'Tolong ulangi', category: 'Fallback', speaker: 'keduanya', keywords: ['tolong', 'ulangi', 'lagi'], videoUrl: null },
  { id: 'f-jbi', text: 'Panggil JBI', category: 'Fallback', speaker: 'keduanya', keywords: ['panggil', 'jbi', 'juru', 'bahasa'], videoUrl: null },
];

export const phraseById = (id: string | null) => PHRASES.find((p) => p.id === id) ?? null;

export const patientPhrases = PHRASES.filter((p) => p.speaker !== 'petugas' && p.id !== 'f-jbi');
export const officerPhrases = PHRASES.filter((p) => p.speaker !== 'pasien' && p.id !== 'f-jbi');
