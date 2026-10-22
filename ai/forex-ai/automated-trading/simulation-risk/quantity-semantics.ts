/**
 * Phase 56.2.4 / 56.2.6 — XAU/USD quantity-unit and min-stop evidence.
 * Never invents ounces or broker min-stop values.
 * CondDist unit/conversion delegated to conddist-semantics (pips × PointSize).
 */

import { resolveCondDistMinStop } from "./conddist-semantics.js";

export type EvidenceStatus =
  | "VERIFIED"
  | "PARTIALLY_VERIFIED"
  | "UNVERIFIED"
  | "NOT_AVAILABLE";

export interface EvidenceField<T = unknown> {
  status: EvidenceStatus;
  value: T | null;
  unit: string | null;
  source: string;
  retrievedAtUtc: string;
  environmentScope: "DEMO" | "LIVE" | "PUBLIC_DOCS" | "SDK" | "MIXED";
  limitations: string;
}

/** Official FXCM Markets contract-size guide (retrieved this phase). */
export const FXCM_XAU_CONTRACT_SIZE_EVIDENCE: EvidenceField<string> = {
  status: "VERIFIED",
  value: "1 contract = 1 troy ounce",
  unit: "contract → troy_ounce",
  source:
    "https://www.fxcm.com/markets/trading-details/fxcm-contract-sizes-a-quick-guide/",
  retrievedAtUtc: "2026-10-20T00:00:00.000Z",
  environmentScope: "PUBLIC_DOCS",
  limitations:
    "Defines FXCM published contract size. Does not alone prove ForexConnect Amount uses the same unit without DEMO metadata alignment.",
};

/** Official FXCM XAU/USD product help (retrieved this phase). */
export const FXCM_XAU_MIN_STOP_PUBLIC_EVIDENCE: EvidenceField<string> = {
  status: "PARTIALLY_VERIFIED",
  value: "no minimum stop distance under Enhanced Execution",
  unit: null,
  source: "https://www.fxcm.com/markets/help/commodities-xau-usd-gold/",
  retrievedAtUtc: "2026-10-20T00:00:00.000Z",
  environmentScope: "PUBLIC_DOCS",
  limitations:
    "Conditional on FXCM Enhanced Execution. Connected DEMO account Enhanced Execution mode is not independently attested — do not treat as a verified numeric min-stop for this account.",
};

export const FXCM_XAU_PIP_HELP_EVIDENCE: EvidenceField<string> = {
  status: "VERIFIED",
  value: "minimum pip/point value $0.01; each 0.01 price move = 1 pip/point; max contracts 10000",
  unit: "USD per point (account-dependent)",
  source: "https://www.fxcm.com/markets/help/commodities-xau-usd-gold/",
  retrievedAtUtc: "2026-10-20T00:00:00.000Z",
  environmentScope: "PUBLIC_DOCS",
  limitations: "Account currency conversion may change pip cost; DEMO pipCost must be read from Offers.",
};

export interface XauQuantitySemanticsResolution {
  instrumentIdentity: EvidenceField<string>;
  quantityUnit: EvidenceField<"contracts" | "unknown">;
  /** True when monetary R must stay blocked. */
  quantityUnitAmbiguous: boolean;
  /** Unit string for sim contract meta when not ambiguous. */
  resolvedQuantityUnit: "contracts" | "unknown";
  contractSizeOunceBinding: EvidenceField<string>;
  baseUnitSize: EvidenceField<number>;
  contractMultiplier: EvidenceField<number>;
  pointSize: EvidenceField<number>;
  pipCostAccount: EvidenceField<number>;
  quantityStep: EvidenceField<number>;
  quantityMin: EvidenceField<number>;
  minStopDistance: EvidenceField<number | "none_claimed">;
  /** Engine flag — true with verified price min OR CondDist=0 (no positive min). */
  minStopDistanceVerified: boolean;
  /** Price units; null when unverified or no-positive-minimum attested. */
  minStopDistanceValue: number | null;
  minStopNoPositiveMinimum: boolean;
  condDistStopPips: number | null;
  condDistUnit: "pips" | "unknown" | null;
  monetaryRiskAllowed: boolean;
  summaryStatus: EvidenceStatus;
  notes: string[];
}

