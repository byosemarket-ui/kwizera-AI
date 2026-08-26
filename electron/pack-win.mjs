/**
 * Windows pack helper — disables auto code-sign discovery (avoids winCodeSign symlink privilege errors).
 * After electron-builder, stages/links node_modules into app-server for offline installed-app startup.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["electron-builder", "--win", "--projectDir", "electron", "--config", "electron-builder.yml"],
  { cwd: root, env: process.env, stdio: "inherit", shell: true },
);

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

const stage = spawnSync(process.execPath, [path.join(root, "scripts", "stage-packaged-runtime.mjs")], {
  cwd: root,
  stdio: "inherit",
});
process.exit(stage.status ?? 0);
