interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  GITHUB_PAT: string;
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
    headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "master", inputs }),
  });
  return r.status === 204;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") return new Response("OK", { status: 200 });

    // Verify webhook secret
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");
    if (secret !== env.WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });

    const update = await request.json() as any;
    const cb = update.callback_query;
    const msg = update.message;

    // Handle callback queries (button clicks)
    if (cb) {
      const fromId = String(cb.from?.id);
      if (fromId !== env.OWNER_CHAT_ID) {
        await tg(env.BOT_TOKEN, "answerCallbackQuery", { callback_query_id: cb.id, text: "Bukan owner." });
        return new Response("OK");
      }

      const data: string = cb.data ?? "";
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;

      // ACK immediately — user sees feedback <1s
      await tg(env.BOT_TOKEN, "answerCallbackQuery", { callback_query_id: cb.id });

      if (/^approve_\d+$/.test(data)) {
        const contentId = data.replace("approve_", "");
        await tg(env.BOT_TOKEN, "editMessageText", {
          chat_id: chatId, message_id: messageId,
          text: "⏳ Diterima. Runner memproses posting (±2-4 menit)...",
        });
        const ok = await ghDispatch(env.GITHUB_PAT, env.REPO, "ainews-publish.yml", { content_id: contentId, action: "approve" });
        if (!ok) {
          // Fallback: dispatch main pipeline with content_id
          await ghDispatch(env.GITHUB_PAT, env.REPO, "ainews.yml", { content_id: contentId });
        }
      } else if (/^skip_\d+$/.test(data)) {
        await tg(env.BOT_TOKEN, "editMessageText", {
          chat_id: chatId, message_id: messageId,
          text: "⏭ Konten dilewati hari ini.",
        });
      } else if (/^revisi_\d+$/.test(data)) {
        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text: "✏️ Balas (reply) pesan preview ini dengan catatan revisimu.",
          reply_to_message_id: messageId,
        });
      }
      return new Response("OK");
    }

    // Handle text messages
    if (msg?.text && String(msg.from?.id) === env.OWNER_CHAT_ID) {
      const text: string = msg.text.trim();

      // /run command
      if (text === "/run") {
        await tg(env.BOT_TOKEN, "sendMessage", { chat_id: msg.chat.id, text: "🏃 Memicu pipeline harian..." });
        await ghDispatch(env.GITHUB_PAT, env.REPO, "ainews.yml", {});
        return new Response("OK");
      }

      // Reply to preview message = revision note
      if (msg.reply_to_message) {
        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: msg.chat.id,
          text: `📝 Revisi diterima. Memicu pipeline ulang...`,
        });
        await ghDispatch(env.GITHUB_PAT, env.REPO, "ainews.yml", {
          revision_note: text,
          content_id: String(msg.reply_to_message.message_id),
        });
        return new Response("OK");
      }
    }

    return new Response("OK");
  },
};

</parameter>
</invoke>
</content>