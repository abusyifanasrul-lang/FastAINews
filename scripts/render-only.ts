// Render video saja untuk konten #4 (sudah ada naskah+TTS, render gagal sebelumnya)
import { renderVideos } from "../src/video.js";
const v = await renderVideos("2026-08-05");
console.log("shorts:", v.shorts);
console.log("durasi:", v.durationSec.toFixed(1), "s");