/**
 * Stage 7.3 — Internal TIF ↔ FXCM adapter capability matrix.
 * Internal acceptance ≠ broker live confirmation.
 * GTD remains explicitly rejected until real broker support is proven.
 */
import { STAGE7_SUPPORTED_TIF, type Stage7SupportedTif } from "./types.js";

export type TifBrokerEvidenceLevel =
  | "INTERNAL_ENUM_ONLY"
  | "ADAPTER_DOCUMENTED"
  | "UNIT_TESTED"
  | "SOURCE_PROBE_DOCUMENTED"
  | "BROKER_LIVE_CONFIRMED";

export interface TifBrokerMappingRow {
  internal: Stage7SupportedTif | "GTD";
  /** Value sent to FXCM OM / ForexConnect when mapped. */
  brokerField: string | null;
  internalAccepted: boolean;
  adapterMappingImplemented: boolean;
  /** True only after an authorized live DEMO OM response confirms the TIF. */
  brokerSupportConfirmed: boolean;
  evidenceLevel: TifBrokerEvidenceLevel;
  silentlyDowngraded: false;
  note: string;
}

/**
 * Documented Stage 6/7 adapter mapping. Broker live confirmation remains false
 * until a separately authorized DEMO probe records OM acceptance evidence.
 */
export function getTifBrokerCapabilityMatrix(): TifBrokerMappingRow[] {
  const rows: TifBrokerMappingRow[] = (STAGE7_SUPPORTED_TIF as readonly Stage7SupportedTif[]).map((tif) => ({
    internal: tif,
    brokerField: tif,
    internalAccepted: true,
    adapterMappingImplemented: true,
    brokerSupportConfirmed: false,
    evidenceLevel: tif === "IOC" ? "SOURCE_PROBE_DOCUMENTED" : "UNIT_TESTED",
    silentlyDowngraded: false,
    note:
      tif === "IOC"
        ? "FXCM OM documented default for TRUE_MARKET_OPEN path; Stage 7 accepts. Live OM confirmation pending authorized DEMO probe."
        : `Mapped 1:1 as broker TIF=${tif} in Stage 6/7 adapter docs/unit tests. Live OM confirmation pending authorized DEMO probe.`,
  }));

  rows.push({
    internal: "GTD",
    brokerField: null,
    internalAccepted: false,
    adapterMappingImplemented: false,
    brokerSupportConfirmed: false,
    evidenceLevel: "INTERNAL_ENUM_ONLY",
    silentlyDowngraded: false,
    note:
      "Explicitly rejected (UNSUPPORTED_TIF_GTD). Never silently converted to GTC. "
      + "Requires proven FXCM GTD+expiry support before any adapter mapping.",
  });

  return rows;
}

export function summarizeTifBrokerGaps(matrix: TifBrokerMappingRow[] = getTifBrokerCapabilityMatrix()): {
  liveUnconfirmed: string[];
  explicitlyRejected: string[];
  allLiveConfirmed: boolean;
} {
  return {
    liveUnconfirmed: matrix
      .filter((r) => r.internalAccepted && !r.brokerSupportConfirmed)
      .map((r) => r.internal),
    explicitlyRejected: matrix.filter((r) => !r.internalAccepted).map((r) => r.internal),
    allLiveConfirmed: matrix
      .filter((r) => r.internalAccepted)
      .every((r) => r.brokerSupportConfirmed),
  };
}
