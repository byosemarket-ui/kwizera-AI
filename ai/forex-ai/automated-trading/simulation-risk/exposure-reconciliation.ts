/**
 * Phase 56.2.4 — Authoritative Orders/Trades exposure reconciliation (read-only).
 * Never mutates broker state. Never invents fills from working orders.
 */

export type ExposureCapability =
  | "AVAILABLE"
  | "AVAILABLE_BUT_DISCONNECTED"
  | "UNSUPPORTED"
  | "ERROR"
  | "MISSING"
  | "UNKNOWN";

export interface BrokerRoTableSnapshot {
  ok?: boolean;
  capabilityStatus?: string | null;
  code?: string | null;
  count?: number | null;
  fetchedAt?: string | null;
  orders?: Array<Record<string, unknown>> | null;
  trades?: Array<Record<string, unknown>> | null;
  error?: { code?: string; message?: string } | null;
}

export interface ExposureReconciliationInput {
  instrument: string;
  environment: string;
  openWorkingOrders: BrokerRoTableSnapshot | null;
  openPositions: BrokerRoTableSnapshot | null;
  /** Max age for RO snapshots before fail-closed stale. */
  maxAgeMs?: number;
  nowMs?: number;
}

export interface InstrumentExposureSlice {
  instrument: string;
  pendingOrderCount: number;
  openPositionCount: number;
  /** Raw quantity sums — unit may still be ambiguous; never treat as USD. */
  pendingOrderQuantitySum: number | null;
  openPositionQuantitySum: number | null;
}

export interface ExposureReconciliationResult {
  authoritative: boolean;
  status:
    | "AUTHORITATIVE_EMPTY"
    | "AUTHORITATIVE_NONEMPTY"
    | "UNAVAILABLE"
    | "INCOMPLETE"
    | "STALE"
    | "MISMATCHED_SCOPE";
  openPositionsCount: number | null;
  pendingOrdersCount: number | null;
  xau: InstrumentExposureSlice | null;
  ordersCapability: ExposureCapability;
  tradesCapability: ExposureCapability;
  ordersCode: string | null;
  tradesCode: string | null;
  fetchedAtUtc: string | null;
  freshnessMs: number | null;
  /** Confirmed zero vs unavailable — never render missing as zero in UI. */
  confirmedZeroExposure: boolean;
  note: string;
  blockers: string[];
}

function capOf(raw: string | null | undefined): ExposureCapability {
  const s = String(raw ?? "").toUpperCase();
  if (s === "AVAILABLE") return "AVAILABLE";
  if (s === "AVAILABLE_BUT_DISCONNECTED") return "AVAILABLE_BUT_DISCONNECTED";
  if (s === "UNSUPPORTED") return "UNSUPPORTED";
  if (s === "ERROR") return "ERROR";
  if (s === "MISSING") return "MISSING";
  return "UNKNOWN";
}

function isConfirmedEmptyCode(code: string | null | undefined, kind: "ORDERS" | "TRADES"): boolean {
  const c = String(code ?? "").toUpperCase();
  if (kind === "ORDERS") return c === "NO_ORDERS" || c === "OK";
  return c === "NO_TRADES" || c === "OK";
}

