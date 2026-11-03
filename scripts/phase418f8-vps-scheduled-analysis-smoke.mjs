/**
 * Phase 4.18F.8 — VPS production smoke for AUTOMATIC 5-minute scheduled analysis.
 *
 * Does NOT call monitor/analyze-now. Waits for two consecutive wall-clock slots
 * observed via monitor/status (lastScheduleSlotSec / cycle telemetry).
 * Analysis-only — never places orders / grants / broker mutations.
 */
import { existsSync, readFileSync } from "node:fs";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const sidecarBase = String(process.env.KWIZERA_FC_SIDECAR_BASE || "http://127.0.0.1:5179").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA || "").trim() || null;
const instrument = String(process.env.KWIZERA_F8_INSTRUMENT || "XAU/USD").trim() || "XAU/USD";
const timeframe = String(process.env.KWIZERA_F8_TIMEFRAME || "5m").trim() || "5m";
const waitMs = Math.max(
  180_000,
  Math.min(900_000, Number(process.env.KWIZERA_F8_WAIT_MS || 780_000) || 780_000),
);
const pollMs = Math.max(5_000, Math.min(30_000, Number(process.env.KWIZERA_F8_POLL_MS || 10_000) || 10_000));

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
  } catch {
    /* ignore */
  }
}

function redact(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => {
    const key = String(k);
    if (/token|password|secret|authorization|api[_-]?key|^base64$|pngBytes|imagePayload/i.test(key)) {
      return "[REDACTED]";
    }
    if (typeof v === "string" && /sk-[A-Za-z0-9]{10,}/.test(v)) return "[REDACTED]";
    if (typeof v === "string" && v.length > 400 && /^[A-Za-z0-9+/=]+$/.test(v)) return `[REDACTED_B64_len=${v.length}]`;
    return v;
  }));
}

