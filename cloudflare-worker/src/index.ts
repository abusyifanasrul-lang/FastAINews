interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  REPO_PAT: string;
  OWNER_CHAT_ID: string;
  REPO: string;
}

const TG_API = (token: string) => `https://api.telegram.org/bot${token}`;

async function tg(token: string, method: string, body: Record<string, unknown>): Promise<void> {
  await fetch(`${TG_API(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function ghDispatch(pat: string, repo: string, workflow: string, inputs: Record<string, string>): Promise<boolean> {
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json", "User-Agent": "ainews-webhook/1.0" },
    body: JSON.stringify({ ref: "master", inputs }),
  });
  const body = await r.text();
  console.log("[ghDispatch]", workflow, "status:", r.status, "body:", body.slice(0, 300));
  return r.status === 204;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") return new Response("OK", { status: 200 });

    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");
    if (secret !== env.WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });

    const update = await request.json() as any;
    const cb = update.callback_query;
    const msg = update.message;

    console.log("[webhook] update received", { has_cb: !!cb, has_msg: !!msg, cb_data: cb?.data, msg_text: msg?.text?.slice(0, 50) });

    if (cb) {
      const fromId = String(cb.from?.id);
      console.log("[webhook] callback from", fromId, "owner?", fromId === env.OWNER_CHAT_ID);
      if (fromId !== env.OWNER_CHAT_ID) {
        await tg(env.BOT_TOKEN, "answerCallbackQuery", { callback_query_id: cb.id, text: "Bukan owner." });
        return new Response("OK");
      }

      const data: string = cb.data ?? "";
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;

      await tg(env.BOT_TOKEN, "answerCallbackQuery", { callback_query_id: cb.id });

      if (/^approve_\d+$/.test(data)) {
        const contentId = data.replace("approve_", "");
        const videoFileId = cb.message?.video?.file_id;
        console.log("[webhook] approve", contentId, "file_id?", videoFileId ?? "NONE");
        await tg(env.BOT_TOKEN, "editMessageText", {
          chat_id: chatId, message_id: messageId,
          text: "⏳ Diterima. Runner memproses posting (±2-4 menit)...",
        });
        // kirim file_id ke publish workflow supaya tidak perlu DB lookup
        const inputs: Record<string, string> = { content_id: contentId };
        if (videoFileId) inputs.video_file_id = videoFileId;
        const ok = await ghDispatch(env.REPO_PAT, env.REPO, "ainews-publish.yml", inputs);
        if (!ok) {
          console.log("[webhook] ainews-publish.yml dispatch failed");
        }
      } else if (/^skip_\d+$/.test(data)) {
        console.log("[webhook] skip", data);
        await tg(env.BOT_TOKEN, "editMessageText", {
          chat_id: chatId, message_id: messageId,
          text: "⏭ Konten dilewati hari ini.",
        });
      } else if (/^revisi_\d+$/.test(data)) {
        const contentId = data.replace("revisi_", "");
        console.log("[webhook] revisi", data);
        // Edit preview jadi prompt revisi dgn #<contentId> tertanam — reply
        // user ke pesan ini membawa contentId yg benar (stateless, tanpa KV).
        // editMessageCaption utk pesan video, editMessageText utk teks.
        const prompt = `✏️ Revisi #${contentId} — balas (reply) pesan ini dengan catatan revisimu.`;
        if (cb.message?.video) {
          await tg(env.BOT_TOKEN, "editMessageCaption", {
            chat_id: chatId, message_id: messageId, caption: prompt,
          });
        } else {
          await tg(env.BOT_TOKEN, "editMessageText", {
            chat_id: chatId, message_id: messageId, text: prompt,
          });
        }
      }
      return new Response("OK");
    }

    if (msg?.text && String(msg.from?.id) === env.OWNER_CHAT_ID) {
      const text: string = msg.text.trim();

      if (text === "/run") {
        console.log("[webhook] /run command");
        await tg(env.BOT_TOKEN, "sendMessage", { chat_id: msg.chat.id, text: "🏃 Memicu pipeline harian..." });
        await ghDispatch(env.REPO_PAT, env.REPO, "ainews.yml", {});
        return new Response("OK");
      }

      if (msg.reply_to_message) {
        const replied = msg.reply_to_message as any;
        const repliedText: string = replied.caption ?? replied.text ?? "";
        const m = repliedText.match(/✏️ Revisi #(\d+)/);
        // Guard: hanya reply ke prompt revisi bot sendiri yg trigger dispatch.
        // Reply ke pesan lain (atau tanpa #ID) diabaikan — cegah false positive.
        if (!replied.from?.is_bot || !m) {
          console.log("[webhook] reply biasa, abaikan (bukan prompt revisi)");
          return new Response("OK");
        }
        const contentId = m[1];
        console.log("[webhook] revision note untuk konten", contentId);
        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: msg.chat.id,
          text: `📝 Revisi #${contentId} diterima. Memicu pipeline ulang...`,
        });
        await ghDispatch(env.REPO_PAT, env.REPO, "ainews.yml", {
          revision_note: text,
          content_id: contentId,
        });
        return new Response("OK");
      }
    }

    return new Response("OK");
  },
};
