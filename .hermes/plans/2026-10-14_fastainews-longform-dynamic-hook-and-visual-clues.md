# FastAINews Long-Form Dynamic Hook & Contextual Visual Engine Plan

> **For Hermes:** Use subagent-driven-development or step-by-step TDD execution to implement this plan task-by-task.

**Goal:** Mengubah video essay long-form FastAINews (`nash_future`) dari "slideshow gambar statis tanpa hook" menjadi video bernilai retensi tinggi dengan pembuka dinamis 5–8 detik bertenaga HyperFrames (*High-Stakes Hook Opener*), naskah bernilai nyata (*outcome-first contract*), serta antarmuka siaran kontekstual (*Contextual Anchor HUD & Kinetic Subtitles*) yang secara eksplisit menghubungkan latar visual dengan narasi.

**Architecture:**
1. **Dynamic Hook Opener Module (Detik 0–8 via HyperFrames)**: Mengembangkan generator intro kinetik HTML/CSS/GSAP HyperFrames berdurasi 6–8 detik (~180 frame @ 24fps) yang merender kartu sorotan 3 topik terpanas, tipografi kinetik bertenaga, dan efek suara *riser/whoosh*. Klip ini (`hook_opener.mp4`) dirender super-cepat (<20 detik di runner) lalu disematkan di awal video (`t=0`) sebelum naskah utama.
2. **Reverse Iceberg Script Hook Engine (`src/long/llm-long.ts`)**: Memperbarui instruksi naskah Stage-1 untuk melarang keras gaya bahasa sastrawi klise (*"telah menjadi saksi bisu..."*) dan memaksakan formula 3 tahap: (1) *The Provocation* (tensi/peristiwa radikal 72 jam), (2) *The Value Promise* (mengapa audiens harus rela menyimak 10 menit), dan (3) *The Roadmap Teaser* (3 hal krusial yang terungkap).
3. **Contextual Storyboard Enrichment (Stage-2 JSON)**: Menambahkan metadata visual pada setiap beat storyboard: `contextTitle` (entitas/topik), `keyMetric` (angka/fakta kuantitatif), dan `visualClue` (penjelasan 3–5 kata tentang hubungan metafora visual dengan esensi berita).
4. **Broadcast-Grade Contextual HUD Engine (`src/long/cinematic.ts`)**: Mengupgrade generator SubStation Alpha (`.ass`) dari sekadar badge sederhana 5 detik menjadi antarmuka siaran persisten:
   - *Top Navigation Breadcrumb*: Penanda posisi bab aktif `[ 02 / 07 ] NAMA BAB // FOKUS`.
   - *Contextual Anchor Box (Pojok Kiri Atas)*: Kotak transparan dengan border aksen yang menampilkan `contextTitle`, `keyMetric`, dan `visualClue`, sehingga audiens langsung paham mengapa gambar tertentu tampil di layar.
   - *Kinetic Subtitle Stream*: Subtitle aktif persisten dengan penyorotan kata kunci emas (`&H00F8BD38`) untuk menghilangkan kesan adegan mati (*dead visual space*).
5. **Assemble Pipeline Orchestration (`scripts/assemble-long.ts`)**: Mengintegrasikan pembuatan `hook_opener.mp4`, merangkai metadata kontekstual dari `storyboard.json` ke dalam `buildAssHud`, dan menggabungkan klip hook secara mulus di detik ke-0.
6. **Empirical Unit Testing & Remastering (`scripts/test-long-unit.ts`)**: Menjamin 100% test coverage terhadap hook validator, HUD generator baru, dan data schema storyboard.

**Tech Stack:** TypeScript, Node.js 20 ESM, HyperFrames CLI (`npx hyperframes`), FFmpeg (libx264, zoompan, xfade, libass), SubStation Alpha v4+, Google Gemini Direct API.

---

## 📋 Struktur Tahapan Eksekusi

