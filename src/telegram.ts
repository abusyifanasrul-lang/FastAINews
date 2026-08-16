import { Bot, InlineKeyboard, session, type Context } from "grammy";
import "dotenv/config";
import { db, getContentWithSources, updateContentStatus, addRevision } from "./db.js";
import { existsSync } from "node:fs";
import { publishAll } from "./publisher.js";
import { runRevision } from "./pipeline.js";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN missing");
const ownerId = process.env.OWNER_CHAT_ID;
if (!ownerId) throw new Error("OWNER_CHAT_ID missing");

interface SessionData {
  waitingRevisionFor?: number; // content id
}
type MyContext = Context & { session: SessionData };

const bot = new Bot<MyContext>(token);
bot.use(session({ initial: (): SessionData => ({}) }));

function loadContent(contentId: number) {
  const row = db
    .prepare("SELECT date FROM contents WHERE id = ?")
    .get(contentId) as { date: string } | undefined;
  if (!row) throw new Error(`Content ${contentId} not found`);
  const data = getContentWithSources(row.date);
  if (!data) throw new Error(`Content ${contentId} not found`);
  return data;
}

// escape MarkdownV2 special chars
function esc(s: string) { return s.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1"); }

function buildKeyboard(contentId: number) {
  return new InlineKeyboard()
    .text("✅ Approve", `approve_${contentId}`)
    .text("✏️ Revisi", `revisi_${contentId}`)
    .text("⏭ Skip", `skip_${contentId}`);
}

// edit msg: video → editMessageCaption, text → editMessageText
async function editMsg(ctx: MyContext, text: string, extra?: Record<string, unknown>) {
  const msg = ctx.callbackQuery?.message;
  const hasVideo = msg && "video" in msg;
  try {
    if (hasVideo) {
      await ctx.editMessageCaption({ caption: text, ...extra });
    } else {
      await ctx.editMessageText(text, extra as any);
    }
  } catch {
    // fallback: kirim msg baru kalau edit gagal (msg terlalu tua, dll)
    await ctx.reply(text, { parse_mode: "Markdown" } as any);
  }
}

// kirim preview: video 9:16 (jika ada) + caption; fallback naskah text
export async function sendPreview(contentId: number, revision = 0) {
  const data = loadContent(contentId);
  const keyboard = buildKeyboard(contentId);
  const revLabel = revision > 0 ? ` — Revisi ke-${revision}` : "";
  const srcText = data.sources.slice(0, 6).map(s => `- ${s.publisher ?? "sumber"}: ${s.url}`).join("\n");
  const srcMore = data.sources.length > 6 ? `\n… +${data.sources.length - 6} sumber lain` : "";

  const caption = `📰 *Konten AI News*${revLabel} — ${data.date}\n\n` +
    `*Topik:* ${data.topic_title ?? "(tanpa judul)"}\n\n` +
    `*Sumber:*\n${srcText}${srcMore}`;

  const videoPath = data.video_916_path ?? data.video_169_path;
  if (videoPath && existsSync(videoPath)) {
    const { InputFile } = await import("grammy");
    const opts = { caption, parse_mode: "Markdown" as const, reply_markup: keyboard, supports_streaming: true };
    let lastErr: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        await bot.api.sendVideo(ownerId as string, new InputFile(videoPath), opts);
        return;
      } catch (e) {
        lastErr = e;
        console.error(`sendVideo attempt ${i+1} gagal:`, e instanceof Error ? e.message : String(e));
        if (i < 2) await new Promise(r => setTimeout(r, 1500 * (i+1)));
      }
    }
    throw new Error(`sendVideo retry gagal: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
  } else {
    const script = data.script_text ?? "(kosong)";
    const msg = caption + `\n\n*Naskah:*\n${script.slice(0, 1200)}`;
    await bot.api.sendMessage(ownerId as string, msg, { parse_mode: "Markdown", reply_markup: keyboard });
  }
}

// /start
bot.command("start", async (ctx) => {
  await ctx.reply("Halo! Saya pegawai digital AInews. Kirim /run untuk mulai produksi konten hari ini.");
});

// /run — trigger manual (konten hari ini)
bot.command("run", async (ctx) => {
  const date = new Date().toISOString().slice(0, 10);
  const existing = getContentWithSources(date);
  if (existing) {
    await ctx.reply(`Sudah ada konten hari ini (status: ${existing.status}).`);
    return;
  }
  await ctx.reply("⏳ Memulai riset & produksi...");
});

// Callback: Approve
bot.callbackQuery(/^approve_(\d+)$/, async (ctx) => {
  const id = Number(ctx.match[1]);
  if (ctx.from.id.toString() !== ownerId) {
    await ctx.answerCallbackQuery("Bukan owner.");
    return;
  }
  const row = db.prepare("SELECT status FROM contents WHERE id = ?").get(id) as { status: string } | undefined;
  if (!row || row.status === "APPROVED" || row.status === "PUBLISHING" || row.status === "PUBLISHED") {
    await ctx.answerCallbackQuery("Sudah diproses.");
    return;
  }
  updateContentStatus(id, "APPROVED");
  await editMsg(ctx, "✅ Konten disetujui! Memulai auto-posting...");
  await ctx.answerCallbackQuery("Approved!");
  try {
    const { results } = await publishAll(id);
    const lines = results.map(r => `${r.ok ? "✅" : "❌"} ${r.platform}: ${r.url ?? r.error ?? "ok"}`).join("\n");
    await editMsg(ctx, `✅ *Auto\\-posting selesai*\n${esc(lines)}`, { parse_mode: "MarkdownV2" });
  } catch (e) {
    await editMsg(ctx, `❌ Auto\\-posting gagal: ${esc((e as Error).message)}`, { parse_mode: "MarkdownV2" });
  }
});

// Callback: Revisi
bot.callbackQuery(/^revisi_(\d+)$/, async (ctx) => {
  const id = Number(ctx.match[1]);
  if (ctx.from.id.toString() !== ownerId) {
    await ctx.answerCallbackQuery("Bukan owner.");
    return;
  }
  ctx.session.waitingRevisionFor = id;
  await editMsg(ctx, "✏️ Kirim catatan revisi (teks bebas).");
  await ctx.answerCallbackQuery("Revisi dimulai.");
});

// Callback: Skip
bot.callbackQuery(/^skip_(\d+)$/, async (ctx) => {
  const id = Number(ctx.match[1]);
  if (ctx.from.id.toString() !== ownerId) {
    await ctx.answerCallbackQuery("Bukan owner.");
    return;
  }
  updateContentStatus(id, "SKIPPED");
  await editMsg(ctx, "⏭ Konten dilewati hari ini.");
  await ctx.answerCallbackQuery("Skipped.");
});

// Handler text untuk catatan revisi
bot.on("message:text", async (ctx) => {
  const id = ctx.session.waitingRevisionFor;
  if (!id) return;
  const note = ctx.message.text;
  if (!note) return;

  addRevision(id, note, null, null, null);
  updateContentStatus(id, "REVISION_PENDING");
  ctx.session.waitingRevisionFor = undefined;
  await ctx.reply(`📝 Revisi diterima. Memproses ulang konten #${id}...`);
  try {
    const rev = await runRevision(id, note);
    await ctx.reply(`✅ Revisi ke-${rev.version} selesai. Preview dikirim ulang.`);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error(`[revisi] #${id} GAGAL:`, msg);
    updateContentStatus(id, "REVISION_FAILED");
    await ctx.reply(`❌ Revisi gagal: ${msg}`);
  }
});

// alert function — kirim pesan error ke owner (bisa dipanggil dari pipeline)
export async function sendAlert(msg: string) {
  try {
    if (!ownerId) return;
    const bot = new Bot(token!);
    await bot.api.sendMessage(ownerId, `🚨 *Pipeline Alert*\n\n${msg}`, { parse_mode: "Markdown" });
  } catch {}
}

// start bot jika dijalankan langsung (bukan di-import)
const isMain = process.argv[1]?.includes("telegram");
if (isMain) {
  // tangkap crash biar gak silent die
  process.on("unhandledRejection", (err) => {
    console.error("[bot] unhandledRejection:", err);
  });
  process.on("uncaughtException", (err) => {
    console.error("[bot] uncaughtException:", err);
  });
  bot.start();
  console.log("🤖 Telegram bot running");
}

export { bot, ownerId };