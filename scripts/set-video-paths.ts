import "dotenv/config";
import { db } from "../src/db.js";
import { join } from "node:path";

const date = "2026-08-04";
const c = db.prepare("SELECT id FROM contents WHERE date = ?").get(date) as { id: number } | undefined;
if (!c) throw new Error("konten tidak ada");

const base = join(process.cwd(), "content", date);
// video baru: OpenMontage 720p vertical (sementara), master masih lama
db.prepare("UPDATE contents SET video_916_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
  .run(join(base, "shorts-openmontage-720.mp4"), c.id);
console.log("DB video_916 → shorts-openmontage-720.mp4 (#", c.id, ")");