```
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 1: Rekayasa Naskah & Storyboard Contextual Cues                   │
│ - Perbarui SYSTEM_PROMPT naskah Stage-1 (Formula Hook 3-Tahap)          │
│ - Tambahkan validator Hook di validate.ts                              │
│ - Perbarui Stage-2 Storyboard JSON: contextTitle, keyMetric, visualClue │
│ - Perbarui parseStoryboardJson & fallback Thematic Mapper              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ FASE 2: Modul HyperFrames Dynamic Hook Opener (00:00 - 00:08)          │
│ - Buat template HTML/CSS/GSAP HyperFrames: templates/long-hook/        │
│ - Tulis script perakit: scripts/render-hook.ts                         │
│ - Uji render lokal: validasi durasi (6-8s), resolusi 1080p, dan SFX   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ FASE 3: Upgrade Broadcast Cinematic HUD (cinematic.ts & assemble)      │
│ - Rombak buildAssHud: Top Breadcrumb, Context Anchor Pill, Subtitles   │
│ - Update getHudContent: ekstrak entitas, metrik angka, & visual clue   │
│ - Modifikasi scripts/assemble-long.ts: suntikkan hook_opener.mp4       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ FASE 4: Sinkronisasi Unit Test & Remastering Edisi Berjalan            │
│ - Tambahkan test #16, #17, #18 di scripts/test-long-unit.ts            │
│ - Jalankan npx tsx scripts/test-long-unit.ts                           │
│ - Remaster naskah & storyboard edisi 2026-10-13 / 2026-09-29          │
│ - Uji assemble dry-run                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Rincian Tugas (Bite-Sized Tasks)

### Task 1: Rekayasa Hook Naskah Stage-1 di `src/long/llm-long.ts` & `src/long/validate.ts`

**Objective:** Memaksa LLM menghasilkan hook bernilai tinggi (Provokasi -> Value Promise -> Roadmap 3 Topik) di 5–10 detik pertama, serta melarang pembuka klise sastrawi.

**Files:**
- Modify: `src/long/llm-long.ts:20-45` (SYSTEM prompt naskah)
- Modify: `src/long/validate.ts:40-80` (Validasi aturan hook pembuka)
- Test: `scripts/test-long-unit.ts`

**Step 1: Tulis unit test untuk validasi hook pembuka**
Di `scripts/test-long-unit.ts`, tambahkan test:
- Naskah yang dimulai dengan frasa terlarang (`telah menjadi saksi bisu`, `selamat datang`, `pada video kali ini`) harus ditolak.
- Naskah pembuka harus mengandung janji nilai untuk audiens (kata seperti `Anda`, `menit`, `membongkar`, `panduan`, `penting`).

**Step 2: Jalankan test untuk memverifikasi failure**
Run: `npx tsx scripts/test-long-unit.ts`
Expected: FAIL — fungsi validator hook belum diterapkan.

**Step 3: Implementasikan aturan hook di `llm-long.ts` & `validate.ts`**
- Perbarui prompt sistem naskah:
  ```typescript
  `ATURAN MUTLAK 10 DETIK PERTAMA (HOOK RETENSI TINGGI):
  - DILARANG membuka dengan kalimat klise: "telah menjadi saksi bisu", "selamat datang", "pada kesempatan kali ini", "perkembangan pesat".
  - WAJIB gunakan Formula Hook 3-Tahap:
    1. Kalimat 1 (Detik 0-4): The Provocation — Tembakkan kontradiksi atau peristiwa paling radikal/mengejutkan dari 72 jam ini.
    2. Kalimat 2 (Detik 4-8): The Value Contract — Jelaskan dengan tegas MENGAPA penonton harus meluangkan 10 menit waktu mereka (apa risiko jika tertinggal, apa keunggulan yang mereka dapatkan).
    3. Kalimat 3-4 (Detik 8-15): The Roadmap Teaser — Sebutkan 3 hal krusial yang akan dibongkar di video ini.`
  ```
- Tambahkan pengecekan `validateScriptHook(script)` di `validate.ts`.

**Step 4: Jalankan test untuk verifikasi pass**
Run: `npx tsx scripts/test-long-unit.ts`
Expected: PASS.

**Step 5: Commit perubahan**
```bash
git add src/long/llm-long.ts src/long/validate.ts scripts/test-long-unit.ts
git commit -m "feat(long): enforce 3-stage high-retention hook and ban legacy cliches"
```

---

### Task 2: Perkaya Storyboard Stage-2 dengan Contextual Cues (`contextTitle`, `keyMetric`, `visualClue`)

**Objective:** Menyediakan data penjelas konteks pada setiap beat agar audiens memahami alasan di balik background visual.

**Files:**
- Modify: `src/long/llm-long.ts:270-360` (SYSTEM_STORYBOARD, parseStoryboardJson, themedHintFor)
- Modify: `src/long/storyboard.ts:15-30` (Interface Beat & Chapter)
- Test: `scripts/test-long-unit.ts`

**Step 1: Perbarui interface `BeatHint` & `Beat`**
Tambahkan field:
```typescript
export interface BeatHint {
  visual: BeatVisual;
  prompt: string;
  sfx: string;
  srcImage?: string | null;
  contextTitle?: string;  // misal: "META // MUSE WONDER"
  keyMetric?: string;      // misal: "+28% Inference Speed" atau "Frontier Scale"
  visualClue?: string;     // misal: "Simulasi Arsitektur Model"
}
```

**Step 2: Perbarui instruksi JSON di `SYSTEM_STORYBOARD`**
Instruksikan model untuk mengembalikan format JSON yang diperkaya:
```json
[
  {
    "visual": "T2V_GENERATION",
    "scene": "clean isometric 3D illustration of...",
    "sfx": "subtle electronic hum",
    "srcImage": "",
    "contextTitle": "META // MUSE WONDER",
    "keyMetric": "Frontier Multimodal",
    "visualClue": "Simulasi Arsitektur Model"
  }
]
```

**Step 3: Update `parseStoryboardJson` dan Fallback Thematic Mapper**
- Pastikan parser mengekstrak ketiga field tersebut dengan nilai default yang aman jika LLM tidak menyediakannya.
- Di `themedHintFor`, berikan default semantik sesuai tema (misal tema chip -> `keyMetric: "Arsitektur 2nm"`, `visualClue: "Wafer Semikonduktor Emas"`).

**Step 4: Uji dan verifikasi dengan unit test**
Run: `npx tsx scripts/test-long-unit.ts`
Expected: PASS.

**Step 5: Commit perubahan**
```bash
git add src/long/llm-long.ts src/long/storyboard.ts scripts/test-long-unit.ts
git commit -m "feat(long): enrich storyboard with contextTitle, keyMetric, and visualClue"
```

---

### Task 3: Buat Modul HyperFrames Dynamic Hook Opener (`templates/long-hook/` & `scripts/render-hook.ts`)

**Objective:** Membangun intro video 6–8 detik berbasis HTML/GSAP/HyperFrames yang dinamis, berenergi tinggi, dan siap di-render di runner.

**Files:**
- Create: `templates/long-hook/index.html` (Komposisi HyperFrames 1920x1080)
- Create: `templates/long-hook/styles.css`
- Create: `scripts/render-hook.ts` (CLI wrapper untuk merender hook MP4)
- Test: Manual render test via `npx tsx scripts/render-hook.ts --date=2026-10-13 --dry-run`

**Step 1: Susun template HyperFrames `templates/long-hook/index.html`**
- Spesifikasi teknis:
  - Resolusi: 1920x1080 @ 24fps, durasi 7 detik (168 frames).
  - Background: Dark gradient `#090d16` dengan animated subtle mesh lines.
  - Headline Utama: `FAST AI NEWS  //  72-HOUR INTEL`.
  - 3 Staggered Teaser Cards:
    - Card 1: Topik 1 + Badge Kategori.
    - Card 2: Topik 2 + Badge Kategori.
    - Card 3: Topik 3 + Badge Kategori.
  - Value Ticker di bawah: *"7 Perubahan Krusial yang Mengubah Arah Industri Global"*.
  - Animasi: GSAP timelines dengan spring easing (`back.out(1.4)`), stagger 0.8s antar kartu.

