# Implementation Plan: Pipeline Long-Form YouTube 8–10 Menit (3-Harian)

> Status: siap eksekusi. Revisi matang dari draft Antigravity + self-reflection 10 gap.
> Bahasa: Indonesia. Repo: `abusyifanasrul-lang/FastAINews`, branch `master`.

## 0. Ringkasan Eksekutif

Bangun pipeline semi-otomatis video horizontal long-form 16:9, 8–10 menit, terbit tiap ~3 hari dari deep-dive berita AI 72 jam terakhir.

Pembagian peran:
- **GitHub Actions + LLM = Content Director**: kurasi 72 jam, naskah deep-dive 1300–1500 kata, storyboard beats ≤10 detik, notifikasi Telegram, publish YouTube via file Google Drive.
- **Owner (laptop lokal) = Producer**: voice clone per segmen (<1000 char), generate video AI 10 detik per beat `T2V_GENERATION`, rakit CapCut/Premiere, upload MP4 final ke GDrive, kirim `/publish_long <gdrive_url>` ke bot.
- **Tidak ada render video di CI.** CI hanya teks + JSON + gambar + publish. Tidak ada TTS / Remotion / ffmpeg render di workflow long. `ffmpeg`/`ffprobe` di runner hanya untuk validasi durasi file unduhan, bukan render.

Artefak per edisi `content/long/YYYY-MM-DD/` (commit paksa via `git add -f` karena `content/` di `.gitignore`):
- `script.md` — naskah bersih (tanpa marker iklan), siap baca.
- `storyboard.json` — data terstruktur beats.
- `STORYBOARD.md` — dokumen sutradara (tabel chapters, teks per segmen siap copy ke voice clone, label aksi visual).
- `images/srcN.*` — og:image berita sumber (refetch, bukan dari cache shorts).
- `meta.json` — tanggal, topic, status, estimasi durasi, daftar sumber.

## 1. Kondisi Repo Aktual (Terverifikasi)

| Item | Status | Lokasi |
|---|---|---|
| Tabel `long_contents` | SUDAH ADA, sesuai draft | `src/schema.sql:58-70` |
| `src/long/` | BELUM ADA | — |
| `scripts/*long*` | BELUM ADA | — |
| Workflow long | BELUM ADA | hanya `ainews.yml`, `ainews-publish.yml`, `telegram-poller.yml`, `keepalive.yml` |
| Worker `/publish_long` | BELUM ADA | `cloudflare-worker/src/index.ts` hanya `/run`, approve/skip/revisi |
| Command bot lokal/poller utk long | BELUM ADA | `src/telegram.ts`, `scripts/telegram-poller.ts` hanya shorts |
| `uploadYoutube` | ADA tapi `readFileSync` (OOM di >500 MB) | `src/publisher.ts:43` |
| Download Telegram ke Buffer | ADA, OOM untuk file besar | `scripts/publish-approved.ts:48`, `src/telegram.ts:170-172`, `scripts/telegram-poller.ts:89,98` |
| Riset RSS + `fetchOgImage` + `filterRecent` + `dedupe` | ADA, reusable | `src/research.ts`, `src/pipeline.ts:46-83` |
| Validator shorts `cleanAndValidateScript` | ADA, TIDAK reusable (tolak >2500 char) | `src/llm.ts:145-150` |
| Commit `content/` | Pola `git add -f` sudah terbukti | `ainews.yml:107` |
| Concurrency shorts | Grup `ainews-pipeline` | `ainews.yml:22-24` |

## 2. Hasil Self-Reflection: 10 Gap & Mitigasi

