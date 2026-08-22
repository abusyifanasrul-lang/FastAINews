import Zernio from "@zernio/node";
import { readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
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

/** Upload file gambar ke storage Zernio, return publicUrl */
export async function uploadImageToZernio(imagePath: string, date: string): Promise<string | undefined> {
  try {
    const bytes = readFileSync(imagePath);
    const { data: presign } = await z.media.getMediaPresignedUrl({
      body: { filename: `thumbnail-${date}.jpg`, contentType: "image/jpeg", size: statSync(imagePath).size },
    });
    if (!presign.uploadUrl || !presign.publicUrl) return undefined;
    await fetch(presign.uploadUrl, {
      method: "PUT",
      body: new Blob([bytes]),
      headers: { "Content-Type": "image/jpeg" },
    });
    return presign.publicUrl;
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

/** PUT ke presigned URL + verifikasi. Retry 2x dgn presign baru. Throw jika tetap gagal. */
async function putMediaVerified(presignFn: () => Promise<{ uploadUrl?: string; publicUrl?: string }>, body: Uint8Array, contentType: string, label: string): Promise<string> {
  let lastErr = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const presign = await presignFn();
    if (!presign.uploadUrl || !presign.publicUrl) {
      lastErr = `${label}: presign tidak lengkap`;
      continue;
    }
    const resp = await fetch(presign.uploadUrl, {
      method: "PUT",
      body: new Blob([new Uint8Array(body)]),
      headers: { "Content-Type": contentType },
    });
    if (!resp.ok) {
      lastErr = `${label}: PUT ${resp.status} ${(await resp.text()).slice(0, 200)}`;
      console.warn(`[zernio] ${lastErr} (attempt ${attempt})`);
      continue;
    }
    // verifikasi file benar-benar ada di storage sebelum createPost
    const head = await fetch(presign.publicUrl);
    if (!head.ok) {
      lastErr = `${label}: verifikasi publicUrl ${head.status}`;
      console.warn(`[zernio] ${lastErr} (attempt ${attempt})`);
      continue;
    }
    console.log(`[zernio] ${label} ter-upload & terverifikasi`);
    return presign.publicUrl;
  }
  throw new Error(`Gagal upload media ke storage — ${lastErr}`);
}

export async function publishToSocialDirect(videoPath: string, caption: string, date: string, contentId?: number, thumbnailPath?: string, thumbnailUrl?: string): Promise<PublishResult[]> {
  const accounts = await listZernioAccounts();
  const tiktok = accounts.find(a => a.platform === "tiktok");
  const instagram = accounts.find(a => a.platform === "instagram");

  if (!tiktok && !instagram) {
    console.log("[zernio] tidak ada akun TikTok/IG terhubung");
    return [{ platform: "social", ok: false, error: "No TikTok/Instagram accounts connected" }];
  }

  // upload video (verified + retry)
  const bytes = readFileSync(videoPath);
  const videoUrl = await putMediaVerified(
    async () => {
      const { data } = await z.media.getMediaPresignedUrl({
        body: { filename: `ainews-${date}.mp4`, contentType: "video/mp4", size: bytes.length },
      });
      return data;
    },
    bytes, "video/mp4", "video"
  );

  // mediaItems HANYA video — TikTok tolak campuran foto+video dalam satu post.
  // Thumbnail dikirim sbg custom cover via platformSpecificData (bukan media item).
  const mediaItems: any[] = [{ type: "video", url: videoUrl }];

  // upload thumbnail → publicUrl utk cover TikTok/IG (skip jika URL sudah disediakan)
  let thumbUrl: string | undefined = thumbnailUrl;
  if (!thumbUrl && thumbnailPath && existsSync(thumbnailPath)) {
    try {
      const thumbBytes = readFileSync(thumbnailPath);
      thumbUrl = await putMediaVerified(
        async () => {
          const { data } = await z.media.getMediaPresignedUrl({
            body: { filename: `thumbnail-${date}.jpg`, contentType: "image/jpeg", size: thumbBytes.length },
          });
          return data;
        },
        thumbBytes, "image/jpeg", "thumbnail"
      );
    } catch (e) {
      // thumbnail gagal ≠ posting gagal — lanjut tanpa custom cover
      console.warn("[zernio] upload thumbnail gagal, lanjut tanpa cover:", e instanceof Error ? e.message : e);
    }
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
  const { data: post } = await z.posts.createPost({
    body: {
      content: caption,
      mediaItems,
      platforms,
      publishNow: true,
    },
  });

  for (const p of post.platforms ?? []) {
    const ok = p.status === "published" || p.status === "pending" || p.status === "processing";
    if (contentId) {
      db.prepare(
        "INSERT INTO publications (content_id, platform, status, external_id, url, error) VALUES (?,?,?,?,?,?)"
      ).run(contentId, p.platform, ok ? "SUCCESS" : "FAILED", p.postId ?? post.id, p.url ?? null, p.error ?? null);
    }
    results.push({ platform: p.platform, ok, externalId: p.postId, url: p.url, error: p.error });
    console.log(`[zernio] ${p.platform} → ${p.status}`);
  }

  return results;
}
