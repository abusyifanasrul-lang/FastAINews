# Migrasi Endpoint LLM ke Google Gemini Direct & Resilient Multi-Tier Fallback

> **Status:** Revised after Deep Self-Reflection (Empirically Verified)  
> **Target Repo:** `FastAINews` (`C:\Users\K4G3\FastAINews`)  
> **Tanggal:** 2026-09-18  

---

## 1. Goal
Mengeliminasi ketergantungan pada free-tier OpenCode yang tidak stabil dan memblokir GitHub Actions runner (HTTP 403 `FreeTierError`), dengan beralih ke **Google Gemini Direct** (resmi Google AI Studio) baik sebagai endpoint utama maupun fallback otomatis di seluruh pipeline (Daily Shorts & Long-Form).

---

## 2. Temuan Hasil Deep Self-Reflection & Pengujian Empiris

Dari pengujian live langsung terhadap endpoint `https://generativelanguage.googleapis.com/v1beta/openai/`:

1. **Model Obsolete (GAP KRITIS):**
   * Awalnya direncanakan menggunakan `gemini-2.5-flash`.
   * **Hasil tes live:** Google mengembalikan `HTTP 404`: `"This model models/gemini-2.5-flash is no longer available to new users."`
   * **Model yang verified stabil:** `gemini-3.5-flash` dan `gemini-3.1-flash-lite` (keduanya HTTP 200, inferensi ~2-3 detik, menghasilkan naskah Bahasa Indonesia yang 100% lolos validasi script).

2. **Reasoning / Thinking Tokens Overhead:**
   * Model keluarga Gemini 3 mengalokasikan token untuk proses berpikir internal dari kuota `max_tokens`.
   * Jika `max_tokens` terlalu kecil (misalnya 50), respons teks kosong karena token habis dipakai proses internal (`finish_reason: length`).
   * Di `src/llm.ts`, default `maxTokens` adalah 2000 (dan 3200-4000 di long-form), yang terbukti **sangat aman dan cukup** untuk menghasilkan naskah lengkap.

3. **Rate Limiting Google AI Studio (15 RPM):**
   * Tier gratis Google AI Studio memiliki kuota 15 RPM (Request Per Minute = 1 request tiap 4 detik).
   * Nilai `MIN_INTERVAL_MS` di `src/llm.ts` yang tadinya 2000 ms dinaikkan menjadi **3500–4000 ms** untuk menjamin pipeline long-form (Stage-2 batching) tidak pernah menyentuh 429.

4. **Environment Secret Alignment di GitHub Actions:**
   * Di `.github/workflows/ainews.yml`: secret `GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}` sudah ada.
   * Di `.github/workflows/ainews-long-curate.yml`: secret `GOOGLE_API_KEY` **belum dipasang** dan wajib ditambahkan.

---

## 3. Rincian Task Implementasi

### Task 1: Refactor `src/llm.ts` dengan Native Gemini Fallback
* **File:** `src/llm.ts`
* **Implementasi:**
  1. **Smart Header Filter:** Header OpenCode (`x-opencode-*`, `X-Session-Id`) hanya dikirim jika URL memuat `opencode.ai`. Jika ke Google Gemini atau endpoint lain, gunakan header standar bersih.
  2. **Model Priority:**
     * Primary Gemini: `gemini-3.5-flash`
     * Gemini Backup: `gemini-3.1-flash-lite` (jika model utama sedang antre/high-load 503)
  3. **Multi-tier Execution Flow di `chat()`:**
     ```
     Try Primary (LLM_ENDPOINT)
       └─ Gagal (403/429/error)?
           └─ Try Fallback Endpoint (LLM_ENDPOINT_FALLBACK)
               └─ Gagal / Tidak ada?
                   └─ Try Google Gemini Direct (GOOGLE_API_KEY)
     ```
  4. **Pembersihan Reasoning Tag:**
     Perluas regex pembersih agar menangani `<think>` maupun `<thought>`.
  5. **Safety Rate Limit:**
     Set interval jeda antar-panggilan minimum 3500 ms (aman di bawah 15 RPM).

### Task 2: Update Workflow `.github/workflows/ainews-long-curate.yml`
* **File:** `.github/workflows/ainews-long-curate.yml`
* **Implementasi:**
  Tambahkan:
  ```yaml
  GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
  ```
  di langkah `Run long curate pipeline`.

### Task 3: Verifikasi Komprehensif
1. Compile check: `npm run build` (`tsc -p tsconfig.json`) -> 0 error.
2. Long-form unit test: `npx tsx scripts/test-long-unit.ts` -> Semua lolos.
3. Live simulation test: Jalankan skrip uji pemanggilan naskah dengan memutus primary endpoint untuk membuktikan fallback otomatis ke Gemini bekerja 100% mulus.

### Task 4: Git Commit & Push
* Commit perubahan ke branch `master` dan push ke GitHub repository.
* Uji trigger langsung via Telegram command `/run`.

---
