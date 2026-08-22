import Zernio from "@zernio/node";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db.js";
import type { PublishResult } from "./publisher.js";

const z = new Zernio({ apiKey: process.env.ZERNIO_API_KEY! });

// Node fetch di Windows kadang timeout DNS — paksa IPv4-first
if (!process.env.NODE_OPTIONS?.includes("ipv4first")) {
  require("node:dns").setDefaultResultOrder("ipv4first");
}

export async function listZernioAccounts(): Promise<{ platform: string; id: string; username: string }[]> {
  const { data } = await z.accounts.listAccounts({});
  return (data.accounts ?? []).map((a: any) => ({
    platform: a.platform,
    id: a._id ?? a.id,
    username: a.username ?? a.displayName ?? "",
  }));
}

/**
 * Upload media via endpoint RESMI z.messages.uploadMediaDirect (multipart).
 * Ini satu-satunya jalur yang mendaftarkan file ke registry internal Zernio —
 * PUT manual ke presigned URL tidak terdaftar → createPost menolak "missing files".
 * Return publicUrl (path /media/... permanen).
 */
async function uploadMediaRegistered(bytes: Uint8Array, contentType: string, label: string): Promise<string> {
  const { data, error } = await (z as any).messages.uploadMediaDirect({
    body: {
      file: new Blob([new Uint8Array(bytes)], { type: contentType }),
      contentType,
    },
  });
  if (error || !data?.url) {
    throw new Error(`${label}: uploadMediaDirect gagal — ${JSON.stringify(error ?? data)}`);
  }
  console.log(`[zernio] ${label} ter-upload (registered): ${data.url} (${data.size ?? bytes.length} bytes)`);
  return data.url;
}

/** Upload file gambar ke storage Zernio, return publicUrl */
export async function uploadImageToZernio(imagePath: string, date: string): Promise<string | undefined> {
  try {
    return await uploadMediaRegistered(new Uint8Array(readFileSync(imagePath)), "image/jpeg", `thumbnail-${date}`);
  } catch (e) {
    console.warn("[zernio] uploadImage gagal:", e instanceof Error ? e.message : e);
    return undefined;
  }
}

export async function publishToSocial(contentId: number): Promise<PublishResult[]> {
  const c = db.prepare(
    "SELECT id, date, video_916_path, video_169_path, topic_title, script_text, caption FROM contents WHERE id = ?"
  ).get(contentId) as any;
  if (!c) throw new Error(`Content ${contentId} not found`);

  const videoPath = c.video_916_path ?? c.video_169_path;
  if (!videoPath) throw new Error("Tidak ada video");

  const sources = db.prepare("SELECT title, url, publisher FROM sources WHERE content_id = ?").all(contentId) as any[];
  const summary = (c.script_text ?? c.caption ?? "").slice(0, 1500);
  const srcLines = sources.map((s, i) => `${i + 1}. ${s.publisher ?? "Sumber"}: ${s.title}`).join("\n");
  const caption = `${summary}\n\n📰 Sumber:\n${srcLines}\n\n#AI #BeritaAI #Teknologi`;

  const thumbPath = join(process.cwd(), "content", c.date, "thumbnail.jpg");
  return publishToSocialDirect(videoPath, caption, c.date, contentId, existsSync(thumbPath) ? thumbPath : undefined);
}

export async function publishToSocialDirect(videoPath: string, caption: string, date: string, contentId?: number, thumbnailPath?: string, thumbnailUrl?: string): Promise<PublishResult[]> {
  const accounts = await listZernioAccounts();
  const tiktok = accounts.find(a => a.platform === "tiktok");
  const instagram = accounts.find(a => a.platform === "instagram");

  if (!tiktok && !instagram) {
    console.log("[zernio] tidak ada akun TikTok/IG terhubung");
    return [{ platform: "social", ok: false, error: "No TikTok/Instagram accounts connected" }];
  }

  // upload video via jalur resmi (terdaftar di registry Zernio)
  const bytes = new Uint8Array(readFileSync(videoPath));
  const videoUrl = await uploadMediaRegistered(bytes, "video/mp4", "video");

  // mediaItems HANYA video — TikTok tolak campuran foto+video dalam satu post.
  const mediaItems: any[] = [{ type: "video", url: videoUrl }];

  // thumbnail: URL eksternal (dari runner) → download; file lokal → langsung.
  // Selalu re-upload VIA JALUR RESMI supaya masuk registry sesi ini.
  let thumbUrl: string | undefined;
  try {
    let thumbBytes: Uint8Array | undefined;
    if (thumbnailPath && existsSync(thumbnailPath)) {
      thumbBytes = new Uint8Array(readFileSync(thumbnailPath));
    } else if (thumbnailUrl) {
      const imgResp = await fetch(thumbnailUrl);
      if (imgResp.ok) thumbBytes = new Uint8Array(Buffer.from(await imgResp.arrayBuffer()));
    }
    if (thumbBytes) {
      thumbUrl = await uploadMediaRegistered(thumbBytes, "image/jpeg", "thumbnail");
    }
  } catch (e) {
    // thumbnail gagal ≠ posting gagal — lanjut tanpa custom cover
    console.warn("[zernio] thumbnail gagal, lanjut tanpa cover:", e instanceof Error ? e.message : e);
  }

  const platforms: any[] = [];
  if (tiktok) platforms.push({
    platform: "tiktok",
    accountId: tiktok.id,
    ...(thumbUrl ? { platformSpecificData: { videoCoverImageUrl: thumbUrl } } : {}),
  });
  if (instagram) platforms.push({
    platform: "instagram",
    accountId: instagram.id,
    ...(thumbUrl ? { platformSpecificData: { instagramThumbnail: thumbUrl } } : {}),
  });

  const results: PublishResult[] = [];
  const { data: post, error: postErr } = await z.posts.createPost({
    body: { content: caption, mediaItems, platforms, publishNow: true },
  });
  if (postErr || !post) {
    throw new Error(`createPost gagal: ${JSON.stringify(postErr ?? post)}`);
  }

  for (const p of (post as any).platforms ?? []) {
    const ok = p.status === "published" || p.status === "pending" || p.status === "processing";
    if (contentId) {
      db.prepare(
        "INSERT INTO publications (content_id, platform, status, external_id, url, error) VALUES (?,?,?,?,?,?)"
      ).run(contentId, p.platform, ok ? "SUCCESS" : "FAILED", p.postId ?? (post as any).id, p.url ?? null, p.error ?? null);
    }
    results.push({ platform: p.platform, ok, externalId: p.postId, url: p.url, error: p.error });
    console.log(`[zernio] ${p.platform} → ${p.status}`);
  }

  return results;
}
