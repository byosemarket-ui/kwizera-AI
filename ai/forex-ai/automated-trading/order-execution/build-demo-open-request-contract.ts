/**
 * Phase 59.0.6/59.0.7 — Offline DEMO TRUE_MARKET_OPEN request contract builder.
 * Validates required fields and computes amount. Never imports/calls ForexConnect
 * send_request / create_order_request. Never activates mutation adapters.
 *
 * Time-in-force (FXCM Open Market / OM docs):
 *   Optional; supported GTC | IOC | FOK | DAY.
 *   Open Market orders default to IOC when omitted.
 *   GTD exists on Constants.TIF but requires expiry — unsupported here until modelled.
 */
import { lotsToBrokerAmount } from "./lots-to-broker-amount.js";

export const DEMO_OPEN_REQUEST_CONTRACT_PHASE = "59.0.7" as const;

export type DemoOpenRequestOrderType = "TRUE_MARKET_OPEN";

/** Documented OM-compatible TIF values (FXCM Create Open Market Order help). */
export const DEMO_OPEN_SUPPORTED_TIF = ["IOC", "GTC", "FOK", "DAY"] as const;
export type DemoOpenTimeInForce = (typeof DEMO_OPEN_SUPPORTED_TIF)[number];

/** TRUE_MARKET_OPEN / OM default per FXCM documentation. */
export const DEMO_OPEN_DEFAULT_TIF: DemoOpenTimeInForce = "IOC";

export interface BuildDemoOpenRequestContractInput {
  accountIdMasked: string | null | undefined;
  /** Raw account id is never required here — offline contract uses masked evidence only. */
  accountPresent: boolean;
  instrument: string;
  offerId: string | null | undefined;
  direction: "BUY" | "SELL";
  lots: number;
  baseUnitSize: number | null | undefined;
  minQuantity?: number | null;
  rateStop?: number | null;
  rateLimit?: number | null;
  /**
   * Optional TIME_IN_FORCE. Omit to use documented OM default (IOC).
   * Unsupported/unknown values fail closed (including GTD without expiry).
   */
  timeInForce?: string | null;
  /** Injected send hook — tests assert this is never invoked. */
  sendRequest?: (payload: unknown) => unknown;
  createOrderRequest?: (payload: unknown) => unknown;
}

export interface DemoOpenRequestContract {
  phase: typeof DEMO_OPEN_REQUEST_CONTRACT_PHASE;
  orderType: DemoOpenRequestOrderType;
  instrument: string;
  offerId: string | null;
  direction: "BUY" | "SELL";
  lots: number;
  amount: number;
  baseUnitSize: number;
  accountIdMasked: string | null;
  rateStop: number | null;
  rateLimit: number | null;
  timeInForce: DemoOpenTimeInForce;
  timeInForceSource: "EXPLICIT" | "DOCUMENTED_OM_DEFAULT_IOC";
  /** Explicit: constructing this object is not broker acceptance. */
  brokerAccepted: false;
  fillConfirmed: false;
  mutatesBroker: false;
  placesOrders: false;
  acceptsForExecution: false;
  note: string;
}

