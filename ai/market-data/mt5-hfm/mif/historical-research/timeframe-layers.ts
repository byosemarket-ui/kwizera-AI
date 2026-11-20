/**
 * Phase 5F STEP 1 — distinguish timeframe layers (not interchangeable).
 */
import {
  HFM_VERIFIED_LIVE_TFS,
  timeframeSeconds,
} from "../../live-candle-engine.js";
import { MIF_PRODUCTION_DEFAULT_TIMEFRAMES } from "../production-integration/contracts.js";

/** Duration math / code-parseable (includes unverified). */
export function isCodeSupportedTimeframe(tf: string): boolean {
  return timeframeSeconds(tf) != null;
}

/** Verified live CopyRates + forming aggregation set — do not silently expand. */
export function isVerifiedLiveTimeframe(tf: string): boolean {
  return (HFM_VERIFIED_LIVE_TFS as readonly string[]).includes(
    String(tf || "").trim().toUpperCase(),
  );
}

/** Default MIF production pack (configured operational set). */
export function isConfiguredMifProductionTimeframe(tf: string): boolean {
  return (MIF_PRODUCTION_DEFAULT_TIMEFRAMES as readonly string[]).includes(
    String(tf || "").trim().toUpperCase() as (typeof MIF_PRODUCTION_DEFAULT_TIMEFRAMES)[number],
  );
}

/**
 * Operationally exportable for research STEP 1:
 * verified-live only (source-proven). Code-supported but unverified TFs
 * are rejected for archive export unless explicitly allowlisted later.
 */
export function isOperationallyExportableTimeframe(tf: string): boolean {
  return isVerifiedLiveTimeframe(tf);
}

export type MifResearchTimeframeLayer =
  | "CODE_SUPPORTED"
  | "VERIFIED_LIVE"
  | "CONFIGURED_MIF_PRODUCTION"
  | "OPERATIONALY_EXPORTABLE"
  | "NOT_SUPPORTED";

export function classifyTimeframeLayer(tf: string): {
  timeframe: string;
  codeSupported: boolean;
  verifiedLive: boolean;
  configuredMifProduction: boolean;
  operationallyExportable: boolean;
  durationSec: number | null;
  layers: MifResearchTimeframeLayer[];
} {
  const timeframe = String(tf || "").trim().toUpperCase();
  const codeSupported = isCodeSupportedTimeframe(timeframe);
  const verifiedLive = isVerifiedLiveTimeframe(timeframe);
  const configuredMifProduction = isConfiguredMifProductionTimeframe(timeframe);
  const operationallyExportable = isOperationallyExportableTimeframe(timeframe);
  const layers: MifResearchTimeframeLayer[] = [];
  if (!codeSupported) layers.push("NOT_SUPPORTED");
  else {
    layers.push("CODE_SUPPORTED");
    if (verifiedLive) layers.push("VERIFIED_LIVE");
    if (configuredMifProduction) layers.push("CONFIGURED_MIF_PRODUCTION");
    if (operationallyExportable) layers.push("OPERATIONALY_EXPORTABLE");
  }
  return {
    timeframe,
    codeSupported,
    verifiedLive,
    configuredMifProduction,
    operationallyExportable,
    durationSec: timeframeSeconds(timeframe),
    layers,
  };
}

export const MIF_RESEARCH_EXPORTABLE_TIMEFRAMES = [
  ...HFM_VERIFIED_LIVE_TFS,
] as const;
