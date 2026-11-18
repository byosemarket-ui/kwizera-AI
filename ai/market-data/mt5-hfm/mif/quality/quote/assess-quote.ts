/**
 * Phase 5B.2 Step 2 — scoped quote quality assessment.
 */
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_QUALITY_CONTRACT_ID,
  MIF_QUALITY_CONTRACT_VERSION,
  MIF_QUALITY_STEP2_QUOTE_ENGINE_ID,
  MIF_QUALITY_STEP2_QUOTE_ENGINE_VERSION,
} from "../contracts.js";
import {
  MIF_QI_CLOCK_DOMAINS_INCOMPARABLE,
  MIF_QI_QUOTE_DELAYED,
  MIF_QI_QUOTE_FRESH,
  MIF_QI_QUOTE_FRESHNESS_UNKNOWN,
  MIF_QI_QUOTE_MISSING,
  MIF_QI_QUOTE_STALE,
  MIF_QI_TIMEBASE_UNCERTAIN,
} from "../codes.js";
import { deriveScopedQualityStatus, uniqueFindingCodes } from "../status.js";
import { stableSerialize } from "../stable-identity.js";
import { createHash } from "node:crypto";
import type { MifQualityFinding, MifQualityMetric } from "../types.js";
import {
  assessQuoteClockComparability,
  classifyQuoteFreshness,
  quoteEventTimeUtcSec,
  type MifQuoteFreshnessClass,
} from "./freshness.js";
import { validateQuoteBidAsk } from "./validate-quote.js";
import type { AssessQuoteQualityInput, MifQuoteQualityAssessment } from "./types.js";

