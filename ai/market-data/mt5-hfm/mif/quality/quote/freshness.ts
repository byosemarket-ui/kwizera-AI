/**
 * Phase 5B.2 Step 2 — named quote freshness profiles (not universal thresholds).
 */
import type { MifTimebase } from "../../canonical/types.js";
import {
  MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS_ID,
  MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS_VERSION,
} from "../contracts.js";

export type MifQuoteFreshnessClass = "FRESH" | "DELAYED" | "STALE" | "UNKNOWN";

export interface MifQuoteFreshnessProfile {
  profileId: string;
  profileVersion: string;
  liveMaxAgeSec: number;
  staleMaxAgeSec: number;
  /**
   * When true, age may be computed as wallClockNowSec - quoteTimestampSec even if the
   * quote timebase is BROKER_SERVER without a known UTC offset. This documents Phase 2
   * HFM analysis semantics only — not a universal MIF rule.
   */
  allowBrokerServerVsWallClockHeuristic: boolean;
}

/** Named profile mirroring Phase 2 HFM analysis quote windows (15s / 180s). */
export const MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS: MifQuoteFreshnessProfile = {
  profileId: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS_ID,
  profileVersion: MIF_QUOTE_FRESHNESS_PROFILE_HFM_ANALYSIS_VERSION,
  liveMaxAgeSec: 15,
  staleMaxAgeSec: 180,
  allowBrokerServerVsWallClockHeuristic: true,
};

export interface ClockComparabilityResult {
  comparable: boolean;
  reason: string;
  method: "same_domain" | "trusted_offset" | "heuristic_broker_vs_wall" | "incomparable" | "missing";
}

/**
 * Decide whether quote event time can be compared to an assessment "now" clock.
 * assessmentNow is treated as wall-clock UTC seconds.
 */
export function assessQuoteClockComparability(input: {
  quoteTimebase: MifTimebase;
  timezoneOffsetSec: number | null;
  quoteTimestampSec: number | null;
  profile: MifQuoteFreshnessProfile | null;
}): ClockComparabilityResult {
  if (
    input.quoteTimestampSec == null ||
    !Number.isFinite(input.quoteTimestampSec) ||
    input.quoteTimestampSec <= 0
  ) {
    return { comparable: false, reason: "quote timestamp unavailable", method: "missing" };
  }
  if (input.quoteTimebase === "UTC") {
    return { comparable: true, reason: "quote timebase UTC vs wall-clock UTC", method: "same_domain" };
  }
  if (
    input.quoteTimebase === "BROKER_SERVER" &&
    input.timezoneOffsetSec != null &&
    Number.isFinite(input.timezoneOffsetSec)
  ) {
    return {
      comparable: true,
      reason: "broker server + trusted timezoneOffsetSec",
      method: "trusted_offset",
    };
  }
  if (
    input.quoteTimebase === "BROKER_SERVER" &&
    input.profile?.allowBrokerServerVsWallClockHeuristic === true
  ) {
    return {
      comparable: true,
      reason: "named profile allows broker-server vs wall-clock heuristic",
      method: "heuristic_broker_vs_wall",
    };
  }
  return {
    comparable: false,
    reason: "clock domains incomparable without trusted offset",
    method: "incomparable",
  };
}

export function quoteEventTimeUtcSec(input: {
  quoteTimestampSec: number;
  timebase: MifTimebase;
  timezoneOffsetSec: number | null;
  method: ClockComparabilityResult["method"];
}): number | null {
  if (input.method === "same_domain" || input.method === "heuristic_broker_vs_wall") {
    return input.quoteTimestampSec;
  }
  if (input.method === "trusted_offset" && input.timezoneOffsetSec != null) {
    // broker local epoch + offset → approximate UTC seconds (offset = local - UTC).
    return input.quoteTimestampSec - input.timezoneOffsetSec;
  }
  return null;
}

export function classifyQuoteFreshness(input: {
  ageSec: number | null;
  profile: MifQuoteFreshnessProfile;
}): MifQuoteFreshnessClass {
  if (input.ageSec == null || !Number.isFinite(input.ageSec)) return "UNKNOWN";
  if (input.ageSec <= input.profile.liveMaxAgeSec) return "FRESH";
  if (input.ageSec <= input.profile.staleMaxAgeSec) return "DELAYED";
  return "STALE";
}
