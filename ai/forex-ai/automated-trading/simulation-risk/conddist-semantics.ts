/**
 * Phase 56.2.6 — ForexConnect CondDist semantics (read-only evidence).
 *
 * Official O2GTradingSettingsProvider docs (ForexConnect 1.6.x):
 * - getCondDistStopForTrade(instrument) → int expressed in **pips**
 * - getCondDistLimitForTrade similarly in pips
 * - getCondDistEntryStop / getCondDistEntryLimit in pips
 *
 * Price distance = pips × PointSize (Offers).
 * Never treat CondDist as a quantity step or lot increment.
 * Never invent a unit when the method provenance is unknown.
 */

export type CondDistUnit = "pips" | "unknown";

export type CondDistFieldKind =
  | "STOP_FOR_TRADE"
  | "LIMIT_FOR_TRADE"
  | "ENTRY_STOP"
  | "ENTRY_LIMIT"
  | "UNSPECIFIED";

export interface CondDistEvidence {
  status: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | "NOT_AVAILABLE";
  rawValue: number | null;
  unit: CondDistUnit;
  fieldKind: CondDistFieldKind;
  /** Price distance when unit=pips and pointSize verified; null otherwise. */
  priceDistance: number | null;
  pointSize: number | null;
  source: string;
  limitations: string;
  notes: string[];
}

export interface MinStopAttestation {
  /**
   * True only when account-scoped SDK CondDist is available with verified unit,
   * OR CondDist raw=0 with verified pips unit (no positive minimum).
   * Public Enhanced Execution marketing alone never sets this true.
   */
  minStopDistanceVerified: boolean;
  /** Minimum stop distance in **price** units; null when none/unverified. */
  minStopDistancePrice: number | null;
  /** True when SDK CondDist pips === 0 (no positive minimum for this instrument). */
  noPositiveMinimumAttested: boolean;
  condDist: CondDistEvidence;
  publicEnhancedExecutionClaim:
    | "NOT_APPLIED_AS_ACCOUNT_PROOF"
    | "CONSISTENT_WITH_ZERO_CONDDIST"
    | "CONTRADICTS_POSITIVE_CONDDIST";
  notes: string[];
}

function finiteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Phase 56.4.0 — True when sidecar/bridge reported a documented O2G CondDist getter.
 * Accepts Python snake_case and JS/camelCase aliases used by ForexConnect 1.6.x docs.
 * Never treats a bare numeric CondDist as documented without method provenance.
 */
export function isDocumentedCondDistMethod(method: string | null | undefined): boolean {
  const m = String(method ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!m) return false;
  return (
    m === "getconddiststopfortrade"
    || m === "getconddistlimitfortrade"
    || m === "getconddistentrystop"
    || m === "getconddistentrylimit"
  );
}

/**
 * Resolve CondDist unit from documented SDK method provenance.
 * Do not infer from the numeric value alone.
 */
export function resolveCondDistUnit(input: {
  /** Sidecar / bridge unit label when present. */
  reportedUnit?: string | null;
  /** True when value came from getCondDist*ForTrade / Entry* SDK methods. */
  fromDocumentedSdkMethod?: boolean;
  /** Sidecar condDistMethod string when present. */
  condDistMethod?: string | null;
}): CondDistUnit {
  const reported = String(input.reportedUnit ?? "").trim().toLowerCase();
  if (reported === "pips" || reported === "pip") return "pips";
  if (input.fromDocumentedSdkMethod === true) return "pips";
  if (isDocumentedCondDistMethod(input.condDistMethod)) return "pips";
  // Legacy sidecar default "pips_or_points_unverified" is NOT sufficient alone.
  return "unknown";
}

/**
 * Convert CondDist pips → price distance using verified PointSize.
 */
export function condDistPipsToPriceDistance(
  pips: number,
  pointSize: number | null | undefined,
): { ok: true; priceDistance: number } | { ok: false; code: string; message: string } {
  if (!finiteNumber(pips) || pips < 0) {
    return {
      ok: false,
      code: "CONDDIST_PIPS_INVALID",
      message: "CondDist pips must be a finite number ≥ 0.",
    };
  }
  if (!finiteNumber(pointSize) || !(pointSize > 0)) {
    return {
      ok: false,
      code: "CONDDIST_POINTSIZE_UNVERIFIED",
      message: "PointSize unverified — cannot convert CondDist pips to price.",
    };
  }
  return { ok: true, priceDistance: pips * pointSize };
}

/**
 * Build CondDist evidence and account-attested min-stop for simulation gates.
 */
