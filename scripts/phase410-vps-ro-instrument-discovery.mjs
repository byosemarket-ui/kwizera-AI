/**
 * Phase 4.10 — VPS-side READ-ONLY DEMO instrument discovery for 0.01-lot compatibility.
 *
 * - Uses live /api/forex/providers/forexconnect/instruments (no mutations).
 * - Scores each row with the same formula as broker-quantity-contract (inline duplicate
 *   of conversion rules so this script has zero Node package imports on the VPS).
 * - Never prints tokens, account IDs, or secrets.
 * - Does not create grants, enable mutation, or place orders.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadOperatorEnv } from "./lib/load-operator-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = String(process.env.KWIZERA_PROD_BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA || "").trim() || null;
const REQUESTED_LOTS = 0.01;

const operatorLoad = loadOperatorEnv();
let token = String(process.env.KWIZERA_ADMIN_API_TOKEN || "").trim();
const envCandidates = [
  process.env.KWIZERA_VPS_ENV_FILE,
  "/opt/kwizera-ai/.env",
].filter(Boolean);
for (const p of envCandidates) {
  if (token || !p || !existsSync(p)) continue;
  try {
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
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

function finitePositive(n) {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Inline mirror of lotsToBrokerAmount + evaluateBrokerQuantityContract (keep in sync). */
function scoreRow(row) {
  const providerSymbol = String(row.providerSymbol || row.displaySymbol || row.canonicalSymbol || "").trim()
    || "(unknown)";
  const baseUnitSize = finitePositive(row.baseUnitSize) ? Number(row.baseUnitSize) : null;
  const minQuantity = finitePositive(row.minQuantity) ? Number(row.minQuantity) : null;
  const mmrPerLot = finitePositive(row.mmrPerLot) ? Number(row.mmrPerLot) : null;
  const amountStep = finitePositive(row.amountStep)
    ? Number(row.amountStep)
    : (finitePositive(row.lotStep) ? Number(row.lotStep) : null);
  const blockers = [];
  let amount = null;
  let amountCode = "BASE_UNIT_SIZE_UNKNOWN";

  if (!finitePositive(REQUESTED_LOTS)) {
    amountCode = "LOTS_INVALID";
    blockers.push(amountCode);
  } else if (baseUnitSize == null) {
    amountCode = "BASE_UNIT_SIZE_UNKNOWN";
    blockers.push(amountCode);
  } else if (!Number.isInteger(baseUnitSize)) {
    amountCode = "BASE_UNIT_SIZE_INVALID";
    blockers.push(amountCode);
  } else {
    const raw = baseUnitSize * REQUESTED_LOTS;
    const rounded = Math.round(raw);
    if (!(raw > 0) || !Number.isFinite(raw)) {
      amountCode = "AMOUNT_INVALID";
      blockers.push(amountCode);
    } else if (Math.abs(raw - rounded) > 1e-9 || !Number.isInteger(rounded) || rounded <= 0) {
      amountCode = "AMOUNT_NOT_INTEGER";
      blockers.push(amountCode);
    } else if (minQuantity != null && rounded < minQuantity) {
      amountCode = "AMOUNT_BELOW_MIN_QUANTITY";
      blockers.push(amountCode);
    } else {
      amount = rounded;
      amountCode = "OK";
    }
  }

  if (minQuantity == null) blockers.push("MIN_QUANTITY_UNVERIFIED");
  if (mmrPerLot == null) blockers.push("MMR_PER_LOT_UNVERIFIED");

  const minLotsFromBroker = baseUnitSize != null && minQuantity != null
    ? minQuantity / baseUnitSize
    : null;
  if (minLotsFromBroker != null && REQUESTED_LOTS + 1e-12 < minLotsFromBroker) {
    blockers.push("REQUESTED_LOTS_BELOW_BROKER_MIN");
    blockers.push("OWNER_MAX_LOTS_BELOW_BROKER_MIN");
  }

  let amountStepOk = null;
  if (amount != null && amountStep != null) {
    amountStepOk = Math.abs(amount / amountStep - Math.round(amount / amountStep)) < 1e-9;
    if (!amountStepOk) blockers.push("AMOUNT_NOT_ALIGNED_TO_STEP");
  }

  const quantityOk = amountCode === "OK"
    && !blockers.includes("REQUESTED_LOTS_BELOW_BROKER_MIN")
    && amountStepOk !== false;
  const compatible001Lot = quantityOk && mmrPerLot != null;

  return {
    providerSymbol,
    instrumentType: row.instrumentType ?? row.instrumentTypeLabel ?? null,
    tradingStatus: row.tradingStatus ?? null,
    evidenceSource: "live_broker",
    liveFields: {
      baseUnitSize,
      minQuantity,
      amountStep,
      pointSize: finitePositive(row.pointSize) ? Number(row.pointSize) : null,
      pipCost: finitePositive(row.pipCost) ? Number(row.pipCost) : null,
      mmrPerLot,
      condDistStop: row.condDistStop != null && Number.isFinite(Number(row.condDistStop))
        ? Number(row.condDistStop)
        : null,
      condDistAvailable: row.condDistAvailable == null ? null : Boolean(row.condDistAvailable),
    },
    amountCode,
    integerAmount: amount,
    minLotsFromBroker,
    estimatedMarginAccount: mmrPerLot != null ? mmrPerLot * REQUESTED_LOTS : null,
    amountStepOk,
    compatible001Lot,
    blockers: [...new Set(blockers)],
  };
}

