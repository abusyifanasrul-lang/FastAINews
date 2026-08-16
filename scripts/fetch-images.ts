// Download og:image utk 5 sumber konten #3 → content/2026-08-04/images/, update DB
import { db } from "../src/db.js";
import { fetchOgImage } from "../src/research.js";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const date = "2026-08-04";
const c = db.prepare("SELECT id FROM contents WHERE date = ?").get(date) as { id: number };
const sources = db.prepare("SELECT id, title, url FROM sources WHERE content_id = ?").all(c.id) as { id: number; title: string; url: string }[];

const imgDir = join(process.cwd(), "content", date, "images");
mkdirSync(imgDir, { recursive: true });

const up = db.prepare("UPDATE sources SET image_path = ? WHERE id = ?");
let ok = 0;
for (let i = 0; i < sources.length; i++) {
  const s = sources[i];
  const img = await fetchOgImage(s.url, join(imgDir, `src${i + 1}`));
  if (img) { up.run(img, s.id); ok++; }
  console.log(`${s.title.slice(0, 40)} → ${img ? "OK" : "GAGAL"}`);
}
console.log(`\n${ok}/${sources.length} gambar terdownload`);