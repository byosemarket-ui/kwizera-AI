/**
 * Phase 4.18F.8R — VPS System Master ON/OFF + two scheduled cycles smoke.
 * Uses authenticated admin token on VPS. Never places orders.
 * Does NOT call analyze-now. Uses operational-history for evidence IDs.
 */
import { existsSync, readFileSync } from "node:fs";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const sidecarBase = String(process.env.KWIZERA_FC_SIDECAR_BASE || "http://127.0.0.1:5179").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA || "").trim() || null;
const instrument = String(process.env.KWIZERA_F8R_INSTRUMENT || "XAU/USD").trim() || "XAU/USD";
const timeframe = String(process.env.KWIZERA_F8R_TIMEFRAME || "5m").trim() || "5m";
const waitMs = Math.max(
  180_000,
  Math.min(900_000, Number(process.env.KWIZERA_F8R_WAIT_MS || 780_000) || 780_000),
);
const pollMs = Math.max(5_000, Math.min(30_000, Number(process.env.KWIZERA_F8R_POLL_MS || 10_000) || 10_000));

loadOperatorEnv();
let token = String(process.env.KWIZERA_ADMIN_API_TOKEN || "").trim();
for (const p of [process.env.KWIZERA_VPS_ENV_FILE, "/opt/kwizera-ai/.env"].filter(Boolean)) {
  if (token || !p || !existsSync(p)) continue;
  try {
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*KWIZERA_ADMIN_API_TOKEN\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (v) token = v;
    }
  } catch { /* ignore */ }
}

