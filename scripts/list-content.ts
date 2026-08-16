import { db } from "../src/db.js";
const rows = db.prepare("SELECT id, date, status FROM contents ORDER BY date DESC LIMIT 5").all() as { id: number; date: string; status: string }[];
for (const r of rows) console.log(`#${r.id} ${r.date} ${r.status}`);