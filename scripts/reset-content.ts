import { db } from "../src/db.js";
const c = db.prepare("SELECT id FROM contents WHERE date='2026-08-04'").get() as { id: number };
db.prepare("DELETE FROM publications WHERE content_id = ?").run(c.id);
db.prepare("UPDATE contents SET status='PENDING_REVIEW' WHERE id = ?").run(c.id);
console.log("#3 → PENDING_REVIEW, publications dibersihkan");