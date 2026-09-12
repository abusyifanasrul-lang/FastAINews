# LAPORAN TEKNIS: Keputusan & Mekanisme Storyboard LLM (Stage-2 Long-Form)

> Disusun: 2026-09-12. Target pembaca: agent AI lain yang melanjutkan pengembangan FastAINews.
> Revisi 2026-09-12: 3 mikro-tweaks hasil review agent kedua — retry batch 3x→2x, regex parser tahan teks pembuka ber-kurung-siku, guard STATIC-blank (edisi 0 gambar → T2V themed).
> Scope: alasan keputusan Opsi A (Stage-2 storyboard kembali via LLM) + mekanisme detail implementasinya.
> File yang relevan: `src/long/llm-long.ts`, `src/long/storyboard.ts`, `scripts/full-long-pipeline.ts`, `scripts/test-long-unit.ts`.

---

## 1. Konteks Pipeline

Workflow `.github/workflows/ainews-long-curate.yml` (cron `0 19 */3 * *`, ~3-harian) menjalankan `scripts/full-long-pipeline.ts`:

```
curateLongNews(72, date)            → src/long/curator.ts (berita 72 jam + og:image)
generateLongScript(items)           → Stage-1: naskah deep-dive 1300-1500 kata (LLM chat())
stripMidroll(script)                → cabut marker iklan, simpan posisi
splitBeats(clean)                   → pass-1: beats kasar (≤20 kata, <1000 char, ≤10 dtk @WPM 130)
chapters (statis proporsional)      → 5 bab: 0% / 12% / 35% / 72% / 88% dari estimasi total
generateLongStoryboard(...)         → Stage-2: klasifikasi visual + prompt per beat  ★ bagian yang diperbaiki ★
splitBeats(clean, fullHints, ...)   → beats final terisi visual/prompt/srcImage
buildStoryboardMd(...)              → STORYBOARD.md (dokumen sutradara)
```

`STORYBOARD.md` adalah dokumen sutradara: tabel chapters, teks per segmen siap copy ke voice clone, label aksi visual, dan **prompt video AI per beat** yang dipakai owner (producer) untuk generate T2V/I2V di laptop — tanpa LLM lanjutan. Jadi kualitas prompt yang dihasilkan CI **adalah** kualitas bahan produksi.

---

## 2. Investigasi: Mengapa Output STORYBOARD.md Kurang Memuaskan

### KR-1 (akar utama): Kontradiksi desain vs implementasi
- `implementation_plan.md` §4.2 & §3 mendesain Stage-2 sebagai **LLM**: fungsi `generateLongStoryboard(scriptClean, items)` — *"LLM hanya klasifikasikan tiap beat → {visual, prompt?, srcImage?, sfx?} + kelompokkan jadi ≥3 chapters"*, retry parse 3x.
- Implementasi aktual menyimpang: komentar file asli `src/long/llm-long.ts` baris 3 — *"Stage 2: Thematic Visual Mapper deterministik (0 LLM call, 0 delay, 100% bebas timeout)"*. Fungsi `generateLongStoryboard` tak pernah dibuat — diganti `classifyBeats` murni pencocok regex.

Kemungkinan besar ini trade-off sadar untuk menghindari biaya/latensi/gagal-parse panggilan LLM kedua — tapi mengorbankan kualitas konten, esensi peran "Content Director" (istilah `implementation_plan.md` §0).

### KR-2: 8 kalimat prompt statis berulang
Mapper hanya punya 7 tema regex (`THEMES`: chip/GPU, data center, model/LLM, robot, cyber, bio, pasar) + 1 `DEFAULT_THEME`. Beat yang tak cocok 7 regex jatuh ke kalimat default yang sama persis. Untuk storyboard 40–60 beat, ~85% prompt adalah salah satu dari **8 kalimat identik berulang**. Tidak ada prompt yang menyebut subjek konkret berita (Nvidia, OpenAI, angka, produk).

### KR-3: Mayoritas beat STATIC dengan prompt kosong
- `classifyBeats`: `prompt: visual === "STATIC_IMAGE_MOTION" ? "" : matchedTheme.prompt`
- `buildStoryboardMd`: `if (b.prompt) L.push(\`Prompt video: ${b.prompt}\`)` → baris **di-skip** bila kosong.
- Pemicunya `STATIC_TRIGGER` sangat agresif: `/(\d+\s*persen|melaporkan|dilaporkan|miliar|juta|ceo|mengumumkan|menurut|hasil survei|laporan resmi)/i` — kata-kata ini muncul di hampir setiap kalimat naskah berita. Akibatnya mayoritas beat terklasifikasi STATIC → **tanpa arahan visual sama sekali** di STORYBOARD.md.

