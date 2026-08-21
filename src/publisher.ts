import "dotenv/config";
import { db } from "./db.js";
import { readFileSync } from "node:fs";
import { publishToSocial } from "./zernio.js";

export interface PublishResult {
  platform: string;
  ok: boolean;
  externalId?: string;
  url?: string;
  error?: string;
}

/** Refresh token Google → access token */
async function getGoogleAccessToken(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: process.env.YT_REFRESH_TOKEN!,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json() as { access_token?: string; error?: string };
  if (!j.access_token) throw new Error(`Google token gagal: ${j.error}`);
  return j.access_token;
}

/** Upload video ke YouTube (resumable), return video id */
export async function uploadYoutube(videoPath: string, title: string, description: string, privacy: "private" | "unlisted" | "public" = "private", thumbnailUrl?: string): Promise<string> {
  const token = await getGoogleAccessToken();
  const meta = {
    snippet: {
      title: title.slice(0, 100),
      description: description.slice(0, 4900),
      tags: ["AI", "Teknologi", "Berita", "Artificial Intelligence"],
      categoryId: "28",
    },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  };
  const bytes = readFileSync(videoPath);
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": bytes.length.toString(),
    },
    body: JSON.stringify(meta),
  });
  if (!init.ok) throw new Error(`YouTube init ${init.status}: ${(await init.text()).slice(0, 300)}`);
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube: tidak ada upload URL");

  const up = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": bytes.length.toString() },
    body: bytes,
  });
  const upJson = await up.json() as { id?: string; error?: { message?: string } };
  if (!up.ok || !upJson.id) throw new Error(`YouTube upload ${up.status}: ${JSON.stringify(upJson).slice(0, 300)}`);

  // set custom thumbnail dari URL (non-fatal — video sudah aman ter-upload)
  if (thumbnailUrl) {
    try {
      const imgResp = await fetch(thumbnailUrl);
      if (imgResp.ok) {
        const imgBuf = Buffer.from(await imgResp.arrayBuffer());
        const tRes = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${upJson.id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
          body: imgBuf,
        });
        console.log(tRes.ok ? "[youtube] thumbnail custom diset" : `[youtube] set thumbnail gagal ${tRes.status} (video tetap live)`);
      }
    } catch (e) {
      console.warn("[youtube] set thumbnail error:", e instanceof Error ? e.message : e);
    }
  }

  return upJson.id;
}

/**
 * Auto-post konten ke platform sosmed.
 * YouTube: API nyata (Data API v3, resumable).
 * TikTok/IG: stub — butuh developer app + token (belum ada).
 */
export async function publishToYouTube(contentId: number, privacy: "private" | "unlisted" | "public" = "private"): Promise<PublishResult> {
  try {
    const c = db.prepare("SELECT id, date, video_169_path, video_916_path, caption, topic_title, script_text FROM contents WHERE id = ?").get(contentId) as
      | { id: number; date: string; video_169_path: string | null; video_916_path: string | null; caption: string | null; topic_title: string | null; script_text: string | null } | undefined;
    if (!c) throw new Error(`Content ${contentId} not found`);
    const videoPath = c.video_169_path ?? c.video_916_path;
    if (!videoPath) throw new Error("Tidak ada video utk YouTube");

    const sources = db.prepare("SELECT title, url, publisher FROM sources WHERE content_id = ?").all(contentId) as
      { title: string; url: string; publisher: string | null }[];

    const title = c.topic_title ?? `Berita AI ${c.date}`;
    const summary = c.script_text ?? c.caption ?? "";
    const srcLines = sources.map((s, i) => `${i + 1}. ${s.publisher ?? "Sumber"}: ${s.title}\n   ${s.url}`).join("\n");
    const description = `${summary}\n\n📰 Sumber Berita:\n${srcLines}\n\n#AI #Teknologi #BeritaAI #ArtificialIntelligence`.slice(0, 4900);
    const id = await uploadYoutube(videoPath, title, description, privacy);

    db.prepare(
      `INSERT INTO publications (content_id, platform, status, external_id, url, error) VALUES (?,?,?,?,?,?)`
    ).run(contentId, "youtube", "SUCCESS", id, `https://youtu.be/${id}`, null);
    console.log(`[publisher] youtube → https://youtu.be/${id}`);
    return { platform: "youtube", ok: true, externalId: id, url: `https://youtu.be/${id}` };
  } catch (e) {
    console.error(`[publisher] youtube gagal:`, (e as Error).message);
    return { platform: "youtube", ok: false, error: (e as Error).message };
  }
}

export async function publishToTikTok(contentId: number): Promise<PublishResult> {
  try {
    const results = await publishToSocial(contentId);
    const r = results.find(x => x.platform === "tiktok");
    if (r) return r;
    if (results.length > 0) return results[0];
    return { platform: "tiktok", ok: false, error: "Tidak ada akun TikTok di Zernio" };
  } catch (e) {
    console.error(`[publisher] tiktok gagal:`, (e as Error).message);
    return { platform: "tiktok", ok: false, error: (e as Error).message };
  }
}

export async function publishToInstagram(contentId: number): Promise<PublishResult> {
  try {
    const results = await publishToSocial(contentId);
    const r = results.find(x => x.platform === "instagram");
    if (r) return r;
    if (results.length > 0) return results[0];
    return { platform: "instagram", ok: false, error: "Tidak ada akun Instagram di Zernio" };
  } catch (e) {
    console.error(`[publisher] instagram gagal:`, (e as Error).message);
    return { platform: "instagram", ok: false, error: (e as Error).message };
  }
}

/** Publish konten ke semua platform + update status */
export async function publishAll(contentId: number, privacy: "private" | "unlisted" | "public" = "public"): Promise<{ results: PublishResult[]; allOk: boolean }> {
  const ytPromise = publishToYouTube(contentId, privacy);
  const socialPromise = publishToSocial(contentId).catch((e) => {
    console.error("[publisher] social gagal:", (e as Error).message);
    return [{ platform: "social", ok: false, error: (e as Error).message } as PublishResult];
  });

  const [ytResult, socialResults] = await Promise.all([ytPromise, socialPromise]);
  const results = [ytResult, ...socialResults];
  const allOk = results.every(r => r.ok);
  db.prepare("UPDATE contents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    allOk ? "PUBLISHED" : "PUBLISH_FAILED",
    contentId
  );
  return { results, allOk };
}