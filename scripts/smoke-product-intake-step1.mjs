/** Quick smoke — CreativeWorkspaceManager without vitest */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CreativeWorkspaceManager } from "../ai/creative-workspace/creative-workspace-manager.ts";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-intake-smoke-"));
const mgr = new CreativeWorkspaceManager();
await mgr.initialize(tmp);
const p = await mgr.createProject("Smoke Product");
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const img = await mgr.uploadImage(p.id, {
  fileName: "a.png",
  mimeType: "image/png",
  dataBase64: png,
});
const disk = path.join(tmp, "creative-workspace", "projects", p.id, "images", `${img.id}.png`);
const ok = fs.existsSync(disk) && (await mgr.getProject(p.id))?.productImages.length === 1;
console.log(JSON.stringify({ ok, projectId: p.id, imageId: img.id, diskExists: fs.existsSync(disk), tmp }, null, 2));
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