**Step 2: Tulis script eksekutor `scripts/render-hook.ts`**
- Membaca `meta.json` atau `script.md` dari `content/long/[DATE]/`.
- Mengambil judul dan 3 topik teratas.
- Mengisi data variabel ke template atau menyusun `variables.json`.
- Memanggil `npx hyperframes render templates/long-hook --output content/long/[DATE]/hook_opener.mp4 --quality looks`.

**Step 3: Uji render lokal**
Run: `npx tsx scripts/render-hook.ts --date=2026-10-13`
Verifikasi output: File `hook_opener.mp4` tercipta, durasi ~7 detik, resolusi 1920x1080, ukuran ~2–4MB.

**Step 4: Commit modul hook**
```bash
git add templates/long-hook/ scripts/render-hook.ts
git commit -m "feat(long): implement HyperFrames dynamic hook opener template and renderer"
```

---

### Task 4: Upgrade Broadcast Contextual HUD di `src/long/cinematic.ts`

**Objective:** Merombak file `.ass` agar menampilkan Top Navigation Breadcrumb, Context Anchor Card (Pojok Kiri Atas), dan Subtitle Kinetik persisten.

**Files:**
- Modify: `src/long/cinematic.ts:1-82` (buildAssHud, getHudContent)
- Test: `scripts/test-long-unit.ts`

