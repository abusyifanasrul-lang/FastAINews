// Script perender Hook Opener (Detik 0-7) via HyperFrames:
// Membaca judul & 3 topik teratas dari storyboard.json / script.md ->
// Mengisi template HTML -> npx hyperframes render -> hook_opener.mp4
import { parseArgs } from "node:util";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

export function extractHookContent(dateStr: string): {
  badge: string;
  title: string;
  subtitle: string;
  card1: { tag: string; text: string };
  card2: { tag: string; text: string };
  card3: { tag: string; text: string };
} {
  const sbPath = join(process.cwd(), "content", "long", dateStr, "storyboard.json");
  const scriptPath = join(process.cwd(), "content", "long", dateStr, "script.md");

  let title = "72 JAM TERAKHIR: 3 PERGESERAN BESAR AI";
  let subtitle = "Mengapa 10 menit ke depan sangat krusial agar Anda tidak tertinggal gelombang disrupsi berikutnya?";
  let card1 = { tag: "01 // FRONTIER RACE", text: "Lompatan Model Frontier Generasi Baru" };
  let card2 = { tag: "02 // INFRASTRUCTURE", text: "Krisis Energi & Transparansi Pusat Data" };
  let card3 = { tag: "03 // POLICY & MARKET", text: "Regulasi Global & Arah Industri Masa Depan" };

  if (existsSync(sbPath)) {
    try {
      const sb = JSON.parse(readFileSync(sbPath, "utf8")) as {
        title: string;
        chapters: { title: string; startSec: number }[];
        beats?: { text: string; chapter: string; contextTitle?: string; keyMetric?: string }[];
      };
      if (sb.title) {
        title = sb.title.slice(0, 75).toUpperCase();
      }
      const meaningfulChapters = (sb.chapters || []).filter(
        (c) => !/intro|penutup|sintesis|peluang/i.test(c.title),
      );
      if (meaningfulChapters[0]) {
        card1 = {
          tag: "01 // " + (meaningfulChapters[0].title.split(/[:\-\/]/)[0] || "FRONTIER").trim().toUpperCase().slice(0, 20),
          text: meaningfulChapters[0].title.slice(0, 70),
        };
      }
      if (meaningfulChapters[1]) {
        card2 = {
          tag: "02 // " + (meaningfulChapters[1].title.split(/[:\-\/]/)[0] || "INFRA").trim().toUpperCase().slice(0, 20),
          text: meaningfulChapters[1].title.slice(0, 70),
        };
      }
      if (meaningfulChapters[2]) {
        card3 = {
          tag: "03 // " + (meaningfulChapters[2].title.split(/[:\-\/]/)[0] || "POLICY").trim().toUpperCase().slice(0, 20),
          text: meaningfulChapters[2].title.slice(0, 70),
        };
      }
    } catch {}
  } else if (existsSync(scriptPath)) {
    try {
      const raw = readFileSync(scriptPath, "utf8");
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      const titleLine = lines.find((l) => l.startsWith("# "));
      if (titleLine) {
        title = titleLine.replace(/^#\s+/, "").slice(0, 75).toUpperCase();
      }
    } catch {}
  }

  return {
    badge: `FAST AI NEWS // ${dateStr}`,
    title,
    subtitle,
    card1,
    card2,
    card3,
  };
}

export function buildHookHtml(content: ReturnType<typeof extractHookContent>): string {
  const templatePath = join(process.cwd(), "templates", "long-hook", "index.html");
  let html = readFileSync(templatePath, "utf8");

  html = html.replace(/<div class="badge-text">.*?<\/div>/, `<div class="badge-text">${content.badge}</div>`);
  html = html.replace(/<h1 id="hook-title" class="main-title">[\s\S]*?<\/h1>/, `<h1 id="hook-title" class="main-title">${content.title}</h1>`);
  html = html.replace(/<p id="hook-sub" class="sub-title">[\s\S]*?<\/p>/, `<p id="hook-sub" class="sub-title">${content.subtitle}</p>`);

  // Replace cards
  html = html.replace(/(<div class="hook-card card-1">\s*<div class="card-tag">).*?(<\/div>\s*<div id="card-1-text" class="card-text">).*?(<\/div>)/s, `$1${content.card1.tag}$2${content.card1.text}$3`);
  html = html.replace(/(<div class="hook-card card-2">\s*<div class="card-tag">).*?(<\/div>\s*<div id="card-2-text" class="card-text">).*?(<\/div>)/s, `$1${content.card2.tag}$2${content.card2.text}$3`);
  html = html.replace(/(<div class="hook-card card-3">\s*<div class="card-tag">).*?(<\/div>\s*<div id="card-3-text" class="card-text">).*?(<\/div>)/s, `$1${content.card3.tag}$2${content.card3.text}$3`);

  return html;
}

export function renderHookVideo(dateStr: string, outPath?: string, dryRun = false): string {
  const finalOut = outPath || join(process.cwd(), "content", "long", dateStr, "hook_opener.mp4");
  const content = extractHookContent(dateStr);
  const populatedHtml = buildHookHtml(content);

  const workDir = join(tmpdir(), `hf-hook-${dateStr}-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  const compFile = join(workDir, "index.html");
  writeFileSync(compFile, populatedHtml, "utf8");

  console.log(`[render-hook] merender Hook Opener (7 detik) via HyperFrames untuk ${dateStr}...`);
  if (dryRun) {
    console.log(`[render-hook] dry-run: HTML tersimpan di ${compFile}`);
    return finalOut;
  }

  try {
    execFileSync(
      "npx",
      [
        "hyperframes",
        "render",
        workDir,
        "--output",
        finalOut,
        "--quality",
        "looks",
      ],
      { stdio: "inherit", shell: true },
    );
    console.log(`[render-hook] Berhasil merender Hook Opener: ${finalOut}`);
    return finalOut;
  } catch (e) {
    console.error(`[render-hook] Gagal render hook: ${(e as Error).message}`);
    throw e;
  }
}

// Run CLI jika dijalankan langsung
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const { values } = parseArgs({
    options: {
      date: { type: "string" },
      out: { type: "string" },
      "dry-run": { type: "boolean" },
    },
  });
  const dateStr = (values.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    console.error("[render-hook] --date harus berformat YYYY-MM-DD");
    process.exit(1);
  }
  try {
    renderHookVideo(dateStr, values.out, !!values["dry-run"]);
  } catch {
    process.exit(1);
  }
}
