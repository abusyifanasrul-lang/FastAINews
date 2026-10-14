// Engine Sinematik untuk Video Long-Form (2.5K Canvas, Cubic Smoothstep Ken Burns, Broadcast Contextual ASS HUD, VFX)

export interface HudExtraOptions {
  contextTitle?: string;
  keyMetric?: string;
  visualClue?: string;
  navBreadcrumb?: string;
  paraText?: string;
}

function toAssTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** Pisah naskah paragraf menjadi baris subtitle (maks 6 kata) dengan durasi terdistribusi */
function generateSubtitleEvents(paraText: string, durationSec: number): string[] {
  const words = paraText.replace(/[\r\n]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  const chunkSize = 6;
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }

  const chunkDur = durationSec / chunks.length;
  const events: string[] = [];

  chunks.forEach((chunk, i) => {
    const start = i * chunkDur;
    const end = Math.min((i + 1) * chunkDur, durationSec);
    // Sorot kata kunci (nama brand / angka / persentase) dengan warna emas
    const highlighted = chunk
      .replace(/[\\{}]/g, "")
      .replace(/(\b[A-Z][a-zA-Z0-9_\-\.]{2,}\b|\b\d+[\d\.,%]*\b)/g, "{\\c&H00F8BD38&}$1{\\c&H00F8FAFC&}");

    events.push(
      `Dialogue: 3,${toAssTime(start)},${toAssTime(end)},KineticSub,,0,0,0,,{\\fad(150,150)}${highlighted}`
    );
  });

  return events;
}