function redact(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => {
    const key = String(k);
    if (/token|password|secret|authorization|api[_-]?key|^base64$|pngBytes|imagePayload/i.test(key)) return "[REDACTED]";
    if (typeof v === "string" && /sk-[A-Za-z0-9]{10,}/.test(v)) return "[REDACTED]";
    if (typeof v === "string" && v.length > 400 && /^[A-Za-z0-9+/=]+$/.test(v)) return `[REDACTED_B64_len=${v.length}]`;
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
  try { body = text ? JSON.parse(text) : null; } catch { body = { parseError: true, textLength: text.length }; }
  return { status: res.status, body };
}

function shaMatches(actual, expected) {
  if (!actual || !expected) return false;
  const a = String(actual).toLowerCase();
  const e = String(expected).toLowerCase();
  return a === e || a.startsWith(e.slice(0, 7)) || e.startsWith(a.slice(0, 7));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const report = {
    phase: "4.18F.8R",
    base,
    expectSha,
    instrument,
    timeframe,
    usedAnalyzeNow: false,
    checks: {},
    tests: {},
    cycles: [],
    historyCycles: [],
    blockers: [],
    labels: {},
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };

  const health = await getJson("/api/health");
  report.checks.health = { http: health.status, ok: health.body?.ok ?? null };
  if (health.status !== 200 || health.body?.ok !== true) report.blockers.push("GATEWAY_HEALTH_FAILED");

  const version = await getJson("/api/version").catch(() => ({ status: 0, body: null }));
  const versionSha = version.body?.gitSha ?? version.body?.commit ?? version.body?.sha ?? null;
  report.checks.version = { http: version.status, sha: versionSha };
  if (expectSha && versionSha && !shaMatches(versionSha, expectSha)) report.blockers.push("DEPLOYED_SHA_MISMATCH");

  try {
    const sc = await fetch(`${sidecarBase}/health`, { signal: AbortSignal.timeout(8000) });
    report.checks.sidecar = { http: sc.status, ok: sc.ok };
    if (!sc.ok) report.blockers.push("SIDECAR_HEALTH_FAILED");
  } catch (err) {
    report.checks.sidecar = { ok: false, error: err instanceof Error ? err.message.slice(0, 120) : "fail" };
    report.blockers.push("SIDECAR_HEALTH_FAILED");
  }

  if (!token) {
    report.blockers.push("BLOCKED_AUTHENTICATION");
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(2);
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // --- Test A: SYSTEM OFF ---
  let master = await getJson("/api/forex/automated-trading/system-master/status", { headers });
  let stateVersion = master.body?.systemMaster?.stateVersion;
  const off = await getJson("/api/forex/automated-trading/system-master/off", {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedStateVersion: stateVersion }),
  });
  master = await getJson("/api/forex/automated-trading/system-master/status", { headers });
  const monOff = await getJson("/api/forex/automated-trading/monitor/status", { headers });
  report.tests.A_masterOff = {
    http: off.status,
    code: off.body?.code ?? null,
    ownerState: master.body?.systemMaster?.ownerState ?? null,
    operationalState: master.body?.systemMaster?.operationalState ?? null,
    workerEnabled: monOff.body?.monitor?.config?.enabled ?? null,
    workerActive: monOff.body?.monitor?.health?.workerActive ?? null,
    placesOrders: off.body?.placesOrders ?? null,
    acceptsForExecution: off.body?.acceptsForExecution ?? null,
  };
  if (master.body?.systemMaster?.ownerState !== "OFF" || master.body?.systemMaster?.operationalState !== "OFF") {
    report.blockers.push("MASTER_OFF_NOT_PERSISTED");
  }
  if (monOff.body?.monitor?.config?.enabled === true) report.blockers.push("WORKER_STILL_ENABLED_AFTER_OFF");
  if (off.body?.placesOrders === true || off.body?.acceptsForExecution === true) {
    report.blockers.push("UNSAFE_EXECUTION_FLAGS");
  }

  // Confirm no new schedule activity for a short dwell while OFF
  const slotBefore = monOff.body?.monitor?.health?.lastScheduleSlotSec ?? null;
  await sleep(20_000);
  const monOff2 = await getJson("/api/forex/automated-trading/monitor/status", { headers });
  const slotAfter = monOff2.body?.monitor?.health?.lastScheduleSlotSec ?? null;
  report.tests.A_noNewCyclesWhileOff = {
    slotBefore,
    slotAfter,
    advanced: slotBefore != null && slotAfter != null && slotAfter !== slotBefore,
  };
  if (report.tests.A_noNewCyclesWhileOff.advanced) report.blockers.push("CYCLE_ADVANCED_WHILE_OFF");

  // --- Test B: SYSTEM ON ---
  stateVersion = master.body?.systemMaster?.stateVersion;
  await getJson("/api/forex/automated-trading/verify", {
    method: "POST",
    headers,
    body: JSON.stringify({ environment: "DEMO", instrument, timeframe }),
  });
  const on = await getJson("/api/forex/automated-trading/system-master/on", {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedStateVersion: stateVersion, instrument, timeframe }),
  });
  master = await getJson("/api/forex/automated-trading/system-master/status", { headers });
  const monOn = await getJson("/api/forex/automated-trading/monitor/status", { headers });
  report.tests.B_masterOn = {
    http: on.status,
    ok: on.body?.ok ?? null,
    code: on.body?.code ?? null,
    ownerState: master.body?.systemMaster?.ownerState ?? null,
    operationalState: master.body?.systemMaster?.operationalState ?? null,
    activeModuleCount: master.body?.systemMaster?.activeModuleCount ?? null,
    workerEnabled: monOn.body?.monitor?.config?.enabled ?? null,
    nextScheduled: monOn.body?.monitor?.health?.nextScheduledAnalysisAtUtc ?? null,
    placesOrders: on.body?.placesOrders ?? false,
  };
  if (master.body?.systemMaster?.ownerState !== "ON") report.blockers.push("MASTER_ON_NOT_PERSISTED");
  if (
    master.body?.systemMaster?.operationalState !== "ON"
    && master.body?.systemMaster?.operationalState !== "BLOCKED"
  ) {
    report.blockers.push("MASTER_ON_NOT_OPERATIONAL");
  }
  if (monOn.body?.monitor?.config?.enabled !== true && master.body?.systemMaster?.operationalState === "ON") {
    report.blockers.push("WORKER_NOT_ENABLED_AFTER_ON");
  }
  if (on.body?.placesOrders === true) report.blockers.push("UNSAFE_PLACES_ORDERS_ON_ON");

  // --- Test C: two TERMINAL scheduled cycles (never count mid-flight ANALYSIS_IN_FLIGHT) ---
  const NON_TERMINAL = new Set(["ANALYSIS_IN_FLIGHT", "ANALYSIS_IN_PROGRESS", null, undefined, ""]);
  const seen = new Set();
  const baselineTerminals = new Set(
    (await getJson("/api/forex/automated-trading/operational-history?limit=24", { headers }))
      .body?.scheduledTerminals?.map((t) => String(t.slotSec)) ?? [],
  );
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline && report.cycles.length < 2) {
    const histPoll = await getJson("/api/forex/automated-trading/operational-history?limit=24", { headers });
    const terminals = Array.isArray(histPoll.body?.scheduledTerminals)
      ? histPoll.body.scheduledTerminals
      : [];
    for (const t of terminals) {
      const key = String(t.slotSec ?? "");
      if (!key || seen.has(key) || baselineTerminals.has(key)) continue;
      if (!t.isTerminal || !t.completedAtUtc || !t.terminalStatus) continue;
      if (NON_TERMINAL.has(t.terminalStatus) || t.terminalStatus === "ANALYSIS_IN_FLIGHT") continue;
      seen.add(key);
      report.cycles.push({
        slotKey: key,
        terminalStatus: t.terminalStatus ?? null,
        scheduledAt: t.scheduledAtUtc ?? null,
        startedAt: t.startedAtUtc ?? null,
        completedAt: t.completedAtUtc ?? null,
        durationMs: t.durationMs ?? null,
        observationId: t.observationId ?? null,
        imageId: t.imageId ?? null,
        imageHash: t.imageHash ?? null,
        lifecycle: t.lifecycle ?? null,
        canonical: t.canonicalFinalOutcome ?? null,
        blocker: t.blockerCode ?? null,
        includedImageBytesInRequest: t.includedImageBytesInRequest ?? null,
        analysisId: t.analysisId ?? null,
        observedAtUtc: new Date().toISOString(),
        isTerminal: true,
      });
      if (report.cycles.length >= 2) break;
    }
    if (report.cycles.length >= 2) break;

    // Fallback: monitor health lastCycleTerminalStatus with completedAt (still requires terminal).
    const mon = await getJson("/api/forex/automated-trading/monitor/status", { headers });
    const h = mon.body?.monitor?.health ?? {};
    const key = h.lastScheduleSlotSec != null ? String(h.lastScheduleSlotSec) : null;
    const term = h.lastCycleTerminalStatus ?? null;
    if (
      key
      && !seen.has(key)
      && !baselineTerminals.has(key)
      && h.lastCycleCompletedAtUtc
      && term
      && !NON_TERMINAL.has(term)
      && term !== "ANALYSIS_IN_FLIGHT"
    ) {
      seen.add(key);
      report.cycles.push({
        slotKey: key,
        terminalStatus: term,
        scheduledAt: h.lastScheduledAtUtc ?? null,
        startedAt: h.lastCycleStartedAtUtc ?? null,
        completedAt: h.lastCycleCompletedAtUtc ?? null,
        durationMs: h.lastCycleDurationMs ?? null,
        observationId: h.lastObservationId ?? null,
        imageId: h.lastImageId ?? null,
        imageHash: h.lastScreenshotImageHash ?? null,
        lifecycle: h.lastAnalysisLifecycle ?? null,
        canonical: h.lastCanonicalFinalOutcome ?? null,
        blocker: h.lastBlockerCode ?? null,
        includedImageBytesInRequest: h.lastIncludedImageBytesInRequest ?? null,
        analysisId: h.lastAnalysisId ?? null,
        observedAtUtc: new Date().toISOString(),
        isTerminal: true,
        source: "monitor_health_fallback",
      });
    }
    if (report.cycles.length >= 2) break;
    await sleep(pollMs);
  }
  report.labels.scheduledCyclesObserved = report.cycles.length;
  report.labels.allCyclesTerminal = report.cycles.every((c) => c.isTerminal === true && c.completedAt);
  if (report.cycles.length < 2) report.blockers.push("LESS_THAN_TWO_SCHEDULED_CYCLES");
  if (report.cycles.some((c) => !c.completedAt || c.terminalStatus === "ANALYSIS_IN_FLIGHT")) {
    report.blockers.push("NON_TERMINAL_CYCLE_COUNTED");
  }

  const hist = await getJson("/api/forex/automated-trading/operational-history?limit=12", { headers });
  report.historyCycles = Array.isArray(hist.body?.cycles) ? hist.body.cycles.slice(0, 6) : [];
  report.scheduledTerminals = Array.isArray(hist.body?.scheduledTerminals)
    ? hist.body.scheduledTerminals.slice(0, 6)
    : [];
  report.tests.C_operationalHistory = {
    http: hist.status,
    count: report.historyCycles.length,
    terminalCount: report.scheduledTerminals.length,
    hasObservationIds: report.historyCycles.some((c) => c.observationId)
      || report.scheduledTerminals.some((c) => c.observationId),
    hasImageIds: report.historyCycles.some((c) => c.imageId)
      || report.scheduledTerminals.some((c) => c.imageId),
  };

  // Leave system ON for continuous operation after successful proof (owner intent verified).
  // Re-assert execution safety.
  if (master.body?.systemMaster?.placesOrders === true) report.blockers.push("UNSAFE_MASTER_PLACES_ORDERS");

  if (report.blockers.includes("GATEWAY_HEALTH_FAILED") || report.blockers.includes("SIDECAR_HEALTH_FAILED")) {
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(1);
  }
  if (report.blockers.length) {
    report.labels.verdict = "FAIL";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(2);
  }
  report.labels.verdict = "PASS_SYSTEM_MASTER_ON_OFF_SCHEDULED";
  console.log(JSON.stringify(redact(report), null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(JSON.stringify({
    phase: "4.18F.8R",
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "fatal",
    placesOrders: false,
  }));
  process.exit(1);
});
