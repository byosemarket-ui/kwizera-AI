/**
 * Phase 3.5/3.6 — Fail-closed DEMO open-market risk controls.
 * Pure validation only. Never mutates the broker. Never invents equity/margin/specs.
 *
 * Authoritative inputs (must be supplied by callers from live RO ForexConnect reads):
 * - Accounts table: equity, usableMargin, balance, currency (via /accounts)
 * - Offers / TradingSettings: baseUnitSize, pointSize, pipCost, mmrPerLot, CondDist*
 * - Trades table (RO): open exposure lots (via /trades)
 *
 * Units (project + ForexConnect evidence — not invented):
 * - baseUnitSize: TradingSettingsProvider units per 1.0 lot (amount = baseUnitSize × lots)
 * - pointSize: Offers PointSize (price increment of one pip/point)
 * - pipCostAccount: Offers PipCost in account currency per pip/point per 1.0 lot
 * - mmrPerLot: TradingSettings get_mmr absolute margin for 1 lot (account/counter ccy amount, not a rate)
 * - CondDist*: O2G docs → pips; priceDistance = pips × pointSize (see conddist-semantics.ts)
 *
 * SL loss estimate: (|entry−SL| / pointSize) × pipCostAccount × lots
 * XAU/USD public help aligns with 0.01 point size when Offers agrees; live Offers values remain required.
 *
 * If any required input is missing/stale/unknown-unit → reject. Unknown ≠ zero risk.
 */
import {
  evaluateProtectiveGeometry,
  evaluateUnprotectedFillPolicy,
} from "../broker-intent/protective-geometry.js";
import {
  condDistPipsToPriceDistance,
  isDocumentedCondDistMethod,
  resolveCondDistUnit,
} from "../simulation-risk/conddist-semantics.js";
import { lotsToBrokerAmount } from "../order-execution/lots-to-broker-amount.js";

export const DEMO_OPEN_RISK_DEFAULTS = {
  /** Hard per-order lot cap for DEMO open-market (grant may be tighter). */
  maxLotsPerOrder: 1,
  /** Max sum of open broker lots + proposed lots. */
  maxTotalExposureLots: 2,
  /** Absolute floor for usable/free margin in account currency. */
  minUsableMargin: 50,
  /** Fraction of equity that must remain free after estimated MMR. */
  marginReserveFractionOfEquity: 0.1,
  /** Absolute max estimated SL loss in account currency (null = no absolute cap). */
  maxSlLossAccount: null as number | null,
  /** Max estimated SL loss as fraction of equity. */
  maxSlLossFractionOfEquity: 0.02,
  /** Max age of Accounts snapshot before fail-closed. */
  accountMaxAgeMs: 15_000,
} as const;

export interface DemoOpenMarketRiskLimits {
  maxLotsPerOrder: number;
  maxTotalExposureLots: number;
  minUsableMargin: number;
  marginReserveFractionOfEquity: number;
  maxSlLossAccount: number | null;
  maxSlLossFractionOfEquity: number;
  accountMaxAgeMs: number;
}

type EnvParse =
  | { kind: "absent" }
  | { kind: "ok"; value: number }
  | { kind: "invalid"; raw: string };

function envNumberStrict(env: NodeJS.ProcessEnv, key: string): EnvParse {
  const raw = env[key];
  if (raw == null || String(raw).trim() === "") return { kind: "absent" };
  const text = String(raw).trim();
  const n = Number(text);
  if (!Number.isFinite(n)) return { kind: "invalid", raw: text };
  return { kind: "ok", value: n };
}

export interface DemoOpenMarketRiskLimitsLoad {
  limits: DemoOpenMarketRiskLimits;
  /** True when any present env key was malformed / out of range — fail closed at evaluate. */
  configInvalid: boolean;
  invalidKeys: string[];
}

/**
 * Load DEMO open limits from env.
 * Missing keys → conservative defaults.
 * Present but NaN/Inf/negative/out-of-range → configInvalid (evaluate must reject).
 */
export function loadDemoOpenMarketRiskLimits(
  env: NodeJS.ProcessEnv = process.env,
): DemoOpenMarketRiskLimits {
  return loadDemoOpenMarketRiskLimitsDetailed(env).limits;
}

