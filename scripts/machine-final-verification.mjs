/**
 * Final Windows machine verification — launches packaged EXE (not dev server),
 * verifies API, Product Creation E2E, shortcut target, storage paths.
 *
 * Does NOT claim Windows reboot or UI click tests.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const UNPACKED_EXE = path.join(ROOT, "release", "win-unpacked", "KWIZERA AI STUDIO.exe");
const SETUP_EXE = path.join(ROOT, "release", `KwizeraAIStudio-Setup-${VERSION}.exe`);
const PORT = 5173;
const BASE = `http://127.0.0.1:${PORT}`;
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** @type {Array<{ id: string; name: string; expected: string; actual: string; status: "PASS"|"FAIL"|"LIMITED"|"SKIP"|"NOT CERTIFIED" }>} */
const results = [];

function record(id, name, expected, actual, status) {
  results.push({ id, name, expected, actual, status });
  const m = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "·";
  console.log(`[${m}] ${id}: ${status} — ${actual}`);
}

function httpJson(method, url, body, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const payload = body == null ? null : JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
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
          let parsed = Buffer.concat(chunks).toString("utf8");
          try {
            parsed = JSON.parse(parsed);
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

async function waitHealth(attempts = 180) {
  for (let i = 0; i < attempts; i++) {
    const r = await httpJson("GET", `${BASE}/api/health`);
    if (r.ok && r.body?.ok) return r.body;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

function readShortcutTarget(lnkPath) {
  if (!fs.existsSync(lnkPath)) return null;
  const ps = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `(New-Object -ComObject WScript.Shell).CreateShortcut('${lnkPath.replace(/'/g, "''")}').TargetPath`,
    ],
    { encoding: "utf8", timeout: 15000 },
  );
  return (ps.stdout ?? "").trim() || null;
}

async function main() {
  console.log(`\nKWIZERA AI STUDIO — Final Machine Verification v${VERSION}\n`);

  record(
    "build.setup-exe",
    "Windows Setup EXE exists",
    SETUP_EXE,
    fs.existsSync(SETUP_EXE) ? `${Math.round(fs.statSync(SETUP_EXE).size / 1e6)}MB` : "missing",
    fs.existsSync(SETUP_EXE) ? "PASS" : "FAIL",
  );
  record(
    "build.unpacked-exe",
    "Unpacked application EXE exists",
    UNPACKED_EXE,
    fs.existsSync(UNPACKED_EXE) ? "present" : "missing",
    fs.existsSync(UNPACKED_EXE) ? "PASS" : "FAIL",
  );

  const appServer = path.join(ROOT, "release", "win-unpacked", "resources", "app-server");
  const hasModules = fs.existsSync(path.join(appServer, "node_modules", "tsx", "dist", "cli.mjs"));
  if (!hasModules) {
    console.log("\nStaging node_modules into packaged app-server…");
    const stage = spawnSync(process.execPath, [path.join(ROOT, "scripts", "stage-packaged-runtime.mjs")], {
      cwd: ROOT,
      stdio: "inherit",
    });
    record(
      "deploy.runtime-staged",
      "Packaged app-server has node_modules",
      "tsx present",
      stage.status === 0 ? "staged" : `stage exit ${stage.status}`,
      stage.status === 0 ? "PASS" : "FAIL",
    );
  } else {
    record("deploy.runtime-staged", "Packaged app-server has node_modules", "tsx present", "already present", "PASS");
  }

  console.log("\nInstalling desktop shortcuts…");
  const shortcuts = spawnSync("npm", ["run", "install:shortcuts"], {
    cwd: ROOT,
    shell: true,
    stdio: "pipe",
    encoding: "utf8",
    timeout: 60000,
  });
  const desktopLnk = path.join(os.homedir(), "Desktop", "KWIZERA AI STUDIO.lnk");
  const shortcutTarget = readShortcutTarget(desktopLnk);
  const exeNorm = UNPACKED_EXE.replace(/\//g, "\\").toLowerCase();
  const targetNorm = (shortcutTarget ?? "").replace(/\//g, "\\").toLowerCase();
  record(
    "windows.desktop-shortcut",
    "Desktop shortcut targets packaged EXE",
    exeNorm,
    shortcutTarget ?? "missing",
    targetNorm === exeNorm ? "PASS" : shortcutTarget ? "LIMITED" : "FAIL",
  );
  record(
    "windows.shortcuts-script",
    "install:shortcuts",
    "exit 0",
    String(shortcuts.status ?? 1),
    shortcuts.status === 0 ? "PASS" : "FAIL",
  );

  console.log("\nLaunching packaged KWIZERA AI STUDIO.exe…");
  const child = spawn(UNPACKED_EXE, [], {
    cwd: path.dirname(UNPACKED_EXE),
    env: { ...process.env, KWIZERA_SKIP_BROWSER_OPEN: "1" },
    stdio: "ignore",
    windowsHide: false,
    detached: true,
  });
  child.unref();

  let health = null;
  try {
    health = await waitHealth(180);
    record(
      "installed.app-startup",
      "Packaged app starts local API",
      "/api/health ok",
      health ? `storageRoot=${health.storageRoot}` : "timeout",
      health ? "PASS" : "FAIL",
    );

    if (health) {
      record(
        "installed.storage-root",
        "Actual KWIZERA_STORAGE_ROOT in use",
        "configured path",
        String(health.storageRoot ?? "unknown"),
        health.storageRoot ? "PASS" : "FAIL",
      );

      let wsOk = false;
      for (let i = 0; i < 60; i++) {
        const ws = await httpJson("GET", `${BASE}/api/workspace`);
        if (ws.ok) {
          wsOk = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      record("installed.workspace-ready", "Creative workspace ready", "GET /api/workspace", wsOk ? "ready" : "timeout", wsOk ? "PASS" : "FAIL");

      if (wsOk) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const name = `KWIZERA-FINAL-MACHINE-TEST-${stamp}`;
        const created = await httpJson("POST", `${BASE}/api/workspace/projects`, { name });
        const projectId = created.body?.project?.id;
        record(
          "installed.create-project",
          "Create project from installed app API",
          "projectId",
          projectId ?? JSON.stringify(created.body).slice(0, 80),
          created.ok && projectId ? "PASS" : "FAIL",
        );

        if (projectId) {
          const up = await httpJson("POST", `${BASE}/api/workspace/projects/${projectId}/images`, {
            fileName: "machine-test.png",
            mimeType: "image/png",
            dataBase64: PNG,
            width: 1,
            height: 1,
          });
          record(
            "installed.image-upload",
            "Image upload via installed app API",
            "image id",
            up.body?.image?.id ?? String(up.body).slice(0, 60),
            up.ok && up.body?.image?.id ? "PASS" : "FAIL",
          );

          const diskPath = path.join(
            String(health.storageRoot),
            "creative-workspace",
            "projects",
            projectId,
            "project.json",
          );
          record(
            "installed.filesystem-project",
            "Project on disk under storage root",
            diskPath,
            fs.existsSync(diskPath) ? "exists" : "missing",
            fs.existsSync(diskPath) ? "PASS" : "FAIL",
          );

          const sh = await httpJson("GET", `${BASE}/api/system-health`);
          record(
            "installed.system-health",
            "System health from installed app",
            "report ok",
            sh.ok ? `score=${sh.body?.healthScore} status=${sh.body?.overallStatus}` : "fail",
            sh.ok ? "PASS" : "FAIL",
          );
        }
      }

      const desktop = await httpJson("GET", `${BASE}/desktop/`);
      record(
        "installed.desktop-ui",
        "Desktop UI served by installed app",
        "HTTP 200",
        `HTTP ${desktop.status}`,
        desktop.status === 200 ? "PASS" : "FAIL",
      );
    }
  } finally {
    console.log("\nStopping packaged application…");
    try {
      if (child.pid) {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      }
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  record("ui.file-picker", "Windows file picker click test", "manual UI", "NOT RUN in harness", "SKIP");
  record("ui.drag-drop", "Drag & drop UI test", "manual UI", "NOT RUN in harness", "SKIP");
  record("os.windows-reboot", "Windows restart persistence", "real reboot", "NOT RUN in harness", "SKIP");
  record("production.video-output", "Real video production output", "completed job + file", "NOT RUN — requires persistent AI runtime", "NOT CERTIFIED");

  const criticalFail = results.some(
    (r) =>
      r.status === "FAIL"
      && [
        "build.unpacked-exe",
        "deploy.runtime-staged",
        "installed.app-startup",
        "installed.create-project",
        "installed.image-upload",
      ].includes(r.id),
  );
  const hasSkip = results.some((r) => r.status === "SKIP" || r.status === "NOT CERTIFIED");
  let verdict = "PRODUCTION READY";
  if (criticalFail) verdict = "NOT READY";
  else if (hasSkip) verdict = "LIMITED PRODUCTION";

  const outDir = path.join(ROOT, "release", "certification");
  fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    version: VERSION,
    verdict,
    kind: "final-machine-verification",
    os: `${os.type()} ${os.release()}`,
    executable: UNPACKED_EXE,
    setup: SETUP_EXE,
    desktopShortcutTarget: shortcutTarget,
    results,
    counts: {
      pass: results.filter((r) => r.status === "PASS").length,
      fail: results.filter((r) => r.status === "FAIL").length,
      limited: results.filter((r) => r.status === "LIMITED").length,
      skip: results.filter((r) => r.status === "SKIP").length,
      notCertified: results.filter((r) => r.status === "NOT CERTIFIED").length,
    },
  };
  fs.writeFileSync(path.join(outDir, "final-machine-verification.json"), JSON.stringify(payload, null, 2), "utf8");

  const md = [
    "# KWIZERA AI STUDIO",
    "# FINAL WINDOWS MACHINE CERTIFICATION",
    "",
    `**Generated:** ${payload.generatedAt}`,
    `**Verdict:** ${verdict}`,
    `**Version:** ${VERSION}`,
    "",
    "## Machine",
    `- OS: ${payload.os}`,
    `- Executable: ${UNPACKED_EXE}`,
    `- Setup: ${SETUP_EXE}`,
    `- Desktop shortcut → ${shortcutTarget ?? "n/a"}`,
    "",
    "## Results",
    "",
    "| ID | Status | Actual |",
    "|----|--------|--------|",
    ...results.map((r) => `| ${r.id} | ${r.status} | ${String(r.actual).replace(/\|/g, "\\|").slice(0, 80)} |`),
    "",
    "## Counts",
    `- PASS: ${payload.counts.pass}`,
    `- FAIL: ${payload.counts.fail}`,
    `- LIMITED: ${payload.counts.limited}`,
    `- SKIP: ${payload.counts.skip}`,
    `- NOT CERTIFIED: ${payload.counts.notCertified}`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "FINAL-WINDOWS-MACHINE-CERTIFICATION.md"), md, "utf8");

  console.log(`\nVerdict: ${verdict}`);
  console.log(`PASS=${payload.counts.pass} FAIL=${payload.counts.fail} SKIP=${payload.counts.skip}`);
  process.exit(criticalFail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
