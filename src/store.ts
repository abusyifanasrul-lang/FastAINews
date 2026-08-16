import { db, upsertContent, addSources } from "./db.js";

export interface ContentSource {
  title: string;
  url: string;
  publisher?: string;
  publishedAt?: string;
  imagePath?: string;
}

export interface ContentResult {
  id: number;
  date: string;
  topicTitle: string;
  scriptText: string;
  sources: ContentSource[];
}

/** Simpan draft konten (belum naskah) + sumber; return content id */
export function saveDraft(date: string, sources: ContentSource[], topicTitle: string): number {
  const id = upsertContent({ date, status: "DRAFT", topicTitle });
  addSources(id, sources);
  return id;
}

export function saveScript(id: number, scriptText: string) {
  db.prepare("UPDATE contents SET script_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(scriptText, id);
}