**Step 1: Rancang layout SSA/ASS Styles baru**
Definisikan style profesional:
```
Style: NavTop, Arial, 16, &H00A0B0C0, &H00000000, &H00000000, &HBF090D16, -1, 0, 0, 0, 100, 100, 1.5, 0, 3, 12, 0, 8, 80, 80, 28, 1
Style: AnchorEntity, Arial, 20, &H00F8FAFC, &H00000000, &H00000000, &HBF0D1117, -1, 0, 0, 0, 100, 100, 1, 0, 3, 14, 2, 7, 60, 60, 60, 1
Style: AnchorClue, Arial, 14, &H00F8BD38, &H00000000, &H00000000, &HBF0D1117, -1, 0, 0, 0, 100, 100, 1.2, 0, 3, 10, 0, 7, 60, 60, 95, 1
Style: KineticSub, Arial, 26, &H00FFFFFF, &H00000000, &H80000000, &H99000000, -1, 0, 0, 0, 100, 100, 0.5, 0, 1, 3, 4, 2, 100, 100, 70, 1
```

**Step 2: Perbarui fungsi `buildAssHud`**
Parameter menerima:
- `chapterIndex`, `totalChapters`, `chapterTitle`
- `contextTitle`, `keyMetric`, `visualClue`
- `displayDuration`
- `subtitles`: array baris subtitle beserta timestamp relatif di dalam segmen adegan.

**Step 3: Update `getHudContent`**
Ekstraksi pintar:
- Membaca `contextTitle`, `keyMetric`, dan `visualClue` langsung dari beat data jika tersedia.
- Fallback ke entity extractor reguler jika data beat kosong.

**Step 4: Uji dengan unit test**
Run: `npx tsx scripts/test-long-unit.ts`
Expected: PASS.

**Step 5: Commit perubahan**
```bash
git add src/long/cinematic.ts scripts/test-long-unit.ts
git commit -m "feat(long): broadcast-grade contextual ASS HUD with nav breadcrumb and anchor clues"
```

---

### Task 5: Integrasi Pipeline Perakitan Video di `scripts/assemble-long.ts`

**Objective:** Menyambungkan `hook_opener.mp4` di awal video dan menyuntikkan metadata kontekstual baru ke perenderan segmen FFmpeg.

**Files:**
- Modify: `scripts/assemble-long.ts:480-645`
- Test: Dry-run check

