# PRD — Modeling (Gesture & Semantic Matching Engine)
## Jembatan Komunikasi Dua Arah untuk Tuli di Layanan Publik

**Turunan dari:** PRD Induk (Final)
**Tim pemilik:** Modeling / AI
**Status:** Siap dikerjakan

---

## 1. Lingkup Tim Ini

Modeling bertanggung jawab atas **dua engine pencocokan** yang dipanggil BE sebagai fungsi/service:

1. **Matching isyarat → frasa** (sequence landmark → phrase_id + confidence)
2. **Matching semantik teks → frasa** (ucapan petugas → phrase_id + confidence)

Modeling juga bertanggung jawab atas **pipeline data referensi** (ekstraksi landmark dari video, penyimpanan representasi yang siap dibandingkan) dan **proses kalibrasi** threshold/parameter bersama tim produk sebelum demo.

Modeling **tidak** menentukan aturan bisnis threshold 85%/60% (itu ada di BE, lihat `PRD-BE.md` §6) — tugas Modeling hanya menghasilkan `confidence` yang **kalibrasinya masuk akal** (angka tinggi = benar-benar mirip, angka rendah = benar-benar beda), supaya threshold itu berfungsi seperti diharapkan.

---

## 2. Framing yang Wajib Dipegang (PRD Induk §16)

Sistem ini **bukan** penerjemah bahasa isyarat umum. Ini adalah **closed-vocabulary classifier**: sequence gesture dicocokkan ke daftar frasa Indonesia yang sudah ditentukan dan divalidasi sebelumnya (5–10 untuk demo, target 30–50 untuk versi produk). Semua desain algoritma di bawah ini dibangun di atas asumsi closed-vocabulary — **bukan** open-vocabulary sign language translation, yang memang belum ada solusi matang untuk itu.

Implikasi teknis: kita **tidak** membutuhkan dataset besar/deep learning training dari nol. Pendekatan berbasis perbandingan sequence ke sedikit referensi (few-shot by design) sudah cukup dan lebih realistis untuk timeline hackathon maupun MVP awal.

---

## 3. Pipeline Data Referensi (Isyarat)

### 3.1 Sumber Data
- Video rekaman asli BISINDO dari penanda tangan (signer) yang divalidasi.
- **Hackathon prototype:** 3 rekaman dari 1–2 penanda tangan, untuk 5–10 frasa.
- **Product MVP (paska-hackathon):** 3–5 rekaman dari beberapa penanda tangan berbeda, untuk 30–50 frasa.
- Wajib melibatkan komunitas Tuli/JBI BISINDO dalam perekaman & validasi (bukan hanya tim dengar yang merekam sendiri) — lihat PRD Induk §17.

### 3.2 Ekstraksi Landmark dari Video Referensi
1. Untuk tiap video di `sign_references`, jalankan MediaPipe Hands/Holistic (server-side, batch) untuk mengekstrak landmark per frame.
2. Simpan hasilnya ke kolom `sign_references.landmark_data` (format sama dengan yang dikirim FE real-time, lihat §4.1, supaya perbandingan apple-to-apple).
3. Proses ini dipicu oleh endpoint admin `POST /api/admin/phrases/{id}/references` (lihat `PRD-BE.md` §4.5) — Modeling menyediakan fungsi ekstraksinya, BE yang mengekspos endpoint-nya.
4. Video/landmark baru **tidak otomatis dipakai untuk matching** sampai `approved = true` — mencegah data referensi berkualitas rendah masuk tanpa review.

### 3.3 Preprocessing (wajib, di kedua sisi — referensi & input real-time)

Supaya perbandingan adil, sequence dari video referensi dan sequence dari kamera real-time harus melalui pipeline normalisasi yang **identik**:

1. **Normalisasi skala & posisi:** landmark dinormalisasi relatif terhadap ukuran tangan/posisi pergelangan, supaya jarak orang ke kamera & ukuran tangan tidak memengaruhi hasil.
2. **Resampling temporal:** sequence referensi dan input punya jumlah frame berbeda (kecepatan orang berisyarat bervariasi) — resample ke jumlah titik waktu yang seragam (atau gunakan DTW yang memang didesain untuk ini, lihat §4.2) sebelum dibandingkan.
3. **Penanganan 1 vs 2 tangan:** banyak isyarat BISINDO dua tangan sekaligus (alasan kenapa produk ini pakai auto-capture, bukan push-to-talk — PRD Induk §9). Pipeline harus eksplisit menangani kasus tangan hilang sesaat dari deteksi tanpa merusak keseluruhan sequence.

---

## 4. Engine 1 — Matching Isyarat

### 4.1 Interface (kontrak dengan BE, lihat `PRD-BE.md` §5.1)

```
matchSign(sequence: Landmark[][]) -> { phrase_id: str | None, confidence: float }
```