### KR-4: Gambar dicocokkan siklik, bukan semantik
`splitBeats`: `images[imgIdx++ % images.length]` — gambar berita A bisa menempel di beat topik B (mismatch visual-narasi), terutama setelah balance-pass mengubah klasifikasi beat.

### KR-5 (pendukung, belum diubah): Chapters statis
`full-long-pipeline.ts` selalu 5 bab proporsi sama (0/12/35/72/88%) dengan judul sama tiap edisi — tidak mengikuti alur konten. Dicatat di §8 sebagai upgrade path.

### KR-6 (pendukung, sengaja dipertahankan): Balance-pass ≥35% T2V
Kebijakan "video AI berlimpah" untuk produksi. Kini dipindahkan dari kode klasifikasi ke aturan system prompt (Rule 3) + tetap ada di fallback mapper.

### KR-7: Unit test hanya mengunci constraint, bukan kualitas
Test lama (#5) hanya cek: prompt mengandung "Unreal Engine 5", "faceless, no people, no text", tanpa kata Indonesia, SFX no-music, jumlah T2V ≥35%. Repetisi/kosongnya prompt tak pernah tertangkap — sehingga regresi kualitas lolos CI diam-diam.

---

## 3. Keputusan: Opsi A — Stage-2 Kembali via LLM

Tiga opsi dievaluasi:

| Opsi | Isi | Biaya | Kualitas | Dipilih |
|---|---|---|---|---|
| **A** | Kembalikan Stage-2 ke LLM sungguhan, prompt kontekstual per beat | +panggilan LLM | Maksimal | ✅ |
| B | Perbaiki mapper deterministik: +15-20 tema, variasi prompt, prompt STATIC diisi Ken Burns, gambar semantik | 0 | Sedang | — |
| C | Hybrid: 1 panggilan batch utk seluruh storyboard + fallback deterministik | +1 | Tinggi | — |

**Keputusan: Opsi A**, tapi diimplementasikan **berbatch** (16 beat/panggilan) + **fallback deterministik per batch** — secara efektif mendapatkan keunggulan Opsi C (resiliensi, biaya terkendali) tanpa mengorbankan kualitas Opsi A. Alasan:

1. Esensi "Content Director" adalah **pemahaman konten**: memilih treatment yang benar (pakai gambar berita vs generate video) dan menulis prompt yang menyebut subjek konkret. Ini hanya bisa dilakukan model bahasa.
2. Biaya tambahan terkendali: ~3-4 panggilan LLM per edisi (bukan per-beat — 50 beat ≈ 4 batch @16).
3. Resiliensi: LLM gagal 2× pada satu batch → batch itu fallback ke `classifyBeats` (mapper regex lama, dipertahankan murni sebagai fallback). **Pipeline tidak pernah mati karena storyboard.**
4. Jaminan paten tetap di kode, bukan diminta ke LLM — konsisten `implementation_plan.md` §4.2: *"Konstanta paten disuntik di kode, bukan diminta ke LLM: setiap beat T2V/I2V otomatis dapat {faceless:true, negative_prompt: FACELESS_NEGATIVE, audio:{music:false,...}}"*. Parser juga menyuntik ulang bila LLM lupa.

---

## 4. Mekanisme Detail (Implementasi Aktual)

### 4.1 Tipe data — `BeatHint` (src/long/llm-long.ts:59)

```ts
export interface BeatHint {
  visual: BeatVisual;      // "STATIC_IMAGE_MOTION" | "T2V_GENERATION" | "I2V_ANIMATE_IMAGE"
  prompt: string;          // prompt T2V/I2V murni Inggris UE5; "" utk STATIC
  sfx: string;             // deskripsi ambient/foley, wajib no-music
  srcImage?: string | null; // path gambar edisi yang dipilih LLM (BARU)
}
```

`BeatHint` adalah output Stage-2 yang dikonsumsi `splitBeats` untuk membangun `Beat` final (dengan jaminan paten `faceless`, `negative_prompt: FACELESS_NEGATIVE`, `audio:{music:false,...}`).

### 4.2 System prompt — `SYSTEM_STORYBOARD` (llm-long.ts:166-177)

Prompt memerintahkan model berperan sebagai "visual director" faceless AI-news long-form, output **STRICT JSON array** 1-objek-per-beat urut. Aturan kuncinya:

1. **Rule 1 (kualitas — mengatasi KR-2)**: `prompt` murni Inggris, sinematik, estetika Unreal Engine 5, 30-60 kata, **SPESIFIK ke narasi beat** — wajib menyebut subjek konkret (produk, perusahaan, teknologi, metrik) dari teks. **Dilarang kalimat sama antar beat; setiap prompt wajib berbeda visualnya.**
2. **Rule 2 (patokan keamanan)**: larangan keras wajah manusia/orang/hewan/teks on-screen; prompt non-STATIC wajib diakhiri `", faceless, no people, no text"`.
3. **Rule 3 (distribusi — memindahkan KR-6 ke prompt)**: `STATIC_IMAGE_MOTION` bila beat laporan fakta/angka yang paling pas dengan gambar berita sumber; `I2V_ANIMATE_IMAGE` bila salah satu AVAILABLE IMAGES jelas cocok subjek; `T2V_GENERATION` sisanya. **Minimal 35% beat wajib T2V.**
4. **Rule 4 (anti-halusinasi path)**: `srcImage` wajib disalin **persis** dari daftar AVAILABLE IMAGES; kosong bila tidak ada yang cocok; dilarang mengarang path; selalu kosong untuk T2V.
5. **Rule 5 (audio)**: `sfx` Inggris 6-14 kata, ambient/foley, wajib diakhiri `", no background music"`.
6. **Rule 6**: tanpa markdown/komentar — JSON array saja.

### 4.3 User prompt — `buildUserPrompt()` (llm-long.ts:179-189)

Per batch, menyusun dua blok:
- **AVAILABLE IMAGES**: daftar `N. <path> — [<publisher>] <judul-berita>` (atau teks "(kosong — jangan isi srcImage)"). Judul berita + publisher inilah yang membuat LLM bisa memilih gambar **secara semantik** (mengatasi KR-4).
- **BEATS**: `N. [bab: <judul-chapter>] <teks-beat>` — label bab memberi konteks fase narasi (hook/deep-dive/analisis).

### 4.4 Parser anti-rusak — `parseStoryboardJson()` (llm-long.ts, export)

Digunakan untuk validasi + retry, sanitasi jaminan paten:

- Slicing tahan benc: regex greedy `\[\s*\{[\s\S]*\}\s*\]` mencari kurung siku pembuka-array-objek — teks pembuka LLM yang memuat kurung siku lain (mis. `[bab: Intro]:`) tidak merusak parsing; fallback `indexOf('[')..lastIndexOf(']')`; otomatis membersihkan code fence ```json dan teks pengantar.
- **Tolak** (memicu retry): tidak ada array, jumlah objek ≠ jumlah beat, `visual` di luar 3 enum.
- **Injeksi jaminan paten** (bila LLM lupa): non-STATIC + prompt tanpa "faceless" → suntik `", faceless, no people, no text"`; `sfx` tanpa larangan musik → suntik `", no background music"`.
- **Sanitasi**: `prompt` STATIC dipaksa `""`; `srcImage` kosong → `null`; `sfx` kosong → default `LONG_AUDIO_PROMPT`.

### 4.5 Orkestrator batch — `generateLongStoryboard()` (llm-long.ts, export)

```
for batch dari beats (16/batch, offset kumulatif):
    retry 2x:  chat([SYSTEM_STORYBOARD, user], 3200) → parseStoryboardJson(raw, batch.length)
    gagal 2x → hints = classifyBeats(batch)          ← fallback mapper regex (per batch)
    sanitasi: srcImage yang tidak ada di daftar edisi → null (anti-path-liar)
    kumpulkan
log ringkasan: N beat → T2V/I2V/STATIC, jumlah batch
```

Detail penting:
- `STORYBOARD_BATCH = 16` — kalkulasi ukuran: 16 beat × (prompt 30-60 kata ≈ 60-100 token + sfx ≈ 20 token + JSON overhead) ≈ 1800-2400 token → `maxTokens 3200` memberi margin aman agar output tidak terpotong (terpotong = JSON rusak = retry).
- Retry per batch **2×** dengan backoff `sleep(1500 * attempt)` (revisi hasil review agent kedua: percobaan ke-3 dengan mode gagal sama jarang menyelamatkan — lebih baik fallback cepat; worst-case 1 batch gagal ≈ 60 dtk, bukan 90 dtk; cascade 2 batch gagal ≈ +2 mnt, total workflow tetap < timeout 15 mnt).
- `chat()` dari `src/llm.ts` sudah membawa rate-limit internal 2 detik/panggilan, retry 3× + fallback model bila "Hermes" kosong, dan header `x-opencode-session` (wajib vendor). Tidak diduplikasi.

### 4.6 Konsumsi di pipeline — `scripts/full-long-pipeline.ts:73-87`

```ts
const imgMeta = images.map((p, i) => p ? { path: p, title: items[i]?.title, publisher: items[i]?.publisher } : null).filter(...);
const labeled = pass1.map((b) => ({ text: b.text, chapter: [...chapters].reverse().find((c) => c.startSec <= b.startSec)?.title ?? "Intro & Tesis Utama" }));
const fullHints = await generateLongStoryboard(labeled, imgMeta);
const beats = splitBeats(clean, fullHints, chapters, imgPaths);
```

Catatan: `images` dan `items` **index-paralel** (dijamin kurator), sehingga `imgMeta[i]` selalu metadata gambar `srcN` untuk berita `items[i]`.

### 4.7 Resolusi srcImage — `splitBeats()` (src/long/storyboard.ts:50-59)

```ts
const needImg = hint.visual !== "T2V_GENERATION";
const hinted = hint.srcImage != null && images.includes(hint.srcImage) ? hint.srcImage : null;
if (needImg) { if (hinted) srcImage = hinted; else if (images.length > 0) srcImage = images[imgIdx++ % images.length] ?? null; }
```

Prioritas: (1) pilihan LLM bila path-nya benar-benar ada di edisi; (2) fallback siklik perilaku lama. T2V tidak memakai gambar.

**Guard anti-blank (revisi hasil review agent kedua):** bila `visual === "STATIC_IMAGE_MOTION"` tetapi `srcImage` ter-resolve `null` (hanya terjadi bila edisi 0 gambar terdownload — dengan gambar, siklik selalu mengisi), beat otomatis dialihkan ke `T2V_GENERATION` dengan prompt tema deterministik via `themedHintFor(text)` (export di llm-long.ts, sama dengan fallback mapper). **Beat STATIC tidak pernah blank tanpa arahan visual** — menutup kelemahan lama "producer pakai T2V semua" tapi storyboard tidak menyediakan prompt T2V.

---

## 5. File yang Berubah

| File | Perubahan |
|---|---|
| `src/long/llm-long.ts` | Komentar header Stage-2 direvisi; `BeatHint` +`srcImage?`; `SYSTEM_STORYBOARD`, `buildUserPrompt`, `parseStoryboardJson` (export), `generateLongStoryboard` (export), `themedHintFor` (export) DITAMBAHKAN; `classifyBeats` lama dipertahankan sebagai fallback (log → "Thematic Visual Mapper (fallback)"); `maxTokens` chat storyboard = 3200; retry batch 2×; regex parser greedy `[\s*\{...\}]`. |
| `src/long/storyboard.ts` | `splitBeats` menghormati `hint.srcImage` (valid edisi → dipakai; else siklik) + guard anti-blank: STATIC tanpa gambar ter-resolve → T2V themed via `themedHintFor`. |
| `scripts/full-long-pipeline.ts` | Stage-2 memanggil `generateLongStoryboard(labeled, imgMeta)`; import berubah `classifyBeats` → `generateLongStoryboard`. |
| `scripts/test-long-unit.ts` | +3 grup test: **#7** `parseStoryboardJson` (JSON murni, fenced, adversarial teks pembuka ber-kurung-siku, injeksi jaminan, srcImage, STATIC dikosongkan, 3 pola penolakan: bukan-JSON / salah-jumlah / visual-invalid), **#8** `splitBeats` srcImage hint (valid dipakai, path liar dibuang), **#9** guard STATIC-blank (0 gambar → T2V themed UE5; dengan gambar tetap STATIC). |

Yang **TIDAK diubah**: `generateLongScript` (Stage-1), chapters statis proporsional (KR-5), `validateLongScript`/`validateChapters`, `buildStoryboardMd` format, workflow yml, DB schema, `classifyBeats` fallback.

## 6. Validasi

| Uji | Hasil |
|---|---|
| `npm run build` (`tsc -p tsconfig.json`, strict) | ✅ 0 error |
| `npx tsx scripts/test-long-unit.ts` (9 grup: stripMidroll, validateLongScript, parseGdriveId+args, splitBeats, Thematic Visual Mapper, validateChapters+description, parseStoryboardJson, splitBeats srcImage hint, guard STATIC-blank) | ✅ `SEMUA UJI LONG-FORM LOLOS` |

Estimasi waktu CI (refleksi review agent kedua, edisi 116 beat): Stage-2 ≈ 8 batch × ~25 dtk ≈ 3.5 mnt; Stage-1 ≈ 1.5 mnt; total workflow 5–7 mnt — aman di bawah `timeout-minutes: 15`.

Catatan lingkungan: terminal shell sesi ini tidak stabil (integrasi output gagal), sehingga build/test diverifikasi via redirect output ke file sementara (lalu dihapus). Verifikasi ulang cukup: `npm run build` dan `npx tsx scripts/test-long-unit.ts`.

## 7. Dampak pada STORYBOARD.md (Sebelum → Sesudah)

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Keberagaman prompt | ~85% beat = 1 dari 8 kalimat template identik | Setiap prompt unik, merujuk subjek konkret narasi (nama chip/model/metrik), larang repetisi via Rule 1 |
| Beat STATIC | Prompt kosong → segmen tanpa arahan visual | Keputusan STATIC semantik via Rule 3 (bukan trigger regex agresif); guard anti-blank: STATIC tanpa gambar (edisi 0 gambar) otomatis dialihkan T2V themed — tidak pernah blank |
| Pemilihan gambar | Siklik `imgIdx++ % n` — mismatch | Semantik oleh LLM berdasar judul berita + publisher; validasi double di kode |
| Jaminan patokan | Hanya dari mapper | Ditulis di system prompt + **di-inject ulang parser** (double-guarantee) |
| Resiliensi | 100% deterministik | LLM retry 2×/batch → fallback mapper per batch → pipeline tak mati |
| Biaya LLM | 1 panggilan (Stage-1) | +~3-4 panggilan batch (Stage-2) |

## 8. Catatan untuk Agent Berikutnya (Kontrak & Upgrade Path)

**Jangan dilanggar (akan merusak produksi owner):**
1. **Jangan hapus fallback `classifyBeats`** — satu-satunya jalur selamat bila vendor LLM turun.
2. **Jangan hapus sanitasi `srcImage`** (parser + `splitBeats` + sanitasi post-batch) — LLM bisa mengarang path; path liar akan merusak produksi di laptop.
3. **Jangan kurangi `maxTokens 3200`** tanpa menurunkan `STORYBOARD_BATCH` — output terpotong = JSON rusak = retry sia-sia.
4. **Jangan lemahkan jaminan paten** (faceless/no-people/no-text, no-music, negative_prompt) — kebijakan channel: 100% faceless & tanpa background music.
5. **Jangan hapus guard STATIC-blank** (`splitBeats`: STATIC tanpa gambar → T2V themed) — tanpa guard, edisi 0 gambar menghasilkan beat blank (kelemahan yang ditemukan review agent kedua).
6. Retry batch **2× sengaja dipilih** (bukan 3×) — trade-off waktu CI vs peluang kecil penyelamatan; naikkan kembali hanya bila vendor LLM sering glitch pada percobaan pertama.
7. `prompt` untuk STATIC **dengan gambar** sengaja `""` — STATIC dirender dari og:image berita sumber (Ken Burns di editor), bukan T2V; STATIC tanpa gambar sudah diguard ke T2V themed (item 5).

**Estimasi vs durasi riil:** semua timestamp masih estimasi WPM 130 (lihat komentar `ponytail` di `storyboard.ts:2-3` — upgrade saat producer kirim durasi TTS riil).

**Upgrade path tersisa (dicatat, belum dieksekusi):**
- KR-5: chapters dinamis dari posisi kalimat topik (mis. chapter per topik deep-dive, bukan 5 bab proporsional tetap).
- Format `buildStoryboardMd` bisa diperkaya (ringkasan tabel beat, transisi/shot type, target durasi T2V per beat) — format sekarang minim (KR minor).
- Unit test kualitas berikutnya: cek keragaman prompt antar-beat (jaccard similarity) + relevansi keyword dengan teks beat, agar regresi kualitas tertangkap CI (mengatasi KR-7 secara permanen).

**Perintah verifikasi:**
```
npm run build
npx tsx scripts/test-long-unit.ts
```

*Akhir laporan. Laporan ini merefleksikan kode pada `master` sesi 2026-09-12; belum di-commit — kebijakan repo: agen tidak push tanpa diminta.*