function normalizeInstrument(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function matchesInstrument(rowInstrument: unknown, target: string): boolean {
  const a = normalizeInstrument(rowInstrument);
  const b = normalizeInstrument(target);
  if (!a || !b) return false;
  if (a === b) return true;
  const compact = (s: string) => s.replace(/[^A-Z0-9]/g, "");
  return compact(a) === compact(b);
}

function sumAmount(
  rows: Array<Record<string, unknown>>,
  instrument: string,
  amountKeys: string[],
): { count: number; sum: number | null } {
  let count = 0;
  let sum = 0;
  let anyAmount = false;
  for (const row of rows) {
    if (!matchesInstrument(row.instrument ?? row.symbol, instrument)) continue;
    count += 1;
    let amt: number | null = null;
    for (const k of amountKeys) {
      const v = row[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        amt = v;
        break;
      }
    }
    if (amt != null) {
      anyAmount = true;
      sum += Math.abs(amt);
    }
  }
  return { count, sum: count === 0 ? 0 : anyAmount ? sum : null };
}

function parseFetchedAt(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/**
 * Reconcile ORDERS + TRADES RO snapshots for simulation exposure.
 *
 * Rules:
 * - AUTHORITATIVE only when both tables are AVAILABLE (including confirmed empty).
 * - Working orders are not assumed filled; counted separately from trades.
 * - Never double-count by summing order+trade into one filled exposure bucket.
 * - Failed / disconnected / unsupported → UNAVAILABLE (not zero).
 */
export function reconcileBrokerExposure(
  input: ExposureReconciliationInput,
): ExposureReconciliationResult {
  const blockers: string[] = [];
  const orders = input.openWorkingOrders;
  const trades = input.openPositions;
  const ordersCap = capOf(orders?.capabilityStatus);
  const tradesCap = capOf(trades?.capabilityStatus);
  const ordersCode = orders?.code != null ? String(orders.code) : null;
  const tradesCode = trades?.code != null ? String(trades.code) : null;

  const fetchedCandidates = [orders?.fetchedAt, trades?.fetchedAt].filter(Boolean) as string[];
  const fetchedAtUtc = fetchedCandidates[0] ?? null;
  const nowMs = input.nowMs ?? Date.now();
  const fetchedMs = parseFetchedAt(fetchedAtUtc);
  const freshnessMs = fetchedMs != null ? Math.max(0, nowMs - fetchedMs) : null;
  const maxAgeMs = input.maxAgeMs ?? 60_000;

  if (!orders || !trades) {
    return {
      authoritative: false,
      status: "UNAVAILABLE",
      openPositionsCount: null,
      pendingOrdersCount: null,
      xau: null,
      ordersCapability: ordersCap,
      tradesCapability: tradesCap,
      ordersCode,
      tradesCode,
      fetchedAtUtc,
      freshnessMs,
      confirmedZeroExposure: false,
      note: "Orders and/or Trades RO snapshot missing — exposure not authoritative.",
      blockers: ["EXPOSURE_SNAPSHOT_MISSING"],
    };
  }

  if (ordersCap !== "AVAILABLE" || tradesCap !== "AVAILABLE") {
    if (ordersCap === "AVAILABLE_BUT_DISCONNECTED" || tradesCap === "AVAILABLE_BUT_DISCONNECTED") {
      blockers.push("EXPOSURE_DISCONNECTED");
    } else if (ordersCap === "UNSUPPORTED" || tradesCap === "UNSUPPORTED") {
      blockers.push("EXPOSURE_UNSUPPORTED");
    } else {
      blockers.push("EXPOSURE_QUERY_FAILED");
    }
    return {
      authoritative: false,
      status: "UNAVAILABLE",
      openPositionsCount: null,
      pendingOrdersCount: null,
      xau: null,
      ordersCapability: ordersCap,
      tradesCapability: tradesCap,
      ordersCode,
      tradesCode,
      fetchedAtUtc,
      freshnessMs,
      confirmedZeroExposure: false,
      note: "Orders/Trades RO not both AVAILABLE — fail closed (not treated as zero).",
      blockers,
    };
  }

  if (!isConfirmedEmptyCode(ordersCode, "ORDERS") && orders.ok === false) {
    blockers.push("ORDERS_INCOMPLETE");
  }
  if (!isConfirmedEmptyCode(tradesCode, "TRADES") && trades.ok === false) {
    blockers.push("TRADES_INCOMPLETE");
  }
  if (blockers.length) {
    return {
      authoritative: false,
      status: "INCOMPLETE",
      openPositionsCount: null,
      pendingOrdersCount: null,
      xau: null,
      ordersCapability: ordersCap,
      tradesCapability: tradesCap,
      ordersCode,
      tradesCode,
      fetchedAtUtc,
      freshnessMs,
      confirmedZeroExposure: false,
      note: "RO tables reported AVAILABLE but ok=false without confirmed empty code.",
      blockers,
    };
  }

  if (freshnessMs != null && freshnessMs > maxAgeMs) {
    return {
      authoritative: false,
      status: "STALE",
      openPositionsCount: null,
      pendingOrdersCount: null,
      xau: null,
      ordersCapability: ordersCap,
      tradesCapability: tradesCap,
      ordersCode,
      tradesCode,
      fetchedAtUtc,
      freshnessMs,
      confirmedZeroExposure: false,
      note: `Exposure snapshots stale (${freshnessMs}ms > ${maxAgeMs}ms).`,
      blockers: ["EXPOSURE_STALE"],
    };
  }

  const orderRows = Array.isArray(orders.orders) ? orders.orders : [];
  const tradeRows = Array.isArray(trades.trades) ? trades.trades : [];
  const pendingAll = typeof orders.count === "number" && Number.isFinite(orders.count)
    ? orders.count
    : orderRows.length;
  const positionsAll = typeof trades.count === "number" && Number.isFinite(trades.count)
    ? trades.count
    : tradeRows.length;

  const pendingXau = sumAmount(orderRows, input.instrument, ["amount", "quantity", "Amount"]);
  const openXau = sumAmount(tradeRows, input.instrument, ["amount", "quantity", "Amount"]);

  // Confirmed empty: both codes NO_* or OK with count 0.
  const confirmedZero =
    pendingAll === 0
    && positionsAll === 0
    && (String(ordersCode).toUpperCase() === "NO_ORDERS" || String(ordersCode).toUpperCase() === "OK")
    && (String(tradesCode).toUpperCase() === "NO_TRADES" || String(tradesCode).toUpperCase() === "OK");

  const nonempty = pendingAll > 0 || positionsAll > 0;

  return {
    authoritative: true,
    status: nonempty ? "AUTHORITATIVE_NONEMPTY" : "AUTHORITATIVE_EMPTY",
    openPositionsCount: positionsAll,
    pendingOrdersCount: pendingAll,
    xau: {
      instrument: input.instrument,
      pendingOrderCount: pendingXau.count,
      openPositionCount: openXau.count,
      pendingOrderQuantitySum: pendingXau.sum,
      openPositionQuantitySum: openXau.sum,
    },
    ordersCapability: ordersCap,
    tradesCapability: tradesCap,
    ordersCode,
    tradesCode,
    fetchedAtUtc,
    freshnessMs,
    confirmedZeroExposure: confirmedZero,
    note: nonempty
      ? "Authoritative RO exposure: pending orders and open trades counted separately (no fill assumption / no double-count bucket)."
      : "Authoritative confirmed empty exposure (NO_ORDERS + NO_TRADES).",
    blockers: [],
  };
}

/**
 * ClosedTrades assessment for Phase 56.2.4 — documentation helper (no implementation).
 */
export function assessClosedTradesNecessity(): Record<string, unknown> {
  return {
    implemented: false,
    capabilityStatus: "MISSING",
    neededFor: {
      historicalRealizedPl: "YES_FOR_PERFORMANCE_STATS — not required for open exposure",
      duplicateLifecycleAccounting: "OPTIONAL — open ORDERS+TRADES sufficient if states disjoint",
      strategyAllocationAccounting: "NO — open exposure + local draft reservations suffice when authoritative",
      closedPositionAudit: "YES_FOR_AUDIT_TRAILS — out of scope this phase",
      futurePerformanceStatistics: "YES — defer",
    },
    safeWithoutClosedTrades: [
      "Confirmed open positions (TRADES)",
      "Confirmed working orders (ORDERS)",
      "Local ACTIVE strategy budget reservations",
      "Verified equity / free margin from Accounts",
    ],
    unsafeWithoutClosedTrades: [
      "Historical realized P/L reconciliation",
      "Lifecycle audit of closed fills",
      "Performance statistics",
    ],
    policy:
      "Do not mix historical realized P/L into open exposure or free margin without verified ClosedTrades semantics.",
  };
}
