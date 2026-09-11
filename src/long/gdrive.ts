// Parse argumen /publish_long + ID file Google Drive.
// Dipakai 3 konsumen: scripts/publish-long.ts, telegram-poller.ts, worker.

/** Ekstrak file ID dari 4 format link share. Tolak URL folder. */
export function parseGdriveId(url: string): string {
  const u = url.trim();
  if (/drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(u)) {
    throw new Error("URL folder ditolak — kirim link FILE (klik file → Share → Anyone with link → Viewer).");
  }
  const m = /\/file\/d\/([-\w]{10,})/.exec(u) ?? /[?&]id=([-\w]{10,})/.exec(u);
  if (!m) throw new Error("Format URL tak dikenal. Pakai link share file Google Drive.");
  return m[1];
}

/** Format: /publish_long [YYYY-MM-DD] <gdrive_url>. Tanpa tanggal = hari ini. */
export function splitPublishLongArgs(text: string): { date: string; gdriveUrl: string } {
  const parts = text.trim().split(/\s+/).slice(1);
  let date = new Date().toISOString().slice(0, 10);
  const rest = [...parts];
  if (rest.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(rest[0])) date = rest.shift()!;
  const gdriveUrl = rest.join(" ");
  if (!gdriveUrl) throw new Error("Format: /publish_long [YYYY-MM-DD] <gdrive_url>");
  return { date, gdriveUrl };
}
