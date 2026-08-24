/**
 * Poller GitHub Actions — pengganti bot listener lokal.
 * Jalan tiap 5 menit via workflow, baca getUpdates Telegram, proses:
 *   - callback approve_ / skip_  → publish TikTok/IG (Zernio) + YouTube
 *   - callback revisi_          → reply "minta catatan" (catatan dikirim sbg REPLY ke pesan preview)
 *   - message:text REPLY ke pesan preview yang menunggu catatan → dispatch workflow revisi
 *   - command /run              → dispatch pipeline harian
 * Offset update disimpan di .github/poller-state.json (commit tiap run bila berubah).
 * Tanpa state di memori → aman untuk job pendek.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishToSocialDirect } from "../src/zernio.js";
import { uploadYoutube } from "../src/publisher.js";
import type { PublishResult } from "../src/publisher.js";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const OWNER = process.env.OWNER_CHAT_ID!;
const GH_PAT = process.env.GITHUB_PAT!;
const REPO = "abusyifanasrul-lang/FastAINews";
const STATE_FILE = ".github/poller-state.json";

// Node fetch di Windows/runner kadang timeout DNS — paksa IPv4-first
import { setDefaultResultOrder } from "node:dns";
setDefaultResultOrder("ipv4first");

function esc(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

async function tg(method: string, body: any): Promise<any> {
  const r = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`tg ${method}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.result;
}

async function ghDispatch(inputs: Record<string, string>): Promise<void> {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/ainews.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GH_PAT}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "master", inputs }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`dispatch ${r.status}: ${await r.text()}`);
}

interface PendingRev { chat_id: string; message_id: number; content_id: number }
type State = { offset?: number; pending_revision?: Record<string, PendingRev> };

function loadState(): State {
  if (!existsSync(STATE_FILE)) return {};
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}

function saveState(s: State): void {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

/** Publish video dari pesan preview (approve). */
async function handleApprove(cb: any): Promise<string> {
  const msg = cb.message;
  const caption: string = msg.caption ?? msg.text ?? "";
  const fileId: string | undefined = msg.video?.file_id;
  if (!fileId) return "Tidak ada video di pesan ini.";

  const dateMatch = caption.match(/— (\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
  const thumbUrlMatch = caption.match(/🖼 Thumbnail: (https?:\/\/\S+)/);
  const thumbUrl = thumbUrlMatch?.[1];
  const postCaption = caption.replace(/\n?🖼 Thumbnail: https?:\/\/\S+\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  // download video dari Telegram (timeout + retry ringan)
  let buf: ArrayBuffer | undefined;
  for (let a = 1; a <= 3; a++) {
    try {
      const file = await tg("getFile", { file_id: fileId });
      const resp = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`, { signal: AbortSignal.timeout(120000) });
      if (!resp.ok) throw new Error(`download ${resp.status}`);
      buf = await resp.arrayBuffer();
      break;
    } catch (e) {
      console.warn(`[approve] download attempt ${a} gagal:`, e instanceof Error ? e.message : e);
      if (a === 3) throw e;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  const tmpPath = join(tmpdir(), `ainews-${Date.now()}.mp4`);
  writeFileSync(tmpPath, Buffer.from(buf!));

  const results: PublishResult[] = [];
  // TikTok + IG via Zernio — gagal tidak memblokir YouTube
  try {
    results.push(...await publishToSocialDirect(tmpPath, postCaption, date, undefined, undefined, thumbUrl));
  } catch (e) {
    const m = (e as Error).message;
    console.error("[poller] zernio gagal:", m);
    results.push({ platform: "tiktok+instagram", ok: false, error: m });
  }
  // YouTube via Data API v3 — thumbnail custom ikut diset
  try {
    const topicLine = postCaption.match(/\*?Topik:\*?\s*(.+)/)?.[1] ?? "Berita AI Hari Ini";
    const ytId = await uploadYoutube(tmpPath, `${topicLine} | AI News ${date}`, postCaption, "public", thumbUrl);
    results.push({ platform: "youtube", ok: true, externalId: ytId, url: `https://youtu.be/${ytId}` });
  } catch (e) {
    const m = (e as Error).message;
    console.error("[poller] youtube gagal:", m);
    results.push({ platform: "youtube", ok: false, error: m });
  }

  try { unlinkSync(tmpPath); } catch {}
  return results.map(r => `${r.ok ? "✅" : "❌"} ${r.platform}: ${r.url ?? r.error ?? "ok"}`).join("\n");
}

async function main(): Promise<void> {
  const state = loadState();

  // 1) drain getUpdates sejak offset tersimpan
  const updates = await tg("getUpdates", {
    offset: state.offset,
    timeout: 0,
    allowed_updates: ["message", "callback_query"],
  });

  for (const u of updates as any[]) {
    state.offset = u.update_id + 1;

    // --- callback tombol ---
    const cb = u.callback_query;
    if (cb) {
      if (String(cb.from.id) !== OWNER) { await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Bukan owner." }).catch(() => {}); continue; }
      const mApprove = /^approve_(\d+)$/.exec(cb.data ?? "");
      const mSkip = /^skip_(\d+)$/.exec(cb.data ?? "");
      const mRevisi = /^revisi_(\d+)$/.exec(cb.data ?? "");
      const msg = cb.message;

      if (msg?.chat?.id && msg?.message_id) {
        if (mApprove) {
          await tg("editMessageText", { chat_id: msg.chat.id, message_id: msg.message_id, text: "✅ Disetujui. Runner memproses posting (±2-4 menit)... ⏳" }).catch(() => {});
          try {
            const summary = await handleApprove(cb);
            await tg("editMessageText", { chat_id: msg.chat.id, message_id: msg.message_id, text: `✅ Auto-posting selesai\n${summary}` }).catch(() => {});
            console.log(`[approve] #${mApprove[1]} OK`);
          } catch (e) {
            const m = (e as Error).message;
            console.error("[poller] approve gagal:", m);
            await tg("editMessageText", { chat_id: msg.chat.id, message_id: msg.message_id, text: `❌ Auto-posting gagal: ${m.slice(0, 300)}` }).catch(() => {});
          }
        } else if (mSkip) {
          // skip = cukup abaikan preview (tidak ada state di server pipeline)
          await tg("editMessageText", { chat_id: msg.chat.id, message_id: msg.message_id, text: "⏭ Konten dilewati hari ini." }).catch(() => {});
        } else if (mRevisi) {
          state.pending_revision = state.pending_revision ?? {};
          state.pending_revision[String(msg.message_id)] = { chat_id: String(msg.chat.id), message_id: msg.message_id, content_id: Number(mRevisi[1]) };
          await tg("sendMessage", { chat_id: msg.chat.id, text: `✏️ Balas (reply) pesan preview ini dengan catatan revisimu.` }).catch(() => {});
        }
      }
      await tg("answerCallbackQuery", { callback_query_id: cb.id }).catch(() => {});
      continue;
    }

    // --- pesan teks ---
    const m = u.message;
    if (m?.text && String(m.from?.id) === OWNER) {
      // reply ke pesan preview yang menunggu catatan revisi?
      const replyTo = m.reply_to_message?.message_id;
      const key = replyTo ? String(replyTo) : undefined;
      const pending = key ? state.pending_revision?.[key] : undefined;
      if (pending) {
        state.pending_revision ??= {};
        delete state.pending_revision[key!];
        await tg("sendMessage", { chat_id: pending.chat_id, text: `📝 Revisi diterima. Memicu pipeline ulang untuk #${pending.content_id}...` }).catch(() => {});
        await ghDispatch({ content_id: String(pending.content_id), revision_note: m.text });
        continue;
      }
      // perintah /run
      if (m.text.trim() === "/run") {
        await tg("sendMessage", { chat_id: String(m.chat.id), text: "🏃 Memicu pipeline harian..." }).catch(() => {});
        await ghDispatch({});
        continue;
      }
      // teks lain tanpa konteks — abaikan
      console.log("[poller] teks diabaikan (bukan reply revisi / perintah)");
    }
  }

  // 2) simpan offset hanya jika berubah
  const before = existsSync(STATE_FILE) ? readFileSync(STATE_FILE, "utf8") : "";
  const after = JSON.stringify(state, null, 2);
  if (before !== after) saveState(state);
  console.log(`[poller] selesai — ${updates.length} update diproses, offset=${state.offset ?? "-"}`);
}

main().catch(e => { console.error("[poller] FATAL:", e); process.exit(1); });
