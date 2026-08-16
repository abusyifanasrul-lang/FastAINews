import { fetchFeeds, filterRecent, isAiRelevant, dedupe, fetchOgImage, type NewsItem } from "./research.js";
import { saveDraft, saveScript } from "./store.js";
import { db, updateContentStatus, addRevision, getContentWithSources } from "./db.js";
import { generateScript, generateScriptWithFeedback } from "./llm.js";
import { generateTtsChunks } from "./tts.js";
import { renderVideos } from "./video.js";
import { sendPreview } from "./telegram.js";
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const LOG_FILE = join(process.cwd(), "content", "revision.log");
function logRev(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  try { appendFileSync(LOG_FILE, line); } catch {}
}

export interface PipelineOptions {
  hours?: number; // window berita (default 48)
}

/** Pilih item dengan publisher beragam (1 per publisher dulu, lalu sisanya isi berurutan) */
function pickDiverse<T extends { publisher: string }>(items: T[], count: number): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (!seen.has(it.publisher) && out.length < count) {
      out.push(it);
      seen.add(it.publisher);
    }
  }
  // isi sisa dari publisher yang sama
  for (const it of items) {
    if (out.length >= count) break;
    if (!out.includes(it)) out.push(it);
  }
  return out;
}

/** Jalankan pipeline: riset → naskah (via callback) → simpan */
export async function runPipeline(opts: PipelineOptions = {}) {
  const hours = opts.hours ?? 48;
  const date = new Date().toISOString().slice(0, 10);

  // 1. Riset — widen window bertingkat kalau berita sepi
  console.log("[pipeline] fetch feeds...");
  const all = await fetchFeeds();
  console.log(`[pipeline] ${all.length} item mentah`);

  let unique: ReturnType<typeof dedupe> = [];
  let usedHours = hours;
  for (const h of [hours, 72, 96]) {
    const recent = filterRecent(all, h);
    const ai = recent.filter(i => isAiRelevant(i.title));
    unique = dedupe(ai);
    if (unique.length >= 3) { usedHours = h; break; }
    if (h === 96) usedHours = h; // pakai apa adanya
  }
  console.log(`[pipeline] ${unique.length} relevan AI dalam ${usedHours}h`);

  if (unique.length === 0) {
    console.log("[pipeline] tidak ada berita relevan → skip hari ini");
    updateContentStatus(
      (() => {
        const existing = saveDraft(date, [], "");
        return existing;
      })(),
      "SKIPPED"
    );
    return { skipped: true, items: [] };
  }

  // 2. Ambil 2-5 topik, diversifikasi publisher (bukan 5 pertama mentah)
  const top = pickDiverse(unique, 5);
  const topicTitle = top[0].title;

  // 2b. Download gambar relevan (og:image) untuk tiap topik → content/<date>/images/
  const imgDir = join(process.cwd(), "content", date, "images");
  mkdirSync(imgDir, { recursive: true });
  const withImg = await Promise.all(top.map(async (s, i) => {
    const img = await fetchOgImage(s.url, join(imgDir, `src${i + 1}`));
    return { ...s, imagePath: img };
  }));
  console.log(`[pipeline] ${withImg.filter(s => s.imagePath).length}/${withImg.length} gambar terdownload`);

  // 3. Simpan draft + sumber
  const id = saveDraft(
    date,
    withImg.map(s => ({ title: s.title, url: s.url, publisher: s.publisher, publishedAt: s.publishedAt, imagePath: s.imagePath ?? undefined })),
    topicTitle
  );
  console.log(`[pipeline] draft #${id} tersimpan (${top.length} sumber)`);

  // 4. Naskah via LLM — dari semua topik terpilih
  const { script, topicTitle: llmTitle } = await generateScript(top);
  saveScript(id, script);
  if (llmTitle && llmTitle !== top[0].title) {
    db.prepare("UPDATE contents SET topic_title = ? WHERE id = ?").run(llmTitle, id);
  }
  updateContentStatus(id, "NASKAH_READY");
  console.log(`[pipeline] naskah tersimpan #${id}`);

  return { skipped: false, id, items: top, topicTitle: llmTitle ?? topicTitle };
}

/**
 * Revisi: naskah baru dari catatan reviewer → TTS → render → preview ulang.
 * Menyimpan revision row + memakai video paths baru di contents.
 */
export async function runRevision(contentId: number, feedback: string): Promise<{ version: number }> {
  const TIMEOUT_MS = 5 * 60 * 1000; // 5 menit max per step
  const withTimeout = <T>(p: Promise<T>, label: string): Promise<T> =>
    Promise.race([p, new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`timeout: ${label} >${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
    )]);

  const c = getContentWithSources((db.prepare("SELECT date FROM contents WHERE id = ?").get(contentId) as { date: string }).date);
  if (!c?.script_text) throw new Error("konten/naskah tidak ditemukan");

  const sources = c.sources.map(s => ({
    title: s.title, url: s.url, publisher: s.publisher ?? undefined,
    publishedAt: s.published_at ?? undefined, imagePath: s.image_path ?? undefined,
  }));
  const items: NewsItem[] = sources.map(s => ({
    title: s.title, url: s.url, publisher: s.publisher ?? "sumber", publishedAt: s.publishedAt ?? new Date().toISOString(),
  }));

  logRev(`#${contentId} — LLM revisi naskah...`);
  const { script } = await withTimeout(
    generateScriptWithFeedback(items, c.script_text, feedback),
    "LLM revisi"
  );
  saveScript(contentId, script);
  updateContentStatus(contentId, "REVISION_PENDING");

  // TTS ulang
  const outDir = join(process.cwd(), "content", c.date);
  mkdirSync(outDir, { recursive: true });
  logRev(`#${contentId} — TTS...`);
  const { audioPath, durationSec } = await withTimeout(
    generateTtsChunks(script, outDir, "voiceover.mp3"),
    "TTS"
  );
  logRev(`#${contentId} — TTS ${durationSec.toFixed(1)}s`);

  // render ulang (shorts), pakai gambar existing
  logRev(`#${contentId} — render video...`);
  const v = await withTimeout(renderVideos(c.date), "render video");
  logRev(`#${contentId} — render: ${v.shorts}`);

  const version = addRevision(contentId, feedback, script, null, v.shorts);
  updateContentStatus(contentId, "PENDING_REVIEW");

  // preview ulang dengan label revisi
  await sendPreview(contentId, version);
  logRev(`#${contentId} — preview v${version} terkirim`);
  return { version };
}
