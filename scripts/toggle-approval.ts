import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PIPELINE_CONFIG } from "../src/config.js";

const configPath = join(process.cwd(), "src", "config.ts");
const args = process.argv.slice(2);

function showStatus() {
  console.log("\n=======================================================");
  console.log("       STATUS SISTEM KONFIRMASI FASTAINIEWS            ");
  console.log("=======================================================");
  console.log(`Mode Aktif Saat Ini : ${PIPELINE_CONFIG.REQUIRE_APPROVAL ? "🛑 MANUAL APPROVAL (Butuh Konfirmasi)" : "⚡ AUTOPILOT (Zero-Approval / Tanpa Konfirmasi)"}`);
  console.log(`Random Timing Jitter: ${PIPELINE_CONFIG.RANDOM_TIMING.ENABLED ? `AKTIF (${PIPELINE_CONFIG.RANDOM_TIMING.MIN_MINUTES} - ${PIPELINE_CONFIG.RANDOM_TIMING.MAX_MINUTES} menit)` : "NONAKTIF"}`);
  console.log("-------------------------------------------------------");
  console.log("Perintah Pengalihan Cepat:");
  console.log("  npx tsx scripts/toggle-approval.ts --autopilot  (Nonaktifkan konfirmasi)");
  console.log("  npx tsx scripts/toggle-approval.ts --manual     (Aktifkan konfirmasi)");
  console.log("=======================================================\n");
}

if (args.includes("--autopilot")) {
  let content = readFileSync(configPath, "utf8");
  content = content.replace(/DEFAULT_REQUIRE_APPROVAL\s*=\s*(true|false)/, "DEFAULT_REQUIRE_APPROVAL = false");
  writeFileSync(configPath, content, "utf8");
  console.log("✅ Berhasil dialihkan ke MODE AUTOPILOT (Zero-Approval).");
  console.log("FastAINews akan otomatis merilis video ke YouTube & medsos tanpa konfirmasi manual, dengan jeda acak.");
} else if (args.includes("--manual")) {
  let content = readFileSync(configPath, "utf8");
  content = content.replace(/DEFAULT_REQUIRE_APPROVAL\s*=\s*(true|false)/, "DEFAULT_REQUIRE_APPROVAL = true");
  writeFileSync(configPath, content, "utf8");
  console.log("🛑 Berhasil dialihkan ke MODE MANUAL APPROVAL.");
  console.log("FastAINews akan menunggu tombol 'Approve' ditekan via Telegram sebelum video diposting.");
} else {
  showStatus();
}
