// Kirim preview video ke Telegram (tanpa polling bot) — langsung pakai Bot API
import "dotenv/config";
import { Bot, InputFile } from "grammy";
import { db, getContentWithSources } from "../src/db.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const token = process.env.BOT_TOKEN;
const ownerId = process.env.OWNER_CHAT_ID;
if (!token || !ownerId) { console.error("BOT_TOKEN/OWNER_CHAT_ID missing"); process.exit(1); }

const date = process.argv[2] ?? "2026-08-05";
const c = getContentWithSources(date);
if (!c) { console.error("content not found:", date); process.exit(1); }

const bot = new Bot(token);

function buildKeyboard(id: number) {
  return { inline_keyboard: [
    [{ text: "✅ Approve", callback_data: `approve_${id}` }],
    [{ text: "✏️ Revisi", callback_data: `revisi_${id}` }],
    [{ text: "⏭ Skip", callback_data: `skip_${id}` }],
  ]};
}

const srcText = c.sources.slice(0, 6).map(s => `- ${s.publisher ?? "sumber"}: ${s.url}`).join("\n");
const caption = `📰 *Konten AI News* — ${c.date}\n\n` +
  `*Topik:* ${c.topic_title ?? "(tanpa judul)"}\n\n` +
  `*Sumber:*\n${srcText}`;

const videoPath = c.video_916_path ?? c.video_169_path;
// Telegram limit 50MB — pakai compressed preview jika terlalu besar
const previewPath = join(process.cwd(), "content", date, "shorts-preview.mp4");
const finalPath = existsSync(previewPath) ? previewPath : videoPath;
if (finalPath && existsSync(finalPath)) {
  console.log("sending video:", finalPath);
  await bot.api.sendVideo(ownerId, new InputFile(finalPath), {
    caption,
    parse_mode: "Markdown",
    reply_markup: buildKeyboard(c.id),
    supports_streaming: true,
  });
  console.log("✅ preview terkirim ke Telegram");
} else {
  const script = c.script_text ?? "(kosong)";
  const msg = caption + `\n\n*Naskah:*\n${script.slice(0, 1200)}`;
  await bot.api.sendMessage(ownerId, msg, { parse_mode: "Markdown", reply_markup: buildKeyboard(c.id) });
  console.log("✅ preview text terkirim (video tak ditemukan)");
}