export function loadDemoOpenMarketRiskLimitsDetailed(
  env: NodeJS.ProcessEnv = process.env,
): DemoOpenMarketRiskLimitsLoad {
  const invalidKeys: string[] = [];

  const pickInt = (
    key: string,
    min: number,
    max: number,
    fallback: number,
  ): number => {
    const p = envNumberStrict(env, key);
    if (p.kind === "absent") return fallback;
    if (p.kind === "invalid" || p.value < min || p.value > max || !Number.isFinite(p.value)) {
      invalidKeys.push(key);
      return fallback;
    }
    return Math.floor(p.value);
  };

  const pickFloat = (
    key: string,
    predicate: (n: number) => boolean,
    fallback: number,
  ): number => {
    const p = envNumberStrict(env, key);
    if (p.kind === "absent") return fallback;
    if (p.kind === "invalid" || !predicate(p.value)) {
      invalidKeys.push(key);
      return fallback;
    }
    return p.value;
  };

  const pickOptionalPositive = (key: string): number | null => {
    const p = envNumberStrict(env, key);
    if (p.kind === "absent") return null;
    if (p.kind === "invalid" || !(p.value > 0)) {
      invalidKeys.push(key);
      return null;
    }
    return p.value;
  };

  const limits: DemoOpenMarketRiskLimits = {
    maxLotsPerOrder: pickInt(
      "KWIZERA_DEMO_OPEN_MAX_LOTS",
      1,
      50,
      DEMO_OPEN_RISK_DEFAULTS.maxLotsPerOrder,
    ),
    maxTotalExposureLots: pickInt(
      "KWIZERA_DEMO_OPEN_MAX_EXPOSURE_LOTS",
      1,
      50,
      DEMO_OPEN_RISK_DEFAULTS.maxTotalExposureLots,
    ),
    // Zero disables the floor — treat as invalid when explicitly set.
    minUsableMargin: pickFloat(
      "KWIZERA_DEMO_OPEN_MIN_USABLE_MARGIN",
      (n) => n > 0 && Number.isFinite(n),
      DEMO_OPEN_RISK_DEFAULTS.minUsableMargin,
    ),
    marginReserveFractionOfEquity: pickFloat(
      "KWIZERA_DEMO_OPEN_MARGIN_RESERVE_FRACTION",
      (n) => n >= 0 && n < 1,
      DEMO_OPEN_RISK_DEFAULTS.marginReserveFractionOfEquity,
    ),
    maxSlLossAccount: pickOptionalPositive("KWIZERA_DEMO_OPEN_MAX_SL_LOSS"),
    maxSlLossFractionOfEquity: pickFloat(
      "KWIZERA_DEMO_OPEN_MAX_SL_LOSS_FRACTION",
      (n) => n > 0 && n <= 1,
      DEMO_OPEN_RISK_DEFAULTS.maxSlLossFractionOfEquity,
    ),
    accountMaxAgeMs: pickInt(
      "KWIZERA_DEMO_OPEN_ACCOUNT_MAX_AGE_MS",
      1_000,
      300_000,
      DEMO_OPEN_RISK_DEFAULTS.accountMaxAgeMs,
    ),
  };

  return {
    limits,
    configInvalid: invalidKeys.length > 0,
    invalidKeys,
  };
}

export interface DemoOpenMarketAccountSnapshot {
  accountId: string;
  accountIdMasked?: string | null;
  environment: string;
  accountCurrency: string | null;
  equity: number | null;
  usableMargin: number | null;
  balance: number | null;
  usedMargin?: number | null;
  missingFields?: string[];
  fetchedAtUtc: string | null;
  equityIncludesFloatingPl?: boolean;
}

export interface DemoOpenMarketInstrumentSpecs {
  providerSymbol: string;
  baseUnitSize: number | null;
  pointSize: number | null;
  /** Account-currency pip/point cost per 1.0 lot when Offers PipCost is present. */
  pipCostAccount: number | null;
  /** Absolute maintenance margin for 1 lot when TradingSettings MMR is present. */
  mmrPerLot: number | null;
  /** Raw CondDist stop value from TradingSettings (unit via condDistUnit). */
  condDistStopRaw: number | null;
  /** Reported/sidecar unit label (resolved via resolveCondDistUnit). */
  condDistReportedUnit?: string | null;
  /** Sidecar condDistMethod provenance string. */
  condDistMethod?: string | null;
  /** True when a CondDist getter returned a value. */
  condDistAvailable: boolean;
}

