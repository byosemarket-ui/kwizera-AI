/**
 * Phase 09 live quote reliability — reuses bid/ask rules; evidence-based freshness.
 */
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import type { MifResearchReliabilityPolicy } from "./policies.js";
import type { HfmQuoteReliabilityReport, HfmQuoteSnapshotInput } from "./types.js";

export function assessQuoteReliability(input: {
  quote: HfmQuoteSnapshotInput | null | undefined;
  previousQuote?: HfmQuoteSnapshotInput | null;
  recentSpreads?: readonly number[];
  policy: MifResearchReliabilityPolicy;
  validationTimestamp: string;
  nowSec?: number;
}): HfmQuoteReliabilityReport {
  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000);
  const findings: string[] = [];
  const q = input.quote;

  if (!q) {
    return {
      symbol: "UNKNOWN",
      providerId: MIF_PROVIDER_ID,
      classification: "MISSING",
      bid: null,
      ask: null,
      mid: null,
      spread: null,
      spreadValid: false,
      spreadAbnormal: null,
      providerTimestampSec: null,
      receivedAt: null,
      validationTimestamp: input.validationTimestamp,
      ageSec: null,
      httpOkIsNotLive: true,
      findings: ["quote_missing"],
      evidenceKind: "MEASURED",
    };
  }

  const symbol = String(q.symbol || "").trim().toUpperCase();
  const providerRaw = String(q.providerId ?? MIF_PROVIDER_ID).toUpperCase();
  if (providerRaw !== MIF_PROVIDER_ID) {
    findings.push(`PROVIDER_MISMATCH:${providerRaw}`);
  }

  const bid = q.bid;
  const ask = q.ask;
  let spreadValid = false;
  let spread: number | null =
    typeof q.spread === "number" && Number.isFinite(q.spread) ? q.spread : null;
  let classification: HfmQuoteReliabilityReport["classification"] = "INVALID";

  if (bid == null || ask == null || !(bid > 0) || !(ask > 0)) {
    findings.push("invalid_bid_ask");
  } else if (ask + 1e-12 < bid) {
    findings.push("negative_or_inverted_spread");
  } else {
    spreadValid = true;
    if (spread == null) spread = ask - bid;
  }

  const mid =
    typeof q.mid === "number" && Number.isFinite(q.mid)
      ? q.mid
      : bid != null && ask != null && bid > 0 && ask > 0
        ? (bid + ask) / 2
        : null;

  let spreadAbnormal: boolean | null = null;
  if (spreadValid && spread != null && input.recentSpreads && input.recentSpreads.length >= 3) {
    const sorted = [...input.recentSpreads].filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
    if (sorted.length >= 3) {
      const median = sorted[Math.floor(sorted.length / 2)]!;
      if (median > 0 && spread > median * input.policy.spreadWideMultiplier) {
        spreadAbnormal = true;
        findings.push("abnormal_wide_spread");
      } else {
        spreadAbnormal = false;
      }
    }
  }

  const providerTs = q.providerTimestampSec;
  let ageSec: number | null = null;
  if (providerTs == null || !Number.isFinite(providerTs)) {
    findings.push("missing_provider_timestamp");
  } else {
    ageSec = Math.max(0, nowSec - providerTs);
    const freshBand = Math.min(
      input.policy.quoteLiveMaxAgeSec * 4,
      Math.floor(input.policy.quoteStaleMaxAgeSec / 2),
    );
    if (ageSec <= input.policy.quoteLiveMaxAgeSec) classification = "LIVE";
    else if (ageSec <= freshBand) classification = "FRESH";
    else if (ageSec <= input.policy.quoteStaleMaxAgeSec) classification = "STALE";
    else classification = "DELAYED";
  }

  if (findings.includes("invalid_bid_ask") || findings.includes("negative_or_inverted_spread")) {
    classification = "INVALID";
  }
  if (providerRaw !== MIF_PROVIDER_ID) {
    classification = "INVALID";
  }

  // Recovery heuristic: previous missing/invalid, current LIVE/FRESH
  if (
    input.previousQuote
    && (input.previousQuote.bid == null || input.previousQuote.ask == null)
    && (classification === "LIVE" || classification === "FRESH")
  ) {
    classification = "RECOVERING";
    findings.push("recovering_after_missing_quote");
  }

  if (mid != null && input.previousQuote?.bid != null && input.previousQuote?.ask != null) {
    const prevMid = (input.previousQuote.bid + input.previousQuote.ask) / 2;
    if (prevMid > 0) {
      const jump = Math.abs(mid - prevMid) / prevMid;
      if (jump >= input.policy.priceDiscontinuityFrac) {
        findings.push(`price_discontinuity_frac=${jump.toFixed(4)}`);
      }
    }
  }

  if (classification === "LIVE" && ageSec != null && ageSec > input.policy.quoteLiveMaxAgeSec / 2) {
    // still LIVE but note freshness band
    findings.push("live_within_threshold");
  }

  // Map STALE window also allow FRESH label for ages between 0 and live when explicitly requested — keep LIVE only.
  if (classification === "STALE" && ageSec != null && ageSec <= input.policy.quoteLiveMaxAgeSec * 2) {
    // keep STALE
  }

  return {
    symbol,
    providerId: MIF_PROVIDER_ID,
    classification,
    bid,
    ask,
    mid,
    spread,
    spreadValid,
    spreadAbnormal,
    providerTimestampSec: providerTs,
    receivedAt: q.receivedAt,
    validationTimestamp: input.validationTimestamp,
    ageSec,
    httpOkIsNotLive: true,
    findings,
    evidenceKind: "MEASURED",
  };
}