function isXauSymbol(symbol: string | null | undefined): boolean {
  const s = String(symbol ?? "").toUpperCase().replace(/\s+/g, "");
  return s === "XAU/USD" || s === "XAUUSD" || s.startsWith("XAU/");
}

/**
 * Resolve XAU/USD quantity + min-stop evidence from DEMO verification fields + public docs.
 * Non-XAU instruments remain unknown/ambiguous here.
 */
export function resolveXauQuantitySemantics(input: {
  symbol: string | null | undefined;
  instrumentType?: string | null;
  pointSize?: number | null;
  pipCostAccount?: number | null;
  baseUnitSize?: number | null;
  contractMultiplier?: number | null;
  quantityStep?: number | null;
  quantityMin?: number | null;
  /** Legacy local label from contract-spec (e.g. "lots") — never treated as ounce proof. */
  legacyQuantityUnitLabel?: string | null;
  /** Optional CondDist from TradingSettings RO (pips or price — unit must be stated). */
  condDistStop?: number | null;
  condDistStopUnit?: string | null;
  condDistAvailable?: boolean;
  /** Phase 56.4.0 — documented SDK method name when sidecar attested it. */
  condDistMethod?: string | null;
  /** Explicit provenance flag when caller already verified the method. */
  fromDocumentedSdkMethod?: boolean;
}): XauQuantitySemanticsResolution {
  const now = "2026-10-20T00:00:00.000Z";
  const notes: string[] = [];
  const symbol = String(input.symbol ?? "").trim() || null;

  if (!isXauSymbol(symbol)) {
    return {
      instrumentIdentity: {
        status: "NOT_AVAILABLE",
        value: symbol,
        unit: null,
        source: "caller",
        retrievedAtUtc: now,
        environmentScope: "MIXED",
        limitations: "Not an XAU/USD allowlist symbol for Phase 56.2.4 semantics.",
      },
      quantityUnit: {
        status: "UNVERIFIED",
        value: "unknown",
        unit: null,
        source: "n/a",
        retrievedAtUtc: now,
        environmentScope: "MIXED",
        limitations: "XAU semantics resolver does not apply.",
      },
      quantityUnitAmbiguous: true,
      resolvedQuantityUnit: "unknown",
      contractSizeOunceBinding: { ...FXCM_XAU_CONTRACT_SIZE_EVIDENCE, status: "NOT_AVAILABLE", value: null },
      baseUnitSize: {
        status: "NOT_AVAILABLE",
        value: null,
        unit: null,
        source: "n/a",
        retrievedAtUtc: now,
        environmentScope: "DEMO",
        limitations: "n/a",
      },
      contractMultiplier: {
        status: "NOT_AVAILABLE",
        value: null,
        unit: null,
        source: "n/a",
        retrievedAtUtc: now,
        environmentScope: "DEMO",
        limitations: "n/a",
      },
      pointSize: {
        status: "NOT_AVAILABLE",
        value: null,
        unit: null,
        source: "n/a",
        retrievedAtUtc: now,
        environmentScope: "DEMO",
        limitations: "n/a",
      },
      pipCostAccount: {
        status: "NOT_AVAILABLE",
        value: null,
        unit: null,
        source: "n/a",
        retrievedAtUtc: now,
        environmentScope: "DEMO",
        limitations: "n/a",
      },
      quantityStep: {
        status: "NOT_AVAILABLE",
        value: null,
        unit: null,
        source: "n/a",
        retrievedAtUtc: now,
        environmentScope: "DEMO",
        limitations: "n/a",
      },
      quantityMin: {
        status: "NOT_AVAILABLE",
        value: null,
        unit: null,
        source: "n/a",
        retrievedAtUtc: now,
        environmentScope: "DEMO",
        limitations: "n/a",
      },
      minStopDistance: {
        status: "UNVERIFIED",
        value: null,
        unit: null,
        source: "n/a",
        retrievedAtUtc: now,
        environmentScope: "MIXED",
        limitations: "n/a",
      },
      minStopDistanceVerified: false,
      minStopDistanceValue: null,
      minStopNoPositiveMinimum: false,
      condDistStopPips: null,
      condDistUnit: null,
      monetaryRiskAllowed: false,
      summaryStatus: "UNVERIFIED",
      notes: ["Non-XAU instrument — quantity semantics unresolved here."],
    };
  }

  const identity: EvidenceField<string> = {
    status: "VERIFIED",
    value: "XAU/USD",
    unit: null,
    source: "forexconnect-offers + AT allowlist",
    retrievedAtUtc: now,
    environmentScope: "DEMO",
    limitations: "Symbol mapping verified on DEMO Offers; LIVE identity attestation remains separate.",
  };

  const baseUnit: EvidenceField<number> = {
    status:
      typeof input.baseUnitSize === "number" && Number.isFinite(input.baseUnitSize) && input.baseUnitSize > 0
        ? "VERIFIED"
        : "UNVERIFIED",
    value:
      typeof input.baseUnitSize === "number" && Number.isFinite(input.baseUnitSize)
        ? input.baseUnitSize
        : null,
    unit: "BaseUnitSize (TradingSettings)",
    source: "forexconnect-offers+trading-settings",
    retrievedAtUtc: now,
    environmentScope: "DEMO",
    limitations: "SDK BaseUnitSize for the connected DEMO account.",
  };

  const mult: EvidenceField<number> = {
    status:
      typeof input.contractMultiplier === "number"
      && Number.isFinite(input.contractMultiplier)
      && input.contractMultiplier > 0
        ? "VERIFIED"
        : "UNVERIFIED",
    value:
      typeof input.contractMultiplier === "number" && Number.isFinite(input.contractMultiplier)
        ? input.contractMultiplier
        : null,
    unit: "ContractMultiplier (Offers)",
    source: "forexconnect-offers",
    retrievedAtUtc: now,
    environmentScope: "DEMO",
    limitations: "Numeric field verified present; interpretation follows FXCM contract-size docs for XAU.",
  };

  const point: EvidenceField<number> = {
    status:
      typeof input.pointSize === "number" && Number.isFinite(input.pointSize) && input.pointSize > 0
        ? "VERIFIED"
        : "UNVERIFIED",
    value: typeof input.pointSize === "number" && Number.isFinite(input.pointSize) ? input.pointSize : null,
    unit: "price",
    source: "forexconnect-offers",
    retrievedAtUtc: now,
    environmentScope: "DEMO",
    limitations: "Offers PointSize.",
  };

  const pip: EvidenceField<number> = {
    status:
      typeof input.pipCostAccount === "number"
      && Number.isFinite(input.pipCostAccount)
      && input.pipCostAccount > 0
        ? "VERIFIED"
        : "UNVERIFIED",
    value:
      typeof input.pipCostAccount === "number" && Number.isFinite(input.pipCostAccount)
        ? input.pipCostAccount
        : null,
    unit: "account currency per point",
    source: "forexconnect-offers",
    retrievedAtUtc: now,
    environmentScope: "DEMO",
    limitations: "Offers PipCost for connected account currency.",
  };

  const step: EvidenceField<number> = {
    status:
      typeof input.quantityStep === "number" && Number.isFinite(input.quantityStep) && input.quantityStep > 0
        ? "PARTIALLY_VERIFIED"
        : "UNVERIFIED",
    value:
      typeof input.quantityStep === "number" && Number.isFinite(input.quantityStep)
        ? input.quantityStep
        : null,
    unit: "quantity",
    source: "trading-settings lotStep / contract-spec",
    retrievedAtUtc: now,
    environmentScope: "DEMO",
    limitations:
      "Quantity step may come from TradingSettings or local fallback; conflicting min/step must not be silently reconciled.",
  };

  const qMin: EvidenceField<number> = {
    status:
      typeof input.quantityMin === "number" && Number.isFinite(input.quantityMin) && input.quantityMin > 0
        ? "PARTIALLY_VERIFIED"
        : "UNVERIFIED",
    value:
      typeof input.quantityMin === "number" && Number.isFinite(input.quantityMin) ? input.quantityMin : null,
    unit: "quantity",
    source: "trading-settings / contract-spec",
    retrievedAtUtc: now,
    environmentScope: "DEMO",
    limitations: "May disagree with quantityStep; fail closed if inconsistent for sizing.",
  };

  if (input.legacyQuantityUnitLabel && /lot/i.test(input.legacyQuantityUnitLabel)) {
    notes.push(
      `Legacy local label quantityUnit="${input.legacyQuantityUnitLabel}" is display-only and is not used as ounce/lot proof.`,
    );
  }

  // Binding: published 1 contract = 1 oz + DEMO baseUnitSize=1 + contractMultiplier=1 + pipCost≈0.01 alignment.
  const bindingAligned =
    baseUnit.status === "VERIFIED"
    && baseUnit.value === 1
    && mult.status === "VERIFIED"
    && mult.value === 1
    && point.status === "VERIFIED"
    && point.value === 0.01
    && pip.status === "VERIFIED"
    && Math.abs((pip.value as number) - 0.01) < 1e-9;

  const contractBinding: EvidenceField<string> = {
    status: bindingAligned ? "VERIFIED" : "PARTIALLY_VERIFIED",
    value: FXCM_XAU_CONTRACT_SIZE_EVIDENCE.value,
    unit: "contract → troy_ounce",
    source: `${FXCM_XAU_CONTRACT_SIZE_EVIDENCE.source} + DEMO Offers/TradingSettings`,
    retrievedAtUtc: now,
    environmentScope: "MIXED",
    limitations: bindingAligned
      ? "DEMO metadata aligns with published FXCM contract size and $0.01/point help text."
      : "Published contract size exists, but DEMO BaseUnitSize/PointSize/PipCost alignment is incomplete.",
  };

  const quantityUnit: EvidenceField<"contracts" | "unknown"> = {
    status: bindingAligned ? "VERIFIED" : "PARTIALLY_VERIFIED",
    value: bindingAligned ? "contracts" : "unknown",
    unit: bindingAligned ? "FXCM contract (1 oz)" : null,
    source: contractBinding.source,
    retrievedAtUtc: now,
    environmentScope: "MIXED",
    limitations: bindingAligned
      ? "Quantity is treated as FXCM contracts for XAU/USD; 1 contract = 1 troy ounce per published FXCM guide."
      : "Cannot conclusively bind API quantity to ounces without DEMO alignment.",
  };

  // Phase 56.2.6 / 56.4.0 — CondDist is pips per ForexConnect docs; convert via PointSize.
  // Public Enhanced Execution marketing alone never attests account min-stop.
  const attested = resolveCondDistMinStop({
    condDistStop: input.condDistStop,
    condDistAvailable: input.condDistAvailable,
    reportedUnit: input.condDistStopUnit,
    condDistMethod: input.condDistMethod,
    // Trust unit=pips or documented getCondDist* method — never invent from availability alone.
    fromDocumentedSdkMethod:
      input.fromDocumentedSdkMethod === true
      || String(input.condDistStopUnit ?? "").toLowerCase() === "pips",
    fieldKind: "STOP_FOR_TRADE",
    pointSize: point.value,
  });
  notes.push(...attested.notes);

  let minStop: EvidenceField<number | "none_claimed">;
  let minStopDistanceVerified = attested.minStopDistanceVerified;
  let minStopDistanceValue: number | null = attested.minStopDistancePrice;

  if (attested.noPositiveMinimumAttested) {
    minStop = {
      status: "VERIFIED",
      value: "none_claimed",
      unit: "pips→price (CondDist=0)",
      source: attested.condDist.source,
      retrievedAtUtc: now,
      environmentScope: "DEMO",
      limitations: attested.condDist.limitations,
    };
    minStopDistanceValue = null;
  } else if (attested.minStopDistanceVerified && minStopDistanceValue != null) {
    minStop = {
      status: "VERIFIED",
      value: minStopDistanceValue,
      unit: "price (CondDist pips × PointSize)",
      source: attested.condDist.source,
      retrievedAtUtc: now,
      environmentScope: "DEMO",
      limitations: attested.condDist.limitations,
    };
  } else {
    minStop = {
      status: attested.condDist.status === "NOT_AVAILABLE" ? "PARTIALLY_VERIFIED" : attested.condDist.status,
      value: "none_claimed",
      unit: null,
      source: FXCM_XAU_MIN_STOP_PUBLIC_EVIDENCE.source,
      retrievedAtUtc: now,
      environmentScope: "PUBLIC_DOCS",
      limitations:
        FXCM_XAU_MIN_STOP_PUBLIC_EVIDENCE.limitations
        + " "
        + attested.condDist.limitations,
    };
    minStopDistanceVerified = false;
    minStopDistanceValue = null;
  }

  const monetaryRiskAllowed =
    quantityUnit.status === "VERIFIED"
    && !quantityUnitAmbiguousFrom(quantityUnit)
    && (pip.status === "VERIFIED" || mult.status === "VERIFIED")
    && point.status === "VERIFIED";

  const summaryStatus: EvidenceStatus = monetaryRiskAllowed
    ? minStop.status === "VERIFIED"
      ? "VERIFIED"
      : "PARTIALLY_VERIFIED"
    : quantityUnit.status === "PARTIALLY_VERIFIED"
      ? "PARTIALLY_VERIFIED"
      : "UNVERIFIED";

  return {
    instrumentIdentity: identity,
    quantityUnit,
    quantityUnitAmbiguous: quantityUnitAmbiguousFrom(quantityUnit),
    resolvedQuantityUnit: quantityUnit.value === "contracts" ? "contracts" : "unknown",
    contractSizeOunceBinding: contractBinding,
    baseUnitSize: baseUnit,
    contractMultiplier: mult,
    pointSize: point,
    pipCostAccount: pip,
    quantityStep: step,
    quantityMin: qMin,
    minStopDistance: minStop,
    minStopDistanceVerified,
    minStopDistanceValue,
    minStopNoPositiveMinimum: attested.noPositiveMinimumAttested,
    condDistStopPips:
      attested.condDist.unit === "pips" && typeof attested.condDist.rawValue === "number"
        ? attested.condDist.rawValue
        : null,
    condDistUnit: attested.condDist.unit === "pips" ? "pips" : attested.condDist.rawValue != null ? "unknown" : null,
    monetaryRiskAllowed,
    summaryStatus,
    notes,
  };
}

