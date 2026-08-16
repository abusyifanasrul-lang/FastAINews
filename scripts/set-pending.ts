import { updateContentStatus } from "../src/db.js";
updateContentStatus(4, "PENDING_REVIEW");
console.log("#4 → PENDING_REVIEW");