**Step 1: Suntikkan pembuatan hook opener otomatis**
Jika file `hook_opener.mp4` belum ada, jalankan renderer hook atau fallback intro yang mulus.
Tambahkan `hook_opener.mp4` ke urutan pertama daftar klip perakitan visual (`clips.txt`).

**Step 2: Teruskan field kontekstual beat ke `buildAssHud`**
Hubungkan data `beat.contextTitle`, `beat.keyMetric`, dan `beat.visualClue` dari `storyboard.json` ke perakitan file `.ass` per segmen.

**Step 3: Uji sinkronisasi audio dan chapter timestamp**
Pastikan penambahan klip hook di detik 0 memperhitungkan offset timestamp chapter YouTube (tambah durasi hook, misal +7 detik) agar timestamp di deskripsi video YouTube tetap 100% presisi dengan audio narasi.

**Step 4: Commit perubahan**
```bash
git add scripts/assemble-long.ts
git commit -m "feat(assemble): prepend HyperFrames hook opener and bind contextual beat cues"
```

---

### Task 6: Remastering Edisi Berjalan (`2026-10-13`) & Verifikasi Komprehensif

**Objective:** Menerapkan seluruh arsitektur baru ke edisi berjalan `2026-10-13` untuk membuktikan hasil nyata secara empiris.

**Files:**
- Modify: `content/long/2026-10-13/script.md` (Remaster pembuka dengan Formula Hook 3-Tahap)
- Modify: `content/long/2026-10-13/storyboard.json` & `STORYBOARD.md` (Suntikkan contextual clues)
- Modify: `content/long/2026-10-13/prompts.txt` & `narrations.txt`
- Execute: `npx tsx scripts/test-long-unit.ts`

**Step 1: Remaster pembuka naskah `content/long/2026-10-13/script.md`**
Ganti pembuka lama yang klise (*"saksi bisu pergeseran tektonik..."*) dengan hook retensi tinggi 10 detik pertama.

**Step 2: Perbarui storyboard & prompts**
Ganti prompt Beat 1 (yang sebelumnya padang pasir obsidian) menjadi set laboratorium server komputasi berkecepatan tinggi dengan telemetri monitor yang relevan.

**Step 3: Jalankan seluruh rangkaian test**
Run: `npx tsx scripts/test-long-unit.ts`
Expected: Seluruh 18 uji unit lolos tanpa error.

**Step 4: Commit hasil remastering**
```bash
git add content/long/2026-10-13/
git commit -m "chore(long): remaster 2026-10-13 with high-retention hook and contextual clues"
```

---

## 🎯 Kriteria Penerimaan (Acceptance Criteria)

1. **5 Detik Pertama (Hook Retensi)**:
   - Naskah langsung menembakkan disrupsi terbesar 72 jam terakhir dan janji nilai (*value promise*) dalam 10–15 kata pertama.
   - Video diawali dengan modul pembuka HyperFrames 6–8 detik dengan kartu teaser 3 berita utama dan kinetic typography.
2. **Keterkaitan Visual-Narasi (Contextual Clues)**:
   - Setiap adegan memiliki kotak penjelas (*Contextual Anchor Pill*) di pojok layar yang menyebutkan entitas, metrik kunci, dan alasan visual background tersebut ditampilkan.
   - Penonton tidak lagi merasa tersesat melihat gambar metaforik.
3. **Dinamisme Layar (Zero Dead Space)**:
   - Terdapat bar navigasi bab aktif di bagian atas layar (*Top Breadcrumb*).
   - Subtitle narasi aktif mengalir dengan penyorotan kata penting berwarna emas.
4. **Efisiensi Cloud Runner**:
   - Total waktu perakitan video 10 menit di GitHub Actions runner tetap berada di bawah 8 menit, jauh di bawah batas timeout CI 45 menit.
5. **Integritas CI**:
   - `npx tsx scripts/test-long-unit.ts` lolos 100%.
