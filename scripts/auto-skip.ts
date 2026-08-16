// Auto-skip 20:00 WITA — konten yang masih PENDING_REVIEW dilewati (tak dipublish)
import { db } from "../src/db.js";

const pending = db.prepare("SELECT id, date FROM contents WHERE status='PENDING_REVIEW'").all() as
  | { id: number; date: string }[];

if (pending.length === 0) {
  console.log("Tidak ada konten pending → tak perlu auto-skip.");
  process.exit(0);
}

const up = db.prepare("UPDATE contents SET status='SKIPPED', updated_at=CURRENT_TIMESTAMP WHERE id=?");
for (const p of pending) {
  up.run(p.id);
  console.log(`#${p.id} (${p.date}) → SKIPPED (auto-skip 20:00)`);
}