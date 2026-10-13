# FastAINews Long-Form Visual Anti-Dejavu & Style Diversification Plan

> **For Hermes:** Subagent-driven or step-by-step TDD execution plan to eliminate visual repetition (*anti-dejavu*) in FastAINews (`nash_future`) long-form videos, implement the multi-style bible, harmonize faceless constraints with functional UI/text, and update both the codebase engine and current running batch (`2026-09-29`).

**Goal:** Mengganti generator visual long-form yang monoton (sebelumnya terkunci 100% pada gaya seragam Unreal Engine 5 gelap / neon) dengan sistem rotasi gaya tematik (*Dynamic Style Bible*: 35mm film still, makro industri, isometrik 3D, layered paper-cut, fotografi produk), membuang abstraksi non-visual, mengizinkan teks/elemen UI fungsional pada mockup perangkat, mempertahankan aturan mutlak *faceless* melalui arsitektur framing, serta meremaster 48 prompt pada edisi `2026-09-29`.

**Architecture:**
1. **Dynamic Style Bible Engine**: Mengganti konstanta monolitik `STUDIO_TAGS` di `src/long/llm-long.ts` dengan 6 spektrum medium & palet visual berotasi per segmen topik (dokumenter 35mm, makro industri, isometrik 3D, paper-cut art, fotografi produk studio, dan sinematik berskala terbatas).
2. **Object-First Concrete Metaphors**: Mengeliminasi kata abstrak (*representing*, *symbolizing*) dan nama figur publik riil (Dario Amodei, Jensen Huang) menjadi set fisik nyata (podium kayu kosong, kursi kantor kosong, lab tray manik-manik, timbangan neraca).
3. **Harmonisasi Teks/UI Fungsional + Faceless**: Menghapus larangan kaku `no text` pada prompt positif agar mockup layar/chart/papan bursa tidak hampa, sembari mengunci larangan wajah lewat *compositional faceless* (rear-facing OTS, nose-down crop, mannequin hands, diorama jarak jauh) dan *negative prompt*.
4. **Resilient CI & Unit Test Decoupling**: Menghapus assert kaku `Unreal Engine 5` di `scripts/test-long-unit.ts` dan menggantinya dengan verifikasi keanekaragaman gaya dan integritas *faceless*.

**Tech Stack:** TypeScript, Node.js, FastAINews Long Pipeline (LLM Stage-2 Storyboard, Edge TTS, Remotion / FFmpeg Ken Burns, SQLite).

---

## 📋 Struktur Tahapan Eksekusi

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 1: Refactoring Engine Storyboard (llm-long.ts)         │
│ - Hapus hardcoded STUDIO_TAGS monolitik                     │
│ - Implementasikan 6 Style Presets (Style Bible)             │
│ - Perbarui THEMES (Thematic Visual Mapper Fallback)          │
│ - Perbarui SYSTEM_STORYBOARD & parseStoryboardJson          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ FASE 2: Sinkronisasi Unit Test & CI Guard (test-long-unit.ts) │
│ - Hapus ketergantungan assertion kaku "Unreal Engine 5"    │
│ - Tambahkan assertion Style Diversity & Faceless Negative   │
│ - Eksekusi npm test / npx tsx scripts/test-long-unit.ts      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ FASE 3: Remastering Edisi Berjalan (2026-09-29)              │
│ - Polishing 48 Prompt dari tmp-run21/contoh.md              │
│ - Suntik elemen UI & teks kontekstual (e-commerce, chart)   │
│ - Timpa prompts.txt & perbarui storyboard.json               │
│ - Validasi keselarasan narrations.txt & paragraphs.txt      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ FASE 4: Verifikasi Pipeline Empiris & Dokumentasi           │
│ - Dry-run eksekusi Stage-2 storyboard unit                  │
│ - Update STORYBOARD-LLM-REPORT.md                           │
│ - Laporan akhir ke Owner (Nasrul Jihadi)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Rincian Tugas (Bite-Sized Tasks)

### Task 1: Refaktor Engine Storyboard & Style Bible di `src/long/llm-long.ts`

**Objective:** Menghapus suffix kaku `STUDIO_TAGS` dan menggantinya dengan sistem 6 varian medium visual, meremajakan prompt fallback `THEMES`, mengizinkan teks/elemen antarmuka fungsional, dan memperbarui instruksi `SYSTEM_STORYBOARD`.

**Files:**
- Modify: `src/long/llm-long.ts:10-150` (Konstanta negatif & THEMES), `212-313` (SYSTEM_STORYBOARD & parseStoryboardJson)

**Step 1: Definisikan Style Spectrum & Negasi Faceless yang Tepat**
Perbarui `FACELESS_NEGATIVE`:
```typescript
export const FACELESS_NEGATIVE =
  "human face, eyes, portrait, readable facial features, smiling, looking at camera, character model, distorted face, unreadable blurry text, intrusive watermark, copyright signature";
```
Ganti `STUDIO_TAGS` monolitik dengan Style Bible tags atau hilangkan suffix global agar LLM menyusun deskripsi mandiri dengan format:
`[Subjek konkret + aksi], [latar/lokasi], [sudut kamera + lensa], [pencahayaan], [palet warna], [medium/gaya]`

