/**
 * Stage 3 — validate risk-policy values without inventing thresholds.
 */
import type {
  InstrumentRiskPolicy,
  InstrumentSlippagePolicy,
  InstrumentSpreadPolicy,
  RiskPolicyFieldStatus,
} from "./types.js";

export function normalizeInstrumentSymbol(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  // Accept EURUSD → EUR/USD, XAUUSD → XAU/USD
  if (s.includes("/")) return s;
  if (s.length === 6 && /^[A-Z]{6}$/.test(s)) {
    return `${s.slice(0, 3)}/${s.slice(3)}`;
  }
  if (s.length === 7 && s.startsWith("XAU")) {
    return `XAU/${s.slice(3)}`;
  }
  return s;
}

export function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function validateAbsolutePriceLimit(
  value: unknown,
): { ok: true; value: number } | { ok: false; status: RiskPolicyFieldStatus; reason: string } {
  if (value === null || value === undefined || value === "") {
    return {
      ok: false,
      status: "NOT_CONFIGURED",
      reason: "Limit not configured — owner approval required; no invented threshold.",
    };
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return { ok: false, status: "INVALID", reason: "Limit is not a finite number." };
  }
  if (!(n > 0)) {
    return { ok: false, status: "INVALID", reason: "Limit must be a positive number." };
  }
  return { ok: true, value: n };
}

export function emptySpreadPolicy(instrument: string): InstrumentSpreadPolicy {
  return {
    instrument,
    maxSpreadAbsolute: null,
    units: "absolute_price",
    pricePrecision: null,
    status: "NOT_CONFIGURED",
    reason:
      "SPREAD_LIMIT_NOT_CONFIGURED — owner must approve instrument-specific maxSpreadAbsolute "
      + "(absolute price units). Do not invent from live market spreads.",
    approvedAtUtc: null,
    approvedBy: null,
  };
}

export function emptySlippagePolicy(instrument: string): InstrumentSlippagePolicy {
  return {
    instrument,
    maxSlippageAbsolute: null,
    units: "absolute_price",
    basis: "entry_vs_executable",
    status: "NOT_CONFIGURED",
    reason:
      "SLIPPAGE_LIMIT_NOT_CONFIGURED — owner must approve maxSlippageAbsolute "
      + "(absolute |entry − executable| price units; BUY→ask, SELL→bid).",
    approvedAtUtc: null,
    approvedBy: null,
  };
}

export function emptyInstrumentPolicy(instrument: string): InstrumentRiskPolicy {
  return {
    instrument,
    spread: emptySpreadPolicy(instrument),
    slippage: emptySlippagePolicy(instrument),
  };
}

export function applyApprovedSpread(
  instrument: string,
  value: unknown,
  actor: string,
  nowUtc: string,
  pricePrecision?: number | null,
): { ok: true; policy: InstrumentSpreadPolicy } | { ok: false; status: RiskPolicyFieldStatus; reason: string } {
  const v = validateAbsolutePriceLimit(value);
  if (!v.ok) return v;
  const precision = pricePrecision == null
    ? null
    : (Number.isInteger(pricePrecision) && pricePrecision >= 0 ? pricePrecision : null);
  return {
    ok: true,
    policy: {
      instrument,
      maxSpreadAbsolute: v.value,
      units: "absolute_price",
      pricePrecision: precision,
      status: "VERIFIED",
      reason: null,
      approvedAtUtc: nowUtc,
      approvedBy: actor,
    },
  };
}

export function applyApprovedSlippage(
  instrument: string,
  value: unknown,
  actor: string,
  nowUtc: string,
): { ok: true; policy: InstrumentSlippagePolicy } | { ok: false; status: RiskPolicyFieldStatus; reason: string } {
  const v = validateAbsolutePriceLimit(value);
  if (!v.ok) return v;
  return {
    ok: true,
    policy: {
      instrument,
      maxSlippageAbsolute: v.value,
      units: "absolute_price",
      basis: "entry_vs_executable",
      status: "VERIFIED",
      reason: null,
      approvedAtUtc: nowUtc,
      approvedBy: actor,
    },
  };
}

/**
 * Executable market price for slippage: BUY pays ask, SELL receives bid.
 */
export function executableMarketPrice(
  direction: "BUY" | "SELL" | null | undefined,
  bid: number | null,
  ask: number | null,
): { ok: true; price: number } | { ok: false; reason: string } {
  if (direction !== "BUY" && direction !== "SELL") {
    return { ok: false, reason: "Direction required to compute executable price." };
  }
  if (direction === "BUY") {
    if (!finitePositive(ask)) return { ok: false, reason: "Ask missing/invalid for BUY executable price." };
    return { ok: true, price: ask };
  }
  if (!finitePositive(bid)) return { ok: false, reason: "Bid missing/invalid for SELL executable price." };
  return { ok: true, price: bid };
}

export function measureSlippageAbsolute(
  entry: number | null,
  executable: number | null,
): { ok: true; slippage: number } | { ok: false; reason: string } {
  if (!finitePositive(entry)) return { ok: false, reason: "Entry price missing/invalid." };
  if (!finitePositive(executable)) return { ok: false, reason: "Executable price missing/invalid." };
  return { ok: true, slippage: Math.abs(entry - executable) };
}
