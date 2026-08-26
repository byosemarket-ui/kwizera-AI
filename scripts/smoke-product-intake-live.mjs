/**
 * Live API smoke: PERSISTENT_MODE=0 must still create projects + upload images.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-intake-live-"));
const port = 5211;
const base = `http://127.0.0.1:${port}`;

function httpJson(method, url, body, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const payload = body == null ? null : JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method,
        headers: payload
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
          : {},
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            /* keep */
          }
          resolve({ ok: (res.statusCode ?? 500) < 400, status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on("error", (e) => resolve({ ok: false, status: 0, body: String(e) }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, body: "timeout" });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitHealth(attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    const r = await httpJson("GET", `${base}/api/health`);
    if (r.ok && r.body?.ok) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

const child = spawn(process.execPath, ["--import", "tsx", path.join(ROOT, "dev/server/index.ts")], {
  cwd: ROOT,
  env: {
    ...process.env,
    KWIZERA_STORAGE_ROOT: tmpRoot,
    KWIZERA_DEV_PORT: String(port),
    KWIZERA_PERSISTENT_MODE: "0",
    KWIZERA_SKIP_BROWSER_OPEN: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let log = "";
child.stdout?.on("data", (d) => {
  log += d.toString();
});
child.stderr?.on("data", (d) => {
  log += d.toString();
});

const results = [];
try {
  const up = await waitHealth();
  results.push({ id: "health", ok: up });

  // Wait until workspace is registered
  let wsReady = false;
  for (let i = 0; i < 40; i++) {
    const ws = await httpJson("GET", `${base}/api/workspace`);
    if (ws.ok) {
      wsReady = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  results.push({ id: "workspace-ready", ok: wsReady });

  const created = await httpJson("POST", `${base}/api/workspace/projects`, {
    name: "Live Intake Repair Project",
  });
  results.push({
    id: "create-project",
    ok: created.ok && Boolean(created.body?.project?.id),
    detail: created.body?.project?.id || created.body,
  });

  const projectId = created.body?.project?.id;
  if (projectId) {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const upload = await httpJson("POST", `${base}/api/workspace/projects/${projectId}/images`, {
      fileName: "front.png",
      mimeType: "image/png",
      dataBase64: png,
      width: 1,
      height: 1,
    });
    results.push({
      id: "upload-image",
      ok: upload.ok && Boolean(upload.body?.image?.id),
      detail: upload.body?.image?.id || upload.body,
    });

    const read = await httpJson("GET", `${base}/api/workspace`);
    const active = read.body?.activeProject;
    results.push({
      id: "read-back",
      ok: active?.id === projectId && (active?.productImages?.length ?? 0) >= 1,
      detail: { activeId: active?.id, images: active?.productImages?.length },
    });

    const imgFile = path.join(
      tmpRoot,
      "creative-workspace",
      "projects",
      projectId,
      "images",
      `${upload.body?.image?.id}.png`,
    );
    results.push({ id: "disk-file", ok: fs.existsSync(imgFile), detail: imgFile });
  }
} finally {
  try {
    child.kill();
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 1000));
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

const allOk = results.every((r) => r.ok);
console.log(JSON.stringify({ allOk, results, logTail: log.slice(-800) }, null, 2));
process.exit(allOk ? 0 : 1);
