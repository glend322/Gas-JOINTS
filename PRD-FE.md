# PRD — Frontend (Kiosk Client)
## Jembatan Komunikasi Dua Arah untuk Tuli di Layanan Publik

**Turunan dari:** PRD Induk (Final)
**Tim pemilik:** Frontend
**Status:** Siap dikerjakan

---

## 1. Lingkup Tim Ini

FE bertanggung jawab atas **satu aplikasi web** yang berjalan di kiosk (tablet/laptop, 1 device per konter, lihat §2) mencakup:

- Kamera & capture gesture (state machine auto-capture)
- Speech-to-text & text-to-speech di browser
- Tampilan hasil sesuai confidence (accept/confirm/unknown)
- Pemutar video isyarat
- Mode fallback ketik manual
- Semua animasi & indikator status

FE **tidak** mengerjakan: algoritma matching (itu tanggung jawab Modeling, diakses lewat API BE), penyimpanan data (BE + Supabase), dashboard admin/validator (di luar scope MVP teknis — lihat PRD Induk §19).

---

## 2. Konteks Perangkat (wajib dipahami sebelum desain interaksi)

- **1 device**, kamera & layar menghadap pasien, speaker & mic untuk petugas.
- Tidak ada login untuk pemakaian harian (pasien & petugas). Tidak ada session/room-code.
- Target browser: Chrome/Edge terbaru di tablet Android atau laptop dengan webcam, minimal resolusi kamera 720p.
- **Tidak ada tombol fisik** yang menandai "sistem sedang mendengarkan" → semua status wajib ditampilkan visual secara real-time.

---

## 3. Kontrak dengan Backend (WAJIB dibaca bersama `PRD-BE.md`)

FE memanggil BE lewat REST API berikut. FE **tidak pernah** memanggil model matching langsung — semua lewat BE.

### 3.1 `POST /api/match/sign`
Mengirim sequence landmark hasil auto-capture untuk dicocokkan.

**Request:**
```json
{
  "device_id": "string",
  "sequence": [
    { "t": 0, "landmarks": [[x, y, z], "...21 titik per tangan, 1-2 tangan"] }
  ],
  "duration_ms": 1830
}
```

**Response:**
```json
{
  "phrase_id": "string | null",
  "phrase_text": "string | null",
  "confidence": 0.92,
  "action": "accepted | confirmed | escalated_to_jbi"
}
```

### 3.2 `POST /api/match/text`
Mengirim hasil speech-to-text petugas untuk dicocokkan secara semantik.

**Request:**
```json
{ "device_id": "string", "utterance": "kontrolnya kapan lagi ya" }
```

**Response:** — sama bentuknya dengan 3.1, ditambah:
```json
{ "video_url": "string | null" }
```

### 3.3 `POST /api/logs`
FE mengirim log tambahan yang tidak otomatis tercatat oleh endpoint match (misalnya aksi user menekan Konfirmasi/Coba Lagi/Panggil JBI setelah hasil `confirmed` muncul).

```json
{
  "device_id": "string",
  "direction": "sign_to_text | speech_to_sign",
  "predicted_phrase_id": "string | null",
  "confidence": 0.72,
  "resulted_action": "accepted | confirmed | escalated_to_jbi"
}
```

**Kontrak latensi:** BE wajib merespons endpoint match dalam **< 2.5 detik** agar total (termasuk overhead FE) tetap di bawah target 3 detik (PRD Induk §18).

**Penanganan gagal:** jika request gagal / timeout > 4 detik, FE otomatis masuk **mode fallback ketik manual** untuk sisi yang gagal (lihat §8).

---

## 4. Fitur A — Isyarat ke Teks/Suara

### 4.1 State Machine Auto-Capture

```
IDLE → HAND_DETECTED → RECORDING → PROCESSING → RESULT_ACCEPT / RESULT_CONFIRM / RESULT_UNKNOWN → (IDLE)
```

