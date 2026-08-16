// Verifikasi alokasi durasi proporsional: hitung durasi cut vs estimasi narasi
import { db } from "../src/db.js";
const c = db.prepare("SELECT script_text FROM contents WHERE date='2026-08-05'").get() as { script_text: string } | undefined;
if (!c) { console.log("tak ada naskah #4"); process.exit(0); }
const dur = 63.4;
const sentences = c.script_text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
const body = sentences.slice(1);
const chunks: string[] = [];
for (let i = 0; i < body.length; i += 2) chunks.push(body.slice(i, i + 2).join(" "));
const totalLen = chunks.reduce((s, x) => s + x.length, 0) || 1;
const bodyBudget = Math.max(5, dur - 3 - 3 - 2.5);
// estimasi narasi: 15.5 char/detik (ukuran normal)
const CPS = 15.5;
let t = 3;
console.log("cut | dur_visual | est_narasi | delta");
chunks.forEach((ch, i) => {
  const segDur = Math.max(3.5, bodyBudget * (ch.length / totalLen));
  const estNarasi = ch.length / CPS;
  console.log(`c${i + 2} | ${segDur.toFixed(1)}s | ${estNarasi.toFixed(1)}s | ${(segDur - estNarasi).toFixed(1)}s`);
  t += segDur;
});
console.log("total body:", t.toFixed(1), "dari durasi", dur);