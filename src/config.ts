import "dotenv/config";

/**
 * DEFAULT_REQUIRE_APPROVAL:
 * - false (DEFAULT): MODE AUTOPILOT (Zero-Approval).
 *   Konten berita AI harian akan diproduksi dan langsung dipublikasikan secara otonom
 *   ke YouTube Shorts, TikTok, dan Instagram tanpa menunggu konfirmasi manual via Telegram.
 *
 * - true: MODE MANUAL APPROVAL.
 *   Pipeline akan mengirimkan preview ke Telegram dan menunggu tombol "Approve" ditekan
 *   oleh Owner sebelum publikasi dijalankan.
 */
const DEFAULT_REQUIRE_APPROVAL = false;

/**
 * Konfigurasi Operasional FastAINews
 *
 * Mengontrol mode rilis (Autopilot vs Manual Approval) dan random timing untuk publikasi.
 */
export const PIPELINE_CONFIG = {
  /**
   * REQUIRE_APPROVAL:
   * Prioritas:
   * 1. Environment variable REQUIRE_APPROVAL (jika didefinisikan di .env / GitHub Actions)
   * 2. Nilai DEFAULT_REQUIRE_APPROVAL di atas
   */
  REQUIRE_APPROVAL: process.env.REQUIRE_APPROVAL !== undefined
    ? (process.env.REQUIRE_APPROVAL === "true" || process.env.REQUIRE_APPROVAL === "1")
    : DEFAULT_REQUIRE_APPROVAL,

  /**
   * RANDOM_TIMING:
   * Menambahkan jeda waktu acak (jitter) sebelum publikasi agar posting tidak monoton
   * di menit/jam yang persis sama setiap hari (menyerupai perilaku kurasi organik).
   */
  RANDOM_TIMING: {
    ENABLED: process.env.RANDOM_TIMING_ENABLED !== "false", // default: aktif
    MIN_MINUTES: Number(process.env.RANDOM_DELAY_MIN_MINUTES) || 10, // jeda minimal (menit)
    MAX_MINUTES: Number(process.env.RANDOM_DELAY_MAX_MINUTES) || 35, // jeda maksimal (menit)
  },
};
