import Zernio from "@zernio/node";
import { readFileSync, statSync } from "node:fs";
import { db } from "./db.js";
import type { PublishResult } from "./publisher.js";

const z = new Zernio({ apiKey: process.env.ZERNIO_API_KEY! });

export async function listZernioAccounts(): Promise<{ platform: string; id: string; username: string }[]> {
  const { data } = await z.accounts.listAccounts({});
  return (data.accounts ?? []).map((a: any) => ({
    platform: a.platform,
    id: a._id ?? a.id,
    username: a.username ?? a.displayName ?? "",
  }));
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

  // List connected accounts
  const accounts = await listZernioAccounts();
  const tiktok = accounts.find(a => a.platform === "tiktok");
  const instagram = accounts.find(a => a.platform === "instagram");

  if (!tiktok && !instagram) {
    console.log("[zernio] tidak ada akun TikTok/IG terhubung");
    return [{ platform: "social", ok: false, error: "No TikTok/Instagram accounts connected" }];
  }

  // Upload video via presigned URL
  const bytes = readFileSync(videoPath);
  const fileName = `ainews-${c.date}.mp4`;
  const { data: presign } = await z.media.getMediaPresignedUrl({
    body: { filename: fileName, contentType: "video/mp4", size: statSync(videoPath).size },
  });
  if (!presign.uploadUrl) throw new Error("Gagal dapat presigned URL");

  await fetch(presign.uploadUrl, {
    method: "PUT",
    body: new Blob([bytes]),
    headers: { "Content-Type": "video/mp4" },
  });

  // Build platform targets
  const platforms: any[] = [];
  if (tiktok) platforms.push({ platform: "tiktok", accountId: tiktok.id });
  if (instagram) platforms.push({ platform: "instagram", accountId: instagram.id });

  const results: PublishResult[] = [];
  const { data: post } = await z.posts.createPost({
    body: {
      content: caption,
      mediaItems: [{ type: "video", url: presign.publicUrl }],
      platforms,
      publishNow: true,
    },
  });

  for (const p of post.platforms ?? []) {
    const ok = p.status === "published" || p.status === "pending" || p.status === "processing";
    db.prepare(
      "INSERT INTO publications (content_id, platform, status, external_id, url, error) VALUES (?,?,?,?,?,?)"
    ).run(contentId, p.platform, ok ? "SUCCESS" : "FAILED", p.postId ?? post.id, p.url ?? null, p.error ?? null);
    results.push({ platform: p.platform, ok, externalId: p.postId, url: p.url, error: p.error });
    console.log(`[zernio] ${p.platform} → ${p.status}`);
  }

  return results;
}