| State | Kondisi masuk | Kondisi keluar |
|---|---|---|
| IDLE | default / reset | tangan terdeteksi (conf ≥ 0.6) → HAND_DETECTED |
| HAND_DETECTED | tangan baru terdeteksi | stabil ≥ 250ms → RECORDING; hilang lagi sebelum itu → IDLE (false start) |
| RECORDING | debounce lolos | diam ≥ 1–2 detik (rata-rata motion di bawah ambang, dihitung dari buffer beberapa frame) **atau** tangan hilang > 500ms **atau** durasi ≥ 8 detik → PROCESSING |
| PROCESSING | stop condition terpenuhi | jika durasi rekam < 0.5 detik → buang, kembali IDLE (noise); selain itu → kirim ke `POST /api/match/sign` |
| RESULT_* | response diterima | lihat §6 (confidence logic) |

**Guard rail (nilai default, harus dibaca dari config, bukan hardcoded — akan dikalibrasi ulang sebelum demo):**

| Parameter | Nilai awal |
|---|---|
| Debounce sebelum RECORDING | 250 ms |
| Durasi rekam minimum | 500 ms |
| Durasi rekam maksimum (timeout) | 8000 ms |
| Ambang diam sebelum stop | 1000–2000 ms |
| Toleransi tangan hilang sesaat (flicker) | 500 ms |

**Kapan pun** (di state apa pun): tombol **"Ulangi Isyarat"** mengembalikan ke IDLE dan membuang buffer landmark yang sedang direkam.

### 4.2 Indikator Visual Status (wajib, tidak opsional)

| State | Tampilan minimum |
|---|---|
| IDLE | ikon tangan netral + teks "Silakan mulai mengisyaratkan" |
| HAND_DETECTED / RECORDING | border kamera merah, **pulsa pelan** (siklus ≥ 1.2 detik — hindari kedip cepat karena risiko fotosensitif) + teks "Merekam…" |
| PROCESSING | spinner + teks "Memproses…" |
| RESULT_* | sesuai §6 |

Setiap status juga harus punya representasi teks (bukan hanya warna/ikon) dan region `aria-live="polite"` untuk pembaca layar — meski pengguna utama Tuli, petugas atau pendamping bisa terbantu, dan ini praktik aksesibilitas standar.

---

## 5. Fitur B — Suara/Teks ke Isyarat

- Petugas memicu dengan tombol "Bicara" (tekan sekali, bukan tekan-tahan) atau mengetik langsung.
- Selama `SpeechRecognition` aktif, tampilkan **transkrip interim** secara live agar petugas bisa mengoreksi sebelum dikirim.
- Setelah transkrip final → kirim ke `POST /api/match/text` → tampilkan hasil sesuai §6.
- Bila hasil diterima (accepted/confirmed setelah dikonfirmasi): putar `video_url` di panel layar yang menghadap pasien, dengan **teks frasa ditampilkan berdampingan** dengan video (bukan hanya video saja).
- Kontrol pemutaran: tombol **Ulangi** video wajib ada (pasien mungkin perlu melihat ulang).

---

## 6. Confidence & Tampilan Hasil (berlaku untuk Fitur A & B)

| Confidence | Label internal | Tampilan |
|---|---|---|
| ≥ 85% | `accepted` | Alur A: tampilkan teks + **TTS otomatis**. Alur B: langsung putar video. |
| 60–84% | `confirmed` | Tampilkan kartu: *"Kemungkinan maksud: [frasa] — Confidence: XX%"* + 3 tombol: **Konfirmasi / Coba Lagi / Panggil JBI**. TTS (Alur A) atau pemutaran video (Alur B) **baru berjalan setelah Konfirmasi ditekan**, tidak otomatis. |
| < 60% | `escalated_to_jbi` (otomatis) | Tampilkan *"Tidak ada frasa yang cocok"* + tombol utama **Panggil JBI**, dan **Coba Lagi**. |

Tombol **"Panggil JBI"** harus selalu terlihat & terjangkau dari state manapun di aplikasi (bukan hanya muncul saat unknown), diletakkan konsisten di posisi yang sama.

---

## 7. Arbitrase Dua Alur di Satu Device

Karena Alur A dan B berjalan di device yang sama secara independen, FE wajib menangani konflik berikut secara eksplisit:

1. **Cegah feedback loop audio:** saat TTS (hasil Alur A) sedang berbunyi, **nonaktifkan sementara** `SpeechRecognition` (Alur B) sampai TTS selesai + jeda ~300ms. Tanpa ini, mic bisa menangkap suara speaker sendiri.
2. Saat pasien sedang di state `RECORDING`, tombol "Bicara" petugas dinonaktifkan dengan **alasan yang ditampilkan sebagai teks** (bukan disabled tanpa penjelasan).
3. Saat `B_LISTENING` atau video isyarat sedang diputar, auto-capture kamera (Alur A) **di-pause** — tangan pasien yang lewat di depan kamera saat itu tidak boleh memicu rekaman baru.

---

## 8. Mode Fallback Ketik Manual (Skenario Uji 4)

Dipicu otomatis bila salah satu dari kondisi berikut terjadi:
- Izin kamera ditolak / video stream terputus
- Izin mic ditolak / `SpeechRecognition` tidak tersedia di browser
- Request ke BE gagal / timeout > 4 detik

**Perilaku:**
- Tampilkan notifikasi non-modal yang jelas menyatakan sisi mana yang beralih ke mode manual.
- Sisi yang gagal diganti input ketik (textarea untuk isyarat → deskripsi/pilihan frasa manual; input teks untuk ucapan petugas).
- Sisi yang masih berfungsi normal **tidak ikut terganggu**.
- Sediakan tombol "Coba aktifkan kamera/mic lagi" untuk kembali ke mode normal tanpa reload halaman.

---

## 9. Non-Functional Requirements (FE)

- **Latensi dirasakan:** dari akhir gestur/ucapan sampai hasil tampil, target < 3 detik total (termasuk network ke BE).
- **Aksesibilitas:** kontras warna memadai (WCAG AA minimum), teks dapat diperbesar tanpa merusak layout, setiap ikon disertai label teks, tidak ada informasi status yang hanya disampaikan lewat warna/suara saja.
- **Motion safety:** tidak ada elemen berkedip > 3x/detik. Hormati `prefers-reduced-motion` — ganti animasi gerak dengan transisi opacity/warna, tapi indikator status tetap wajib ada dalam bentuk apa pun.
- **Privasi tampilan:** tidak menampilkan/menyimpan rekaman video pasien di local storage/IndexedDB; buffer landmark dibuang dari memori setelah PROCESSING selesai.
- **Resilience:** kegagalan salah satu modul (kamera/mic/network) tidak boleh membuat seluruh aplikasi blank/crash — selalu ada fallback yang terlihat.

---

## 10. Skenario Uji (Acceptance Criteria)

Checklist ini harus bisa didemokan langsung dari UI (idealnya juga lewat panel simulator dev untuk kondisi yang sulit direproduksi manual):

1. **Normal** — isyarat jelas → confidence ≥85% → teks + suara langsung keluar.
2. **Ambigu** — confidence 60–84% → kartu konfirmasi tampil, tidak ada TTS/video otomatis sebelum user menekan Konfirmasi.
3. **Unknown** — confidence <60% → "tidak ada frasa yang cocok" + tombol Panggil JBI menonjol.
4. **Gangguan** — cabut izin kamera/mic atau matikan network → sistem otomatis pindah ke mode ketik, tanpa membuat sisi lain ikut gagal.
5. **False start** — tangan lewat sekilas (< 250ms stabil) → kembali ke IDLE tanpa pesan error, tanpa request ke BE.
6. **Jeda alami** — gestur dua bagian dengan jeda singkat (< ambang diam) → tidak berhenti prematur, tetap merekam sampai frasa selesai.

---

## 11. Di Luar Scope FE (MVP)

- Dashboard admin/validator institusi.
- Fitur submission kosakata komunitas (roadmap, §19 PRD Induk).
- Autentikasi apa pun untuk pasien/petugas (hanya admin, dan itu di luar scope kiosk FE ini).
- Dukungan multi-device/multi-sesi.

---

## 12. Pertanyaan Terbuka untuk Tim Produk

- Berapa lama `RESULT_ACCEPT`/`RESULT_UNKNOWN` bertahan di layar sebelum otomatis kembali ke IDLE?
- Apakah video isyarat perlu subtitle/teks berjalan tambahan selain teks frasa statis di samping?
- Bahasa UI selain Indonesia (untuk petugas non-penutur asli) — masuk scope MVP atau tidak?