| # | Gap / Bug | Dampak | Mitigasi (wajib, sudah masuk desain §4–§8) |
|---|---|---|---|
| G1 | Validator shorts tolak naskah >2500 char | Pipeline long selalu gagal validasi | Validator long terpisah `validateLongScript`: batas 4000–12000 char, cek bahasa per paragraf |
| G2 | OOM `readFileSync` + `Buffer.from(arrayBuffer())` di 3 file | Heap pecah di video 500 MB–1,5 GB | `uploadYoutube` refactor ke resumable chunked 8 MB via `fs.createReadStream`; `publish-long.ts` download GDrive stream-ke-disk, larang fallback Telegram `file_id` |
| G3 | Gambar 3 hari lalu hilang di runner (ephemeral) | `images/` kosong | `curator.ts` refetch `og:image` saat kurasi, simpan `images/srcN.*`, commit `-f` |
| G4 | Chapters YouTube tidak muncul | Chapters hilang diam-diam | `validateChapters` strict: mulai `00:00`, ≥3 bab, monoton naik, jeda ≥10 dtk; chapters disuntik ke deskripsi saat upload |
| G5 | GDrive download gagal/private/folder | Runner gagal tanpa pesan jelas | `parseGdriveId` dukung 4 format file, tolak folder eksplisit, `gdown --fuzzy` + verifikasi `ffprobe` + pesan Telegram eksplisit |
| G6 | Mid-roll ditolak (<8 mnt) | Monetisasi gagal | Target naskah 8:30–9:30, `duration guard` estimasi ≥480 dtk + cek riil `ffprobe` pasca-download |
| G7 | Pelanggaran faceless/musik | Kebijakan / audiens | `negative_prompt` + `faceless:true` + `music:false` hardcoded di schema, bukan di prompt bebas |
| G8 | Marker `[MID-ROLL AD BREAK]` ikut terbaca voice | Narasi rusak | Marker di-strip dari teks beat saat split; posisi disimpan sebagai metadata chapter saja |
| G9 | Status `long_contents` tanpa state machine | Dispatch ganda = upload dobel | Transisi `DRAFT → READY_FOR_ASSETS → PUBLISHING → PUBLISHED / FAILED`; guard status + concurrency grup `ainews-long-*` terpisah |
| G10 | Timestamp chapters fiktif (asumsi kata) | Chapters drift menit di akhir | Estimasi durasi per beat via WPM_ID=130 kalibrasi + clamp; chapters final dihitung ulang dari estimasi kumulatif, bukan dari LLM mentah; catat sebagai estimasi (`ponytail`: upgrade ke durasi TTS riil per beat saat producer kirim durasi aktual) |

Keputusan sadar:
- Cron `0 19 */3 * *` jalan tgl 1,4,7,10… (bukan interval 72 jam strict). Diterima; guard tambahan: skip jika edisi `<3 hari` terakhir sudah `READY_FOR_ASSETS`/`PUBLISHED` (idempotensi tanggal).
- Tidak pakai Telegram `file_id` untuk long (limit bot 50 MB). Larangan eksplisit di `publish-long.ts`.
- Tidak tambah npm dep baru. `gdown` via `pip install gdown` di workflow publish saja.

## 3. Arsitektur & Alur Data

```
RSS (8 feed) → filterRecent(72h) → isAiRelevant → dedupe → pickDiverse(5-7)
  → fetchOgImage → images/srcN.*
  → LLM Stage-1 naskah 1300-1500 kata (+1 marker mid-roll)
  → strip marker → split beats ≤10 dtk / <1000 char
  → LLM Stage-2 storyboard per bab (visual per beat)
  → validateLongScript + validateChapters
  → tulis content/long/YYYY-MM-DD/{script.md,storyboard.json,STORYBOARD.md,meta.json}
  → DB long_contents READY_FOR_ASSETS → notif Telegram (tanpa video)
  → [manual laptop: voice clone + T2V 10 dtk + rakit + upload GDrive]
  → /publish_long <url> → ghDispatch ainews-long-publish.yml
  → gdown stream → ffprobe → guard ≥480 dtk → upload YT chunked + chapters
  → DB PUBLISHED + notif Telegram link youtu.be
```

## 4. Desain Modul

### 4.1 `src/long/curator.ts` (NEW)
Fungsi: `curateLongNews(hours=72): Promise<{items, images}>`.
- `fetchFeeds()` → `filterRecent(all, 72)` → filter `isAiRelevant` → `dedupe`.
- Widen bertingkat `[72, 96, 120]` bila <3 item (tiru `pipeline.ts:52-58`).
- `pickDiverse(items, 7)`: 1 per publisher dulu, sisa berurutan (copy pola `pipeline.ts:23-38`, tidak import agar modul long mandiri).
- Download gambar: `fetchOgImage(url, join(imgDir, 'src'+i))`, `imgDir = content/long/YYYY-MM-DD/images/`. Gagal = `null`, tidak fatal. Minimal 1 gambar atau warning Telegram.
- Return `{ date, items: top, images }`. Tidak sentuh DB (DB di runner script agar test murni).