export interface BuildDemoOpenRequestContractResult {
  ok: boolean;
  contract: DemoOpenRequestContract | null;
  code: string;
  blockers: string[];
  message: string;
  sendInvoked: false;
  createInvoked: false;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

function resolveTimeInForce(raw: string | null | undefined): {
  ok: boolean;
  value: DemoOpenTimeInForce | null;
  source: "EXPLICIT" | "DOCUMENTED_OM_DEFAULT_IOC" | null;
  code?: string;
} {
  if (raw == null || String(raw).trim() === "") {
    return { ok: true, value: DEMO_OPEN_DEFAULT_TIF, source: "DOCUMENTED_OM_DEFAULT_IOC" };
  }
  const normalized = String(raw).trim().toUpperCase();
  if ((DEMO_OPEN_SUPPORTED_TIF as readonly string[]).includes(normalized)) {
    return { ok: true, value: normalized as DemoOpenTimeInForce, source: "EXPLICIT" };
  }
  if (normalized === "GTD") {
    return {
      ok: false,
      value: null,
      source: null,
      code: "TIME_IN_FORCE_GTD_UNSUPPORTED",
    };
  }
  return {
    ok: false,
    value: null,
    source: null,
    code: "TIME_IN_FORCE_UNSUPPORTED",
  };
}

/**
 * Build a validated offline request contract. Stops before any SDK send.
 */
export function buildDemoOpenRequestContract(
  input: BuildDemoOpenRequestContractInput,
): BuildDemoOpenRequestContractResult {
  const blockers: string[] = [];
  const base = {
    sendInvoked: false as const,
    createInvoked: false as const,
    placesOrders: false as const,
    acceptsForExecution: false as const,
    mutatesBroker: false as const,
  };

  // Hard proof hooks: even if callers pass send/create, this builder must not call them.
  void input.sendRequest;
  void input.createOrderRequest;

  if (!input.accountPresent) blockers.push("ACCOUNT_ROW_MISSING");
  const instrument = String(input.instrument || "").trim();
  if (!instrument) blockers.push("INSTRUMENT_REQUIRED");
  if (input.direction !== "BUY" && input.direction !== "SELL") {
    blockers.push("DIRECTION_INVALID");
  }

  const sized = lotsToBrokerAmount({
    lots: input.lots,
    baseUnitSize: input.baseUnitSize,
    minQuantity: input.minQuantity,
  });
  if (!sized.ok) blockers.push(sized.code);

  if (input.rateStop != null && !(typeof input.rateStop === "number" && Number.isFinite(input.rateStop))) {
    blockers.push("RATE_STOP_INVALID");
  }
  if (input.rateLimit != null && !(typeof input.rateLimit === "number" && Number.isFinite(input.rateLimit))) {
    blockers.push("RATE_LIMIT_INVALID");
  }

  const tif = resolveTimeInForce(input.timeInForce);
  if (!tif.ok) blockers.push(tif.code ?? "TIME_IN_FORCE_UNSUPPORTED");

  if (
    blockers.length
    || !sized.ok
    || sized.amount == null
    || sized.baseUnitSize == null
    || sized.lots == null
    || !tif.ok
    || tif.value == null
    || tif.source == null
  ) {
    return {
      ok: false,
      contract: null,
      code: blockers[0] ?? "REQUEST_CONTRACT_INVALID",
      blockers,
      message: `Offline request contract rejected: ${blockers.join(", ") || sized.message}`,
      ...base,
    };
  }

  const contract: DemoOpenRequestContract = {
    phase: DEMO_OPEN_REQUEST_CONTRACT_PHASE,
    orderType: "TRUE_MARKET_OPEN",
    instrument,
    offerId: input.offerId != null && String(input.offerId).trim() ? String(input.offerId).trim() : null,
    direction: input.direction,
    lots: sized.lots,
    amount: sized.amount,
    baseUnitSize: sized.baseUnitSize,
    accountIdMasked: input.accountIdMasked ?? null,
    rateStop: input.rateStop ?? null,
    rateLimit: input.rateLimit ?? null,
    timeInForce: tif.value,
    timeInForceSource: tif.source,
    brokerAccepted: false,
    fillConfirmed: false,
    mutatesBroker: false,
    placesOrders: false,
    acceptsForExecution: false,
    note:
      "Offline TRUE_MARKET_OPEN contract only. Not sent. brokerAccepted=false until Orders/Trades evidence. "
      + (tif.source === "DOCUMENTED_OM_DEFAULT_IOC"
        ? "TIF defaults to IOC per FXCM Open Market documentation."
        : `TIF explicitly set to ${tif.value}.`),
  };

  return {
    ok: true,
    contract,
    code: "REQUEST_CONTRACT_READY",
    blockers: [],
    message: "Offline request contract validated — send_request was not invoked.",
    ...base,
  };
}
