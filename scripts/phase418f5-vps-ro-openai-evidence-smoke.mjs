/**
 * Phase 4.18F.5 — VPS READ-ONLY OpenAI evidence-delivery round-trip smoke.
 *
 * Calls the real /openai/analyze path (not includeOpenAi:false, not mock).
 * Verifies redacted evidenceDelivery on the response. Never prints tokens.
 * Never places orders, creates grants, enables armed_execute, or mutates broker.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const sidecarBase = String(process.env.KWIZERA_FC_SIDECAR_BASE || "http://127.0.0.1:5179").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA || "").trim() || null;
const appDir = String(process.env.KWIZERA_APP_DIR || "/opt/kwizera-ai").replace(/\/$/, "");
const timeoutMs = Math.max(15_000, Math.min(120_000, Number(process.env.KWIZERA_OA_TIMEOUT_MS || 90_000) || 90_000));

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
    if (/token|password|secret|authorization|api[_-]?key/i.test(String(k))) return "[REDACTED]";
    if (typeof v === "string" && /sk-[A-Za-z0-9]{10,}/.test(v)) return "[REDACTED]";
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

async function main() {
  const report = {
    phase: "4.18F.5",
    base,
    sidecarBase,
    expectSha,
    tokenPresent: Boolean(token),
    tokenLength: token ? token.length : 0,
    checks: {},
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
    status: health.body?.status ?? null,
    runtimeReady: health.body?.runtimeReady ?? null,
    deployedSha: health.body?.gitSha ?? health.body?.commit ?? health.body?.sha ?? null,
  };
  if (health.status !== 200 || health.body?.ok !== true) {
    report.blockers.push("GATEWAY_HEALTH_FAILED");
  }
  if (expectSha && report.checks.health.deployedSha && !shaMatches(report.checks.health.deployedSha, expectSha)) {
    // soft — some health payloads omit SHA; also check version endpoint below
    report.labels.shaFromHealth = "MISMATCH_OR_ABSENT";
  }

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

  // Dashboard markers for F.5 evidence delivery
  const assetRoots = [
    path.join(appDir, "dev", "ui", "desktop"),
    path.join(appDir, "dev", "ui", "desktop", "assets"),
    path.join(appDir, "dist", "ui", "desktop"),
    path.join(appDir, "desktop", "forex"),
  ];
  let bundleHasDelivery = false;
  for (const root of assetRoots) {
    if (!existsSync(root)) continue;
    let entries = [];
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    const files = [...entries.filter((e) => e.isFile()).map((e) => path.join(root, e.name))];
    const nested = path.join(root, "assets");
    if (existsSync(nested)) {
      try {
        for (const name of readdirSync(nested)) files.push(path.join(nested, name));
      } catch { /* ignore */ }
    }
    for (const fp of files) {
      if (!/\.(js|mjs|css|html|tsx|ts)$/i.test(fp)) continue;
      let text = "";
      try {
        text = readFileSync(fp, "utf8");
      } catch {
        continue;
      }
      if (/data-fx-at-openai-evidence-delivery|Evidence delivery \(F\.5|openai-evidence-delivery/i.test(text)) {
        bundleHasDelivery = true;
      }
    }
  }
  report.checks.dashboard = { bundleHasOpenAiEvidenceDelivery: bundleHasDelivery };
  if (!bundleHasDelivery) report.blockers.push("DASHBOARD_OA_DELIVERY_MARKERS_MISSING");

  if (!token) {
    report.blockers.push("BLOCKED_AUTHENTICATION");
    report.labels.openaiRoundTrip = "BLOCKED_AUTHENTICATION";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(2);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const atStatus = await getJson("/api/forex/automated-trading/status", { headers });
  if (atStatus.status === 403) {
    report.blockers.push("ADMIN_FORBIDDEN");
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(3);
  }
  const selectedInstrument =
    atStatus.body?.status?.selectedEnvState?.selectedInstrument
    ?? atStatus.body?.selectedInstrument
    ?? null;
  const selectedEnvironment =
    atStatus.body?.status?.selectedEnvironment
    ?? atStatus.body?.selectedEnvironment
    ?? "DEMO";
  const environmentEpoch =
    atStatus.body?.status?.environmentEpoch
    ?? atStatus.body?.environmentEpoch
    ?? null;
  report.checks.atStatus = {
    http: atStatus.status,
    selectedInstrument,
    selectedEnvironment,
    environmentEpoch,
    placesOrders: atStatus.body?.status?.placesOrders ?? atStatus.body?.placesOrders ?? null,
    tradingEnabled: atStatus.body?.status?.tradingEnabled ?? null,
    emergencyLock: atStatus.body?.status?.emergencyLock ?? null,
    masterEnabled: atStatus.body?.status?.masterEnabled ?? null,
  };
  if (report.checks.atStatus.placesOrders === true) {
    report.blockers.push("UNSAFE_PLACES_ORDERS");
  }

  const oaStatus = await getJson("/api/forex/automated-trading/openai/status", { headers });
  report.checks.openaiStatus = {
    http: oaStatus.status,
    apiKeyConfigured: oaStatus.body?.openai?.apiKeyConfigured ?? null,
    modelConfigured: oaStatus.body?.openai?.modelConfigured ?? null,
    inFlight: oaStatus.body?.openai?.inFlight ?? null,
    placesOrders: oaStatus.body?.placesOrders ?? null,
  };
  if (oaStatus.status !== 200 || oaStatus.body?.ok !== true) {
    report.blockers.push("OPENAI_STATUS_FAILED");
  }
  if (oaStatus.body?.openai?.apiKeyConfigured !== true) {
    report.blockers.push("OPENAI_NOT_CONFIGURED");
    report.labels.openaiRoundTrip = "BLOCKED_OPENAI_NOT_CONFIGURED";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(4);
  }
  if (!selectedInstrument) {
    report.blockers.push("NO_MARKET_SELECTED");
    report.labels.openaiRoundTrip = "BLOCKED_NO_MARKET_SELECTED";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(5);
  }

  // Actual OpenAI analyze round-trip (bounded).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let analyze;
  try {
    analyze = await getJson("/api/forex/automated-trading/openai/analyze", {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        environment: selectedEnvironment,
        expectedEnvironmentEpoch: environmentEpoch,
        instrument: selectedInstrument,
        timeframes: ["15m", "1h", "4h", "5m", "30m", "1d"],
        timeoutMs: Math.min(timeoutMs - 5_000, 80_000),
      }),
    });
  } catch (err) {
    analyze = {
      status: 0,
      body: {
        ok: false,
        error: {
          code: "CLIENT_TIMEOUT",
          message: err instanceof Error ? err.message.slice(0, 160) : "analyze_failed",
        },
      },
    };
  } finally {
    clearTimeout(timer);
  }

  const analysis = analyze.body?.analysis ?? null;
  const delivery = analysis?.evidenceDelivery ?? null;
  report.checks.openaiAnalyze = {
    http: analyze.status,
    ok: analyze.body?.ok ?? null,
    errorCode: analyze.body?.error?.code ?? null,
    errorMessage: analyze.body?.error?.message
      ? String(analyze.body.error.message).slice(0, 200)
      : null,
    lifecycle: analysis?.lifecycle ?? null,
    direction: analysis?.direction ?? null,
    dataQuality: analysis?.dataQuality ?? null,
    placesOrders: analysis?.placesOrders ?? analyze.body?.placesOrders ?? null,
    modelUsed: analysis?.modelUsed ?? null,
    instrument: analysis?.instrument ?? null,
    timeframes: analysis?.timeframes ?? null,
    evidenceDelivery: delivery
      ? {
        schemaVersion: delivery.schemaVersion ?? null,
        phase: delivery.phase ?? null,
        requestStatus: delivery.requestStatus ?? null,
        responseStatus: delivery.responseStatus ?? null,
        validationStatus: delivery.validationStatus ?? null,
        evidenceSizeChars: delivery.evidenceSizeChars ?? null,
        categoriesIncluded: delivery.categoriesIncluded ?? null,
        timeframesIncluded: delivery.timeframesIncluded ?? null,
        movementWindowIds: delivery.movementWindowIds ?? null,
        indicatorGroupsIncluded: delivery.indicatorGroupsIncluded ?? null,
        structureIncluded: delivery.structureIncluded ?? null,
        atrMethodLabel: delivery.atrMethodLabel ?? null,
        historicalLiveSeparated: delivery.historicalLiveSeparated ?? null,
        placesOrders: delivery.placesOrders ?? null,
        acceptsForExecution: delivery.acceptsForExecution ?? null,
        mutatesBroker: delivery.mutatesBroker ?? null,
        blockers: delivery.blockers ?? null,
      }
      : null,
  };

  if (analyze.status === 0 || analyze.body?.error?.code === "CLIENT_TIMEOUT") {
    report.blockers.push("OPENAI_CLIENT_TIMEOUT");
    report.labels.openaiRoundTrip = "TIMEOUT";
  } else if (!analyze.body?.ok) {
    report.blockers.push(`OPENAI_ANALYZE_FAILED:${analyze.body?.error?.code ?? analyze.status}`);
    report.labels.openaiRoundTrip = "FAILED";
  } else if (!delivery) {
    report.blockers.push("EVIDENCE_DELIVERY_MISSING");
    report.labels.openaiRoundTrip = "DELIVERY_MISSING";
  } else {
    report.labels.openaiRoundTrip = "PASS";
    if (delivery.requestStatus !== "REQUEST_SENT") {
      report.blockers.push(`REQUEST_STATUS_${delivery.requestStatus}`);
    }
    if (delivery.responseStatus !== "RESPONSE_RECEIVED") {
      report.blockers.push(`RESPONSE_STATUS_${delivery.responseStatus}`);
    }
    if (delivery.validationStatus === "VALIDATED" && analysis?.lifecycle !== "ANALYSIS_VALID") {
      report.blockers.push("VALIDATED_WITHOUT_ANALYSIS_VALID");
    }
    if (!delivery.categoriesIncluded?.historicalCandles) {
      report.blockers.push("HISTORICAL_NOT_IN_REQUEST");
    }
    if (delivery.historicalLiveSeparated !== true) {
      report.blockers.push("HIST_LIVE_NOT_SEPARATED");
    }
    if (delivery.placesOrders === true || delivery.mutatesBroker === true) {
      report.blockers.push("DELIVERY_UNSAFE_FLAGS");
    }
  }

  // Canonical reconcile with includeOpenAi:true (uses latest OA; does not re-call OpenAI).
  const canRun = await getJson("/api/forex/automated-trading/canonical-analysis/run", {
    method: "POST",
    headers,
    body: JSON.stringify({
      instrument: selectedInstrument,
      timeframe: "15m",
      includeOpenAi: true,
      persist: true,
    }),
  });
  const canResult = canRun.body?.result ?? null;
  const evidence = canRun.body?.marketEvidence ?? null;
  report.checks.canonicalWithOpenAi = {
    http: canRun.status,
    ok: canRun.body?.ok ?? null,
    direction: canResult?.direction ?? null,
    finalOutcome: canResult?.finalOutcome ?? null,
    placesOrders: canRun.body?.placesOrders ?? null,
    acceptsForExecution: canRun.body?.acceptsForExecution ?? null,
    mutatesBroker: canRun.body?.mutatesBroker ?? null,
    evidenceVersion: evidence?.evidenceVersion ?? null,
    mtfAlignment: evidence?.multiTimeframe?.alignment?.classification ?? null,
    liveTickWindows: Array.isArray(evidence?.liveTickMovement?.windows)
      ? evidence.liveTickMovement.windows.length
      : null,
    confidenceType: canResult?.confidence?.confidenceType
      ?? canResult?.confidence?.type
      ?? null,
    isCalibratedWinProbability: canResult?.confidence?.isCalibratedWinProbability ?? null,
  };
  if (canRun.body?.placesOrders === true || canRun.body?.acceptsForExecution === true) {
    report.blockers.push("CANONICAL_UNSAFE_FLAGS");
  }
  if (canRun.body?.mutatesBroker === true) {
    report.blockers.push("CANONICAL_MUTATES_BROKER");
  }

  report.productionSha = versionSha ?? report.checks.health.deployedSha ?? null;
  report.instrument = selectedInstrument;
  report.safety = {
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    analysisOnly: true,
  };

  console.log(JSON.stringify(redact(report), null, 2));
  if (report.blockers.length) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error(JSON.stringify({
    phase: "4.18F.5",
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "fatal",
    placesOrders: false,
    mutatesBroker: false,
  }));
  process.exit(1);
});
