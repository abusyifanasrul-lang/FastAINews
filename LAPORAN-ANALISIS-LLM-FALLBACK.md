# Laporan Investigasi: Mengapa Rasio LLM vs Fallback 40/60 pada Stage-2 Storyboard

**Tanggal:** 2026-09-12
**Cakupan:** Pipeline `AI News Long Curate` — Stage-2 storyboard (`generateLongStoryboard`), edisi 2026-09-12
**Status keyakinan:** Temuan kuat berbasis kode + statistik output, **bukan vonis 100%** (bukti penentu berupa log mentah CI belum tersedia — lihat §6)
**File terkait:** `src/long/llm-long.ts`, `src/llm.ts`, `src/long/storyboard.ts`, `scripts/full-long-pipeline.ts`, `content/long/2026-09-12/storyboard.json`

---

## 1. Ringkasan Eksekutif

Pada edisi 2026-09-12 (87 beats), hanya ±40% prompt video yang tampak kontekstual (hasil LLM), sedangkan ±60% berupa template generik dari `classifyBeats` (fallback deterministik).

Temuan terpenting investigasi ini: **angka 60% tersebut menyesatkan**. Ia mencampur dua sumber berbeda — (a) batch yang LLM-nya benar-benar dicoba lalu gagal parse, dan (b) batch yang **tidak pernah dicoba LLM sama sekali** karena dimatikan oleh circuit breaker internal. Dengan kata lain, 60% bukan ukuran "LLM gagal 60%", melainkan ukuran "sistem menyerah ke fallback untuk 60%".

Tiga Tersangka utama, urut keyakinan:

| # | Tersangka | Keyakinan | Inti masalah |
|---|-----------|-----------|--------------|
| 1 | Parser terlalu ketat (`length !== expected` → buang 1 batch penuh) | ~85% | 1 objek hilang/rusak → 8 prompt bagus ikut dibuang |
| 2 | Retry buta (attempt-2 mengirim prompt identik, suhu 0.2 deterministik) | ~70% | mengulang kesalahan sistematis yang sama |
| 3 | Beban output di ujung tanduk (echo + JSON vs `maxTokens: 4500`) | ~60% | truncation sebelum `]` penutup |

Rencana perbaikan (§7) menarget ketiganya sekaligus, sehingga kalaupun vendor rusak, yang generik hanya batch yang benar-benar gagal — bukan terseret breaker ke mayoritas edisi.

---

## 2. Fakta yang Terukur (Bukan Opini)

Sumber data: `content/long/2026-09-12/storyboard.json` (87 beats) + pembacaan kode `master`.

- Total beats: **87** (durasi estimasi 595 dtk / 09:55, midroll 06:00).
- 15 beats `STATIC_IMAGE_MOTION` tanpa prompt — **ini by design** (`prompt` sengaja dikosongkan, beat dirender dari og:image), bukan kegagalan. Mereka harus dikeluarkan dari perhitungan 40/60.
- Dari 72 prompt terisi, yang unik hanya **33**; duplikat terbanyak:
  - 21× abstraksi blue/amber (DEFAULT_THEME),
  - 13× neural-topology (model/LLM theme),
  - 5× cyber-mainframe, 3× data-center, 2× telemetry.
  - Total **44/72 (≈61%) prompt generik**.
- Prompt generik **mengelompok per ~8 beat** (contoh cluster: beat 12–16, 49–54, 56–57, 82–87) — sidik jari kegagalan **per-batch** (satu respons 8 beat dibuang utuh), bukan kegagalan acak per-beat.
- Prompt kontekstual (±28) justru sangat spesifik dan benar: Apple Watch + always-listening (Beat 3), lab OpenAI + hologram bukti matematika (Beat 4), token Claude dicuri (Beat 6), Navier-Stokes → simulasi fluida (26), lean theorem prover (28), AlphaGeometry simbolik-vs-hibrid (32), SF vs Meta cease-and-desist (36). Model **mampu** — masalahnya di antarmuka, bukan kapabilitas.
- Kontrak paten utuh: `faceless:true` 87/87, `music:false` 87/87, `negative_prompt` 87/87, 7/7 gambar terpakai, tidak ada beat blank (guard anti-blank bekerja).
- Naskah Stage-1: 9775 char / 1242 kata — lolos validator (retry Stage-1 bekerja).

---

## 3. Metodologi Investigasi