function quantityUnitAmbiguousFrom(
  quantityUnit: EvidenceField<"contracts" | "unknown">,
): boolean {
  return quantityUnit.status !== "VERIFIED" || quantityUnit.value !== "contracts";
}

export function xauSemanticsPublicSummary(r: XauQuantitySemanticsResolution): Record<string, unknown> {
  return {
    summaryStatus: r.summaryStatus,
    quantityUnit: r.quantityUnit.status,
    quantityUnitValue: r.resolvedQuantityUnit,
    quantityUnitAmbiguous: r.quantityUnitAmbiguous,
    contractSizeOunceBinding: r.contractSizeOunceBinding.status,
    baseUnitSize: r.baseUnitSize.value,
    contractMultiplier: r.contractMultiplier.value,
    pointSize: r.pointSize.value,
    pipCostAccount: r.pipCostAccount.value,
    minStopDistance: r.minStopDistance.status,
    minStopDistanceVerified: r.minStopDistanceVerified,
    minStopNoPositiveMinimum: r.minStopNoPositiveMinimum,
    minStopDistancePrice: r.minStopDistanceValue,
    condDistStopPips: r.condDistStopPips,
    condDistUnit: r.condDistUnit,
    monetaryRiskAllowed: r.monetaryRiskAllowed,
    notes: r.notes,
    sources: {
      contractSize: FXCM_XAU_CONTRACT_SIZE_EVIDENCE.source,
      minStopPublic: FXCM_XAU_MIN_STOP_PUBLIC_EVIDENCE.source,
      pipHelp: FXCM_XAU_PIP_HELP_EVIDENCE.source,
      condDistDocs:
        "O2GTradingSettingsProvider.getCondDistStopForTrade — value expressed in pips (ForexConnect 1.6.x)",
    },
  };
}
