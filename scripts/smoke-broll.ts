// Smoke test: render 15 frame NewsShort dgn b-roll bg → cek komposer tak error dgn OffthreadVideo absolut path
import { spawnSync } from "node:child_process";
import { join } from "node:path";
const COMPOSER = join(process.cwd(), "vendor-openmontage");
const cli = join(COMPOSER, "node_modules", "@remotion", "cli", "remotion-cli.js");
const out = join(process.cwd(), "content", "broll-smoke.mp4");
const propsPath = join(process.cwd(), "news-props.json");
const r = spawnSync(process.execPath, [cli, "render", "src/index.tsx", "NewsShort", out,
  `--props=${propsPath}`, "--codec=h264", "--width=540", "--height=960", "--fps=30", "--frames=80-80"],
  { cwd: COMPOSER, stdio: "inherit" });
console.log("exit:", r.status);
if (r.status === 0) console.log("OK:", out);