1. Statistik deskriptif `storyboard.json`: distribusi visual, keunikan prompt, pengelompokan duplikat, pemetaan gambar per beat.
2. Pembacaan penuh jalur Stage-2: `full-long-pipeline.ts` (orkestrasi) → `generateLongStoryboard` (batching, retry, breaker, budget) → `chat()` di `src/llm.ts` (rate-limit, SSE parsing, retry model, temperature) → `parseStoryboardJson` (5 kondisi throw) → `classifyBeats` (fallback) → `splitBeats` (konsumsi hint).
3. Uji silang setiap hipotesis terhadap dua pertanyaan: (a) apakah ia menjelaskan pola cluster-per-8? (b) apakah ia bisa dibedakan dari data yang ada?
4. Yang **tidak** dilakukan (dan sengaja dinyatakan): menuduh model/vendor tanpa log mentah CI.

---

## 4. Temuan Utama

### 4.1 Angka 60% itu menyesatkan — dua sumber fallback tercampur

Di `generateLongStoryboard` ada dua jalur menuju prompt generik:

**Jalur A — batch fallback (LLM benar-benar dicoba, gagal 2x):** 8 beat diganti `classifyBeats`.

**Jalur B — circuit-breaker skip (LLM TIDAK PERNAH dicoba):** setelah 2 batch beruntun gagal, seluruh sisa beat langsung mapper + `break`.

Konsekuensi aritmetikanya brutal: **cukup 2 batch gagal di awal (≈16 beat), ~70 beat sisanya otomatis generik tanpa LLM pernah dicoba.** Breaker dirancang sebagai pengaman waktu, tapi efek sampingnya adalah pengali kerusakan kualitas — dan karena tidak ada counter terpisah, angka "60% fallback" menyembunyikan proporsi A vs B.

### 4.2 Tersangka #1 (~85%): parser menghukum output yang sebenarnya valid

`parseStoryboardJson` punya 5 kondisi `throw`. Tiga di antaranya menolak output yang substansinya benar: syarat jumlah kaku (`length !== expected` → 7 objek bagus dibuang karena 1 hilang), syarat urutan + kelengkapan key (model yang menghilangkan `"srcImage": null` atau menukar urutan membuat 8 beat dibuang — padahal tinggal diisi default), dan larangan teks apapun setelah `]`. Polanya identik: **tolak satu batch penuh untuk cacat kecil yang bisa diperbaiki per-objek**. Dengan model yang formatnya tidak disiplin, inilah mesin penghasil fallback terbesar.

### 4.3 Tersangka #2 (~70%): retry buta mengulang kesalahan yang sama

Retry attempt-2 mengirim **user prompt identik** dengan attempt-1, pada suhu 0.2 yang cenderung deterministik. Jika kegagalan attempt-1 bersifat sistematis (model tidak paham format, output kepanjangan lalu terpotong), pengulangan input sama hampir pasti mengulang output salah yang sama — dua panggilan mahal dibuang untuk satu pelajaran yang tidak dipetik. Retry yang benar untuk JSON adalah **repair**: kirim kembali `raw` + pesan error spesifik. Kombinasi #1 + #2 itu mematikan: 1 objek hilang → buang semua 8 → ulangi prompt sama → hilang lagi → fallback 1 batch, dua kali begitu → breaker → seluruh sisa edisi generik.

### 4.4 Tersangka #3 (~60%): beban output di ujung tanduk token

`STORYBOARD_BATCH = 8` dengan `maxTokens = 4500`. Per objek ≈ 90–130 token; 8 objek ≈ 750–1050 token — seharusnya muat, **kecuali** model men-echo sebagian input dulu (pernah terbukti di postmortem Revisi 2). Echo + JSON + 2 objek verbose bisa terpotong di tengah jalan → `lastIndexOf("]")` tidak ketemu → `"JSON array tidak ditemukan"` → retry buta → fallback. Salvage/parsial hanya menolong bila minimal 1 objek utuh tertulis; bila potong terjadi di objek pertama, nol terselamatkan. Catatan: objek hasil pad memakai `themedHintFor` yang string-nya identik dengan fallback — pad parsial pun ikut tercatat "generik" dalam statistik output.

### 4.5 Yang BUKAN penyebab (supaya tidak salah obat)

- **Temperature 0.2** — sudah benar, jangan diutak-atik.
- **Anti-echo Rule 7 / label bracket-free** — sudah benar, pertahankan.
- **Revisi 5 (`splitBeats`: gabung fragmen, penalti gambar)** — memperbaiki gejala hilir, tidak ada hubungan dengan hit-rate LLM.
- **Timeout workflow 30 mnt / pagu Stage-2** — pengaman waktu, bukan penyebab.
- **15 beat STATIC tanpa prompt** — by design, sudah dikeluarkan dari perhitungan.

