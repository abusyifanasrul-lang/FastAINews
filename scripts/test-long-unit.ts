import assert from "node:assert";
import { stripMidroll, validateLongScript, formatTimestamp, trimNaskahToLength } from "../src/long/validate.js";
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
// Revisi 6: jumlah longgar (kurang → parsial + pad di orchestrator, lebih → potong),
// visual-invalid dibuang per-objek (hanya 0-valid yang throw).
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
  const formattedJson = "[\n  " + trio.map((t) => JSON.stringify(t)).join(",\n  ") + "\n]";
  assert.strictEqual(parseStoryboardJson(formattedJson, 3).length, 3, "formatted JSON dengan newline gagal diparse");
  const spacedJson = "[ " + trio.map((t) => JSON.stringify(t)).join(" , ") + " ]";
  assert.strictEqual(parseStoryboardJson(spacedJson, 3).length, 3, "spaced JSON gagal diparse");
  const adversarial = "Berikut storyboard untuk [bab: Intro & Tesis Utama]: \n" + formattedJson;
  assert.strictEqual(parseStoryboardJson(adversarial, 3).length, 3, "kurung siku teks pembuka merusak parsing");
  // Test unbracketed objects (deretan {...}, {...} tanpa kurung siku luar)
  const unbracketed = trio.map((t) => JSON.stringify(t)).join(",\n");
  assert.strictEqual(parseStoryboardJson(unbracketed, 3).length, 3, "unbracketed objects gagal diekstrak");
  // Test numbered objects (1. {...}\n2. {...})
  const numbered = trio.map((t, i) => `${i + 1}. ${JSON.stringify(t)}`).join("\n");
  assert.strictEqual(parseStoryboardJson(numbered, 3).length, 3, "numbered objects gagal diekstrak");
  // Test lean scene field + auto-expansion studio tags
  const lean = JSON.stringify([{ visual: "T2V_GENERATION", scene: "macro shot of Apple Watch sapphire crystal", sfx: "subtle hum" }]);
  const leanHints = parseStoryboardJson(lean, 1);
  assert(leanHints[0].prompt.includes("macro shot of Apple Watch sapphire crystal"), "scene tidak masuk ke prompt");
  assert(leanHints[0].prompt.includes("Unreal Engine 5 aesthetic"), "studio tags tidak diekspansi");
  assert(leanHints[0].prompt.includes("faceless, no people, no text"), "faceless tidak disuntik");
  assert(leanHints[0].sfx.includes("no background music"), "no music tidak disuntik");
  assert.throws(() => parseStoryboardJson("bukan json sama sekali", 3), /JSON/);
  assert.strictEqual(parseStoryboardJson(good, 5).length, 3, "kurang objek harus parsial, bukan buang 1 batch");
  const five = JSON.stringify([...trio, ...trio.slice(0, 2)]);
  assert.strictEqual(parseStoryboardJson(five, 3).length, 3, "lebih objek harus dipotong, bukan buang 1 batch");
  assert.throws(() => parseStoryboardJson("[]", 1), /JSON/);
  assert.throws(() => parseStoryboardJson(JSON.stringify([{ visual: "DRAMA", prompt: "x", sfx: "y" }]), 1), /visual/);
  const mixed = JSON.stringify([{ visual: "DRAMA", prompt: "x", sfx: "y" }, trio[0]]);
  assert.strictEqual(parseStoryboardJson(mixed, 2).length, 1, "objek valid ikut dibuang karena 1 objek rusak");
  console.log("ok parseStoryboardJson (JSON-only, lean scene auto-expansion, jumlah longgar, visual-invalid per-objek, sanitasi jaminan)");
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
  // edisi DENGAN gambar: STATIC tetap STATIC (dapat gambar least-used — perilaku sumber berita)
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
// 11. trimNaskahToLength: pangkas di batas kalimat, null bila tak layak
{
  const panjang = ("Narasi ini cukup panjang untuk Anda dengan fakta penting yang menarik. ").repeat(400);
  const potong = trimNaskahToLength(panjang, 15000);
  assert(potong !== null, "trim gagal");
  assert(potong.length <= 15000, `trim melebihi batas: ${potong.length}`);
  assert(/[.!?]\s*$/.test(potong), "trim tidak berakhir di batas kalimat");
  assert(trimNaskahToLength("pendek. tanpa batas layak", 3) === null, "trim pendek harus null");
  assert(trimNaskahToLength("sudah pas.", 100) === "sudah pas.", "trim teks pendek mengubah teks");
  console.log("ok trimNaskahToLength (batas kalimat, null bila tidak layak)");
}
// 12. Revisi 5: fragmen ekor ≤6 kata digabung ke beat sebelumnya
{
  const scriptFrag = [
    "Kita menyaksikan bagaimana perangkat wearable mulai menormalisasi pengawasan suara terus-menerus di kehidupan sehari-hari untuk Anda semua.",
    "seluruh dunia.",
    "Konteks makro yang muncul adalah pergeseran fundamental dari eksperimen laboratorium ke implementasi skala massal yang nyata.",
    "ekonomi.",
  ].join(" ");
  const beats = splitBeats(scriptFrag, [], [{ title: "A", startSec: 0 }], []);
  assert(!beats.some((b) => b.text === "seluruh dunia." || b.text === "ekonomi."), "fragmen ekor tidak digabung");
  for (const b of beats) assert(b.text.split(/\s+/).length > 6 || beats.length === 1, `beat fragmen tersisa: "${b.text}"`);
  // chain fragmen pendek terserap semua
  const chain = splitBeats("Kalimat pembuka yang cukup panjang berisi dua puluh kata untuk pengujian yang benar sekarang. Tiga kata saja. Dua kata.", [], [{ title: "A", startSec: 0 }], []);
  assert(!chain.some((b) => b.text === "Tiga kata saja." || b.text === "Dua kata."), "chain fragmen tidak terserap");
  console.log(`ok gabung fragmen ekor (${beats.length} beats, tanpa beat sampah)`);
}
// 13. Revisi 5: penalti overuse gambar — fallback least-used, maks 4x per gambar
{
  const teks = Array(10).fill("Narasi berita yang cukup panjang untuk pengujian pembagian gambar yang merata dan adil untuk Anda.").join(" ");
  const imgs = ["a.jpg", "b.jpg"].map((f) => `content/long/2026-09-12/images/${f}`);
  const staticHints = Array(10).fill({ visual: "STATIC_IMAGE_MOTION" as const, prompt: "", sfx: "s" });
  const beats = splitBeats(teks, staticHints, [{ title: "A", startSec: 0 }], imgs);
  const imgBeats = beats.filter((b) => b.srcImage);
  assert(imgBeats.length > 0, "tidak ada beat bergambar");
  const counts = new Map<string, number>();
  for (const b of imgBeats) counts.set(b.srcImage!, (counts.get(b.srcImage!) ?? 0) + 1);
  // 2 gambar, ≤8 beat bergambar (10 hints, sebagian bisa T2V via guard bila 0 — di sini ada gambar jadi STATIC semua)
  // batas longgar: tidak ada gambar yang dipakai > 2x lipat gambar lain (distribusi merata, bukan siklik murni)
  const vals = [...counts.values()];
  assert(Math.max(...vals) - Math.min(...vals) <= 1, `distribusi timpang: ${JSON.stringify([...counts])}`);
  // hint LLM eksplisit dihormati walau gambar itu sudah jenuh
  const saturated = splitBeats(
    "Narasi pertama yang panjang untuk Anda. Narasi kedua yang panjang untuk Anda.",
    [
      { visual: "STATIC_IMAGE_MOTION" as const, prompt: "", sfx: "s", srcImage: imgs[0] },
      { visual: "STATIC_IMAGE_MOTION" as const, prompt: "", sfx: "s", srcImage: imgs[0] },
      { visual: "STATIC_IMAGE_MOTION" as const, prompt: "", sfx: "s", srcImage: imgs[0] },
      { visual: "STATIC_IMAGE_MOTION" as const, prompt: "", sfx: "s", srcImage: imgs[0] },
      { visual: "STATIC_IMAGE_MOTION" as const, prompt: "", sfx: "s", srcImage: imgs[0] },
    ],
    [{ title: "A", startSec: 0 }],
    imgs,
  );
  assert(saturated.every((b) => b.srcImage === imgs[0]), "hint LLM eksplisit tidak dihormati");
  console.log(`ok penalti overuse gambar (distribusi ${JSON.stringify([...counts])}, hint eksplisit dihormati)`);
}
console.log("SEMUA UJI LONG-FORM LOLOS");
