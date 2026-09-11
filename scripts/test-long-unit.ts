import assert from "node:assert";
import { stripMidroll, validateLongScript, formatTimestamp } from "../src/long/validate.js";
import { parseGdriveId, splitPublishLongArgs } from "../src/long/gdrive.js";
import { splitBeats, validateChapters, chaptersToDescription } from "../src/long/storyboard.js";

// 1. stripMidroll: marker hilang dari teks, posisi tersimpan
{
  const { clean, atChar } = stripMidroll("Intro panjang.\n[MID-ROLL AD BREAK: 04:30]\nLanjutan.");
  assert(!clean.includes("MID-ROLL"), "marker ikut teks");
  assert(typeof atChar === "number", "posisi null");
  const none = stripMidroll("Tanpa marker.");
  assert(none.atChar === null && none.clean === "Tanpa marker.", "tanpa marker rusak");
  console.log("ok stripMidroll");
}
// 2. validateLongScript: tolak pendek, terima panjang ID
{
  assert.throws(() => validateLongScript("pendek"), /pendek/);
  const para = "Kita membahas kabar yang penting untuk Anda dengan data dari sumber ini. ";
  const longId = Array(110).fill(para).join("\n\n"); // ~8500 char / ~1320 kata, ID valid
  assert(longId.length > 4000, "fixture kurang panjang");
  validateLongScript(longId);
  assert.throws(() => validateLongScript(longId + " we need to craft hook line fact 1: x\nstructure:\n"), /reasoning/);
  console.log("ok validateLongScript");
}
// 3. parseGdriveId: 4 format ok, folder ditolak
{
  assert.strictEqual(parseGdriveId("https://drive.google.com/file/d/1AbCdefGhIJ2klMNOp3q/view?usp=sharing"), "1AbCdefGhIJ2klMNOp3q");
  assert.strictEqual(parseGdriveId("https://drive.google.com/open?id=1AbCdefGhIJ2klMNOp3q"), "1AbCdefGhIJ2klMNOp3q");
  assert.strictEqual(parseGdriveId("https://drive.google.com/uc?id=1AbCdefGhIJ2klMNOp3q&export=download"), "1AbCdefGhIJ2klMNOp3q");
  assert.strictEqual(parseGdriveId("https://drive.google.com/uc?export=download&id=1AbCdefGhIJ2klMNOp3q"), "1AbCdefGhIJ2klMNOp3q");
  assert.throws(() => parseGdriveId("https://drive.google.com/drive/folders/1AbCdefGhIJ2klMNOp3q"), /folder/);
  assert.throws(() => parseGdriveId("https://example.com/x"), /Format/);
  const a = splitPublishLongArgs("/publish_long 2026-09-12 https://drive.google.com/file/d/1AbCdefGhIJ2klMNOp3q/view");
  assert.strictEqual(a.date, "2026-09-12", "tanggal");
  assert.throws(() => splitPublishLongArgs("/publish_long"), /Format/);
  console.log("ok parseGdriveId + args");
}
// 4. splitBeats: ≤25 kata gabung, <1000 char, estimasi ≤10 dtk
{
  const words = Array(60).fill("kata").join(" ");
  const beats = splitBeats(`${words}. Kalimat penutup yang singkat dan jelas untuk Anda.`, [], [{ title: "Intro", startSec: 0 }], []);
  assert(beats.length >= 3, `beats=${beats.length}`);
  for (const b of beats) {
    assert(b.text.length < 1000, "beat >=1000 char");
    assert(b.estSec <= 10 && b.estSec >= 3, `estSec=${b.estSec}`);
    assert(b.faceless === true && b.audio.music === false, "constraint faceless/musik hilang");
  }
  assert(beats[0].startSec === 0, "beat pertama tidak 00:00");
  console.log(`ok splitBeats (${beats.length} beats)`);
}
// 5. validateChapters: terima valid, tolak 3 pola rusak
{
  validateChapters([{ title: "A", startSec: 0 }, { title: "B", startSec: 30 }, { title: "C", startSec: 120 }], 300);
  assert.throws(() => validateChapters([{ title: "A", startSec: 5 }, { title: "B", startSec: 30 }, { title: "C", startSec: 120 }], 300), /00:00/);
  assert.throws(() => validateChapters([{ title: "A", startSec: 0 }, { title: "B", startSec: 5 }, { title: "C", startSec: 120 }], 300), /10 dtk/);
  assert.throws(() => validateChapters([{ title: "A", startSec: 0 }, { title: "B", startSec: 30 }], 300), /< 3/);
  assert.throws(() => validateChapters(
    [{ title: "A", startSec: 0 }, { title: "B", startSec: 100 }, { title: "C", startSec: 50 }], 300), /monoton/);
  const d = chaptersToDescription("desc", [{ title: "Intro", startSec: 0 }, { title: "X", startSec: 65 }]);
  assert(d.includes("00:00 Intro") && d.includes("01:05 X"), "format chapters salah");
  assert.strictEqual(formatTimestamp(270), "04:30");
  console.log("ok validateChapters + description");
}
console.log("SEMUA UJI LONG-FORM LOLOS");