- Input: sequence landmark mentah dari FE (per frame, per titik tangan).
- Output: `phrase_id` dari kandidat referensi terdekat, dan `confidence` dalam rentang 0.0–1.0.
- Jika tidak ada satu pun referensi yang cukup dekat (di bawah ambang jarak minimal), kembalikan `confidence` rendah dengan `phrase_id` tetap diisi (kandidat terdekat) — **keputusan menolak/menerima ada di BE**, bukan di sini.

### 4.2 Algoritma

**Dynamic Time Warping (DTW)** atau **nearest-neighbor berbasis DTW distance**, dipilih karena:
- Tidak butuh dataset besar/training deep learning — cocok untuk kosakata kecil (5–50 frasa) dan timeline hackathon.
- Secara natural menangani variasi kecepatan berisyarat antar-orang (satu orang bisa berisyarat lebih cepat/lambat dari referensi, DTW tetap bisa mencocokkan).

**Langkah:**
1. Preprocessing sequence input (§3.3, normalisasi + resampling).
2. Hitung DTW distance antara sequence input dan **setiap** `sign_references.landmark_data` yang `approved = true`, untuk **semua** frasa di kosakata aktif.
3. Ambil jarak minimum. Untuk frasa dengan beberapa rekaman referensi, gunakan jarak **terkecil di antara semua rekaman referensi frasa itu** (bukan rata-rata — satu rekaman yang sangat mirip lebih informatif daripada rata-rata dengan rekaman yang kurang representatif).
4. Konversi distance → confidence score (0–1). Perlu fungsi konversi yang dikalibrasi (lihat §6) — **bukan** sekadar `1 - normalized_distance` tanpa validasi, karena skala distance DTW tidak otomatis linear terhadap "kemiripan yang dirasakan."

### 4.3 Kompleksitas & Performa
- Dengan kosakata kecil (5–50 frasa × 3–5 referensi), brute-force DTW ke semua referensi masih realistis untuk target latensi < 2.5 detik di sisi matching saja.
- Jika performa jadi masalah di 30–50 frasa: pertimbangkan pruning awal (filter kasar berdasarkan durasi sequence atau jumlah tangan terdeteksi) sebelum DTW penuh. **Tidak perlu dioptimasi di awal** — validasi dulu apakah benar-benar jadi bottleneck.

---

## 5. Engine 2 — Matching Semantik Teks

### 5.1 Interface (kontrak dengan BE, lihat `PRD-BE.md` §5.2)

```
matchText(utterance: str) -> { phrase_id: str | None, confidence: float }
```

### 5.2 Kenapa Semantic, Bukan String Matching

Ucapan petugas di dunia nyata sangat bervariasi meski maksudnya sama:
- *"Kapan jadwal kontrol berikutnya?"* (kalimat di database)
- *"Kontrolnya datang lagi kapan ya?"* (ucapan asli petugas)

String matching literal akan gagal untuk pasangan seperti ini. Solusi: **sentence embedding + cosine similarity**.

### 5.3 Algoritma

1. Hasil `SpeechRecognition` (teks mentah dari FE, sudah final bukan interim) diterima sebagai `utterance`.
2. Encode `utterance` menggunakan model **sentence-embedding Bahasa Indonesia yang ringan, pretrained** (tanpa training tambahan untuk hackathon-scale — pilih model yang sudah teruji untuk Bahasa Indonesia, evaluasi 2–3 kandidat model open-source sebelum memutuskan).
3. Encode juga seluruh `phrases.phrase_text` yang `active = true` (bisa di-precompute & cache, tidak perlu dihitung ulang tiap request — hanya recompute saat kosakata berubah).
4. Hitung cosine similarity antara embedding `utterance` dan tiap embedding frasa.
5. Ambil similarity tertinggi → itu jadi `confidence`, frasa terkait jadi `phrase_id`.

### 5.4 Catatan Implementasi
- **Cache embedding kosakata** di memori/DB (kolom tambahan atau in-memory store) — hitung ulang hanya ketika ada perubahan di tabel `phrases`. Ini penting untuk menjaga latensi.
- Similarity cosine secara umum sudah berada di rentang 0–1 untuk model embedding yang wajar, tapi tetap **validasi empiris** rentang skornya (lihat §6) — jangan asumsikan 0.85 di cosine similarity otomatis berarti "identik secara makna" tanpa dicek terhadap contoh nyata.

---

## 6. Kalibrasi Confidence (WAJIB sebelum hari-H, PRD Induk §9 & §20)

Confidence yang dihasilkan kedua engine **harus dikalibrasi terhadap frasa demo aktual**, bukan diasumsikan benar dari rumus mentah. Proses yang disarankan:

1. Kumpulkan set uji: setiap frasa demo diucapkan/diisyaratkan oleh beberapa orang berbeda (termasuk variasi kecepatan, sudut, gaya bicara).
2. Jalankan lewat engine, catat distribusi confidence untuk:
   - Kasus **benar** (isyarat/ucapan memang dimaksudkan sebagai frasa X, dan seharusnya cocok ke X).
   - Kasus **mirip tapi beda** (dua frasa dengan gestur/makna berdekatan — ini yang seharusnya jatuh ke rentang 60–84%).
   - Kasus **jelas beda/di luar kosakata** (seharusnya < 60%).
3. Sesuaikan fungsi konversi distance→confidence (§4.2) atau ambang similarity (§5.3) sampai distribusi di atas benar-benar terpisah dengan wajar di sekitar breakpoint 60% dan 85% yang dipakai BE.
4. **Ini bukan pekerjaan sekali jalan** — ulangi setiap kali kosakata demo berubah atau ada frasa baru yang gestur/kalimatnya berdekatan dengan frasa lain.

**Prinsip yang tidak boleh dilanggar:** confidence tinggi harus benar-benar berarti "mirip", bukan angka yang "kebetulan tinggi" karena skala konversi yang tidak tervalidasi. Salah kalibrasi di sini akan membuat threshold BE (85%/60%) kehilangan makna meski angkanya sendiri benar.

---

## 7. Evaluasi & Metrik (PRD Induk §21)

**Metodologi uji standar:**
```
5 frasa × 10 percobaan/frasa = 50 total percobaan
Recognition Accuracy = (jumlah prediksi benar / 50) × 100%
Target: ≥ 90%
```

Modeling bertanggung jawab menyediakan/menjalankan skrip evaluasi ini secara offline (bukan lewat FE), menggunakan set data uji yang direkam terpisah dari data referensi (hindari mengevaluasi model dengan data yang sama persis dipakai sebagai referensi — itu akan memberi akurasi yang menyesatkan/terlalu optimis).

**Metrik tambahan yang harus bisa dihitung dari hasil evaluasi:**
- **False prediction rate:** seberapa sering sistem memberi confidence ≥60% untuk frasa yang **salah** (bukan sekadar tidak yakin) — ini metrik keselamatan yang terpisah dari accuracy biasa, karena PRD Induk secara eksplisit menyatakan salah menerjemahkan lebih berbahaya daripada mengaku tidak yakin.
- **Escalation rate:** persentase percobaan yang jatuh ke `escalated_to_jbi` — dipakai bersama tim produk untuk menilai apakah sistem "terlalu sering menyerah" (kosakata/kalibrasi perlu diperbaiki) atau justru wajar untuk kasus ambigu.

---

## 8. Data & Pertimbangan Etis (kewajiban Modeling)

- **Satu dialek eksplisit:** MVP membatasi diri ke satu dialek BISINDO (mis. BISINDO Jakarta), dicatat di `phrases.language_variant`. Model/algoritma **tidak boleh diklaim** bekerja untuk dialek lain tanpa data referensi dan validasi ulang.
- **Consent rekaman referensi:** video penanda tangan yang dipakai sebagai data referensi harus melalui consent eksplisit sebelum diproses Modeling — ini prasyarat administratif di luar kode, tapi Modeling **tidak memproses** video yang belum ditandai `approved` di sistem.
- **Data pasien tidak disimpan:** sequence landmark real-time dari pasien hanya diproses in-memory untuk satu kali matching, tidak disimpan sebagai data training/evaluasi tanpa consent terpisah (selaras dengan `PRD-BE.md` §8).
- **Tidak overclaim:** dokumentasi model, README, maupun materi presentasi wajib memakai framing di §2 — sistem **mengenali** sejumlah frasa tervalidasi, bukan **menerjemahkan** BISINDO secara umum.

---

## 9. Di Luar Scope Modeling (MVP)

- Deep learning / training model dari nol (cukup pretrained embedding + DTW berbasis referensi).
- Dukungan multi-dialek sekaligus.
- Avatar animasi 3D generatif untuk arah teks→isyarat (tetap pakai video asli, bukan sintesis gerakan).
- Pipeline otomatis untuk submission komunitas (moderasi, deduplikasi gestur) — itu "produk kedua" terpisah, roadmap Fase 2 (PRD Induk §24).

---

## 10. Pertanyaan Terbuka untuk Tim Produk

- Model embedding Bahasa Indonesia mana yang dipakai — perlu dipilih & dibandingkan (misal 2–3 kandidat) sebelum implementasi §5.3 dimulai, karena kualitasnya langsung memengaruhi akurasi Alur B.
- Apakah evaluasi akurasi (§7) dilakukan oleh tim Modeling sendiri atau melibatkan penanda tangan/komunitas Tuli sebagai penguji independen? (Direkomendasikan yang kedua untuk validitas, selaras PRD Induk §17.)
- Berapa banyak variasi penanda tangan yang realistis dikumpulkan untuk hackathon vs yang ideal untuk MVP produk (30–50 frasa × beberapa signer) — ini akan menentukan berapa lama fase pengumpulan data referensi.