**Step 2: Perbarui `THEMES` (Thematic Visual Mapper Fallback)**
Bongkar 7 tema deterministik agar tidak semuanya berakhir dengan "Unreal Engine 5 render, 8k, faceless, no people, no text". Gunakan medium yang bervariasi:
- **Chip / GPU / Hardware**: `macro photograph of microchip wafer, microscopic gold circuits, shallow depth of field, 100mm macro lens, warm tungsten light, amber and slate tones`
- **Data Center / Infrastruktur**: `wide shot of quiet high-density server corridor, humming server racks with cool white status LEDs, symmetrical center frame, 35mm film still, muted blue and cool gray`
- **Model / LLM / Alur Kerja**: `clean isometric 3D illustration of interconnected geometric processing nodes, flat colors, soft shadows, light gray background, mint and coral palette`
- **Robot / Otomasi**: `close-up of robotic manipulator arm assembling mechanical components on a clean lab workbench, soft natural daylight, 50mm lens, brushed metal and neutral tones`
- **Keamanan / Regulasi / Kebijakan**: `empty mahogany conference room with polished table, microphone on podium, soft morning window light, 35mm film still, muted amber and gray tones, film grain`
- **Sains / Molekul**: `macro photograph of crystal formations and glass lab vials on dark stone surface, side lighting, 85mm lens, bokeh, teal and copper tones`
- **Pasar / Keuangan / E-Commerce**: `overhead flat lay of clean tablet showing sales bar charts and receipt cards, surrounded by paper parcels, soft daylight, pastel peach and sky blue palette, clean product photography`
- **Default**: `35mm film still of a modern quiet technology office desk with screens and notebooks, natural soft light, warm neutral tones, shallow depth of field`