export interface DemoOpenMarketRiskInput {
  instrument: string;
  direction: "BUY" | "SELL";
  lots: number;
  /** Absolute prices. */
  stopLoss: number | null;
  takeProfit: number | null;
  entryPrice: number | null;
  requireProtective: boolean;
  /** Grant max lots (already checked separately); also applied here. */
  grantMaxLots: number;
  requestedAccountId?: string | null;
  account: DemoOpenMarketAccountSnapshot | null;
  /** True when Accounts RO fetch succeeded (ok=true). */
  accountFetchOk: boolean;
  accountCount: number;
  instrumentSpecs: DemoOpenMarketInstrumentSpecs | null;
  /** Sum of open position lots from RO trades (null = unavailable). */
  openExposureLots: number | null;
  tradesFetchOk: boolean;
  /** Local lifecycle: block when unprotected fill policy requires it. */
  hasUnresolvedUnprotectedFill: boolean;
  /** Offer/quote timestamp used for entry (ISO / epoch ms / sec). */
  quoteTimestamp?: string | number | null;
  /** Max allowed quote age at risk evaluation time. */
  quoteMaxAgeMs?: number;
  limits?: DemoOpenMarketRiskLimits;
  /** From loadDemoOpenMarketRiskLimitsDetailed — present invalid env → reject. */
  limitsConfigInvalid?: boolean;
  limitsInvalidKeys?: string[];
  nowMs?: number;
}

export interface DemoOpenMarketRiskDetails {
  amount: number | null;
  baseUnitSize: number | null;
  estimatedSlLossAccount: number | null;
  estimatedMarginAccount: number | null;
  equity: number | null;
  usableMargin: number | null;
  openExposureLots: number | null;
  proposedLots: number;
  stopDistance: number | null;
  minStopDistancePrice: number | null;
  accountAgeMs: number | null;
  quoteAgeMs: number | null;
  condDistUnit: "pips" | "unknown" | null;
  exposureScope: "instrument";
  limits: DemoOpenMarketRiskLimits;
}

export interface DemoOpenMarketRiskResult {
  ok: boolean;
  maySubmitDemoMutation: boolean;
  code: string;
  blockers: string[];
  details: DemoOpenMarketRiskDetails;
  placesOrdersGlobal: false;
  acceptsForExecutionGlobal: false;
  mutatesBroker: false;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function parseFetchedAtMs(iso: string | null | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null;
  const ms = Date.parse(String(iso));
  return Number.isFinite(ms) ? ms : null;
}

/** Parse offer/quote timestamps (ISO, epoch ms, or epoch seconds). */
export function parseQuoteTimestampMs(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value) : Math.floor(value * 1000);
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    if (!Number.isFinite(n)) return null;
    return n > 1e12 ? Math.floor(n) : Math.floor(n * 1000);
  }
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Estimated SL loss in account currency:
 *   (|entry − SL| / pointSize) × pipCostAccount × lots
 * Requires verified pointSize + pipCost. Never invents conversion.
 */
export function estimateStopLossLossAccount(input: {
  entryPrice: number;
  stopLoss: number;
  lots: number;
  pointSize: number;
  pipCostAccount: number;
}): number | null {
  if (!finitePositive(input.entryPrice) || !finitePositive(input.stopLoss)) return null;
  if (!finitePositive(input.lots) || !Number.isInteger(input.lots)) return null;
  if (!finitePositive(input.pointSize) || !finitePositive(input.pipCostAccount)) return null;
  const distance = Math.abs(input.entryPrice - input.stopLoss);
  if (!(distance > 0)) return null;
  const points = distance / input.pointSize;
  if (!Number.isFinite(points) || !(points > 0)) return null;
  const loss = points * input.pipCostAccount * input.lots;
  return Number.isFinite(loss) && loss > 0 ? loss : null;
}