/** Bangun file SubStation Alpha (.ass) untuk Glassmorphic Lower-Third HUD dan Broadcast Contextual Anchors */
export function buildAssHud(
  chapterNum: number,
  chapterTitle: string,
  categoryTag: string,
  displayDuration: number,
  options?: HudExtraOptions,
): string {
  const cleanTitle = chapterTitle.replace(/[\\{}]/g, "").trim().slice(0, 52);
  const cleanTag = categoryTag.replace(/[\\{}]/g, "").trim().slice(0, 42);
  const endSecStr = Math.min(Math.max(displayDuration - 0.4, 1.5), 5.5).toFixed(2);
  const totalDuration = Math.max(1.5, displayDuration);
  const persistentEnd = Math.max(1.0, totalDuration - 0.35);

  const events: string[] = [
    // 1. Lower-third Topic Badge & Tag (Muncul 1.00s s/d 5.5s)
    `Dialogue: 0,0:00:01.00,0:00:${endSecStr},TopicBadge,,0,0,0,,{\\fad(400,400)}${cleanTitle}`,
    `Dialogue: 1,0:00:01.00,0:00:${endSecStr},TopicTag,,0,0,0,,{\\fad(400,400)}${cleanTag}`,
  ];

  // 2. Top Navigation Breadcrumb (Persisten sepanjang adegan)
  if (options?.navBreadcrumb) {
    const cleanNav = options.navBreadcrumb.replace(/[\\{}]/g, "").trim().slice(0, 80);
    events.push(
      `Dialogue: 2,0:00:00.60,${toAssTime(persistentEnd)},NavBreadcrumb,,0,0,0,,{\\fad(500,400)}${cleanNav}`
    );
  }

  // 3. Contextual Anchor Card (Pojok Kiri Atas - Persisten menjembatani background visual ke narasi)
  if (options?.contextTitle || options?.visualClue || options?.keyMetric) {
    const entity = (options.contextTitle || cleanTitle).replace(/[\\{}]/g, "").trim().slice(0, 40);
    const metric = (options.keyMetric || "").replace(/[\\{}]/g, "").trim().slice(0, 36);
    const clue = (options.visualClue || "").replace(/[\\{}]/g, "").trim().slice(0, 45);

    events.push(
      `Dialogue: 2,0:00:00.80,${toAssTime(persistentEnd)},AnchorTitle,,0,0,0,,{\\fad(500,400)}${entity}`
    );
    if (metric) {
      events.push(
        `Dialogue: 2,0:00:00.90,${toAssTime(persistentEnd)},AnchorMetric,,0,0,0,,{\\fad(500,400)}📊 ${metric}`
      );
    }
    if (clue) {
      events.push(
        `Dialogue: 2,0:00:01.00,${toAssTime(persistentEnd)},AnchorClue,,0,0,0,,{\\fad(500,400)}💡 [Konteks: ${clue}]`
      );
    }
  }

  // 4. Kinetic Subtitles Stream (Sepanjang adegan)
  if (options?.paraText) {
    const subEvents = generateSubtitleEvents(options.paraText, totalDuration);
    events.push(...subEvents);
  }

  return `[Script Info]
Title: FastAINews Cinematic HUD
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TopicBadge, Arial, 26, &H00F8FAFC, &H00000000, &H80000000, &HBF0D1117, -1, 0, 0, 0, 100, 100, 1, 0, 3, 16, 4, 1, 80, 80, 80, 1
Style: TopicTag, Arial, 15, &H00F8BD38, &H00000000, &H00000000, &H00000000, -1, 0, 0, 0, 100, 100, 2, 0, 1, 0, 0, 1, 96, 80, 150, 1
Style: NavBreadcrumb, Arial, 15, &H00CBD5E1, &H00000000, &H80000000, &HBF090D16, -1, 0, 0, 0, 100, 100, 2, 0, 3, 12, 0, 8, 80, 80, 28, 1
Style: AnchorTitle, Arial, 18, &H00F8FAFC, &H00000000, &H80000000, &HBF070A10, -1, 0, 0, 0, 100, 100, 1, 0, 3, 10, 0, 7, 70, 80, 60, 1
Style: AnchorMetric, Arial, 14, &H0038BDF8, &H00000000, &H00000000, &H00000000, -1, 0, 0, 0, 100, 100, 1, 0, 1, 0, 0, 7, 85, 80, 96, 1
Style: AnchorClue, Arial, 13, &H00F8BD38, &H00000000, &H00000000, &H00000000, 0, -1, 0, 0, 100, 100, 1, 0, 1, 0, 0, 7, 85, 80, 122, 1
Style: KineticSub, Arial, 26, &H00F8FAFC, &H00000000, &H90000000, &HBF05070B, -1, 0, 0, 0, 100, 100, 1, 0, 3, 14, 2, 2, 100, 100, 64, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}

/** Hasilkan filter Ken Burns sinematik (2.5K Canvas, Smoothstep Easing, 4 Koreografi Kamera) */
export function getCinematicKenBurns(choreographyIdx: number, totalFrames: number, fps: number): string {
  const f = Math.max(totalFrames, 1);
  // Cubic smoothstep easing: 3*(on/f)^2 - 2*(on/f)^3
  const ease = `(3*pow(on/${f},2)-2*pow(on/${f},3))`;
  const mode = Math.abs(choreographyIdx) % 4;

  let zoomExpr: string;
  let panX: string;
  let panY: string;

  if (mode === 0) {
    // 1. Slow Push-In (1.00 -> 1.10 ke tengah)
    zoomExpr = `1.0+0.10*${ease}`;
    panX = `iw/2-(iw/zoom/2)`;
    panY = `ih/2-(ih/zoom/2)`;
  } else if (mode === 1) {
    // 2. Gentle Pull-Out (1.12 -> 1.02 dari tengah)
    zoomExpr = `1.12-0.10*${ease}`;
    panX = `iw/2-(iw/zoom/2)`;
    panY = `ih/2-(ih/zoom/2)`;
  } else if (mode === 2) {
    // 3. Cinematic Pan-Right (Pan halus dari kiri ke kanan dengan zoom 1.08)
    zoomExpr = `1.08`;
    panX = `(iw-iw/zoom)*${ease}`;
    panY = `ih/2-(ih/zoom/2)`;
  } else {
    // 4. Cinematic Pan-Left (Pan halus dari kanan ke kiri dengan zoom 1.08)
    zoomExpr = `1.08`;
    panX = `(iw-iw/zoom)*(1-${ease})`;
    panY = `ih/2-(ih/zoom/2)`;
  }

  return `scale=2560:1440:force_original_aspect_ratio=increase,crop=2560:1440,zoompan=z='${zoomExpr}':x='${panX}':y='${panY}':s=1920x1080:fps=${fps}`;
}

/** Ekstrak teks judul, tag, serta contextual cues untuk kartu Lower-Third HUD dan Top Breadcrumb */
export function getHudContent(
  pIdx: number,
  totalParas: number,
  chapterName: string,
  paraText: string,
  beatExtra?: { contextTitle?: string; keyMetric?: string; visualClue?: string },
): {
  title: string;
  tag: string;
  contextTitle?: string;
  keyMetric?: string;
  visualClue?: string;
  navBreadcrumb: string;
} {
  const cleanChapter = chapterName.trim();
  const entities = [
    "TechCrunch", "Wired", "The Verge", "MIT Technology Review", "The Decoder",
    "Google", "OpenAI", "Nvidia", "Perplexity", "Jensen Huang", "DeepSeek", "Anthropic", "Meta"
  ];
  const found = entities.filter((e) => paraText.includes(e));

  let title = cleanChapter;
  if (found.length > 0) {
    title = `${found.slice(0, 2).join(" & ")} // ${cleanChapter}`;
  } else if (pIdx === 0) {
    title = cleanChapter;
  }

  const numStr = String(pIdx + 1).padStart(2, "0");
  const totalStr = String(totalParas).padStart(2, "0");
  const tag = `FAST AI NEWS  //  PART ${numStr}`;
  const navBreadcrumb = `[ ${numStr} / ${totalStr} ]  ${cleanChapter.toUpperCase()}`;

  return {
    title,
    tag,
    contextTitle: beatExtra?.contextTitle,
    keyMetric: beatExtra?.keyMetric,
    visualClue: beatExtra?.visualClue,
    navBreadcrumb,
  };
}