async function req(method, path) {
  const headers = { Accept: "application/json" };
  if (token) headers["x-kwizera-admin-token"] = token;
  const res = await fetch(`${base}${path}`, { method, headers });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const report = {
  phase: "4.10",
  base,
  expectSha,
  requestedLots: REQUESTED_LOTS,
  formula: "amount = baseUnitSize * lots",
  safety: {
    placesOrders: false,
    mutatesBroker: false,
    grantsCreated: false,
    ownerConfirmChanged: false,
    armedExecute: false,
    continuousWorker: false,
  },
  components: {},
};

const deployment = await req("GET", "/api/deployment");
report.deployment = {
  http: deployment.status,
  deployedCommit: deployment.json?.deployedCommit ?? null,
  verifiedLive: deployment.json?.verifiedLive ?? null,
  status: deployment.json?.status ?? null,
  shaMatch: expectSha
    ? String(deployment.json?.deployedCommit ?? "").startsWith(expectSha.slice(0, 7))
      || String(deployment.json?.deployedCommit ?? "") === expectSha
    : null,
};

const fc = await req("GET", "/api/forex/providers/forexconnect/status");
report.forexConnect = {
  http: fc.status,
  status: fc.json?.status ?? null,
  environment: fc.json?.environment ?? null,
  trading: fc.json?.trading ?? null,
  sidecarReachable: fc.json?.sidecarReachable ?? null,
  liveConfigured: fc.json?.profiles?.profiles?.live?.configured ?? null,
  demoConfigured: fc.json?.profiles?.profiles?.demo?.configured ?? null,
  activeEnvironment: fc.json?.profiles?.activeEnvironment ?? null,
};
report.components.liveIsolation = {
  state:
    report.forexConnect.liveConfigured === false
    && report.forexConnect.trading === "DISABLED"
    && String(report.forexConnect.environment ?? "").toLowerCase() === "demo"
      ? "PASS"
      : "FAIL",
};

const instr = await req("GET", "/api/forex/providers/forexconnect/instruments");
const rows = Array.isArray(instr.json?.instruments) ? instr.json.instruments : [];
const scores = rows.map(scoreRow);
const compatible = scores.filter((s) => s.compatible001Lot);
const quantityOkNoMmr = scores.filter((s) =>
  s.amountCode === "OK"
  && !s.blockers.includes("REQUESTED_LOTS_BELOW_BROKER_MIN")
  && s.amountStepOk !== false
  && s.liveFields.mmrPerLot == null
);
const byBus = {};
for (const s of scores) {
  const k = s.liveFields.baseUnitSize == null ? "null" : String(s.liveFields.baseUnitSize);
  byBus[k] = (byBus[k] || 0) + 1;
}

report.components.instrumentDiscovery = {
  state: instr.status === 200 && instr.json?.ok === true
    ? (compatible.length > 0 ? "PASS" : "BLOCKED")
    : "FAIL",
  http: instr.status,
  ok: instr.json?.ok ?? null,
  fetchedAt: instr.json?.fetchedAt ?? null,
  scanned: scores.length,
  compatibleCount: compatible.length,
  quantityOkMissingMmrCount: quantityOkNoMmr.length,
  missingBaseUnitSize: scores.filter((s) => s.liveFields.baseUnitSize == null).length,
  missingMinQuantity: scores.filter((s) => s.liveFields.minQuantity == null).length,
  missingMmr: scores.filter((s) => s.liveFields.mmrPerLot == null).length,
  baseUnitSizeHistogram: byBus,
  compatible: compatible.slice(0, 50).map((s) => ({
    providerSymbol: s.providerSymbol,
    instrumentType: s.instrumentType,
    tradingStatus: s.tradingStatus,
    liveFields: s.liveFields,
    integerAmount: s.integerAmount,
    minLotsFromBroker: s.minLotsFromBroker,
    estimatedMarginAccount: s.estimatedMarginAccount,
    amountCode: s.amountCode,
  })),
  /** Near-misses: integer AMOUNT + min OK but MMR missing — still BLOCKED. */
  quantityOkMissingMmrSample: quantityOkNoMmr.slice(0, 25).map((s) => ({
    providerSymbol: s.providerSymbol,
    liveFields: s.liveFields,
    integerAmount: s.integerAmount,
    amountCode: s.amountCode,
    blockers: s.blockers,
  })),
  incompatibleSample: scores
    .filter((s) => !s.compatible001Lot)
    .slice(0, 40)
    .map((s) => ({
      providerSymbol: s.providerSymbol,
      tradingStatus: s.tradingStatus,
      baseUnitSize: s.liveFields.baseUnitSize,
      minQuantity: s.liveFields.minQuantity,
      mmrPerLot: s.liveFields.mmrPerLot,
      amountCode: s.amountCode,
      blockers: s.blockers.slice(0, 6),
    })),
  evidenceSource: "live_broker",
  note: "Compatible requires live positive mmrPerLot AND integer AMOUNT for 0.01 lots without upsizing.",
};

// Highlight XAU/USD explicitly (prior blocker).
const xau = scores.find((s) =>
  String(s.providerSymbol).replace(/\s+/g, "").toUpperCase() === "XAU/USD"
  || String(s.providerSymbol).replace(/\s+/g, "").toUpperCase() === "XAUUSD"
) ?? null;
report.components.xauUsd = xau
  ? {
    state: xau.compatible001Lot ? "PASS" : "BLOCKED",
    ...xau,
  }
  : { state: "NOT VERIFIED", reason: "XAU/USD not present in instruments payload" };

report.verdict = {
  compatibleInstrumentFound: compatible.length > 0,
  state: compatible.length > 0 ? "PASS" : "BLOCKED",
  message: compatible.length > 0
    ? `Found ${compatible.length} instrument(s) supporting 0.01 lots with live MMR.`
    : "No DEMO instrument proven compatible with owner 0.01-lot max and authoritative MMR. Do not raise owner size.",
};

console.log(JSON.stringify(report, null, 2));
process.exit(instr.status === 200 && instr.json?.ok === true ? 0 : 1);