### 4.2 `src/long/llm-long.ts` (NEW)
Reuse `chat()` dari `src/llm.ts`? Tidak — `chat` tidak diekspor. Solusi lazy: ekspor ulang `chat` + header OpenCode dari `llm.ts` (patch 1 baris `export`), lalu `llm-long.ts` import. Tanpa duplikat retry/rate-limit/session logic.
- `generateLongScript(items)`: Stage-1. System prompt: deep-dive Bahasa Indonesia baku-populer bertutur (Kita/Saya/Anda, tanpa gue/elu), 1300–1500 kata, struktur Hook → Konteks 72 jam → Deep-dive per topik (semua topik wajib disebut) → Analisis/prediksi → Peluang awam → CTA subscribe. Wajib 1 baris marker `[MID-ROLL AD BREAK: MM:SS]` di ~tengah. Judul baris pertama `JUDUL: <≤10 kata>`. `maxTokens` 4000. Retry 3x + `validateLongScript`.
- `generateLongStoryboard(scriptClean, items)`: Stage-2. Input naskah bersih (marker sudah strip, posisi disimpan). Pecah jadi beats di kode (bukan LLM): split kalimat, gabung hingga ≤25 kata DAN <1000 char DAN estimasi ≤10 dtk (WPM 130). Lalu LLM hanya klasifikasikan tiap beat → `{visual: STATIC_IMAGE_MOTION | T2V_GENERATION | I2V_ANIMATE_IMAGE, prompt?, srcImage?, sfx?}` + kelompokkan jadi ≥3 chapters dengan timestamp estimasi kumulatif. Output JSON saja. Retry parse 3x.
- Konstanta paten disuntik di kode, bukan diminta ke LLM: setiap beat T2V/I2V otomatis dapat `{faceless:true, negative_prompt: FACELESS_NEGATIVE, audio:{music:false, ambient_sfx:true}}`.

### 4.3 `src/long/storyboard.ts` (NEW)
- `splitBeats(scriptClean): Beat[]` — murni, testable. Estimasi detik per beat = `kata / 130 * 60`, clamp 3–10 dtk.
- `buildStoryboard(...) → {json, markdown}` — tulis `storyboard.json` (schema §5) + `STORYBOARD.md` (tabel chapters, per-beat: timestamp estimasi, teks <1000 char siap copy voice clone, label `[🎬 GENERATE AI VIDEO]` / `[🖼️ GUNAKAN GAMBAR]` / `[✨ ANIMASIKAN GAMBAR]`, prompt + negative prompt + sfx).
- `validateChapters(chapters)`: mulai 00:00, monoton naik, jeda ≥10 dtk, ≥3 bab. Throw eksplisit.

### 4.4 `src/long/validate.ts` (NEW)
- `validateLongScript(text)`: panjang 4000–12000 char; deteksi reasoning Inggris (reuse daftar `llm.ts:121-129` tapi hanya blok jika >2 indikator cocok — toleransi naskah panjang); cek bahasa Indonesia per paragraf (≥60% paragraf mengandung ≥2 kata hubung); tolak markdown fence / emoji massal.
- `stripMidroll(script) → {clean, atChar}`: ekstrak 1 marker, return posisi relatif (untuk chapter).
- `formatTimestamp(sec) → "MM:SS"`.

### 4.5 `scripts/full-long-pipeline.ts` (NEW, CLI runner kurasi)
Langkah: tentukan `date` (argumen `--date` atau hari ini) → idempotensi: jika `long_contents[date]` status final → exit 0 + log → `curateLongNews` → `generateLongScript` → `stripMidroll` → `splitBeats` → `generateLongStoryboard` → validasi → tulis 5 artefak → upsert DB `READY_FOR_ASSETS` → kirim notif Telegram (teks + path, tanpa video) → `sendAlert` saat gagal.
- Commit ke git dilakukan workflow, bukan script (pemisahan tugas).