export function evaluateDemoOpenMarketRisk(
  input: DemoOpenMarketRiskInput,
): DemoOpenMarketRiskResult {
  const loaded = input.limits
    ? { limits: input.limits, configInvalid: Boolean(input.limitsConfigInvalid), invalidKeys: input.limitsInvalidKeys ?? [] }
    : loadDemoOpenMarketRiskLimitsDetailed();
  const limits = loaded.limits;
  const blockers: string[] = [];
  const nowMs = input.nowMs ?? Date.now();
  const unprotected = evaluateUnprotectedFillPolicy();
  const quoteMaxAgeMs = input.quoteMaxAgeMs ?? 15_000;

  const details: DemoOpenMarketRiskDetails = {
    amount: null,
    baseUnitSize: null,
    estimatedSlLossAccount: null,
    estimatedMarginAccount: null,
    equity: null,
    usableMargin: null,
    openExposureLots: input.openExposureLots,
    proposedLots: input.lots,
    stopDistance: null,
    minStopDistancePrice: null,
    accountAgeMs: null,
    quoteAgeMs: null,
    condDistUnit: null,
    exposureScope: "instrument",
    limits,
  };

  if (loaded.configInvalid) {
    blockers.push("RISK_LIMITS_ENV_INVALID");
  }

  if (input.hasUnresolvedUnprotectedFill && unprotected.blockAdditionalEntries) {
    blockers.push("UNPROTECTED_FILL_BLOCKS_ENTRIES");
  }

  // Quote freshness at risk-evaluation time (must not rely solely on earlier preflight).
  const quoteTsMs = parseQuoteTimestampMs(input.quoteTimestamp);
  if (quoteTsMs == null) {
    blockers.push("QUOTE_TIMESTAMP_MISSING");
  } else {
    const age = nowMs - quoteTsMs;
    details.quoteAgeMs = age;
    if (age < 0) blockers.push("QUOTE_TIMESTAMP_FUTURE");
    else if (age > quoteMaxAgeMs) blockers.push("QUOTE_STALE");
  }

  if (!Number.isInteger(input.lots) || input.lots < 1) {
    blockers.push("LOTS_INVALID");
  } else {
    if (input.lots > limits.maxLotsPerOrder) blockers.push("MAX_LOTS_PER_ORDER_EXCEEDED");
    if (input.lots > input.grantMaxLots) blockers.push("LOTS_EXCEED_GRANT");
  }

  if (!input.accountFetchOk || !input.account) {
    blockers.push("ACCOUNT_STATE_UNAVAILABLE");
  } else {
    const acct = input.account;
    details.equity = acct.equity;
    details.usableMargin = acct.usableMargin;

    const env = String(acct.environment || "").toLowerCase();
    if (env !== "demo") blockers.push("ACCOUNT_ENVIRONMENT_NOT_DEMO");

    if (input.accountCount > 1 && !String(input.requestedAccountId || "").trim()) {
      blockers.push("ACCOUNT_ID_REQUIRED_MULTIPLE");
    }
    if (
      input.requestedAccountId
      && String(input.requestedAccountId).trim()
      && String(input.requestedAccountId).trim() !== acct.accountId
    ) {
      blockers.push("ACCOUNT_ID_MISMATCH");
    }

    const fetchedMs = parseFetchedAtMs(acct.fetchedAtUtc);
    if (fetchedMs == null) {
      blockers.push("ACCOUNT_FETCHED_AT_MISSING");
    } else {
      const age = nowMs - fetchedMs;
      details.accountAgeMs = age;
      if (age < 0) blockers.push("ACCOUNT_FETCHED_AT_FUTURE");
      else if (age > limits.accountMaxAgeMs) blockers.push("ACCOUNT_STATE_STALE");
    }

    const missing = Array.isArray(acct.missingFields) ? acct.missingFields : [];
    if (missing.includes("equity") || acct.equity == null || !Number.isFinite(acct.equity)) {
      blockers.push("EQUITY_MISSING");
    } else if (!(acct.equity > 0)) {
      blockers.push("EQUITY_NON_POSITIVE");
    }
    if (
      missing.includes("usableMargin")
      || acct.usableMargin == null
      || !Number.isFinite(acct.usableMargin)
    ) {
      blockers.push("USABLE_MARGIN_MISSING");
    }
    if (!acct.accountCurrency || String(acct.accountCurrency).trim().length !== 3) {
      blockers.push("ACCOUNT_CURRENCY_MISSING");
    }
  }

  const specs = input.instrumentSpecs;
  if (!specs) {
    blockers.push("INSTRUMENT_SPECS_UNAVAILABLE");
  } else {
    const sized = lotsToBrokerAmount({
      lots: input.lots,
      baseUnitSize: specs.baseUnitSize,
    });
    details.baseUnitSize = sized.baseUnitSize;
    details.amount = sized.ok ? sized.amount : null;
    if (!sized.ok) blockers.push(sized.code);

    if (!finitePositive(specs.pointSize)) blockers.push("POINT_SIZE_UNVERIFIED");
    if (!finitePositive(specs.pipCostAccount)) blockers.push("PIP_COST_UNVERIFIED");
    if (!finitePositive(specs.mmrPerLot)) blockers.push("MMR_PER_LOT_UNVERIFIED");

    if (finitePositive(specs.mmrPerLot) && Number.isInteger(input.lots) && input.lots >= 1) {
      details.estimatedMarginAccount = specs.mmrPerLot * input.lots;
    }
  }

  if (!input.tradesFetchOk || input.openExposureLots == null || !Number.isFinite(input.openExposureLots)) {
    blockers.push("OPEN_EXPOSURE_UNAVAILABLE");
  } else if (input.openExposureLots < 0) {
    blockers.push("OPEN_EXPOSURE_INVALID");
  } else if (
    Number.isInteger(input.lots)
    && input.lots >= 1
    && input.openExposureLots + input.lots > limits.maxTotalExposureLots
  ) {
    blockers.push("MAX_EXPOSURE_LOTS_EXCEEDED");
  }

  const entry = input.entryPrice;
  // DEMO open-market risk always requires protective SL/TP for max-loss estimation.
  if (!input.requireProtective) {
    blockers.push("PROTECTIVE_REQUIRED_FOR_DEMO_RISK");
  }
  const geometry = evaluateProtectiveGeometry({
    direction: input.direction,
    entryPrice: entry,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    requireProtective: true,
    requireThreeR: false,
  });
  for (const r of geometry.rejections) {
    if (!blockers.includes(r.code)) blockers.push(r.code);
  }
  if (input.stopLoss == null || !Number.isFinite(input.stopLoss)) {
    blockers.push("STOP_LOSS_REQUIRED");
  }
  if (input.takeProfit == null || !Number.isFinite(input.takeProfit)) {
    blockers.push("TAKE_PROFIT_REQUIRED");
  }

  // CondDist geometry: always enforce when specs present — never skip unknown units.
  if (specs) {
    const condUnit = resolveCondDistUnit({
      reportedUnit: specs.condDistReportedUnit,
      condDistMethod: specs.condDistMethod,
      fromDocumentedSdkMethod: isDocumentedCondDistMethod(specs.condDistMethod),
    });
    details.condDistUnit = condUnit;
    if (!specs.condDistAvailable || specs.condDistStopRaw == null || !Number.isFinite(specs.condDistStopRaw)) {
      blockers.push("CONDDIST_STOP_UNAVAILABLE");
    } else if (condUnit !== "pips") {
      blockers.push("CONDDIST_UNIT_UNVERIFIED");
    } else if (!finitePositive(specs.pointSize)) {
      blockers.push("CONDDIST_POINTSIZE_UNVERIFIED");
    } else if (finitePositive(entry) && finitePositive(input.stopLoss as number)) {
      details.stopDistance = Math.abs(entry - (input.stopLoss as number));
      const converted = condDistPipsToPriceDistance(specs.condDistStopRaw, specs.pointSize);
      if (!converted.ok) {
        blockers.push(converted.code);
      } else {
        details.minStopDistancePrice = converted.priceDistance;
        // raw=0 with verified pips unit ⇒ no positive minimum (still attested).
        if (
          converted.priceDistance > 0
          && details.stopDistance + 1e-12 < converted.priceDistance
        ) {
          blockers.push("STOP_DISTANCE_BELOW_COND_DIST");
        }
      }
    }
  }

  if (
    finitePositive(entry)
    && finitePositive(input.stopLoss as number)
    && specs
    && finitePositive(specs.pointSize)
    && finitePositive(specs.pipCostAccount)
    && Number.isInteger(input.lots)
    && input.lots >= 1
  ) {
    if (details.stopDistance == null) {
      details.stopDistance = Math.abs(entry - (input.stopLoss as number));
    }
    const slLoss = estimateStopLossLossAccount({
      entryPrice: entry,
      stopLoss: input.stopLoss as number,
      lots: input.lots,
      pointSize: specs.pointSize,
      pipCostAccount: specs.pipCostAccount,
    });
    details.estimatedSlLossAccount = slLoss;
    if (slLoss == null) {
      blockers.push("SL_LOSS_ESTIMATE_UNAVAILABLE");
    } else {
      if (
        limits.maxSlLossAccount != null
        && slLoss > limits.maxSlLossAccount
      ) {
        blockers.push("MAX_SL_LOSS_ACCOUNT_EXCEEDED");
      }
      if (
        details.equity != null
        && details.equity > 0
        && slLoss > details.equity * limits.maxSlLossFractionOfEquity
      ) {
        blockers.push("MAX_SL_LOSS_FRACTION_EXCEEDED");
      }
    }
  } else if (input.requireProtective) {
    if (!blockers.includes("SL_LOSS_ESTIMATE_UNAVAILABLE") && !blockers.includes("POINT_SIZE_UNVERIFIED")) {
      // Specs or prices incomplete — already flagged above; ensure estimate gap is explicit.
      if (!finitePositive(entry)) blockers.push("ENTRY_PRICE_INVALID");
    }
  }

  // Margin reserve: usableMargin must cover estimated MMR and leave equity reserve free.
  if (
    details.usableMargin != null
    && Number.isFinite(details.usableMargin)
    && details.estimatedMarginAccount != null
  ) {
    if (details.usableMargin < limits.minUsableMargin) {
      blockers.push("USABLE_MARGIN_BELOW_MINIMUM");
    }
    if (details.usableMargin < details.estimatedMarginAccount) {
      blockers.push("INSUFFICIENT_USABLE_MARGIN");
    }
    if (details.equity != null && details.equity > 0) {
      const reserve = details.equity * limits.marginReserveFractionOfEquity;
      if (details.usableMargin - details.estimatedMarginAccount < reserve) {
        blockers.push("MARGIN_RESERVE_INSUFFICIENT");
      }
    }
  }

  const ok = blockers.length === 0;
  return {
    ok,
    maySubmitDemoMutation: ok,
    code: ok ? "DEMO_OPEN_RISK_OK" : blockers[0]!,
    blockers,
    details,
    placesOrdersGlobal: false,
    acceptsForExecutionGlobal: false,
    mutatesBroker: false,
  };
}

