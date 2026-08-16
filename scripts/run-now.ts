import { runPipeline } from "../src/pipeline.js";

// trigger manual: npm run run-now
const result = await runPipeline();
if (result.skipped) {
  console.log("Tidak ada berita hari ini.");
} else {
  console.log(`Konten #${result.id} siap (${result.items.length} sumber)`);
}
