// Engine Sinematik untuk Video Long-Form (2.5K Canvas, Cubic Smoothstep Ken Burns, ASS HUD, VFX)

/** Bangun file SubStation Alpha (.ass) untuk Glassmorphic Lower-Third HUD */
export function buildAssHud(chapterNum: number, chapterTitle: string, categoryTag: string, displayDuration: number): string {
  const cleanTitle = chapterTitle.replace(/[\\{}]/g, "").trim().slice(0, 52);
  const cleanTag = categoryTag.replace(/[\\{}]/g, "").trim().slice(0, 42);
  const endSec = Math.min(Math.max(displayDuration - 0.4, 1.5), 5.5).toFixed(2);
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

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:${endSec},TopicBadge,,0,0,0,,{\\fad(400,400)}${cleanTitle}
Dialogue: 1,0:00:01.00,0:00:${endSec},TopicTag,,0,0,0,,{\\fad(400,400)}${cleanTag}
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

/** Ekstrak teks judul & tag untuk kartu Lower-Third HUD */
export function getHudContent(pIdx: number, totalParas: number, chapterName: string, paraText: string): { title: string; tag: string } {
  const cleanChapter = chapterName.trim();
  const entities = [
    "TechCrunch", "Wired", "The Verge", "MIT Technology Review", "The Decoder",
    "Google", "OpenAI", "Nvidia", "Perplexity", "Jensen Huang", "DeepSeek", "Anthropic"
  ];
  const found = entities.filter((e) => paraText.includes(e));

  let title = cleanChapter;
  if (found.length > 0) {
    title = `${found.slice(0, 2).join(" & ")} // ${cleanChapter}`;
  } else if (pIdx === 0) {
    title = cleanChapter;
  }

  const numStr = String(pIdx + 1).padStart(2, "0");
  const tag = `FAST AI NEWS  //  PART ${numStr}`;
  return { title, tag };
}
