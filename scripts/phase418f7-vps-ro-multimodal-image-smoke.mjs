/**
 * Phase 4.18F.7 — VPS READ-ONLY multimodal chart-image + MTF evidence smoke.
 *
 * Uses monitor/analyze-now (requireImage path). Verifies redacted image delivery
 * metadata: includedImageBytesInRequest, imageSource SERVER_OHLC_RENDER, observationId.
 * Never prints image payloads, tokens, or credentials.
 * Never places orders / grants / broker mutations.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const sidecarBase = String(process.env.KWIZERA_FC_SIDECAR_BASE || "http://127.0.0.1:5179").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA || "").trim() || null;
const appDir = String(process.env.KWIZERA_APP_DIR || "/opt/kwizera-ai").replace(/\/$/, "");
const timeoutMs = Math.max(20_000, Math.min(180_000, Number(process.env.KWIZERA_OA_TIMEOUT_MS || 120_000) || 120_000));
const instrument = String(process.env.KWIZERA_F7_INSTRUMENT || "XAU/USD").trim() || "XAU/USD";
const timeframe = String(process.env.KWIZERA_F7_TIMEFRAME || "15m").trim() || "15m";

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
    // Keep boolean/diagnostic image-delivery flags; redact only payload-ish keys.
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

async function main() {
  const report = {
    phase: "4.18F.7",
    base,
    sidecarBase,
    expectSha,
    instrument,
    timeframe,
    tokenPresent: Boolean(token),
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

  // Soft dashboard markers
  let bundleHasF7 = false;
  for (const root of [
    path.join(appDir, "dev", "ui", "desktop"),
    path.join(appDir, "dev", "ui", "desktop", "assets"),
    path.join(appDir, "dist", "ui", "desktop"),
    path.join(appDir, "desktop", "forex"),
  ]) {
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
      if (/SERVER_OHLC_RENDER|data-fx-at-chart-source-label|data-fx-at-image-delivery|4\.18F\.7/i.test(text)) {
        bundleHasF7 = true;
      }
    }
  }
  report.checks.dashboard = { bundleHasF7Markers: bundleHasF7 };
  report.labels.dashboardMarkers = bundleHasF7 ? "PRESENT" : "MISSING";

  if (!token) {
    report.blockers.push("BLOCKED_AUTHENTICATION");
    report.labels.multimodalRoundTrip = "BLOCKED_AUTHENTICATION";
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
  const environmentEpoch =
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

  const monitorStatus = await getJson("/api/forex/automated-trading/monitor/status", { headers });
  const mon = monitorStatus.body?.status ?? monitorStatus.body?.monitor ?? monitorStatus.body ?? null;
  report.checks.monitorStatus = {
    http: monitorStatus.status,
    chartImageSource: mon?.chartImageSource ?? null,
    chartImageSourceLabel: mon?.chartImageSourceLabel ?? null,
    platformScreenshotAvailable: mon?.platformScreenshotAvailable ?? null,
    requiresBrowserOpen: mon?.requiresBrowserOpen ?? null,
    placesOrders: mon?.placesOrders ?? null,
    workerActive: mon?.health?.workerActive ?? null,
    workerState: mon?.health?.workerState ?? null,
    lastImageSourceLabel: mon?.health?.lastImageSourceLabel ?? null,
    lastIncludedImageBytesInRequest: mon?.health?.lastIncludedImageBytesInRequest ?? null,
  };
  if (mon?.chartImageSourceLabel && mon.chartImageSourceLabel !== "SERVER_OHLC_RENDER") {
    report.blockers.push("UNEXPECTED_IMAGE_SOURCE_LABEL");
  }
  if (mon?.platformScreenshotAvailable === true) {
    report.blockers.push("FALSE_PLATFORM_SCREENSHOT_CLAIM");
  }
  if (mon?.requiresBrowserOpen === true) {
    report.blockers.push("BROWSER_REQUIRED_FALSE_CLAIM");
  }

  const oaStatus = await getJson("/api/forex/automated-trading/openai/status", { headers });
  report.checks.openaiStatus = {
    http: oaStatus.status,
    apiKeyConfigured: oaStatus.body?.openai?.apiKeyConfigured ?? null,
    modelConfigured: oaStatus.body?.openai?.modelConfigured ?? null,
  };
  if (oaStatus.body?.openai?.apiKeyConfigured !== true) {
    report.blockers.push("OPENAI_NOT_CONFIGURED");
    report.labels.multimodalRoundTrip = "BLOCKED_OPENAI_NOT_CONFIGURED";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(4);
  }

  if (String(selectedEnvironment).toUpperCase() !== "DEMO") {
    report.blockers.push("NOT_DEMO_SELECTION");
    report.labels.multimodalRoundTrip = "BLOCKED_NOT_DEMO";
    report.labels.note = "F.7 production proof targets DEMO only; select DEMO and re-run.";
    console.log(JSON.stringify(redact(report), null, 2));
    process.exit(2);
  }

  // Bounded wait for genuine LIVE market evidence (do not invent freshness).
  // Retries address cold TF-session MARKET_INACTIVE during snapshot settle — not gate bypass.
  const marketWaitMs = Math.max(30_000, Math.min(120_000, Number(process.env.KWIZERA_F7_MARKET_WAIT_MS || 90_000) || 90_000));
  const marketWaitStarted = Date.now();
  let epochAfterVerify = environmentEpoch;
  let verify = null;
  let analyze = null;
  const verifyAttempts = [];

  while (Date.now() - marketWaitStarted < marketWaitMs) {
    const statusRefresh = await getJson("/api/forex/automated-trading/status", { headers });
    epochAfterVerify =
      statusRefresh.body?.status?.environmentEpoch
      ?? statusRefresh.body?.environmentEpoch
      ?? epochAfterVerify;

    verify = await getJson("/api/forex/automated-trading/verify", {
      method: "POST",
      headers,
      body: JSON.stringify({
        environment: "DEMO",
        expectedEnvironmentEpoch: epochAfterVerify,
        instrument,
      }),
    });
    const market = verify.body?.verification?.market ?? null;
    const feedStatus = market?.feedStatus ?? null;
    const attempt = {
      atUtc: new Date().toISOString(),
      http: verify.status,
      ok: verify.body?.ok ?? null,
      feedStatus,
      marketSession: market?.marketSession ?? null,
      priceChangeAgeMs: market?.priceChangeAgeMs ?? null,
      receiptAgeMs: market?.receiptAgeMs ?? null,
      updateCount: market?.updateCount ?? null,
      identityStatus: verify.body?.verification?.identityStatus ?? null,
    };
    verifyAttempts.push(attempt);
    epochAfterVerify =
      verify.body?.status?.environmentEpoch
      ?? verify.body?.environmentEpoch
      ?? epochAfterVerify;

    if (verify.body?.ok === true && String(feedStatus).toUpperCase() === "LIVE") {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        analyze = await getJson("/api/forex/automated-trading/monitor/analyze-now", {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            environment: "DEMO",
            expectedEnvironmentEpoch: epochAfterVerify,
            instrument,
            timeframe,
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
      const failCode = String(analyze.body?.error?.code ?? analyze.body?.code ?? "");
      if (analyze.body?.ok === true) break;
      // Retry only cold-market / settle classes; other failures are terminal for this loop.
      if (!/STALE_QUOTES|MARKET_INACTIVE|NO_RECENT|QUOTE_STALE|VERIFICATION_REQUIRED/i.test(failCode)) {
        break;
      }
    }

    await new Promise((r) => setTimeout(r, 5_000));
  }

  report.checks.verify = {
    http: verify?.status ?? 0,
    ok: verify?.body?.ok ?? null,
    errorCode: verify?.body?.error?.code ?? null,
    identityStatus: verify?.body?.verification?.identityStatus ?? null,
    feedStatus: verify?.body?.verification?.market?.feedStatus ?? null,
    marketSession: verify?.body?.verification?.market?.marketSession ?? null,
    priceChangeAgeMs: verify?.body?.verification?.market?.priceChangeAgeMs ?? null,
    receiptAgeMs: verify?.body?.verification?.market?.receiptAgeMs ?? null,
    updateCount: verify?.body?.verification?.market?.updateCount ?? null,
    attempts: verifyAttempts.slice(-6),
    waitMs: Date.now() - marketWaitStarted,
  };

  if (!analyze) {
    analyze = {
      status: 422,
      body: {
        ok: false,
        error: {
          code: "STALE_QUOTES",
          message: `No LIVE verification within ${marketWaitMs}ms (last feed=${report.checks.verify.feedStatus}).`,
        },
      },
    };
  }

  const analysisId = analyze.body?.analysisId ?? analyze.body?.analysis?.analysisId ?? null;
  let analysis = analyze.body?.analysisProof ?? analyze.body?.analysis ?? null;
  if (!analysis && analysisId) {
    const latest = await getJson("/api/forex/automated-trading/openai/status", { headers });
    analysis = latest.body?.openai?.latest ?? null;
    if (analysis && analysis.analysisId !== analysisId) {
      const hist = Array.isArray(latest.body?.openai?.history) ? latest.body.openai.history : [];
      analysis = hist.find((h) => h?.analysisId === analysisId) ?? null;
    }
  }

  const delivery = analysis?.evidenceDelivery ?? null;
  const chart = analysis?.chartImage ?? null;
  const monAfter = analyze.body?.monitor ?? analyze.body?.status?.monitor ?? null;
  if (monAfter?.health) {
    report.checks.monitorAfterAnalyze = {
      workerState: monAfter.health.workerState ?? null,
      lastBlockerCode: monAfter.health.lastBlockerCode ?? null,
      lastError: monAfter.health.lastError
        ? String(monAfter.health.lastError).slice(0, 200)
        : null,
      lastObservationId: monAfter.health.lastObservationId ?? null,
      lastImageId: monAfter.health.lastImageId ?? null,
      lastImageSourceLabel: monAfter.health.lastImageSourceLabel ?? null,
      lastIncludedImageBytesInRequest: monAfter.health.lastIncludedImageBytesInRequest ?? null,
      lastImageDeliveryLifecycle: monAfter.health.lastImageDeliveryLifecycle ?? null,
      lastScreenshotImageHash: monAfter.health.lastScreenshotImageHash ?? null,
    };
  }
  report.checks.monitorAnalyzeNow = {
    http: analyze.status,
    ok: analyze.body?.ok ?? null,
    errorCode: analyze.body?.error?.code ?? analyze.body?.code ?? null,
    errorMessage: analyze.body?.error?.message
      ? String(analyze.body.error.message).slice(0, 200)
      : (analyze.body?.message ? String(analyze.body.message).slice(0, 200) : null),
    analysisId,
    lifecycle: analysis?.lifecycle ?? null,
    instrument: analysis?.instrument ?? null,
    timeframes: analysis?.timeframes ?? null,
    primaryTimeframe: analysis?.primaryTimeframe ?? null,
    chartImage: chart
      ? {
        available: chart.available ?? null,
        imageHash: chart.imageHash ?? null,
        includedInOpenAiRequest: chart.includedInOpenAiRequest ?? null,
        imageSourceLabel: chart.imageSourceLabel ?? null,
        observationId: chart.observationId ?? null,
        imageId: chart.imageId ?? null,
        source: chart.source ?? null,
        note: chart.note ? String(chart.note).slice(0, 160) : null,
      }
      : null,
    evidenceDelivery: delivery
      ? {
        phase: delivery.phase ?? null,
        requestStatus: delivery.requestStatus ?? null,
        responseStatus: delivery.responseStatus ?? null,
        validationStatus: delivery.validationStatus ?? null,
        imageDeliveryLifecycle: delivery.imageDeliveryLifecycle ?? null,
        includedImageBytesInRequest: delivery.includedImageBytesInRequest ?? null,
        imageSource: delivery.imageSource ?? null,
        observationId: delivery.observationId ?? null,
        imageId: delivery.imageId ?? null,
        imageHash: delivery.imageHash ?? null,
        timeframesIncluded: delivery.timeframesIncluded ?? null,
        categoriesIncluded: delivery.categoriesIncluded ?? null,
        placesOrders: delivery.placesOrders ?? null,
        acceptsForExecution: delivery.acceptsForExecution ?? null,
        mutatesBroker: delivery.mutatesBroker ?? null,
        blockers: delivery.blockers ?? null,
      }
      : null,
  };

  if (analyze.status === 0 || analyze.body?.error?.code === "CLIENT_TIMEOUT") {
    report.blockers.push("OPENAI_CLIENT_TIMEOUT");
    report.labels.multimodalRoundTrip = "TIMEOUT";
  } else if (!analyze.body?.ok) {
    const failCode = String(analyze.body?.error?.code ?? analyze.body?.code ?? analyze.status);
    report.blockers.push(`MONITOR_ANALYZE_FAILED:${failCode}`);
    if (/STALE_QUOTES|VERIFICATION_REQUIRED|QUOTE_STALE|TICK_STALE|DATA_INSUFFICIENT/i.test(failCode)) {
      report.labels.multimodalRoundTrip = `BLOCKED_${failCode}`;
    } else {
      report.labels.multimodalRoundTrip = "FAILED";
    }
  } else if (!delivery) {
    report.blockers.push("EVIDENCE_DELIVERY_MISSING");
    report.labels.multimodalRoundTrip = "DELIVERY_MISSING";
  } else {
    const imageInRequest =
      delivery.includedImageBytesInRequest === true
      || chart?.includedInOpenAiRequest === true
      || report.checks.monitorAfterAnalyze?.lastIncludedImageBytesInRequest === true;
    report.labels.multimodalRoundTrip = imageInRequest ? "PASS" : "IMAGE_NOT_VERIFIED";
    if (!imageInRequest) {
      report.blockers.push("IMAGE_BYTES_NOT_IN_REQUEST");
    }
    if (delivery.imageSource && delivery.imageSource !== "SERVER_OHLC_RENDER") {
      report.blockers.push("UNEXPECTED_DELIVERY_IMAGE_SOURCE");
    }
    if (
      report.checks.monitorAfterAnalyze?.lastImageSourceLabel
      && report.checks.monitorAfterAnalyze.lastImageSourceLabel !== "SERVER_OHLC_RENDER"
    ) {
      report.blockers.push("UNEXPECTED_MONITOR_IMAGE_SOURCE");
    }
    if (chart?.note && /trading station screenshot/i.test(chart.note) && !/NOT/i.test(chart.note)) {
      report.blockers.push("FALSE_SCREENSHOT_CLAIM_IN_NOTE");
    }
    if (!(analysis?.timeframes?.length >= 2 || (delivery.timeframesIncluded?.length ?? 0) >= 2)) {
      report.blockers.push("MTF_EVIDENCE_THIN");
    }
    if (delivery.placesOrders === true || delivery.mutatesBroker === true || delivery.acceptsForExecution === true) {
      report.blockers.push("DELIVERY_UNSAFE_FLAGS");
    }
  }

  report.labels.vpsRebootRecovery = "NOT_VERIFIED";
  report.labels.platformScreenshot = "NOT_AVAILABLE_SERVER_OHLC_RENDER";

  const hard = report.blockers.filter((b) =>
    !String(b).startsWith("MTF_EVIDENCE_THIN")
    && !String(b).startsWith("MONITOR_ANALYZE_FAILED:STALE")
    && !String(b).startsWith("MONITOR_ANALYZE_FAILED:VERIFICATION")
    && !String(b).startsWith("MONITOR_ANALYZE_FAILED:QUOTE_STALE")
    && !String(b).startsWith("MONITOR_ANALYZE_FAILED:TICK_STALE")
    && !String(b).startsWith("MONITOR_ANALYZE_FAILED:DATA_INSUFFICIENT")
  );
  const exitCode =
    hard.length === 0 && report.labels.multimodalRoundTrip === "PASS"
      ? 0
      : report.labels.multimodalRoundTrip?.startsWith("BLOCKED")
        ? 2
        : 1;

  console.log(JSON.stringify(redact(report), null, 2));
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(JSON.stringify({
    phase: "4.18F.7",
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "fatal",
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  }));
  process.exit(1);
});
