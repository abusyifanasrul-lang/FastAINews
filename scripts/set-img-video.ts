import { db } from "../src/db.js";
const c = db.prepare("SELECT id FROM contents WHERE date='2026-08-04'").get() as { id: number };
db.prepare("UPDATE contents SET video_916_path=? WHERE id=?")
  .run(`C:\\Users\\K4G3\\ainews-bot\\content\\2026-08-04\\shorts-openmontage-img.mp4`, c.id);
console.log("DB video_916 → shorts-openmontage-img.mp4 (#", c.id, ")");