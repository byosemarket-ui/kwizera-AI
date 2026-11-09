/**
 * Stage 1 — drive LIVE Offers spread collection ticks on production (read-only).
 * Does not approve policies. Does not submit orders.
 *
 * Usage (on VPS): node scripts/stage1-live-spread-collect.mjs
 * Env: KWIZERA_PROD_BASE, KWIZERA_ADMIN_API_TOKEN, STAGE1_TARGET_COUNT (default 20),
 *      STAGE1_GAP_MS (default 6000), STAGE1_MAX_TICKS (default 120)
 */
import { existsSync, readFileSync } from "node:fs";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const target = Math.max(1, Number(process.env.STAGE1_TARGET_COUNT || 20) || 20);
const gapMs = Math.max(5_000, Number(process.env.STAGE1_GAP_MS || 6_000) || 6_000);
const maxTicks = Math.max(1, Number(process.env.STAGE1_MAX_TICKS || 120) || 120);
const instruments = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"];

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

async function req(method, path, body) {
  const headers = { Accept: "application/json" };
  if (token) headers["x-kwizera-admin-token"] = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const started = new Date().toISOString();
const tickLog = [];
let ensureOnce = true;

for (let i = 0; i < maxTicks; i++) {
  const tick = await req("POST", "/api/forex/automated-trading/stage1/spread-collect/tick", {
    ensureSubscriptions: ensureOnce,
  });
  ensureOnce = false;
  const counts = {};
  for (const row of tick.json?.instruments || []) {
    counts[row.instrument] = row.validLiveCount;
  }
  tickLog.push({
    i,
    http: tick.status,
    acceptedThisTick: tick.json?.acceptedThisTick ?? null,
    counts,
    per: (tick.json?.instruments || []).map((r) => ({
      instrument: r.instrument,
      code: r.ingestCode,
      quotePresent: r.quotePresent,
      bid: r.bid,
      ask: r.ask,
      tradingStatus: r.tradingStatus,
      ageMs: r.quoteAgeMs,
    })),
  });
  const ready = instruments.every((sym) => (counts[sym] ?? 0) >= target);
  if (ready) break;
  await sleep(gapMs);
}

const readiness = await req("GET", "/api/forex/automated-trading/stage1-readiness");
const dep = await req("GET", "/api/deployment");
const fc = await req("GET", "/api/forex/providers/forexconnect/status");

console.log(JSON.stringify({
  schema: "kwizera.stage1-live-spread-collect-run.v1",
  startedAtUtc: started,
  finishedAtUtc: new Date().toISOString(),
  targetPerInstrument: target,
  gapMs,
  ticksRun: tickLog.length,
  lastTick: tickLog[tickLog.length - 1] ?? null,
  readinessHttp: readiness.status,
  completionCode: readiness.json?.completionCode ?? null,
  stageComplete: readiness.json?.stageComplete ?? null,
  evidenceMeta: readiness.json?.evidenceMeta ?? null,
  drafts: (readiness.json?.drafts || []).map((d) => ({
    instrument: d.instrument,
    validObservationCount: d.validObservationCount,
    sufficient: d.sufficient,
    minSpread: d.minSpread,
    maxSpread: d.maxSpread,
    meanSpread: d.meanSpread,
    medianSpread: d.medianSpread,
    p95Spread: d.p95Spread,
    recommendedMaxSpreadAbsolute: d.recommendedMaxSpreadAbsolute,
    evidenceQuality: d.evidenceQuality,
  })),
  instruments: readiness.json?.instruments ?? null,
  fillAudit: readiness.json?.fillAudit ?? null,
  deployment: {
    commit: dep.json?.deployedCommit ?? null,
    verifiedLive: dep.json?.verifiedLive ?? null,
  },
  forexConnect: {
    status: fc.json?.status ?? null,
    environment: fc.json?.environment ?? null,
    trading: fc.json?.trading ?? null,
    streamUpdateCount: fc.json?.streamUpdateCount ?? null,
    lastQuoteAt: fc.json?.lastQuoteAt ?? null,
  },
  placesOrders: false,
  mutatesBroker: false,
  note: "LIVE collection driver only. Owner approve+confirm still required. Slippage needs controlled DEMO fills.",
}, null, 2));