### 4.6 `scripts/publish-long.ts` (NEW, CLI runner publish)
Args: `--date --gdrive-url`. Larangan: tidak ada fallback Telegram.
1. Guard status: row harus `READY_FOR_ASSETS` (atau `FAILED` retry eksplisit); set `PUBLISHING` + `gdrive_url` di awal (kunci anti-dobel).
2. `parseGdriveId(url)`: dukung `/file/d/ID/`, `open?id=ID`, `uc?id=ID`, `uc?export=download&id=ID`. Tolak `/folders/` dengan error jelas.
3. Download: `gdown --fuzzy "<url>" -O tmp.mp4` (subprocess, stdio inherit). Gagal → `FAILED` + Telegram.
4. Verifikasi: `ffprobe` format+durasi. Bukan video valid → `FAILED`. Durasi <480 → lanjut tapi flag `⚠️ <8 mnt, mid-roll berisiko` di notif.
5. Upload: `uploadYoutubeStreamed(tmpPath, title, description+chapters, 'public')` — fungsi baru di `publisher.ts` (§4.7).
6. Sukses: DB `youtube_id`, `duration_sec`, `PUBLISHED`; Telegram link. Gagal: `FAILED` + pesan error 300 char pertama.
7. Hapus file tmp di `finally`.

### 4.7 Patch `src/publisher.ts` (MODIFY, bukan duplikat)
- Tambah `uploadYoutubeStreamed(videoPath, title, desc, privacy)`: init resumable (stat size via `statSync`), PUT chunk 8 MB dengan header `Content-Range: bytes X-Y/T`, baca via `fs.openSync` + `readSync` per chunk (tanpa load penuh). Retry chunk 3x. Lalu set thumbnail opsional (reuse kode existing).
- `uploadYoutube` existing dipertahankan untuk shorts (kompatibel), tapi delegasikan inti resumable ke helper bersama agar tidak ada 2 implementasi init.
- `ponytail`: migrasi shorts ke streamed saat terbukti stabil 3x publish long sukses.

### 4.8 DB helper (MODIFY `src/db.ts`, tambah ~40 baris)
- `upsertLongContent({date, topicTitle, scriptText, storyboardPath, status})`, `getLongByDate(date)`, `setLongStatus(date, status, extra?)`. Migrasi otomatis tidak perlu (tabel sudah di `schema.sql`).

### 4.9 Telegram + Worker (MODIFY 3 file)
- `cloudflare-worker/src/index.ts`: branch `text.startsWith('/publish_long ')` → validasi owner → `parseGdriveId` ringan (regex ID) → `ghDispatch(REPO_PAT, REPO, 'ainews-long-publish.yml', {date, gdrive_url})` → reply `⏳ Publish long <date> diproses…`. URL tak valid → reply format yang benar. Tanpa `video_file_id`.
- `scripts/telegram-poller.ts`: handler sama untuk pesan `/publish_long` (poller adalah jalur aktif; worker webhook cadangan). Dispatch ke `ainews-long-publish.yml` via `ghDispatchLong`.
- `src/telegram.ts` (bot lokal, dev saja): `bot.command('publish_long')` → validasi 1 argumen URL → `triggerWorkflowLong` ke workflow long. Minimal, 20 baris.

### 4.10 Workflows (NEW 2 file)
- `ainews-long-curate.yml`: `on: schedule '0 19 */3 * *' + workflow_dispatch(date?)`. Steps: checkout, setup-node 20, `npm install --no-audit --no-fund`, install ffmpeg (`sudo apt-get install -y ffmpeg`), run `npx tsx scripts/full-long-pipeline.ts [--date]`, lalu `git add -f content/long/ content/ainews.db` + commit `[skip ci]` + push (tiru `ainews.yml:102-111`). Concurrency grup `ainews-long-curate`. Timeout 30 mnt. Secrets: LLM_*, BOT_TOKEN, OWNER_CHAT_ID.
- `ainews-long-publish.yml`: `on: workflow_dispatch {date (required), gdrive_url (required)}`. Steps: checkout, setup-node, npm install, `pip install gdown`, install ffmpeg, run `npx tsx scripts/publish-long.ts --date --gdrive-url`. Concurrency grup `ainews-long-publish` (terpisah dari shorts). Timeout 60 mnt (upload 1,5 GB). Secrets: YT_*, GOOGLE_*, BOT_TOKEN, OWNER_CHAT_ID. Tanpa Zernio (YouTube saja).
- `telegram-poller.yml`: tidak diubah (poller sudah generic; handler baru di dalam script).

