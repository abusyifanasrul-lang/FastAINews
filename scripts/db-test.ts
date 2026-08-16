import { db, upsertContent, addSources, getContentWithSources, addRevision, getRevisionCount } from "../src/db.js";

// bersihkan run sebelumnya supaya test idempotent
db.exec("DELETE FROM revisions; DELETE FROM sources; DELETE FROM contents;");

const id = upsertContent({ date: "2026-08-04", status: "DRAFT", topicTitle: "Test topik", scriptText: "naskah test" });
addSources(id, [{ title: "Sumber 1", url: "https://x.com/1" }, { title: "Sumber 2", url: "https://x.com/2" }]);
const again = upsertContent({ date: "2026-08-04", status: "PENDING_REVIEW" });
if (again !== id) throw new Error("idempotency gagal: " + again + " != " + id);
addRevision(id, "tambah data", "naskah v2", null, null);
addRevision(id, "lebih singkat", "naskah v3", null, null);
const c = getContentWithSources("2026-08-04");
if (!c) throw new Error("konten tidak ditemukan");
console.log("id:", c.id, "| status:", c.status, "| sources:", c.sources.length, "| revisi:", getRevisionCount(id));
if (c.status !== "PENDING_REVIEW") throw new Error("status tidak ter-update");
if (c.sources.length !== 2) throw new Error("sources gagal");
if (getRevisionCount(id) !== 2) throw new Error("revisi gagal");
console.log("DB TEST OK");
db.close();