/**
 * Sum open trade lots from a RO /trades payload.
 * Broker rows expose `amount` (base units). Conversion requires verified baseUnitSize.
 * Fail-closed → null when structure/specs unknown.
 */
export function sumOpenExposureLotsFromTradesPayload(
  payload: Record<string, unknown> | null | undefined,
  options: {
    instrument?: string | null;
    /** When set, exposure is scoped to this instrument only; otherwise all instruments. */
    baseUnitSize: number | null | undefined;
    scope: "instrument" | "account";
  },
): number | null {
  if (!payload || payload.ok === false) return null;
  const trades = payload.trades;
  if (!Array.isArray(trades)) return null;
  if (!finitePositive(options.baseUnitSize) || !Number.isInteger(options.baseUnitSize)) {
    return null;
  }
  const bus = options.baseUnitSize;
  const want = options.instrument
    ? String(options.instrument).replace(/\s+/g, "").toUpperCase()
    : null;
  let sum = 0;
  for (const row of trades) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const sym = String(r.instrument ?? r.symbol ?? r.Instrument ?? "").replace(/\s+/g, "").toUpperCase();
    if (options.scope === "instrument") {
      if (!want || !sym || sym !== want) continue;
    }
    const lotsField = r.lots ?? r.Lots;
    if (lotsField != null && Number.isFinite(Number(lotsField))) {
      const lots = Number(lotsField);
      if (!(lots >= 0) || !Number.isFinite(lots)) return null;
      sum += lots;
      continue;
    }
    const amount = Number(r.amount ?? r.Amount);
    if (!Number.isFinite(amount) || amount < 0) return null;
    if (amount % bus !== 0) return null;
    sum += amount / bus;
  }
  return Number.isFinite(sum) ? sum : null;
}