## 5. Schema `storyboard.json`

```json
{
  "date": "2026-09-12",
  "title": "…",
  "chapters": [{ "title": "Intro", "startSec": 0 }],
  "beats": [{
    "i": 1, "chapter": "Intro", "startSec": 0, "estSec": 8.2,
    "text": "<1000 char, tanpa marker>",
    "visual": "T2V_GENERATION",
    "prompt": "cinematic sci-fi data center, Unreal Engine 5, …",
    "faceless": true,
    "negative_prompt": "human face, animal face, portrait, close up person, woman, man, eyes, character, character animation",
    "audio": { "music": false, "ambient_sfx": true, "audio_prompt": "realistic futuristic ambient room hum, clean foley, no background music" },
    "srcImage": null
  }],
  "midrollAtSec": 270,
  "estTotalSec": 540
}
```

## 6. State Machine `long_contents.status`

`DRAFT → READY_FOR_ASSETS → PUBLISHING → PUBLISHED` + `FAILED` (retry dari `FAILED` diizinkan; dari `PUBLISHING` ditolak kecuali force).
Setiap transisi update `updated_at=datetime('now')`.

## 7. Error Handling & Notifikasi

| Kasus | Perilaku |
|---|---|
| RSS sepi (<3 item hingga 120 jam) | `SKIPPED`-style: tulis `meta.json {skipped:true}`, DB `DRAFT` + Telegram info, exit 0 |
| LLM gagal 3x | `FAILED`, `sendAlert`, exit 1 (workflow merah, terlihat) |
| Gambar 0 terdownload | Lanjut + warning Telegram (producer pakai T2V semua) |
| GDrive folder/private | `FAILED` + Telegram `❌ URL folder/private, kirim link file (Anyone with link → Viewer)` |
| `ffprobe` bukan video | `FAILED` + Telegram |
| Durasi <480 dtk | Publish lanjut + flag ⚠️ mid-roll |
| Dispatch ganda saat `PUBLISHING` | Tolak + Telegram `⏳ sedang diproses` |
| YT quota / 401 `invalid_grant` | `FAILED` + pesan `re-auth: npx tsx scripts/auth-google.ts` (masalah known) |

## 8. Verification Plan

Otomatis:
1. `npm run build` (`tsc`) nol error.
2. Unit ad-hoc via `npx tsx`: `splitBeats` (25 kata → ≤10 dtk, <1000 char), `validateChapters` (tolak start ≠00:00, jeda <10 dtk, <3 bab), `parseGdriveId` (4 format ok, folder ditolak), `stripMidroll` (marker hilang dari teks, posisi tersimpan).
3. `publish-long.ts` diverifikasi mengandung `createReadStream`/`readSync` chunk dan TIDAK mengandung `readFileSync`/`arrayBuffer` untuk video.
Manual:
1. `npx tsx scripts/full-long-pipeline.ts --date=YYYY-MM-DD` lokal (butuh LLM env) → periksa `STORYBOARD.md` keterbacaan.
2. Kirim `/publish_long <url file kecil dulu>` → cek chapters muncul di YouTube + durasi tercatat di DB.

## 9. Urutan Eksekusi

1. Patch `src/llm.ts` (ekspor `chat`), `src/publisher.ts` (streamed upload), `src/db.ts` (helper long).
2. Buat `src/long/{curator,llm-long,storyboard,validate}.ts`.
3. Buat `scripts/full-long-pipeline.ts`, `scripts/publish-long.ts`.
4. Buat 2 workflow + patch worker + poller + telegram lokal.
5. `npm run build`, perbaiki tipe, uji unit ad-hoc.
6. Commit? Tidak — user commit manual (kebijakan: agen tidak push tanpa diminta).

## 10. Risiko Sisa (Diterima Sadar)

- Estimasi chapters tetap estimasi (WPM 130) hingga producer kirim durasi TTS riil. Upgrade path jelas (`ponytail` di kode).
- OAuth `invalid_grant` 7-harian (Testing mode) tetap butuh re-auth manual / publish app ke Production (di luar scope plan ini).
- Voice clone + T2V + rakit manual tetap di laptop —狙 sesuai permintaan (tanpa bebani CI/Git).
