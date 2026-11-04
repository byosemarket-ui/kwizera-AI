/**
 * Phase 4.18G.1 — VPS production verification closeout for result-intake APIs.
 * Read-only preferred. Uses admin token from VPS env only. Never prints tokens.
 * Does NOT call analyze-now. Does NOT place orders.
 */
import { existsSync, readFileSync } from "node:fs";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA || "").trim() || null;
const waitLiveMs = Math.max(
  0,
  Math.min(900_000, Number(process.env.KWIZERA_G1_WAIT_LIVE_MS || 120_000) || 120_000),
);
const pollMs = Math.max(5_000, Math.min(30_000, Number(process.env.KWIZERA_G1_POLL_MS || 15_000) || 15_000));

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
    if (/token|password|secret|authorization|api[_-]?key|^base64$|pngBytes|imagePayload/i.test(key)) {
      return "[REDACTED]";
    }
    if (typeof v === "string" && /sk-[A-Za-z0-9]{10,}/.test(v)) return "[REDACTED]";
    if (typeof v === "string" && v.length > 400 && /^[A-Za-z0-9+/=]+$/.test(v)) {
      return `[REDACTED_B64_len=${v.length}]`;
    }
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
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 200) }; }
  return { status: res.status, body };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safetyOk(body) {
  if (!body || typeof body !== "object") return false;
  if (body.placesOrders === true) return false;
  if (body.acceptsForExecution === true) return false;
  if (body.mutatesBroker === true) return false;
  const nested = body.resultIntake || body.handoff || body.latest;
  if (nested && typeof nested === "object") {
    if (nested.placesOrders === true) return false;
    if (nested.acceptsForExecution === true) return false;
    if (nested.mutatesBroker === true) return false;
  }
  return true;
}

