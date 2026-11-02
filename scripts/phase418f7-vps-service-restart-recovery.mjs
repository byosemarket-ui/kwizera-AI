/**
 * Phase 4.18F.7 — Controlled kwizera-ai.service restart recovery (NOT a VPS reboot).
 * Analysis-only. Never places orders. Intended for workflow_dispatch only.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const sidecarBase = String(process.env.KWIZERA_FC_SIDECAR_BASE || "http://127.0.0.1:5179").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA || "").trim() || null;
const doRestart = String(process.env.KWIZERA_F7_SERVICE_RESTART || "1").trim() !== "0";

loadOperatorEnv();
let token = String(process.env.KWIZERA_ADMIN_API_TOKEN || "").trim();
for (const p of [process.env.KWIZERA_VPS_ENV_FILE, "/opt/kwizera-ai/.env"].filter(Boolean)) {
  if (token || !p || !existsSync(p)) continue;
  try {
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*KWIZERA_ADMIN_API_TOKEN\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (v) token = v;
    }
  } catch { /* ignore */ }
}

function redact(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => {
    if (/token|password|secret|authorization|api[_-]?key/i.test(String(k))) return "[REDACTED]";
    return v;
  }));
}

async function getJson(pathName, init = {}) {
  const res = await fetch(`${base}${pathName}`, {
    ...init,
    headers: { Accept: "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parseError: true, textLength: text.length };
  }
  return { status: res.status, body };
}

async function waitHealth(maxMs = 90_000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < maxMs) {
    try {
      last = await getJson("/api/health");
      if (last.status === 200 && last.body?.ok === true) return last;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return last;
}

async function main() {
  const report = {
    phase: "4.18F.7-service-restart",
    expectSha,
    doRestart,
    labels: {
      serviceRestartRecovery: "NOT_VERIFIED",
      vpsRebootRecovery: "NOT_VERIFIED",
      rebootTestPlan:
        "1) Confirm no owner-critical live sessions. 2) systemctl stop kwizera-ai.service kwizera-forexconnect.service. 3) reboot. 4) After boot: both services active, /api/health ok, sidecar /health ok, monitor resumeFromPersistence if enabled, no duplicate dedupe keys, placesOrders=false.",
    },
    checks: {},
    blockers: [],
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };

  const headers = token
    ? { Authorization: `Bearer ${token}`, Accept: "application/json" }
    : { Accept: "application/json" };

  const beforeHealth = await getJson("/api/health");
  report.checks.beforeHealth = {
    http: beforeHealth.status,
    ok: beforeHealth.body?.ok ?? null,
  };

  let monitorBefore = null;
  if (token) {
    monitorBefore = await getJson("/api/forex/automated-trading/monitor/status", { headers });
    report.checks.monitorBefore = {
      http: monitorBefore.status,
      enabled: monitorBefore.body?.status?.config?.enabled
        ?? monitorBefore.body?.monitor?.config?.enabled
        ?? monitorBefore.body?.config?.enabled
        ?? null,
      workerActive: monitorBefore.body?.status?.health?.workerActive
        ?? monitorBefore.body?.monitor?.health?.workerActive
        ?? monitorBefore.body?.health?.workerActive
        ?? null,
      lastDedupeKey: monitorBefore.body?.status?.health?.lastDedupeKey
        ?? monitorBefore.body?.health?.lastDedupeKey
        ?? null,
    };
  }

  try {
    const sc = await fetch(`${sidecarBase}/health`, { signal: AbortSignal.timeout(8000) });
    report.checks.sidecarBefore = { http: sc.status, ok: sc.ok };
  } catch (err) {
    report.checks.sidecarBefore = {
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 120) : "fetch_failed",
    };
  }

  if (!doRestart) {
    report.labels.serviceRestartRecovery = "SKIPPED";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(0);
  }

  try {
    execSync("systemctl restart kwizera-ai.service", {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
    report.checks.restart = { ok: true, command: "systemctl restart kwizera-ai.service" };
  } catch (err) {
    report.checks.restart = {
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 200) : "restart_failed",
    };
    report.blockers.push("SERVICE_RESTART_FAILED");
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(1);
  }

  const afterHealth = await waitHealth(90_000);
  report.checks.afterHealth = {
    http: afterHealth?.status ?? 0,
    ok: afterHealth?.body?.ok ?? null,
    waitOk: afterHealth?.status === 200 && afterHealth?.body?.ok === true,
  };
  if (!report.checks.afterHealth.waitOk) {
    report.blockers.push("GATEWAY_HEALTH_AFTER_RESTART_FAILED");
  }

  try {
    const sc = await fetch(`${sidecarBase}/health`, { signal: AbortSignal.timeout(8000) });
    report.checks.sidecarAfter = { http: sc.status, ok: sc.ok };
    if (!sc.ok) report.blockers.push("SIDECAR_UNHEALTHY_AFTER_RESTART");
  } catch (err) {
    report.checks.sidecarAfter = {
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 120) : "fetch_failed",
    };
    report.blockers.push("SIDECAR_UNREACHABLE_AFTER_RESTART");
  }

  if (token) {
    const monitorAfter = await getJson("/api/forex/automated-trading/monitor/status", { headers });
    const enabledBefore = report.checks.monitorBefore?.enabled === true;
    const enabledAfter = monitorAfter.body?.status?.config?.enabled
      ?? monitorAfter.body?.monitor?.config?.enabled
      ?? monitorAfter.body?.config?.enabled
      ?? null;
    const workerActive = monitorAfter.body?.status?.health?.workerActive
      ?? monitorAfter.body?.monitor?.health?.workerActive
      ?? monitorAfter.body?.health?.workerActive
      ?? null;
    const lastDedupe = monitorAfter.body?.status?.health?.lastDedupeKey
      ?? monitorAfter.body?.health?.lastDedupeKey
      ?? null;
    report.checks.monitorAfter = {
      http: monitorAfter.status,
      enabled: enabledAfter,
      workerActive,
      lastDedupeKey: lastDedupe,
      requiresBrowserOpen: monitorAfter.body?.status?.requiresBrowserOpen
        ?? monitorAfter.body?.requiresBrowserOpen
        ?? null,
      placesOrders: monitorAfter.body?.status?.placesOrders
        ?? monitorAfter.body?.placesOrders
        ?? null,
    };
    if (enabledBefore && enabledAfter !== true) {
      report.blockers.push("MONITOR_ENABLED_NOT_RESTORED");
    }
    if (enabledBefore && workerActive !== true) {
      // May be CONNECTING briefly — soft note if health recovered.
      report.labels.workerActiveNote = "enabled_before_but_worker_not_active_yet";
    }
    if (report.checks.monitorBefore?.lastDedupeKey && lastDedupe
      && report.checks.monitorBefore.lastDedupeKey !== lastDedupe) {
      // Dedupe key change alone is not failure; duplicate would be same key re-analyzed.
      report.labels.dedupeKeyChanged = true;
    }
  }

  report.labels.serviceRestartRecovery =
    report.blockers.length === 0 ? "VERIFIED" : "FAILED";
  report.labels.vpsRebootRecovery = "NOT_VERIFIED";

  console.log(JSON.stringify(redact(report), null, 2));
  process.exit(report.blockers.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({
    phase: "4.18F.7-service-restart",
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "fatal",
    placesOrders: false,
  }));
  process.exit(1);
});