---

## 5. Batas Keyakinan: Mengapa Belum 100%

Tiga skenario berikut **tidak dapat dibedakan** hanya dari `storyboard.json` (yang hanya menyimpan hasil akhir, bukan jejak kegagalan):

| Skenario | Jejak di storyboard.json | Bukti penentu yang dibutuhkan |
|----------|--------------------------|-------------------------------|
| A. Parse gagal (model menjawab, format salah) | prompt generik, cluster per-8 | cuplikan raw output + pesan error per batch dari log CI |
| B. API error/timeout (model tak sempat menjawab) | identik dengan A | status HTTP + durasi per batch dari log CI |
| C. Breaker skip (model tak pernah dicoba) | identik dengan A dan B | baris `LLM storyboard tidak sehat` di log + rasio `batchesExecuted/totalBatches` |

Yang dibutuhkan untuk vonis 100%: **log mentah CI run hijau** — baris `[llm-long] storyboard batch X/Y percobaan A/2 gagal: <pesan>` dan (ideal) cuplikan raw output tiap batch gagal:
- `"tidak valid sebagai objek" / "Jumlah objek ... != ..."` dominan → Tersangka #1 terbukti.
- `"JSON array tidak ditemukan"` dominan → Tersangka #3 terbukti.
- `"LLM 5xx/timeout"` dominan → vendor yang salah, bukan parser.
- `"objek LLM parsial (N/8)"` sering → Tersangka #3 + pad menutupi.
- `"LLM storyboard tidak sehat"` muncul → Jalur B aktif, sebagian besar 60% bahkan bukan kegagalan LLM.

Sampai data itu ada, klaim "akar 100% adalah X" adalah spekulasi berbahasa pasti — laporan ini sengaja tidak melakukannya.

---

## 6. Rencana Perbaikan (Urut Dampak)

Semua lokal + aman + testable tanpa LLM:

1. **Longgarkan parser (dampak terbesar)**: `parsed.length !== expected` → jangan throw. Kalau kurang → pad dengan `themedHintFor` untuk beat yang hilang; kalau lebih → potong. Hanya throw bila `parsed.length === 0` (betul-betul tidak ada JSON). Ini mengubah "1 objek hilang = 8 beat generik" menjadi "1 objek hilang = 1 beat generik, 7 tetap LLM".
2. **Jinakkan breaker**: `>= 2` → `>= 4` beruntun, DAN breaker hanya memotong bila sisa beat > 1 batch (jangan matikan 100 beat karena 16 beat gagal). Atau ubah jadi berbasis waktu saja (pagu 15 mnt sudah ada — breaker hitungan batch jadi redundan dan berbahaya).
3. **Retry repair, bukan retry buta**: attempt-2 kirim `raw` + error kembali ke model ("perbaiki menjadi array JSON valid, jangan tulis ulang narasi"). Token lebih kecil, peluang sembuh lebih besar.
4. **Observabilitas (syarat mutlak untuk vonis 100% ke depan)**: log per batch `ok/fallback + sebab + 200 char pertama raw`, dan tulis ringkasan `{ batchesExecuted, totalBatches, fallbackBatches[] }` ke `meta.json` tiap edisi. Tanpa ini kita akan mengulang diskusi "40/60 kenapa" setiap edisi.
5. **Turunkan beban bila perlu (opsional, setelah data masuk)**: kalau log nanti menunjukkan truncation, turunkan batch 8→6 atau prompt 30–60→25–40 kata. Jangan sekarang — tanpa data itu tebak-tebakan.

Estimasi jujur setelah 1–4: hit-rate LLM **85–100% pada vendor sehat, dan kalaupun vendor rusak, yang generik hanya batch yang benar-benar gagal** — tidak lagi terseret breaker ke 60%.

---

## 7. Apendiks: Perintah Analisis yang Dipakai

```bash
# distribusi visual + prompt terisi vs unik
node -e "const j=JSON.parse(fs.readFileSync('content/long/2026-09-12/storyboard.json','utf8')); ..."
# duplikat prompt teratas (sidik jari fallback vs LLM)
# pemetaan srcImage per beat (deteksi overuse + drift topik-gambar)
# beat tanpa prompt (pastikan semuanya STATIC_IMAGE_MOTION bergambar)
```

*Akhir laporan.*

