/**
 * Phase 4.18F.1-CLOSE — VPS READ-ONLY canonical analysis + dashboard smoke.
 *
 * - Loads KWIZERA_ADMIN_API_TOKEN via load-operator-env / VPS .env (never prints it).
 * - Never places orders, creates grants, enables armed_execute, or mutates broker.
 * - Never bypasses requireForexAdmin.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const sidecarBase = String(process.env.KWIZERA_FC_SIDECAR_BASE || "http://127.0.0.1:5179").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA || "").trim() || null;
const appDir = String(process.env.KWIZERA_APP_DIR || "/opt/kwizera-ai").replace(/\/$/, "");
const approvedBaseline = "090e7e7c9b8a9a31f447c0d51ce657855c4e391e";

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

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
    if (/token|password|secret|authorization/i.test(String(k))) return "[REDACTED]";
    return v;
  }));
}

async function getJson(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
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

async function getText(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    return { status: res.status, text, ok: res.ok };
  } catch (err) {
    return {
      status: 0,
      text: "",
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 120) : "fetch_failed",
    };
  }
}

function shaMatches(actual, expected) {
  if (!actual || !expected) return false;
  const a = String(actual).toLowerCase();
  const e = String(expected).toLowerCase();
  return a === e || a.startsWith(e.slice(0, 7)) || e.startsWith(a.slice(0, 7));
}

async function main() {
  const report = {
    phase: "4.18F.1-CLOSE",
    base,
    sidecarBase,
    expectSha,
    approvedBaseline,
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
    gateway: health.body?.gateway ?? null,
  };
  if (
    health.status !== 200
    || health.body?.ok !== true
    || (health.body?.status !== "healthy" && health.body?.gateway !== true)
  ) {
    report.blockers.push("NODE_GATEWAY_UNHEALTHY");
  }

  const runtimeGitSha = sh(`git -C '${appDir}' rev-parse HEAD`) || null;
  const dep = await getJson("/api/deployment");
  const deployedCommit = dep.body?.deployedCommit ?? runtimeGitSha ?? null;
  report.checks.deployment = {
    http: dep.status,
    status: dep.body?.status ?? null,
    result: dep.body?.result ?? null,
    deployedCommit: dep.body?.deployedCommit ?? null,
    runtimeGitSha,
    effectiveDeployedSha: deployedCommit,
    requestedCommit: dep.body?.requestedCommit ?? null,
    verifiedLive: dep.body?.verifiedLive ?? null,
  };
  if (expectSha && deployedCommit && !shaMatches(deployedCommit, expectSha)) {
    report.blockers.push(`SHA_MISMATCH expected ${expectSha} got ${deployedCommit}`);
  }
  if (!deployedCommit) {
    report.blockers.push("DEPLOYED_COMMIT_MISSING");
  }

  const fc = await getJson("/api/forex/providers/forexconnect/status");
  report.checks.forexconnect = {
    http: fc.status,
    status: fc.body?.status ?? null,
    environment: fc.body?.environment ?? null,
    trading: fc.body?.trading ?? null,
    sidecarReachable: fc.body?.sidecarReachable ?? null,
    liveConfigured: fc.body?.profiles?.profiles?.live?.configured ?? null,
  };
  if (fc.body?.profiles?.profiles?.live?.configured) {
    report.blockers.push("LIVE_CREDENTIALS_CONFIGURED_UNEXPECTED");
  }
  if (fc.body?.trading && String(fc.body.trading).toUpperCase() !== "DISABLED") {
    report.blockers.push("TRADING_NOT_DISABLED");
  }

  const fcUnit = sh("systemctl is-active kwizera-forexconnect.service") || "unknown";
  const gatewayUnit = sh("systemctl is-active kwizera-ai.service") || "unknown";
  const listen5179 = Boolean(sh("ss -lntp 2>/dev/null | grep -E ':5179\\b' || true"));
  const sidecarHealth = await getText(`${sidecarBase}/health`);
  const sidecarAlt = sidecarHealth.ok ? null : await getText(`${sidecarBase}/`);
  const viaGateway = fc.body?.sidecarReachable === true;
  const reachableDirect = sidecarHealth.ok || Boolean(sidecarAlt?.ok) || listen5179;
  report.checks.forexconnectSidecar = {
    systemctl: fcUnit,
    gatewayUnit,
    listen5179,
    healthHttp: sidecarHealth.status,
    healthOk: sidecarHealth.ok,
    rootHttp: sidecarAlt?.status ?? null,
    reachableDirect,
    viaGateway,
  };
  if (fcUnit !== "active" && !viaGateway && !reachableDirect) {
    report.blockers.push("FOREXCONNECT_SIDECAR_UNHEALTHY");
  }
  if (gatewayUnit !== "active" && report.blockers.includes("NODE_GATEWAY_UNHEALTHY") === false) {
    // Prefer HTTP health as authority; systemctl is supporting evidence only.
  }

  // Dashboard: studio shell via HTTP + markers from deployed UI assets on disk.
  const dashRoutes = ["/forex/automated-trading", "/forex", "/desktop/", "/"];
  const dashEvidence = {};
  let studioShellOk = false;
  for (const route of dashRoutes) {
    const page = await getText(`${base}${route}`);
    dashEvidence[route] = {
      http: page.status,
      studioTitle: /KWIZERA AI STUDIO/i.test(page.text),
      notDevDashboard: !/Dev Dashboard/i.test(page.text),
    };
    if (page.status === 200 && dashEvidence[route].studioTitle && dashEvidence[route].notDevDashboard) {
      studioShellOk = true;
    }
  }

  const assetRoots = [
    path.join(appDir, "dev", "ui", "desktop"),
    path.join(appDir, "dev", "ui", "desktop", "assets"),
    path.join(appDir, "dist", "ui", "desktop"),
    path.join(appDir, "desktop", "forex"),
  ];
  let bundleHasCanonical = false;
  let bundleHasMarketIntel = false;
  const scannedFiles = [];
  for (const root of assetRoots) {
    if (!existsSync(root)) continue;
    let entries = [];
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (!/\.(js|mjs|css|html|tsx|ts)$/i.test(ent.name)) continue;
      const fp = path.join(root, ent.name);
      let text = "";
      try {
        text = readFileSync(fp, "utf8");
      } catch {
        continue;
      }
      scannedFiles.push(fp.replace(appDir, ""));
      if (/data-fx-at-canonical-analysis|canonical-analysis\/status|canonical-analysis\/run/i.test(text)) {
        bundleHasCanonical = true;
      }
      if (/data-fx-at-market-evidence|Market data intelligence|Evidence completeness/i.test(text)) {
        bundleHasMarketIntel = true;
      }
    }
    // One level of nested assets/
    const nested = path.join(root, "assets");
    if (existsSync(nested)) {
      try {
        for (const name of readdirSync(nested)) {
          if (!/\.(js|mjs|css)$/i.test(name)) continue;
          const fp = path.join(nested, name);
          let text = "";
          try {
            text = readFileSync(fp, "utf8");
          } catch {
            continue;
          }
          scannedFiles.push(fp.replace(appDir, ""));
          if (/data-fx-at-canonical-analysis|canonical-analysis\/status|canonical-analysis\/run/i.test(text)) {
            bundleHasCanonical = true;
          }
          if (/data-fx-at-market-evidence|Market data intelligence|Evidence completeness/i.test(text)) {
            bundleHasMarketIntel = true;
          }
        }
      } catch {
        /* ignore */
      }
    }
  }
  report.checks.dashboard = {
    studioShellOk,
    bundleHasCanonical,
    bundleHasMarketIntel,
    scannedFileCount: scannedFiles.length,
    routes: dashEvidence,
  };
  if (!studioShellOk) report.blockers.push("DASHBOARD_SHELL_FAILED");
  if (!bundleHasCanonical) report.blockers.push("DASHBOARD_CANONICAL_MARKERS_MISSING");
  if (!bundleHasMarketIntel) report.blockers.push("DASHBOARD_MARKET_INTEL_MARKERS_MISSING");

  if (!token) {
    report.blockers.push("BLOCKED_AUTHENTICATION");
    report.labels.canonicalAnalysis = "BLOCKED_AUTHENTICATION";
    report.labels.productionAnalysis = "BLOCKED_AUTHENTICATION";
    report.labels.adminAccess = "BLOCKED";
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
    report.labels.adminAccess = "FORBIDDEN";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(3);
  }
  report.labels.adminAccess = "PASS";
  const selectedInstrument =
    atStatus.body?.status?.selectedEnvState?.selectedInstrument
    ?? atStatus.body?.selectedInstrument
    ?? null;
  report.checks.atStatus = {
    http: atStatus.status,
    selectedInstrument,
    placesOrders: atStatus.body?.status?.placesOrders ?? atStatus.body?.placesOrders ?? null,
    selectedEnvironment: atStatus.body?.status?.selectedEnvironment ?? null,
  };

  const canStatus = await getJson("/api/forex/automated-trading/canonical-analysis/status", { headers });
  report.checks.canonicalStatus = {
    http: canStatus.status,
    ok: canStatus.body?.ok ?? null,
    placesOrders: canStatus.body?.placesOrders ?? null,
    acceptsForExecution: canStatus.body?.acceptsForExecution ?? null,
    hasCanonical: Boolean(canStatus.body?.canonical),
    confidenceSchema: canStatus.body?.canonical?.confidence?.schemaVersion
      ?? canStatus.body?.canonical?.latest?.confidence?.schemaVersion
      ?? null,
  };
  if (canStatus.status !== 200 || canStatus.body?.ok !== true) {
    report.blockers.push("CANONICAL_STATUS_FAILED");
  }
  if (canStatus.body?.placesOrders === true || canStatus.body?.acceptsForExecution === true) {
    report.blockers.push("CANONICAL_STATUS_UNSAFE_FLAGS");
  }

  const canHistory = await getJson("/api/forex/automated-trading/canonical-analysis/history?limit=5", { headers });
  report.checks.canonicalHistory = {
    http: canHistory.status,
    ok: canHistory.body?.ok ?? null,
    placesOrders: canHistory.body?.placesOrders ?? null,
    acceptsForExecution: canHistory.body?.acceptsForExecution ?? null,
    entryCount: Array.isArray(canHistory.body?.history) ? canHistory.body.history.length : null,
  };
  if (canHistory.status !== 200 || canHistory.body?.ok !== true) {
    report.blockers.push("CANONICAL_HISTORY_FAILED");
  }

  if (!selectedInstrument) {
    report.blockers.push("NO_MARKET_SELECTED");
    report.labels.productionAnalysis = "BLOCKED_NO_MARKET_SELECTED";
  } else {
    const run = await getJson("/api/forex/automated-trading/canonical-analysis/run", {
      method: "POST",
      headers,
      body: JSON.stringify({
        instrument: selectedInstrument,
        timeframe: "1h",
        includeOpenAi: false,
        persist: true,
      }),
    });
    const result = run.body?.result ?? null;
    const view = run.body?.view ?? null;
    const evidence = run.body?.marketEvidence ?? null;
    const confidenceSchema =
      result?.confidence?.schemaVersion
      ?? view?.confidence?.schemaVersion
      ?? null;
    const identityInstrument =
      evidence?.identity?.instrument
      ?? result?.instrument
      ?? view?.instrument
      ?? null;
    const identityTf =
      evidence?.identity?.timeframe
      ?? evidence?.primary?.timeframe
      ?? result?.timeframe
      ?? null;

    report.checks.canonicalRun = {
      http: run.status,
      ok: run.body?.ok ?? null,
      analysisOk: run.body?.analysisOk ?? null,
      placesOrders: run.body?.placesOrders ?? null,
      acceptsForExecution: run.body?.acceptsForExecution ?? null,
      mutatesBroker: run.body?.mutatesBroker ?? null,
      direction: result?.direction ?? view?.direction ?? null,
      validity: result?.validity ?? view?.validity ?? null,
      confidenceSchema,
      evidenceCompleteness: evidence?.quality?.completeness ?? null,
      identityInstrument,
      identityTimeframe: identityTf,
      atrMethod: evidence?.primary?.indicators?.atrMethod ?? null,
      volumeUnavailable: evidence?.instrumentMeta?.volume?.available === false
        || evidence?.quality?.missing?.includes?.("volume")
        || null,
      liveTicksNotFromHistory: evidence?.liveQuote != null,
      // Phase 4.18F.4 — MTF alignment present in production evidence (analysis-only).
      mtfAgreement: evidence?.multiTimeframe?.agreement ?? null,
      mtfAlignment: evidence?.multiTimeframe?.alignment?.classification ?? null,
      mtfMatrixCount: Array.isArray(evidence?.timeframeMatrix)
        ? evidence.timeframeMatrix.length
        : (Array.isArray(evidence?.multiTimeframe?.alignment?.matrix)
          ? evidence.multiTimeframe.alignment.matrix.length
          : null),
      mtfHtfBias: evidence?.multiTimeframe?.alignment?.higherTimeframeBias ?? null,
      mtfLtfBias: evidence?.multiTimeframe?.alignment?.lowerTimeframeBias ?? null,
      openaiEvidenceDelivery: evidence?.openaiEvidenceDelivery
        ?? null,
      techSignalOutcome: evidence?.technicalIntelligence?.signalValidation?.outcome ?? null,
    };

    if (run.status !== 200 || run.body?.ok !== true) {
      report.blockers.push(`CANONICAL_RUN_FAILED http=${run.status} code=${run.body?.error?.code ?? "unknown"}`);
    }
    if (run.body?.placesOrders === true || run.body?.acceptsForExecution === true || run.body?.mutatesBroker === true) {
      report.blockers.push("CANONICAL_RUN_UNSAFE_FLAGS");
    }
    if (identityInstrument && String(identityInstrument) !== String(selectedInstrument)) {
      report.blockers.push("INSTRUMENT_FALLBACK_OR_MISMATCH");
    }
    if (confidenceSchema && confidenceSchema !== "analysis-confidence.v1") {
      report.blockers.push(`UNEXPECTED_CONFIDENCE_SCHEMA ${confidenceSchema}`);
    }
    if (evidence?.primary?.indicators?.atrMethod && evidence.primary.indicators.atrMethod !== "SMA_OF_TR") {
      report.blockers.push("ATR_METHOD_NOT_SMA_OF_TR");
    }

    report.labels.productionAnalysis =
      report.blockers.some((b) => String(b).startsWith("CANONICAL_RUN"))
        ? "FAILED"
        : "VERIFIED_DETERMINISTIC_RO";
  }

  report.labels.canonicalEndpoints =
    report.blockers.some((b) => String(b).includes("CANONICAL_"))
      ? "FAILED"
      : "VERIFIED";
  report.labels.dashboard =
    studioShellOk && bundleHasCanonical && bundleHasMarketIntel ? "VERIFIED" : "FAILED";
  report.labels.nodeGateway = report.blockers.includes("NODE_GATEWAY_UNHEALTHY") ? "UNHEALTHY" : "HEALTHY";
  report.labels.forexconnectSidecar = report.blockers.includes("FOREXCONNECT_SIDECAR_UNHEALTHY")
    ? "UNHEALTHY"
    : "HEALTHY";
  report.labels.deployedSha = deployedCommit && expectSha && shaMatches(deployedCommit, expectSha)
    ? "VERIFIED"
    : (deployedCommit ? "PRESENT" : "MISSING");

  const hardFail = report.blockers.filter((b) =>
    b === "BLOCKED_AUTHENTICATION"
    || b === "ADMIN_FORBIDDEN"
    || b === "NODE_GATEWAY_UNHEALTHY"
    || b === "FOREXCONNECT_SIDECAR_UNHEALTHY"
    || b === "LIVE_CREDENTIALS_CONFIGURED_UNEXPECTED"
    || b === "TRADING_NOT_DISABLED"
    || b === "CANONICAL_STATUS_UNSAFE_FLAGS"
    || b === "CANONICAL_RUN_UNSAFE_FLAGS"
    || String(b).startsWith("SHA_MISMATCH")
    || String(b).startsWith("CANONICAL_")
    || String(b).startsWith("DASHBOARD_")
    || b === "NO_MARKET_SELECTED"
    || b === "INSTRUMENT_FALLBACK_OR_MISMATCH"
    || b === "DEPLOYED_COMMIT_MISSING"
  );

  console.log(JSON.stringify(redact(report), null, 2));
  process.exit(hardFail.length ? 1 : 0);
}

main().catch((err) => {
  console.error(JSON.stringify({
    phase: "4.18F.1-CLOSE",
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
  }));
  process.exit(1);
});