function computeQuoteInputIdentity(input: AssessQuoteQualityInput): string {
  const q = input.quote;
  const payload = {
    contractId: MIF_QUALITY_CONTRACT_ID,
    contractVersion: MIF_QUALITY_CONTRACT_VERSION,
    engineId: MIF_QUALITY_STEP2_QUOTE_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP2_QUOTE_ENGINE_VERSION,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    requireQuote: input.requireQuote,
    freshnessProfile: input.freshnessProfile
      ? {
          profileId: input.freshnessProfile.profileId,
          profileVersion: input.freshnessProfile.profileVersion,
          liveMaxAgeSec: input.freshnessProfile.liveMaxAgeSec,
          staleMaxAgeSec: input.freshnessProfile.staleMaxAgeSec,
          allowBrokerServerVsWallClockHeuristic:
            input.freshnessProfile.allowBrokerServerVsWallClockHeuristic,
        }
      : null,
    quote: q
      ? {
          providerId: q.providerId,
          providerSymbol: q.providerSymbol,
          bid: q.bid,
          ask: q.ask,
          spread: q.spread,
          quoteTimestampSec: q.quoteTimestampSec,
          quoteTimestampMs: q.quoteTimestampMs,
          receivedAt: q.receivedAt,
          timebase: q.timebase,
          timezoneOffsetSec: q.timezoneOffsetSec,
          status: q.status,
        }
      : null,
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

export function assessMifQuoteQuality(
  input: AssessQuoteQualityInput,
): MifQuoteQualityAssessment {
  const symbol = String(input.providerSymbol || "").trim().toUpperCase();
  const findings: MifQualityFinding[] = [];
  const profile = input.freshnessProfile ?? null;
  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000);

  let computedSpread: number | null = null;
  let freshness: MifQuoteFreshnessClass = "UNKNOWN";
  let ageSec: number | null = null;
  let clockComparability = null as ReturnType<typeof assessQuoteClockComparability> | null;

  if (input.quote == null) {
    if (input.requireQuote) {
      findings.push({
        code: MIF_QI_QUOTE_MISSING,
        severity: "blocking",
        message: "consumer requires a quote but none was supplied",
      });
    }
  } else {
    const bidAsk = validateQuoteBidAsk(input.quote, symbol);
    findings.push(...bidAsk.findings);
    computedSpread = bidAsk.computedSpread;

    clockComparability = assessQuoteClockComparability({
      quoteTimebase: input.quote.timebase,
      timezoneOffsetSec: input.quote.timezoneOffsetSec,
      quoteTimestampSec: input.quote.quoteTimestampSec,
      profile,
    });

    if (!clockComparability.comparable) {
      if (clockComparability.method === "incomparable") {
        findings.push({
          code: MIF_QI_CLOCK_DOMAINS_INCOMPARABLE,
          severity: "warning",
          message: clockComparability.reason,
          evidence: { timebase: input.quote.timebase },
        });
      }
      if (input.quote.timebase === "UNKNOWN") {
        findings.push({
          code: MIF_QI_TIMEBASE_UNCERTAIN,
          severity: "warning",
          message: "quote timebase UNKNOWN; freshness cannot be claimed",
        });
      }
      findings.push({
        code: MIF_QI_QUOTE_FRESHNESS_UNKNOWN,
        severity: "warning",
        message: "insufficient comparable timestamp evidence for freshness",
      });
      freshness = "UNKNOWN";
    } else if (profile == null) {
      findings.push({
        code: MIF_QI_QUOTE_FRESHNESS_UNKNOWN,
        severity: "info",
        message: "no freshness profile configured; age not classified",
      });
      freshness = "UNKNOWN";
    } else {
      const eventSec = quoteEventTimeUtcSec({
        quoteTimestampSec: input.quote.quoteTimestampSec!,
        timebase: input.quote.timebase,
        timezoneOffsetSec: input.quote.timezoneOffsetSec,
        method: clockComparability.method,
      });
      if (eventSec == null) {
        freshness = "UNKNOWN";
        findings.push({
          code: MIF_QI_QUOTE_FRESHNESS_UNKNOWN,
          severity: "warning",
          message: "could not derive comparable event time",
        });
      } else {
        ageSec = nowSec - eventSec;
        freshness = classifyQuoteFreshness({ ageSec, profile });
        if (freshness === "FRESH") {
          findings.push({
            code: MIF_QI_QUOTE_FRESH,
            severity: "info",
            message: `quote age ${ageSec}s <= liveMax ${profile.liveMaxAgeSec}s (${profile.profileId})`,
            evidence: { ageSec, profileId: profile.profileId },
          });
        } else if (freshness === "DELAYED") {
          findings.push({
            code: MIF_QI_QUOTE_DELAYED,
            severity: "warning",
            message: `quote age ${ageSec}s delayed under ${profile.profileId}`,
            evidence: { ageSec, profileId: profile.profileId },
          });
        } else if (freshness === "STALE") {
          findings.push({
            code: MIF_QI_QUOTE_STALE,
            severity: "degraded",
            message: `quote age ${ageSec}s stale under ${profile.profileId}`,
            evidence: { ageSec, profileId: profile.profileId },
          });
        }
      }
    }
  }

  const status = deriveScopedQualityStatus(findings);
  const inputIdentity = computeQuoteInputIdentity(input);
  const metrics: MifQualityMetric[] = [
    {
      metricId: "quote_present",
      value: input.quote != null,
      unit: "boolean",
      status: input.quote != null ? "ok" : input.requireQuote ? "blocked" : "not_applicable",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
    {
      metricId: "computed_spread",
      value: computedSpread,
      unit: "price",
      status: computedSpread != null ? "ok" : "uncertain",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
    {
      metricId: "quote_age_sec",
      value: ageSec,
      unit: "seconds",
      status: freshness === "UNKNOWN" ? "uncertain" : freshness === "STALE" ? "degraded" : "ok",
      threshold: profile?.liveMaxAgeSec ?? null,
      thresholdSource: profile ? "explicit_consumer" : "none",
      reasonCode: null,
    },
    {
      metricId: "freshness",
      value: freshness,
      unit: "enum",
      status: freshness === "UNKNOWN" ? "uncertain" : freshness === "STALE" ? "degraded" : "ok",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
  ];

  return {
    contractId: MIF_QUALITY_CONTRACT_ID,
    contractVersion: MIF_QUALITY_CONTRACT_VERSION,
    scope: "step2-quote-quality",
    assessmentId: input.assessmentId ?? `step2-quote:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: symbol,
    engineId: MIF_QUALITY_STEP2_QUOTE_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP2_QUOTE_ENGINE_VERSION,
    assessmentTimestamp: input.assessmentTimestamp ?? new Date(nowSec * 1000).toISOString(),
    status,
    requireQuote: input.requireQuote,
    quotePresent: input.quote != null,
    bid: input.quote?.bid ?? null,
    ask: input.quote?.ask ?? null,
    computedSpread,
    declaredSpread: input.quote?.spread ?? null,
    quoteTimestampSec: input.quote?.quoteTimestampSec ?? null,
    receivedAt: input.quote?.receivedAt ?? null,
    timebase: input.quote?.timebase ?? null,
    clockComparability,
    freshnessProfileId: profile?.profileId ?? null,
    freshnessProfileVersion: profile?.profileVersion ?? null,
    freshness,
    ageSec,
    metrics,
    findings,
    warningCodes: uniqueFindingCodes(findings, (f) => f.severity === "warning" || f.severity === "info"),
    blockingCodes: uniqueFindingCodes(findings, (f) => f.severity === "blocking"),
    uncertaintyCodes: uniqueFindingCodes(
      findings,
      (f) =>
        f.code === MIF_QI_QUOTE_FRESHNESS_UNKNOWN ||
        f.code === MIF_QI_TIMEBASE_UNCERTAIN ||
        f.code === MIF_QI_CLOCK_DOMAINS_INCOMPARABLE,
    ),
    diagnosticsSummary: `step2-quote status=${status}; present=${input.quote != null}; freshness=${freshness}; age=${ageSec}`,
    doesNotApproveAiReasoning: true,
    notUnifiedOverallAssessment: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}
