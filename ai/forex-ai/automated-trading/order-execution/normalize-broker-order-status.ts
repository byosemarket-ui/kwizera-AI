/**
 * Phase 59.0.6 — Map opaque ForexConnect Orders.status strings → normalized lifecycle.
 * Preserves raw broker status. Unknown strings map to UNKNOWN (never invent fills).
 * Not proof of broker acceptance by itself — requires OrderID evidence separately.
 */

export const BROKER_ORDER_STATUS_PHASE = "59.0.6" as const;

export type NormalizedBrokerOrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELLED"
  | "EXPIRED"
  | "UNKNOWN";

export interface NormalizeBrokerOrderStatusResult {
  phase: typeof BROKER_ORDER_STATUS_PHASE;
  rawStatus: string | null;
  normalized: NormalizedBrokerOrderStatus;
  label: string;
  /** True when raw string was empty/missing. */
  unavailable: boolean;
  /** True when raw was present but not in the known map. */
  unmapped: boolean;
  note: string;
}

const RULES: Array<{ normalized: NormalizedBrokerOrderStatus; patterns: RegExp[]; label: string }> = [
  {
    normalized: "PENDING",
    label: "Pending / submitted",
    patterns: [
      /^pending$/i,
      /^waiting/i,
      /^waitingformarket$/i,
      /^inprocess$/i,
      /^executing$/i,
      /^submitted$/i,
      /^new$/i,
    ],
  },
  {
    normalized: "ACCEPTED",
    label: "Accepted / open working",
    patterns: [/^accepted$/i, /^open$/i, /^working$/i, /^active$/i, /^live$/i],
  },
  {
    normalized: "REJECTED",
    label: "Rejected",
    patterns: [/^reject/i, /^denied$/i, /^refused$/i, /^failed$/i],
  },
  {
    normalized: "PARTIALLY_FILLED",
    label: "Partially filled",
    patterns: [/^partial/i, /^partfill/i, /^partiallyfilled$/i],
  },
  {
    normalized: "FILLED",
    label: "Filled",
    patterns: [/^filled$/i, /^executed$/i, /^complete(d)?$/i],
  },
  {
    normalized: "CANCELLED",
    label: "Cancelled",
    patterns: [/^cancel/i, /^canceled$/i, /^cancelled$/i, /^removed$/i],
  },
  {
    normalized: "EXPIRED",
    label: "Expired",
    patterns: [/^expir/i, /^timeout$/i],
  },
];

/**
 * Normalize a broker order status string. Never fabricates fill from absence.
 */
export function normalizeBrokerOrderStatus(
  raw: string | null | undefined,
): NormalizeBrokerOrderStatusResult {
  const trimmed = raw == null ? "" : String(raw).trim();
  if (!trimmed) {
    return {
      phase: BROKER_ORDER_STATUS_PHASE,
      rawStatus: null,
      normalized: "UNKNOWN",
      label: "Status unavailable",
      unavailable: true,
      unmapped: false,
      note: "Broker order status field missing — show unavailable, do not infer lifecycle.",
    };
  }

  const compact = trimmed.replace(/[\s_-]+/g, "");
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(trimmed) || re.test(compact))) {
      return {
        phase: BROKER_ORDER_STATUS_PHASE,
        rawStatus: trimmed,
        normalized: rule.normalized,
        label: rule.label,
        unavailable: false,
        unmapped: false,
        note: `Mapped broker status "${trimmed}" → ${rule.normalized}.`,
      };
    }
  }

  return {
    phase: BROKER_ORDER_STATUS_PHASE,
    rawStatus: trimmed,
    normalized: "UNKNOWN",
    label: "Unmapped broker status",
    unavailable: false,
    unmapped: true,
    note: `Broker status "${trimmed}" is not in the verified map — preserve raw value.`,
  };
}

/**
 * Idempotent merge of order-row updates. Later duplicate with same OrderID + status is a no-op.
 * Out-of-order: never regress FILLED/CANCELLED/REJECTED/EXPIRED to PENDING.
 */
export function mergeBrokerOrderStatusUpdate(input: {
  previous: NormalizedBrokerOrderStatus | null | undefined;
  incoming: NormalizedBrokerOrderStatus;
}): { status: NormalizedBrokerOrderStatus; applied: boolean; reason: string } {
  const prev = input.previous ?? null;
  const next = input.incoming;
  if (prev == null) {
    return { status: next, applied: true, reason: "initial" };
  }
  if (prev === next) {
    return { status: prev, applied: false, reason: "duplicate" };
  }
  const terminal: NormalizedBrokerOrderStatus[] = [
    "FILLED",
    "CANCELLED",
    "REJECTED",
    "EXPIRED",
  ];
  if (terminal.includes(prev) && (next === "PENDING" || next === "ACCEPTED" || next === "UNKNOWN")) {
    return {
      status: prev,
      applied: false,
      reason: "reject-regression-from-terminal",
    };
  }
  if (prev === "FILLED" && next === "PARTIALLY_FILLED") {
    return { status: prev, applied: false, reason: "reject-partial-after-filled" };
  }
  return { status: next, applied: true, reason: "forward" };
}