**Step 3: Perbarui `SYSTEM_STORYBOARD`**
Ubah prompt sistem LLM Stage-2 untuk melarang kata abstrak dan menginstruksikan rotasi gaya:
- Rule 1: Visual konkret 15–30 kata mencakup [Subjek konkret] + [Kamera/Lensa] + [Pencahayaan & Palet] + [Medium/Gaya].
- Rule 2: Rotasi medium per segmen (Editorial 35mm film still, Makro, Isometrik 3D, Paper-cut art, Fotografi produk). Batasi gaya sinematik gelap maksimal 15%.
- Rule 3: Larang kata abstrak (*representing, symbolizing*). Larang nama orang nyata (ganti dengan set fisik seperti podium kosong, kursi kosong, layar TV).
- Rule 4: Izinkan elemen teks/grafis antarmuka sederhana (ikon keranjang, chart bar, label angka, bubble chat) untuk kejelasan konteks.
- Rule 5: Faceless ketat secara arsitektur (rear-facing OTS, nose-down crop, wooden mannequin hand, empty set, jarak jauh/bird's-eye).

**Step 4: Update `parseStoryboardJson`**
- Hapus appending `STUDIO_TAGS` otomatis.
- Pastikan scene deskripsi dari LLM tetap bersih dan tidak lagi disisipi paksa `Unreal Engine 5`.

---

### Task 2: Update Unit Test di `scripts/test-long-unit.ts`

**Objective:** Menyesuaikan pengujian unit test #5 dan #7 agar tidak lagi memaksakan string `Unreal Engine 5` dan `no text`, melainkan menguji keanekaragaman gaya dan jaminan faceless yang benar.

**Files:**
- Modify: `scripts/test-long-unit.ts:63-86` (Test #5 Thematic Visual Mapper), `103-122` (Test #7 parseStoryboardJson)

**Step 1: Modifikasi Test #5 (Thematic Visual Mapper)**
- Ubah pengecekan `assert(h.prompt.includes("Unreal Engine 5"))` menjadi pemeriksaan bahwa prompt murni bahasa Inggris, tidak kosong, tidak mengandung kata Indonesia, dan memiliki SFX valid tanpa musik.
- Verifikasi bahwa prompt memiliki variasi medium (mengandung kata kunci seperti `macro`, `35mm`, `isometric`, dsb).

**Step 2: Modifikasi Test #7 (parseStoryboardJson)**
- Hapus verifikasi lama yang mencari string `faceless, no people, no text` di dalam prompt.
- Ganti dengan verifikasi bahwa `negative_prompt` memuat aturan faceless dan prompt visual bersih tanpa kata Indonesia.

**Step 3: Uji dan Jalankan Test Suite**
Command:
```bash
npx tsx scripts/test-long-unit.ts
```
Expected output: Seluruh 7 tes lulus (pass) 100%.

---

### Task 3: Remaster 48 Prompt Edisi Berjalan (`2026-09-29`)

**Objective:** Menerapkan 48 prompt baru yang telah dikurasi dari `tmp-run21/contoh.md`, menyempurnakan adegan e-commerce dan media dengan elemen grafis/UI kontekstual sesuai catatan Owner, lalu menyinkronkannya ke `prompts.txt` dan `storyboard.json`.

**Files:**
- Modify: `content/long/2026-09-29/prompts.txt`
- Modify: `content/long/2026-09-29/storyboard.json`

**Step 1: Audit & Penyempurnaan 48 Prompt dari `tmp-run21/contoh.md`**
Beri pengayaan pada beberapa prompt penting:
- **Beat 6 (E-commerce Flipkart/Gemini)**:
  `Overhead flat lay of a smartphone on a wooden desk displaying a clean shopping app card with a visible "$49" price tag, surrounded by pastel shipping boxes and coffee cup, soft daylight, peach and sky blue palette, clean product photography`
- **Beat 35 (E-commerce India)**:
  `Overhead flat lay of a smartphone screen showing an e-commerce catalog with neat item cards and clear "Buy" buttons, surrounded by colorful Indian textile fabric, brass bowl and tied parcel, soft studio lighting, product photography`
- **Beat 36 (LLM Checkout flow)**:
  `Isometric 3D illustration of an AI chat window showing structured product summary cards with neat price numbers, small conveyor belt sorting boxes beside it, soft shadows, sky blue and peach palette`
- **Beat 48 (Outro CTA)**:
  `Close-up of a modern studio desk with a microphone, ring light, a clean red circular button in sharp focus, and a brass bell mid-swing with subtle motion blur, 85mm lens, shallow depth of field, warm neutral and crimson tones`

**Step 2: Update `content/long/2026-09-29/prompts.txt`**
- Tulis ulang seluruh 48 baris prompt (1 baris per beat, persis 48 baris, self-contained).

**Step 3: Update `content/long/2026-09-29/storyboard.json`**
- Sinkronkan field `prompt` pada masing-masing 48 beat di dalam `storyboard.json` agar identik 1:1 dengan `prompts.txt`.
- Perbarui `negative_prompt` di setiap beat agar menggunakan `FACELESS_NEGATIVE` baru.

---

### Task 4: Verifikasi Integritas & Dokumentasi Teknis

**Objective:** Memastikan seluruh file dan pipeline tetap sinkron 1:1, tidak ada desinkronisasi jumlah baris atau durasi, dan mencatat perbaikan ke dalam dokumentasi teknis.

**Files:**
- Modify: `STORYBOARD-LLM-REPORT.md` (Catat Revisi 6: Anti-Dejavu & Style Bible Migration)

**Step 1: Verifikasi 1:1 Antar File di `content/long/2026-09-29/`**
- Pastikan jumlah baris `prompts.txt` == `narrations.txt` == jumlah beat di `storyboard.json` (tepat 48).
- Pastikan tidak ada karakter newline liar di dalam setiap prompt.

**Step 2: Catat Revisi pada Dokumen Teknis**
- Tambahkan ringkasan keputusan pada `STORYBOARD-LLM-REPORT.md` mengenai eliminasi `STUDIO_TAGS` dan pengadopsian *Dynamic Style Bible*.

---

## ⚠️ Mitigasi Risiko & Aturan Keamanan

1. **Aturan Faceless Owner Tidak Boleh Terkikis**:
   Meskipun `STUDIO_TAGS` dihapus dan teks fungsional diizinkan, gambar manusia tetap **mutlak faceless**. Prompt dilarang meminta wajah manusia tampak depan. Bila menampilkan manusia, wajib menggunakan framing OTS (tampak belakang), crop leher ke bawah (hanya tangan/bodi), atau siluet jauh.
2. **Resiliensi Fallback Tetap 100%**:
   Jika LLM Stage-2 mengalami kendala kuota atau time-out pada batch tertentu di cloud CI, fallback `THEMES` harus tetap berjalan mulus menghasilkan prompt yang bervariasi tanpa pernah menggagalkan pipeline.
3. **Kompatibilitas Batch Generator Eksternal**:
   Format `prompts.txt` wajib tetap 1 baris per beat tanpa numbering (`1.`), tanpa markdown, dan tanpa transcript narasi agar langsung siap dikonsumsi runner gambar (Imagen 3 / Google AI Studio / Midjourney / FLUX).

---

## 🎯 Deliverables Akhir

1. File implementasi `src/long/llm-long.ts` yang bebas dari suffix monolitik dan kaya akan variasi medium.
2. File pengujian `scripts/test-long-unit.ts` yang terverifikasi hijau (pass).
3. File produksi `content/long/2026-09-29/prompts.txt` dan `storyboard.json` berisi 48 prompt berkualitas tinggi yang bebas dari gambar mirip-mirip (*anti-dejavu*).
4. Dokumentasi teknis terbarukan di `STORYBOARD-LLM-REPORT.md`.
