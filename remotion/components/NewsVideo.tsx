import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export interface NewsVideoProps {
  title: string;
  script: string;
  audioFile: string;
  sourceNames: string[];
  aspect?: "16:9" | "9:16";
  backgroundImage?: string; // URL/path gambar latar opsional
}

// split script jadi baris subtitle (potong per kata, maks 5 kata/baris)
function chunkWords(text: string, maxWords = 5): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    out.push(words.slice(i, i + maxWords).join(" "));
  }
  return out;
}

export const NewsVideo: React.FC<NewsVideoProps> = ({ title, script, audioFile, sourceNames }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const lines = chunkWords(script);
  const lineDuration = Math.max(1, Math.floor(durationInFrames / Math.max(lines.length, 1)));
  const idx = Math.min(lines.length - 1, Math.floor(frame / lineDuration));
  const progress = (frame % lineDuration) / lineDuration;

  // animasi masuk
  const opacity = interpolate(progress, [0, 0.15], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(progress, [0, 0.15], [20, 0], { extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 15], [0.95, 1], { extrapolateRight: "clamp" });

  // progress bar atas
  const totalProgress = frame / durationInFrames;

  // daftar sumber di akhir
  const showSources = frame > durationInFrames * 0.85;
  const srcOpacity = interpolate(frame, [durationInFrames * 0.85, durationInFrames * 0.9], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d1117", color: "#fff", fontFamily: "Arial, sans-serif" }}>
      {/* audio via staticFile (membaca dari public/ yang di-set di remotion.config.ts) */}
      <Audio src={staticFile("voiceover.mp3")} />

      {/* progress bar */}
      <div style={{ position: "absolute", top: 0, left: 0, width: `${totalProgress * 100}%`, height: 6, background: "#4f8cff" }} />

      {/* header */}
      <div style={{ position: "absolute", top: 60, left: 80, right: 80, fontSize: 28, color: "#8ab4ff", fontWeight: 600 }}>
        🤖 BERITA AI HARIAN
      </div>

      {/* judul */}
      <div style={{ position: "absolute", top: 120, left: 80, right: 80, fontSize: 56, fontWeight: 700, transform: `scale(${scale})` }}>
        {title}
      </div>

      {/* subtitle tengah */}
      <div style={{ position: "absolute", bottom: 140, left: 80, right: 80, textAlign: "center", opacity, transform: `translateY(${y}px)` }}>
        <div style={{ fontSize: 48, lineHeight: 1.3, background: "rgba(0,0,0,0.6)", padding: "16px 24px", borderRadius: 12, display: "inline-block" }}>
          {lines[idx] ?? ""}
        </div>
      </div>

      {/* sumber */}
      {showSources && (
        <div style={{ position: "absolute", bottom: 30, left: 80, right: 80, fontSize: 22, color: "#9aa7b4", opacity: srcOpacity }}>
          Sumber: {sourceNames.join(" • ")}
        </div>
      )}
    </AbsoluteFill>
  );
};