export function resolveCondDistMinStop(input: {
  condDistStop?: number | null;
  condDistAvailable?: boolean;
  reportedUnit?: string | null;
  /** Prefer true when sidecar used getCondDistStopForTrade (or documented alias). */
  fromDocumentedSdkMethod?: boolean;
  /** Sidecar condDistMethod string (Phase 56.4.0). */
  condDistMethod?: string | null;
  fieldKind?: CondDistFieldKind;
  pointSize?: number | null;
}): MinStopAttestation {
  const notes: string[] = [];
  const fieldKind = input.fieldKind ?? "STOP_FOR_TRADE";
  const fromDoc = input.fromDocumentedSdkMethod === true
    || isDocumentedCondDistMethod(input.condDistMethod)
    || String(input.reportedUnit ?? "").toLowerCase() === "pips";
  const unit = resolveCondDistUnit({
    reportedUnit: input.reportedUnit,
    fromDocumentedSdkMethod: fromDoc,
    condDistMethod: input.condDistMethod,
  });

  if (!input.condDistAvailable || !finiteNumber(input.condDistStop)) {
    return {
      minStopDistanceVerified: false,
      minStopDistancePrice: null,
      noPositiveMinimumAttested: false,
      condDist: {
        status: "NOT_AVAILABLE",
        rawValue: null,
        unit: "unknown",
        fieldKind,
        priceDistance: null,
        pointSize: finiteNumber(input.pointSize) ? input.pointSize : null,
        source: "forexconnect TradingSettings CondDist*",
        limitations:
          "CondDist not returned by SDK for this session — cannot attest min-stop. "
          + "Public Enhanced Execution 'no minimum stop' is not applied as account proof.",
        notes,
      },
      publicEnhancedExecutionClaim: "NOT_APPLIED_AS_ACCOUNT_PROOF",
      notes: [
        ...notes,
        "Account Enhanced Execution mode UNVERIFIED without CondDist SDK value.",
      ],
    };
  }

  const raw = input.condDistStop;
  if (unit !== "pips") {
    notes.push(
      "CondDist unit unknown (not confirmed as pips) — price conversion blocked; value not used as min-stop.",
    );
    return {
      minStopDistanceVerified: false,
      minStopDistancePrice: null,
      noPositiveMinimumAttested: false,
      condDist: {
        status: "UNVERIFIED",
        rawValue: raw,
        unit: "unknown",
        fieldKind,
        priceDistance: null,
        pointSize: finiteNumber(input.pointSize) ? input.pointSize : null,
        source: "forexconnect TradingSettings CondDist*",
        limitations:
          "Raw CondDist present but unit not verified as pips — refuse silent conversion.",
        notes,
      },
      publicEnhancedExecutionClaim: "NOT_APPLIED_AS_ACCOUNT_PROOF",
      notes,
    };
  }

  const converted = condDistPipsToPriceDistance(raw, input.pointSize);
  if (!converted.ok) {
    notes.push(converted.message);
    return {
      minStopDistanceVerified: false,
      minStopDistancePrice: null,
      noPositiveMinimumAttested: false,
      condDist: {
        status: "PARTIALLY_VERIFIED",
        rawValue: raw,
        unit: "pips",
        fieldKind,
        priceDistance: null,
        pointSize: finiteNumber(input.pointSize) ? input.pointSize : null,
        source:
          "O2GTradingSettingsProvider.getCondDistStopForTrade (docs: value in pips) + Offers PointSize",
        limitations: converted.message,
        notes,
      },
      publicEnhancedExecutionClaim: "NOT_APPLIED_AS_ACCOUNT_PROOF",
      notes,
    };
  }

  const priceDistance = converted.priceDistance;
  if (raw === 0) {
    notes.push(
      "CondDistStop=0 pips — account-scoped SDK attests no positive minimum stop for this instrument.",
    );
    return {
      minStopDistanceVerified: true,
      minStopDistancePrice: null,
      noPositiveMinimumAttested: true,
      condDist: {
        status: "VERIFIED",
        rawValue: 0,
        unit: "pips",
        fieldKind,
        priceDistance: 0,
        pointSize: input.pointSize ?? null,
        source:
          "O2GTradingSettingsProvider CondDist (pips) for connected account/instrument",
        limitations:
          "Zero means no positive minimum from SDK. LIVE parity and Enhanced Execution marketing label remain separate.",
        notes,
      },
      publicEnhancedExecutionClaim: "CONSISTENT_WITH_ZERO_CONDDIST",
      notes,
    };
  }

  notes.push(
    `CondDistStop=${raw} pips → price distance ${priceDistance} (× PointSize ${input.pointSize}).`,
  );
  return {
    minStopDistanceVerified: true,
    minStopDistancePrice: priceDistance,
    noPositiveMinimumAttested: false,
    condDist: {
      status: "VERIFIED",
      rawValue: raw,
      unit: "pips",
      fieldKind,
      priceDistance,
      pointSize: input.pointSize ?? null,
      source:
        "O2GTradingSettingsProvider CondDist (docs: pips) × Offers PointSize",
      limitations:
        "Applies to stop distance vs market / associated stop for trade per SDK brief. "
        + "Not a quantity increment. LIVE account may differ.",
      notes,
    },
    publicEnhancedExecutionClaim: "CONTRADICTS_POSITIVE_CONDDIST",
    notes: [
      ...notes,
      "Positive CondDist means a broker minimum exists for this instrument — public 'no min stop under Enhanced Execution' is not treated as overriding the SDK value.",
    ],
  };
}
