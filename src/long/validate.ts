// Validator naskah long-form + util waktu. Terpisah dari validator shorts
// (cleanAndValidateScript tolak >2500 char; naskah long 8-12rb char).

const REASONING_PATTERNS = [
  /we need to/i,
  /let's craft/i,
  /count words/i,
  /hook line/i,
  /fact \d+:/i,
  /structure:\s*\n/i,
];
const ID_CONNECTORS = ["yang", "dan", "di", "ini", "untuk", "dengan", "dari", "pada", "adalah", "ke"];

/** Cabut marker mid-roll dari teks narasi; posisi disimpan sbg metadata. */
export function stripMidroll(script: string): { clean: string; atChar: number | null } {
  const m = /\[MID-ROLL AD BREAK[^\]]*\]/i.exec(script);
  if (!m) return { clean: script.trim(), atChar: null };
  const clean = (script.slice(0, m.index) + "\n" + script.slice(m.index + m[0].length))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { clean, atChar: m.index };
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function validateLongScript(text: string, minWords = 900): void {
  if (text.length < 3500) throw new Error(`Naskah long terlalu pendek (${text.length} char < 3500).`);
  if (text.length > 15000) throw new Error(`Naskah long terlalu panjang (${text.length} char > 15000).`);
  const words = countWords(text);
  if (words < minWords) throw new Error(`Naskah long terlalu pendek (${words} kata < ${minWords}).`);
  const hits = REASONING_PATTERNS.filter((r) => r.test(text));
  if (hits.length > 2) throw new Error(`Naskah mengandung reasoning internal (${hits.length} pola cocok).`);
  const paras = text.split(/\n{2,}|\n/).map((p) => p.trim()).filter((p) => p.length > 40);
  if (paras.length === 0) throw new Error("Naskah kosong setelah split paragraf.");
  const ok = paras.filter((p) => {
    const l = ` ${p.toLowerCase()} `;
    return ID_CONNECTORS.filter((w) => l.includes(` ${w} `)).length >= 2;
  }).length;
  if (ok < paras.length * 0.6) throw new Error(`Bahasa non-Indonesia terdeteksi (${ok}/${paras.length} paragraf valid).`);
}

/** Pangkas naskah di batas kalimat terakhir sebelum maxChars (fallback naskah overlong). */
export function trimNaskahToLength(text: string, maxChars: number): string | null {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const idx = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"), cut.lastIndexOf("\n"));
  if (idx < 3500) return null; // tidak ada batas kalimat layak — tidak bisa diselamatkan
  return cut.slice(0, idx + 1).trim();
}

export function formatTimestamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
