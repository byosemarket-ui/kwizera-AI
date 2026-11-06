/**
 * Stage 3/4 — validate risk-policy values without inventing thresholds.
 */
import {
  INSTRUMENT_PRICE_PRECISION_GUIDANCE,
  type InstrumentRiskPolicy,
  type InstrumentSlippagePolicy,
  type InstrumentSpreadPolicy,
  type RiskLimitApprovalState,
  type RiskPolicyFieldStatus,
  type Stage3TrackedInstrument,
} from "./types.js";

export function normalizeInstrumentSymbol(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
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
  if (typeof value === "number" && !Number.isFinite(value)) {
    return { ok: false, status: "INVALID", reason: "Limit is NaN or Infinity." };
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

function nowIso(): string {
  return new Date().toISOString();
}

export function documentedPrecision(instrument: string): number | null {
  const key = normalizeInstrumentSymbol(instrument);
  if (!key) return null;
  return (INSTRUMENT_PRICE_PRECISION_GUIDANCE as Record<string, number>)[key] ?? null;
}

export function emptySpreadPolicy(instrument: string, nowUtc: string = nowIso()): InstrumentSpreadPolicy {
  return {
    instrument,
    maxSpreadAbsolute: null,
    units: "absolute_price",
    pricePrecision: documentedPrecision(instrument),
    status: "NOT_CONFIGURED",
    approvalState: "NOT_CONFIGURED",
    reason:
      "SPREAD_LIMIT_NOT_CONFIGURED — propose a value then approve explicitly. "
      + "Do not invent from live market spreads.",
    configVersion: 0,
    createdAtUtc: nowUtc,
    updatedAtUtc: nowUtc,
    approvedAtUtc: null,
    approvedBy: null,
    effectiveAtUtc: null,
    proposed: null,
    history: [],
  };
}

export function emptySlippagePolicy(instrument: string, nowUtc: string = nowIso()): InstrumentSlippagePolicy {
  return {
    instrument,
    maxSlippageAbsolute: null,
    units: "absolute_price",
    basis: "entry_vs_executable",
    pricePrecision: documentedPrecision(instrument),
    status: "NOT_CONFIGURED",
    approvalState: "NOT_CONFIGURED",
    reason:
      "SLIPPAGE_LIMIT_NOT_CONFIGURED — propose a value then approve explicitly "
      + "(absolute |entry−executable|; BUY→ask, SELL→bid).",
    configVersion: 0,
    createdAtUtc: nowUtc,
    updatedAtUtc: nowUtc,
    approvedAtUtc: null,
    approvedBy: null,
    effectiveAtUtc: null,
    proposed: null,
    history: [],
  };
}

export function emptyInstrumentPolicy(instrument: string, nowUtc: string = nowIso()): InstrumentRiskPolicy {
  return {
    instrument,
    documentedPricePrecision: documentedPrecision(instrument),
    spread: emptySpreadPolicy(instrument, nowUtc),
    slippage: emptySlippagePolicy(instrument, nowUtc),
  };
}

/** Migrate Stage 3 immediate-VERIFIED records into Stage 4 approval fields. */
export function migrateSpreadPolicy(
  instrument: string,
  raw: Partial<InstrumentSpreadPolicy> | null | undefined,
  nowUtc: string,
): InstrumentSpreadPolicy {
  const base = emptySpreadPolicy(instrument, nowUtc);
  if (!raw || typeof raw !== "object") return base;
  const value = finitePositive(raw.maxSpreadAbsolute) ? raw.maxSpreadAbsolute : null;
  const legacyVerified = raw.status === "VERIFIED" && value != null;
  const approvalState: RiskLimitApprovalState = raw.approvalState
    ?? (legacyVerified ? "APPROVED" : (raw.proposed ? "PENDING_APPROVAL" : "NOT_CONFIGURED"));
  const status: RiskPolicyFieldStatus = approvalState === "APPROVED" && value != null
    ? "VERIFIED"
    : approvalState === "INVALID"
      ? "INVALID"
      : "NOT_CONFIGURED";
  return {
    ...base,
    ...raw,
    instrument,
    maxSpreadAbsolute: approvalState === "APPROVED" ? value : (legacyVerified ? value : (raw.maxSpreadAbsolute ?? null)),
    units: "absolute_price",
    pricePrecision: raw.pricePrecision ?? base.pricePrecision,
    status: raw.status === "VERIFIED" && approvalState === "APPROVED" ? "VERIFIED" : status,
    approvalState,
    reason: raw.reason ?? (status === "VERIFIED" ? null : base.reason),
    configVersion: typeof raw.configVersion === "number" ? raw.configVersion : (legacyVerified ? 1 : 0),
    createdAtUtc: raw.createdAtUtc ?? raw.approvedAtUtc ?? nowUtc,
    updatedAtUtc: raw.updatedAtUtc ?? nowUtc,
    approvedAtUtc: approvalState === "APPROVED" ? (raw.approvedAtUtc ?? nowUtc) : raw.approvedAtUtc ?? null,
    approvedBy: approvalState === "APPROVED" ? (raw.approvedBy ?? "legacy-stage3") : raw.approvedBy ?? null,
    effectiveAtUtc: approvalState === "APPROVED"
      ? (raw.effectiveAtUtc ?? raw.approvedAtUtc ?? nowUtc)
      : raw.effectiveAtUtc ?? null,
    proposed: raw.proposed && finitePositive(raw.proposed.value) ? raw.proposed : null,
    history: Array.isArray(raw.history) ? raw.history.slice(-40) : [],
  };
}

export function migrateSlippagePolicy(
  instrument: string,
  raw: Partial<InstrumentSlippagePolicy> | null | undefined,
  nowUtc: string,
): InstrumentSlippagePolicy {
  const base = emptySlippagePolicy(instrument, nowUtc);
  if (!raw || typeof raw !== "object") return base;
  const value = finitePositive(raw.maxSlippageAbsolute) ? raw.maxSlippageAbsolute : null;
  const legacyVerified = raw.status === "VERIFIED" && value != null;
  const approvalState: RiskLimitApprovalState = raw.approvalState
    ?? (legacyVerified ? "APPROVED" : (raw.proposed ? "PENDING_APPROVAL" : "NOT_CONFIGURED"));
  const status: RiskPolicyFieldStatus = approvalState === "APPROVED" && value != null
    ? "VERIFIED"
    : approvalState === "INVALID"
      ? "INVALID"
      : "NOT_CONFIGURED";
  return {
    ...base,
    ...raw,
    instrument,
    maxSlippageAbsolute: approvalState === "APPROVED" ? value : (legacyVerified ? value : (raw.maxSlippageAbsolute ?? null)),
    units: "absolute_price",
    basis: "entry_vs_executable",
    pricePrecision: raw.pricePrecision ?? base.pricePrecision,
    status: raw.status === "VERIFIED" && approvalState === "APPROVED" ? "VERIFIED" : status,
    approvalState,
    reason: raw.reason ?? (status === "VERIFIED" ? null : base.reason),
    configVersion: typeof raw.configVersion === "number" ? raw.configVersion : (legacyVerified ? 1 : 0),
    createdAtUtc: raw.createdAtUtc ?? raw.approvedAtUtc ?? nowUtc,
    updatedAtUtc: raw.updatedAtUtc ?? nowUtc,
    approvedAtUtc: approvalState === "APPROVED" ? (raw.approvedAtUtc ?? nowUtc) : raw.approvedAtUtc ?? null,
    approvedBy: approvalState === "APPROVED" ? (raw.approvedBy ?? "legacy-stage3") : raw.approvedBy ?? null,
    effectiveAtUtc: approvalState === "APPROVED"
      ? (raw.effectiveAtUtc ?? raw.approvedAtUtc ?? nowUtc)
      : raw.effectiveAtUtc ?? null,
    proposed: raw.proposed && finitePositive(raw.proposed.value) ? raw.proposed : null,
    history: Array.isArray(raw.history) ? raw.history.slice(-40) : [],
  };
}

export function migrateInstrumentPolicy(
  instrument: string,
  raw: Partial<InstrumentRiskPolicy> | null | undefined,
  nowUtc: string,
): InstrumentRiskPolicy {
  return {
    instrument,
    documentedPricePrecision: documentedPrecision(instrument),
    spread: migrateSpreadPolicy(instrument, raw?.spread, nowUtc),
    slippage: migrateSlippagePolicy(instrument, raw?.slippage, nowUtc),
  };
}

export function isTrackedInstrument(instrument: string): instrument is Stage3TrackedInstrument {
  return (INSTRUMENT_PRICE_PRECISION_GUIDANCE as Record<string, number>)[instrument] != null;
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

/** @deprecated Stage 3 helper — Stage 4 uses propose/approve. Kept for tests that validate numbers. */
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
    ? documentedPrecision(instrument)
    : (Number.isInteger(pricePrecision) && pricePrecision >= 0 ? pricePrecision : documentedPrecision(instrument));
  const base = emptySpreadPolicy(instrument, nowUtc);
  return {
    ok: true,
    policy: {
      ...base,
      maxSpreadAbsolute: v.value,
      pricePrecision: precision,
      status: "VERIFIED",
      approvalState: "APPROVED",
      reason: null,
      configVersion: 1,
      approvedAtUtc: nowUtc,
      approvedBy: actor,
      effectiveAtUtc: nowUtc,
      updatedAtUtc: nowUtc,
      history: [{
        value: v.value,
        units: "absolute_price",
        pricePrecision: precision,
        approvedAtUtc: nowUtc,
        approvedBy: actor,
        configVersion: 1,
        documentVersion: 0,
      }],
    },
  };
}

/** @deprecated Stage 3 helper — Stage 4 uses propose/approve. */
export function applyApprovedSlippage(
  instrument: string,
  value: unknown,
  actor: string,
  nowUtc: string,
): { ok: true; policy: InstrumentSlippagePolicy } | { ok: false; status: RiskPolicyFieldStatus; reason: string } {
  const v = validateAbsolutePriceLimit(value);
  if (!v.ok) return v;
  const base = emptySlippagePolicy(instrument, nowUtc);
  return {
    ok: true,
    policy: {
      ...base,
      maxSlippageAbsolute: v.value,
      status: "VERIFIED",
      approvalState: "APPROVED",
      reason: null,
      configVersion: 1,
      approvedAtUtc: nowUtc,
      approvedBy: actor,
      effectiveAtUtc: nowUtc,
      updatedAtUtc: nowUtc,
      history: [{
        value: v.value,
        units: "absolute_price",
        pricePrecision: base.pricePrecision,
        approvedAtUtc: nowUtc,
        approvedBy: actor,
        configVersion: 1,
        documentVersion: 0,
      }],
    },
  };
}