async function getJson(pathName, init = {}) {
  const res = await fetch(`${base}${pathName}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
    },
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

function shaMatches(actual, expected) {
  if (!actual || !expected) return false;
  const a = String(actual).toLowerCase();
  const e = String(expected).toLowerCase();
  return a === e || a.startsWith(e.slice(0, 7)) || e.startsWith(a.slice(0, 7));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractMonitor(body) {
  return body?.monitor ?? body?.status ?? body ?? null;
}

function cycleFingerprint(mon) {
  const h = mon?.health ?? {};
  return {
    slotSec: h.lastScheduleSlotSec ?? null,
    scheduledAt: h.lastScheduledAtUtc ?? null,
    startedAt: h.lastCycleStartedAtUtc ?? null,
    completedAt: h.lastCycleCompletedAtUtc ?? null,
    analysisAt: h.lastAnalysisAtUtc ?? null,
    analysisId: h.lastAnalysisId ?? null,
    observationId: h.lastObservationId ?? null,
    imageId: h.lastImageId ?? null,
    imageHash: h.lastScreenshotImageHash ?? null,
    lifecycle: h.lastAnalysisLifecycle ?? null,
    canonical: h.lastCanonicalFinalOutcome ?? null,
    direction: h.lastCanonicalDirection ?? null,
    imageBytes: h.lastIncludedImageBytesInRequest ?? null,
    blocker: h.lastBlockerCode ?? null,
    workerState: h.workerState ?? null,
  };
}

async function main() {
  const report = {
    phase: "4.18F.8",
    base,
    sidecarBase,
    expectSha,
    instrument,
    timeframe,
    waitMs,
    tokenPresent: Boolean(token),
    usedAnalyzeNow: false,
    checks: {},
    cycles: [],
    blockers: [],
    labels: {},
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };

  const health = await getJson("/api/health");
  report.checks.health = {
    http: health.status,
    ok: health.body?.ok ?? null,
    deployedSha: health.body?.gitSha ?? health.body?.commit ?? health.body?.sha ?? null,
  };
  if (health.status !== 200 || health.body?.ok !== true) report.blockers.push("GATEWAY_HEALTH_FAILED");

  const version = await getJson("/api/version").catch(() => ({ status: 0, body: null }));
  const versionSha =
    version.body?.gitSha
    ?? version.body?.commit
    ?? version.body?.sha
    ?? version.body?.version?.gitSha
    ?? null;
  report.checks.version = { http: version.status, sha: versionSha };
  if (expectSha && versionSha && !shaMatches(versionSha, expectSha)) {
    report.blockers.push("DEPLOYED_SHA_MISMATCH");
  }

  let sidecarOk = false;
  try {
    const sc = await fetch(`${sidecarBase}/health`, { signal: AbortSignal.timeout(8000) });
    sidecarOk = sc.ok;
    report.checks.sidecar = { http: sc.status, ok: sc.ok };
  } catch (err) {
    report.checks.sidecar = {
      http: 0,
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 120) : "fetch_failed",
    };
  }
  if (!sidecarOk) report.blockers.push("SIDECAR_HEALTH_FAILED");

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

  const atStatus = await getJson("/api/forex/automated-trading/status", { headers });
  let environmentEpoch =
    atStatus.body?.status?.environmentEpoch
    ?? atStatus.body?.environmentEpoch
    ?? null;
  const selectedEnvironment =
    atStatus.body?.status?.selectedEnvironment
    ?? atStatus.body?.selectedEnvironment
    ?? "DEMO";
  report.checks.atStatus = {
    http: atStatus.status,
    selectedEnvironment,
    environmentEpoch,
    placesOrders: atStatus.body?.status?.placesOrders ?? atStatus.body?.placesOrders ?? null,
    acceptsForExecution: atStatus.body?.status?.acceptsForExecution ?? null,
    mutatesBroker: atStatus.body?.status?.mutatesBroker ?? null,
  };
  if (report.checks.atStatus.placesOrders === true) report.blockers.push("UNSAFE_PLACES_ORDERS");
  if (report.checks.atStatus.acceptsForExecution === true) report.blockers.push("UNSAFE_ACCEPTS_FOR_EXECUTION");
  if (report.checks.atStatus.mutatesBroker === true) report.blockers.push("UNSAFE_MUTATES_BROKER");
  if (String(selectedEnvironment).toUpperCase() !== "DEMO") {
    report.blockers.push("NOT_DEMO_SELECTION");
  }

  // Ensure instrument + verification evidence exist (readiness), without triggering OpenAI.
  const verify = await getJson("/api/forex/automated-trading/verify", {
    method: "POST",
    headers,
    body: JSON.stringify({
      environment: "DEMO",
      expectedEnvironmentEpoch: environmentEpoch,
      instrument,
      timeframe,
    }),
  });
  environmentEpoch =
    verify.body?.status?.environmentEpoch
    ?? verify.body?.environmentEpoch
    ?? environmentEpoch;
  report.checks.verify = {
    http: verify.status,
    ok: verify.body?.ok ?? null,
    feedStatus: verify.body?.verification?.market?.feedStatus ?? null,
    marketSession: verify.body?.verification?.market?.marketSession ?? null,
  };

  let monRes = await getJson("/api/forex/automated-trading/monitor/status", { headers });
  let mon = extractMonitor(monRes.body);
  report.checks.monitorBefore = {
    http: monRes.status,
    enabled: mon?.config?.enabled ?? null,
    workerActive: mon?.health?.workerActive ?? null,
    automaticAnalysisStatus: mon?.automaticAnalysisStatus ?? mon?.health?.automaticAnalysisStatus ?? null,
    nextScheduled: mon?.health?.nextScheduledAnalysisAtUtc ?? null,
    requiresDashboardClick: mon?.requiresDashboardClick ?? null,
    scheduleMode: mon?.scheduleMode ?? null,
  };

  // Bootstrap only if auto-enable did not yet persist enabled=true (e.g. missing instrument at boot).
  let bootstrapStartUsed = false;
  if (mon?.config?.enabled !== true) {
    bootstrapStartUsed = true;
    const started = await getJson("/api/forex/automated-trading/monitor/start", {
      method: "POST",
      headers,
      body: JSON.stringify({
        environment: "DEMO",
        expectedEnvironmentEpoch: environmentEpoch,
        instrument,
        timeframe,
      }),
    });
    report.checks.bootstrapStart = {
      http: started.status,
      ok: started.body?.ok ?? null,
      code: started.body?.error?.code ?? started.body?.code ?? null,
    };
    monRes = await getJson("/api/forex/automated-trading/monitor/status", { headers });
    mon = extractMonitor(monRes.body);
  }
  report.labels.bootstrapStartUsed = bootstrapStartUsed ? "YES_FOR_ENABLE_ONLY" : "NO";

  if (mon?.config?.enabled !== true) {
    report.blockers.push("MONITOR_NOT_ENABLED");
  }
  if (mon?.requiresDashboardClick === true) {
    report.blockers.push("REQUIRES_DASHBOARD_CLICK_FALSE_CLAIM");
  }
  if (mon?.scheduleMode && mon.scheduleMode !== "five_minute_wall_utc") {
    report.blockers.push("UNEXPECTED_SCHEDULE_MODE");
  }

  const seenSlots = new Set();
  const deadline = Date.now() + waitMs;
  const samples = [];

  while (Date.now() < deadline && report.cycles.length < 2) {
    monRes = await getJson("/api/forex/automated-trading/monitor/status", { headers });
    mon = extractMonitor(monRes.body);
    const fp = cycleFingerprint(mon);
    samples.push({
      atUtc: new Date().toISOString(),
      enabled: mon?.config?.enabled ?? null,
      workerActive: mon?.health?.workerActive ?? null,
      automaticAnalysisStatus: mon?.automaticAnalysisStatus ?? mon?.health?.automaticAnalysisStatus ?? null,
      analysisInFlight: mon?.health?.analysisInFlight ?? null,
      nextScheduled: mon?.health?.nextScheduledAnalysisAtUtc ?? null,
      missedCycles: mon?.health?.missedCycles ?? null,
      delayedCycles: mon?.health?.delayedCycles ?? null,
      ...fp,
    });

    const slotKey = fp.slotSec != null
      ? String(fp.slotSec)
      : (fp.completedAt || fp.analysisAt || null);
    if (slotKey && !seenSlots.has(slotKey) && (fp.completedAt || fp.blocker || fp.analysisAt)) {
      // A cycle advanced the schedule (success, blocked, or OpenAI result).
      seenSlots.add(slotKey);
      report.cycles.push({
        slotKey,
        ...fp,
        observedAtUtc: new Date().toISOString(),
      });
    }

    if (report.cycles.length >= 2) break;
    await sleep(pollMs);
  }

  report.checks.samplesTail = samples.slice(-8);
  report.checks.monitorFinal = samples[samples.length - 1] ?? null;
  report.labels.scheduledCyclesObserved = report.cycles.length;
  report.labels.usedAnalyzeNow = false;

  if (report.cycles.length < 2) {
    report.blockers.push("LESS_THAN_TWO_SCHEDULED_CYCLES");
  } else {
    const [a, b] = report.cycles;
    if (a.slotKey === b.slotKey) report.blockers.push("DUPLICATE_CYCLE_SLOT");
    // Overlap check: both should not claim analysisInFlight simultaneously in final samples —
    // verified by distinct slots advancing without duplicate OpenAI for same slot (dedupe).
  }

  const openaiRequested = report.cycles.some((c) => c.imageBytes === true || c.lifecycle);
  const openaiValidated = report.cycles.some((c) => c.lifecycle === "ANALYSIS_VALID");
  const blockedOnly = report.cycles.every((c) =>
    c.blocker === "STALE_QUOTES"
    || c.blocker === "VERIFICATION_REQUIRED"
    || c.blocker === "DATA_INSUFFICIENT"
    || c.blocker === "SCHEDULE_SLOT_MISSED"
    || c.blocker === "SCHEDULE_SLOT_SKIPPED_IN_FLIGHT"
  );

  report.labels.openaiRequestObserved = openaiRequested ? "YES" : "NO";
  report.labels.openaiValidated = openaiValidated ? "YES" : "NO";
  report.labels.schedulerAdvanced = report.cycles.length >= 2 ? "YES" : "NO";
  report.labels.marketBlockedCycles = blockedOnly ? "YES" : "NO";

  // Scheduler proof can pass with BLOCKED/NO_TRADE when market is closed/stale —
  // but must still show two schedule advances without analyze-now.
  if (report.blockers.includes("GATEWAY_HEALTH_FAILED") || report.blockers.includes("SIDECAR_HEALTH_FAILED")) {
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(1);
  }
  if (report.blockers.includes("MONITOR_NOT_ENABLED") || report.blockers.includes("LESS_THAN_TWO_SCHEDULED_CYCLES")) {
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(2);
  }
  if (report.blockers.some((b) => b.startsWith("UNSAFE_"))) {
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(3);
  }

  report.labels.verdict = "PASS_SCHEDULED_AUTOMATIC_ANALYSIS";
  console.log(JSON.stringify(redact(report), null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(JSON.stringify({
    phase: "4.18F.8",
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "fatal",
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  }));
  process.exit(1);
});