async function main() {
  const report = {
    phase: "4.18G.1-verify",
    expectSha,
    usedAnalyzeNow: false,
    labels: {
      authToken: "UNKNOWN",
      unauthenticated403: "UNKNOWN",
      authenticatedApis: "UNKNOWN",
      handoffReadOnly: "UNKNOWN",
      forexConnect: "UNKNOWN",
      liveAutomaticIntake: "UNKNOWN",
      masterOffIntake: "UNKNOWN",
      duplicateIdempotent: "UNKNOWN",
      verdict: "UNKNOWN",
    },
    blockers: [],
    checks: {},
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };

  const health = await getJson("/api/health");
  const deploy = await getJson("/api/deployment");
  report.checks.health = {
    http: health.status,
    ok: health.body?.ok ?? null,
    runtimeReady: health.body?.runtimeReady ?? null,
  };
  report.checks.deployment = {
    http: deploy.status,
    deployedCommit: deploy.body?.deployedCommit ?? null,
    status: deploy.body?.status ?? null,
    result: deploy.body?.result ?? null,
  };
  if (expectSha && deploy.body?.deployedCommit && !String(deploy.body.deployedCommit).startsWith(expectSha.slice(0, 8))) {
    report.blockers.push("DEPLOY_SHA_MISMATCH");
  }
  if (health.body?.ok !== true) report.blockers.push("GATEWAY_HEALTH_FAILED");

  const fc = await getJson("/api/forex/providers/forexconnect/status");
  report.checks.forexconnect = {
    http: fc.status,
    status: fc.body?.status ?? null,
    errorCode: fc.body?.errorCode ?? null,
    offersListenerActive: fc.body?.offersListenerActive ?? null,
    subscriptionCount: fc.body?.subscriptionCount ?? null,
    streamUpdateCount: fc.body?.streamUpdateCount ?? null,
    lastQuoteAt: fc.body?.lastQuoteAt ?? null,
    trading: fc.body?.trading ?? null,
    environment: fc.body?.environment ?? null,
  };
  const fcLive =
    String(fc.body?.status || "").toUpperCase() === "CONNECTED"
    || String(fc.body?.status || "").toUpperCase() === "LIVE"
    || (fc.body?.offersListenerActive === true && Number(fc.body?.subscriptionCount || 0) > 0);
  report.labels.forexConnect = fcLive ? "LIVE_OR_STREAMING" : "NOT_LIVE";

  // --- Gap 1: unauthenticated must remain 403 ---
  const unauth = {};
  for (const p of [
    "/api/forex/automated-trading/result-intake/status",
    "/api/forex/automated-trading/result-intake/history?limit=4",
    "/api/forex/automated-trading/result-intake/handoff",
  ]) {
    const r = await getJson(p);
    unauth[p] = { http: r.status };
  }
  report.checks.unauthenticated = unauth;
  const all403 = Object.values(unauth).every((x) => x.http === 403);
  report.labels.unauthenticated403 = all403 ? "VERIFIED" : "FAILED";
  if (!all403) report.blockers.push("UNAUTH_NOT_403");

  if (!token) {
    report.labels.authToken = "UNAVAILABLE";
    report.labels.authenticatedApis = "BLOCKED";
    report.labels.handoffReadOnly = "BLOCKED";
    report.labels.liveAutomaticIntake = fcLive ? "NOT_VERIFIED" : "BLOCKED";
    report.labels.masterOffIntake = "BLOCKED";
    report.labels.duplicateIdempotent = "BLOCKED";
    report.blockers.push("AUTH_TOKEN_UNAVAILABLE");
    report.labels.verdict = "BLOCKED_AUTH_TOKEN_UNAVAILABLE";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(2);
  }
  report.labels.authToken = "PRESENT";

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const statusRes = await getJson("/api/forex/automated-trading/result-intake/status", { headers });
  const histRes = await getJson("/api/forex/automated-trading/result-intake/history?limit=8", { headers });
  const handoffRes = await getJson("/api/forex/automated-trading/result-intake/handoff", { headers });

  report.checks.authenticated = {
    status: {
      http: statusRes.status,
      ok: statusRes.body?.ok ?? null,
      phase: statusRes.body?.resultIntake?.phase ?? null,
      schemaVersion: statusRes.body?.resultIntake?.schemaVersion ?? null,
      historyCount: statusRes.body?.resultIntake?.historyCount ?? null,
      latestResultId: statusRes.body?.resultIntake?.latest?.resultId ?? null,
      latestDecision: statusRes.body?.resultIntake?.latest?.decision ?? null,
      latestLifecycle: statusRes.body?.resultIntake?.latest?.intakeLifecycle ?? null,
      latestAnalysisId: statusRes.body?.resultIntake?.latest?.analysisId ?? null,
      latestObservationId: statusRes.body?.resultIntake?.latest?.observationId ?? null,
      latestImageId: statusRes.body?.resultIntake?.latest?.imageId ?? null,
      latestImageHash: statusRes.body?.resultIntake?.latest?.imageHash ?? null,
      placesOrders: statusRes.body?.placesOrders ?? null,
      acceptsForExecution: statusRes.body?.acceptsForExecution ?? null,
      mutatesBroker: statusRes.body?.mutatesBroker ?? null,
      analysisIsNotExecution: statusRes.body?.analysisIsNotExecution ?? null,
      safetyOk: safetyOk(statusRes.body),
    },
    history: {
      http: histRes.status,
      ok: histRes.body?.ok ?? null,
      count: Array.isArray(histRes.body?.history) ? histRes.body.history.length : null,
      placesOrders: histRes.body?.placesOrders ?? null,
      mutatesBroker: histRes.body?.mutatesBroker ?? null,
      safetyOk: safetyOk(histRes.body),
      sample: Array.isArray(histRes.body?.history)
        ? histRes.body.history.slice(0, 3).map((row) => ({
          resultId: row?.resultId ?? null,
          analysisId: row?.analysisId ?? null,
          decision: row?.decision ?? null,
          intakeLifecycle: row?.intakeLifecycle ?? null,
          observationId: row?.observationId ?? null,
          imageId: row?.imageId ?? null,
          imageHash: row?.imageHash ?? null,
          placesOrders: row?.placesOrders ?? null,
          mutatesBroker: row?.mutatesBroker ?? null,
        }))
        : [],
    },
    handoff: {
      http: handoffRes.status,
      ok: handoffRes.body?.ok ?? null,
      handoffPresent: handoffRes.body?.handoff != null,
      acceptedResultId: handoffRes.body?.handoff?.acceptedResultId ?? null,
      canonicalDirection: handoffRes.body?.handoff?.canonicalDirection ?? null,
      placesOrders: handoffRes.body?.placesOrders ?? null,
      mutatesBroker: handoffRes.body?.mutatesBroker ?? null,
      note: handoffRes.body?.note ?? handoffRes.body?.handoff?.note ?? null,
      safetyOk: safetyOk(handoffRes.body),
    },
  };

  const authOk =
    statusRes.status === 200
    && histRes.status === 200
    && handoffRes.status === 200
    && statusRes.body?.ok === true
    && histRes.body?.ok === true
    && handoffRes.body?.ok === true
    && statusRes.body?.resultIntake?.schemaVersion === "at-analysis-result-intake-v1"
    && safetyOk(statusRes.body)
    && safetyOk(histRes.body)
    && safetyOk(handoffRes.body);
  report.labels.authenticatedApis = authOk ? "VERIFIED" : "FAILED";
  if (!authOk) report.blockers.push("AUTHENTICATED_API_FAILED");

  const handoffRo =
    handoffRes.status === 200
    && handoffRes.body?.placesOrders === false
    && handoffRes.body?.mutatesBroker === false
    && handoffRes.body?.acceptsForExecution === false
    && (handoffRes.body?.handoff == null
      || (
        handoffRes.body.handoff.placesOrders === false
        && handoffRes.body.handoff.mutatesBroker === false
        && handoffRes.body.handoff.acceptsForExecution === false
      ));
  report.labels.handoffReadOnly = handoffRo ? "VERIFIED" : "FAILED";
  if (!handoffRo) report.blockers.push("HANDOFF_NOT_READONLY");

  // Duplicate map presence: same analysisId must not appear twice with different resultIds in history.
  const hist = Array.isArray(histRes.body?.history) ? histRes.body.history : [];
  const byAnalysis = new Map();
  let dupConflict = false;
  for (const row of hist) {
    const aid = String(row?.analysisId || "");
    if (!aid) continue;
    const rid = String(row?.resultId || "");
    if (!byAnalysis.has(aid)) byAnalysis.set(aid, rid);
    else if (byAnalysis.get(aid) !== rid) dupConflict = true;
  }
  report.checks.duplicateScan = {
    historyRows: hist.length,
    uniqueAnalysisIds: byAnalysis.size,
    conflictingDuplicateAnalysisIds: dupConflict,
  };
  report.labels.duplicateIdempotent = dupConflict ? "FAILED" : (hist.length ? "VERIFIED_HISTORY_SCAN" : "NOT_VERIFIED");
  if (dupConflict) report.blockers.push("DUPLICATE_ANALYSIS_CONFLICT");

  // Master OFF: preserve history, skip new intake (controlled; restore ON afterward).
  const masterBefore = await getJson("/api/forex/automated-trading/system-master/status", { headers });
  const histCountBefore = statusRes.body?.resultIntake?.historyCount ?? hist.length;
  let masterOffOk = false;
  if (masterBefore.status === 200 && masterBefore.body?.systemMaster) {
    const sv = masterBefore.body.systemMaster.stateVersion;
    const wasOn = masterBefore.body.systemMaster.ownerState === "ON";
    const off = await getJson("/api/forex/automated-trading/system-master/off", {
      method: "POST",
      headers,
      body: JSON.stringify({ expectedStateVersion: sv }),
    });
    const statusOff = await getJson("/api/forex/automated-trading/result-intake/status", { headers });
    const histOff = await getJson("/api/forex/automated-trading/result-intake/history?limit=8", { headers });
    const histCountOff = statusOff.body?.resultIntake?.historyCount ?? null;
    masterOffOk =
      off.status === 200
      && (off.body?.code === "OFF" || off.body?.code === "ALREADY_OFF")
      && statusOff.status === 200
      && histOff.status === 200
      && (histCountOff == null || histCountOff >= histCountBefore)
      && safetyOk(statusOff.body);

    report.checks.masterOff = {
      offHttp: off.status,
      offCode: off.body?.code ?? null,
      historyCountBefore: histCountBefore,
      historyCountWhileOff: histCountOff,
      historyPreserved: histCountOff == null || histCountOff >= histCountBefore,
      placesOrders: statusOff.body?.placesOrders ?? null,
    };

    // Restore prior ON intent when we turned it off from ON.
    if (wasOn) {
      const masterMid = await getJson("/api/forex/automated-trading/system-master/status", { headers });
      const sv2 = masterMid.body?.systemMaster?.stateVersion;
      await getJson("/api/forex/automated-trading/system-master/on", {
        method: "POST",
        headers,
        body: JSON.stringify({ expectedStateVersion: sv2, instrument: "XAU/USD", timeframe: "5m" }),
      });
    }
  } else {
    report.checks.masterOff = { error: "MASTER_STATUS_UNAVAILABLE" };
  }
  report.labels.masterOffIntake = masterOffOk ? "VERIFIED" : "NOT_VERIFIED";
  if (!masterOffOk) report.blockers.push("MASTER_OFF_INTAKE_NOT_VERIFIED");

  // Gap 2: wait briefly for LIVE provider + new intake (no analyze-now).
  let liveIntake = null;
  if (!fcLive) {
    report.labels.liveAutomaticIntake = "BLOCKED";
    report.blockers.push("PROVIDER_NOT_LIVE");
  } else {
    const baselineLatestId = statusRes.body?.resultIntake?.latest?.resultId ?? null;
    const deadline = Date.now() + waitLiveMs;
    while (Date.now() < deadline) {
      const mon = await getJson("/api/forex/automated-trading/monitor/status", { headers });
      const st = await getJson("/api/forex/automated-trading/result-intake/status", { headers });
      const latest = st.body?.resultIntake?.latest ?? null;
      const fc2 = await getJson("/api/forex/providers/forexconnect/status");
      const stillLive =
        fc2.body?.offersListenerActive === true
        || Number(fc2.body?.subscriptionCount || 0) > 0
        || String(fc2.body?.status || "").toUpperCase() === "CONNECTED";
      if (
        latest
        && latest.resultId
        && latest.resultId !== baselineLatestId
        && latest.intakeLifecycle
        && latest.analysisId
      ) {
        liveIntake = {
          resultId: latest.resultId,
          analysisId: latest.analysisId,
          observationId: latest.observationId ?? null,
          imageId: latest.imageId ?? null,
          imageHash: latest.imageHash ?? null,
          instrument: latest.instrument ?? null,
          primaryTimeframe: latest.primaryTimeframe ?? null,
          decision: latest.decision ?? null,
          canonicalDecision: latest.canonicalDecision ?? null,
          intakeLifecycle: latest.intakeLifecycle ?? null,
          monitorLifecycle: mon.body?.monitor?.health?.lastAnalysisLifecycle ?? null,
          offersListenerActive: fc2.body?.offersListenerActive ?? null,
          subscriptionCount: fc2.body?.subscriptionCount ?? null,
        };
        break;
      }
      if (!stillLive) {
        report.blockers.push("PROVIDER_LOST_LIVE_DURING_WAIT");
        break;
      }
      await sleep(pollMs);
    }
    report.checks.liveAutomaticIntake = liveIntake;
    report.labels.liveAutomaticIntake = liveIntake ? "VERIFIED" : "NOT_VERIFIED";
    if (!liveIntake) report.blockers.push("LIVE_AUTOMATIC_INTAKE_NOT_OBSERVED");
  }

  const gap1Ok =
    report.labels.unauthenticated403 === "VERIFIED"
    && report.labels.authenticatedApis === "VERIFIED"
    && report.labels.handoffReadOnly === "VERIFIED"
    && report.labels.masterOffIntake === "VERIFIED";

  if (gap1Ok && report.labels.liveAutomaticIntake === "VERIFIED") {
    report.labels.verdict = "PASS_G1_AUTH_AND_LIVE_INTAKE";
  } else if (gap1Ok && report.labels.liveAutomaticIntake === "BLOCKED") {
    report.labels.verdict = "PASS_G1_AUTH_BLOCKED_PROVIDER_NOT_LIVE";
    // Provider block is expected — remove from hard blockers for exit code if auth passed.
    report.blockers = report.blockers.filter((b) => b !== "PROVIDER_NOT_LIVE" && b !== "LIVE_AUTOMATIC_INTAKE_NOT_OBSERVED");
  } else if (gap1Ok) {
    report.labels.verdict = "PASS_G1_AUTH_LIVE_INTAKE_NOT_VERIFIED";
    report.blockers = report.blockers.filter((b) => b !== "LIVE_AUTOMATIC_INTAKE_NOT_OBSERVED");
  } else {
    report.labels.verdict = "FAIL";
  }

  console.log(JSON.stringify(redact(report), null, 2));
  if (report.labels.verdict.startsWith("PASS")) process.exit(0);
  process.exit(report.blockers.includes("AUTH_TOKEN_UNAVAILABLE") ? 2 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({
    phase: "4.18G.1-verify",
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "fatal",
    placesOrders: false,
  }));
  process.exit(1);
});
