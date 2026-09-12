import assert from "node:assert";
import { stripMidroll, validateLongScript, formatTimestamp } from "../src/long/validate.js";
import { parseGdriveId, splitPublishLongArgs } from "../src/long/gdrive.js";
import { splitBeats, validateChapters, chaptersToDescription } from "../src/long/storyboard.js";
import { classifyBeats, parseStoryboardJson } from "../src/long/llm-long.js";

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
// 4. splitBeats: <=20 kata gabung, <1000 char, estimasi <=10 dtk
{
  const words = Array(60).fill("kata").join(" ");
  const beats = splitBeats(`${words}. Kalimat penutup yang singkat dan jelas untuk Anda.`, [], [{ title: "Intro", startSec: 0 }], ["content/long/2026-09-11/images/src1.jpg"]);
  assert(beats.length >= 3, `beats=${beats.length}`);
  for (const b of beats) {
    const wCount = b.text.split(/\s+/).length;
    assert(wCount <= 20, `beat >20 kata (${wCount} kata): "${b.text}"`);
    assert(b.text.length < 1000, "beat >=1000 char");
    assert(b.estSec <= 10 && b.estSec >= 3, `estSec=${b.estSec}`);
    assert(b.faceless === true && b.audio.music === false, "constraint faceless/musik hilang");
    if (b.srcImage) assert(!b.srcImage.startsWith("/") && !b.srcImage.includes("runner"), `path tidak relatif: ${b.srcImage}`);
  }
  assert(beats[0].startSec === 0, "beat pertama tidak 00:00");
  console.log(`ok splitBeats (${beats.length} beats, max words <= 20, max sec <= 10s)`);
}
// 5. classifyBeats (Thematic Visual Mapper): prompt English UE5, faceless, no music, no leak
{
  const sampleBeats = [
    "TechCrunch melaporkan bahwa Nvidia meluncurkan chip GPU generasi terbaru dengan arsitektur 2 nanometer.",
    "Pusat data kecerdasan buatan kini membutuhkan konsumsi energi dan daya komputasi skala gigawatt.",
    "Para peneliti melatih model neural network deep learning dengan ratusan miliar parameter untuk nalar.",
    "Perusahaan robotika mendemonstrasikan lengan robot otonom dan drone swarm untuk industri manufaktur.",
    "Pakar keamanan siber memperingatkan potensi serangan peretas dan kebocoran data privasi pada sistem AI.",
    "Studi kasus biologi komputasi memanfaatkan AI untuk menyaring molekul antimikroba baru.",
    "Pasar enterprise AI mencatatkan pertumbuhan pendapatan hingga 70 persen dengan valuasi triliunan rupiah.",
    "Kita memasuki babak baru di mana adopsi teknologi cerdas mengubah seluruh aspek kehidupan.",
  ];
  const hints = await classifyBeats(sampleBeats, ["Intro", "Deep-Dive"], []);
  assert.strictEqual(hints.length, sampleBeats.length, "jumlah hint tidak cocok");
  const t2v = hints.filter((h) => h.visual === "T2V_GENERATION");
  assert(t2v.length >= Math.ceil(sampleBeats.length * 0.35), `T2V terlalu sedikit: ${t2v.length}/${sampleBeats.length}`);
  for (const h of t2v) {
    assert(h.prompt.includes("Unreal Engine 5"), `prompt bukan UE5: ${h.prompt}`);
    assert(h.prompt.includes("faceless, no people, no text"), `constraint hilang di prompt: ${h.prompt}`);
    assert(!/menjelaskan|dilaporkan|diproyeksikan|mengumumkan|bahwa/i.test(h.prompt), `kata bahasa Indonesia bocor ke prompt: ${h.prompt}`);
    assert(h.sfx.includes("no background music") || h.sfx.includes("no music"), `sfx tidak melarang musik: ${h.sfx}`);
  }
  console.log(`ok Thematic Visual Mapper (${t2v.length} T2V, prompts UE5 studio-grade murni Inggris)`);
}
// 6. validateChapters: terima valid, tolak 3 pola rusak
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
// 7. parseStoryboardJson: JSON valid/fenced, sanitasi jaminan paten, tolak format rusak
{
  const trio = Array(3).fill(0).map((_, i) => ({ visual: "T2V_GENERATION", prompt: `cinematic macro of next-gen chip ${i}, glowing interconnects`, sfx: "subtle electronic hum" }));
  const good = JSON.stringify(trio);
  const hints = parseStoryboardJson(good, 3);
  assert.strictEqual(hints.length, 3, "jumlah hint salah");
  assert(hints[0].prompt.includes("faceless, no people, no text"), "jaminan faceless tidak disuntik");
  assert(hints[0].sfx.includes("no background music"), "jaminan no-music tidak disuntik");
  const fenced = "```json\n" + good + "\n```";
  assert.strictEqual(parseStoryboardJson(fenced, 3).length, 3, "fence gagal dibersihkan");
  const withImg = JSON.stringify([{ visual: "I2V_ANIMATE_IMAGE", prompt: "animate data center image", sfx: "deep drone", srcImage: "content/long/x/images/src1.jpg" }]);
  assert.strictEqual(parseStoryboardJson(withImg, 1)[0].srcImage, "content/long/x/images/src1.jpg", "srcImage hilang");
  assert.strictEqual(parseStoryboardJson(JSON.stringify([{ visual: "STATIC_IMAGE_MOTION", prompt: "harus kosong", sfx: "sfx" }]), 1)[0].prompt, "", "prompt STATIC tidak dikosongkan");
  const adversarial = "Berikut storyboard untuk [bab: Intro & Tesis Utama]: " + good;
  assert.strictEqual(parseStoryboardJson(adversarial, 3).length, 3, "kurung siku teks pembuka merusak parsing");
  assert.throws(() => parseStoryboardJson("bukan json sama sekali", 3), /JSON/);
  assert.throws(() => parseStoryboardJson(good, 5), /Jumlah/);
  assert.throws(() => parseStoryboardJson(JSON.stringify([{ visual: "DRAMA", prompt: "x", sfx: "y" }]), 1), /visual/);
  console.log("ok parseStoryboardJson (JSON-only, sanitasi jaminan, tolak rusak)");
}
// 8. splitBeats: srcImage dari hint dipakai bila valid, dibuang bila path liar
{
  const imgA = "content/long/2026-09-12/images/src1.jpg";
  const imgB = "content/long/2026-09-12/images/src2.jpg";
  const text = `${Array(60).fill("narasi berita yang cukup panjang untuk Anda").join(" ")}.`;
  const hintsValid = [{ visual: "I2V_ANIMATE_IMAGE" as const, prompt: "p", sfx: "s", srcImage: imgA }];
  const beatsA = splitBeats(text, hintsValid, [{ title: "A", startSec: 0 }], [imgA, imgB]);
  assert(beatsA.some((b) => b.srcImage === imgA), "srcImage valid dari hint tidak dipakai");
  const hintsLiar = [{ visual: "I2V_ANIMATE_IMAGE" as const, prompt: "p", sfx: "s", srcImage: "/absent/path.jpg" }];
  const beatsB = splitBeats(text, hintsLiar, [{ title: "A", startSec: 0 }], [imgA, imgB]);
  for (const b of beatsB) assert(b.srcImage !== "/absent/path.jpg", "path liar dipakai");
  console.log("ok splitBeats srcImage hint (valid dipakai, liar dibuang)");
}
// 9. guard STATIC-blank: STATIC tanpa gambar ter-resolve (edisi 0 gambar) → T2V themed, tidak blank
{
  const teks = "Narasi singkat tentang regulasi AI yang berdampak untuk Anda.";
  const beatsBlank = splitBeats(teks, [{ visual: "STATIC_IMAGE_MOTION", prompt: "", sfx: "s" }], [{ title: "A", startSec: 0 }], []);
  assert(beatsBlank.length > 0, "beats kosong");
  for (const b of beatsBlank) {
    assert(b.visual === "T2V_GENERATION", `STATIC blank tidak dialihkan: ${b.visual}`);
    assert(b.prompt.includes("Unreal Engine 5") && b.prompt.includes("faceless, no people, no text"), "prompt themed rusak");
    assert(b.srcImage == null, "srcImage harus null pada T2V");
  }
  // edisi DENGAN gambar: STATIC tetap STATIC (dapat gambar siklik — perilaku sumber berita)
  const img = "content/long/2026-09-12/images/src1.jpg";
  const beatsImg = splitBeats(teks, [{ visual: "STATIC_IMAGE_MOTION", prompt: "", sfx: "s" }], [{ title: "A", startSec: 0 }], [img]);
  for (const b of beatsImg) assert(b.visual === "STATIC_IMAGE_MOTION" && b.srcImage === img, "STATIC dengan gambar ikut teralihkan");
  console.log("ok guard STATIC-blank (0 gambar → T2V themed; dengan gambar tetap STATIC)");
}
// 10. parseStoryboardJson tahan benc: echo input + JSON terpotong → salvage objek utuh
{
  const echo = "1. Bab: Intro & Tesis Utama | narasi berita untuk Anda di sini.\n2. Bab: Konteks | narasi lanjutan yang lain.\n";
  const truncated = echo + '[{"visual": "T2V_GENERATION", "prompt": "cinematic macro of a chip, faceless, no people, no text", "sfx": "hum, no background music"},\n{"visual": "I2V_AN';
  const salv = parseStoryboardJson(truncated, 8);
  assert.strictEqual(salv.length, 1, `salvage count: ${salv.length}`);
  assert(salv[0].visual === "T2V_GENERATION", "objek salvage salah");
  const full = parseStoryboardJson(echo + JSON.stringify([{ visual: "T2V_GENERATION", prompt: "p", sfx: "s" }]), 1);
  assert.strictEqual(full.length, 1, "echo + array utuh gagal diparse");
  console.log("ok parseStoryboardJson salvage (echo/terpotong ditangani)");
}
console.log("SEMUA UJI LONG-FORM LOLOS");
