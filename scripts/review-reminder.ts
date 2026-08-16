// Reminder 17:00 WITA — cek konten PENDING_REVIEW, kirim notif ke owner jika belum di-review
import "dotenv/config";
import { db } from "../src/db.js";

const pending = db.prepare("SELECT id, date, topic_title FROM contents WHERE status='PENDING_REVIEW'").all() as
  | { id: number; date: string; topic_title: string | null }[];

if (pending.length === 0) {
  console.log("Tidak ada konten pending review.");
  process.exit(0);
}

const token = process.env.BOT_TOKEN!;
const ownerId = process.env.OWNER_CHAT_ID!;
for (const p of pending) {
  const msg = `⏰ *Reminder review* — konten ${p.date}\nTopik: ${p.topic_title ?? "-"}\n\nKlik preview video terakhir untuk Approve / Revisi / Skip. Auto-skip otomatis pukul 20:00 WITA.`;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: ownerId, text: msg, parse_mode: "Markdown" }),
  });
  const j = await r.json() as { ok: boolean };
  console.log(`Reminder #${p.id}: ${j.ok ? "terkirim" : "gagal"}`);
}