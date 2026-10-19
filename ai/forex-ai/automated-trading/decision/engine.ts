/**
 * Phase 54 — Trading Decision Engine (signal validation only).
 * Evaluates whether an existing BUY/SELL analysis is eligible for review.
 * Never places broker orders. Does not call OpenAI or market-data services.
 */
import { randomUUID } from "node:crypto";
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AutomatedTradingVerificationResult } from "../verification-types.js";
import {
  isVerificationAccountIdentityOk,
  isVerificationMarketQuoteFresh,
} from "../verification-gates.js";
import type { AtOpenAiAnalysisResult } from "../analysis/types.js";
import { AT_CONFIDENCE_LABEL } from "../analysis/types.js";
import {
  AT_DIRECTIONAL_CONFIDENCE_NOTE,
  parseAtBinaryDirection,
  parseAtDirectionalConfidencePct,
} from "../analysis/direction.js";
import { resolveMaxAnalysisAgeMs } from "./policy.js";
import { getAtDecisionStore, type AtDecisionStore } from "./store.js";
import {
  AT_DECISION_CONFIDENCE_LABEL,
  AT_DECISION_CONFIDENCE_NOTE,
  AT_DECISION_PHASE,
  AT_DECISION_SCHEMA,
  type AtDecisionCheck,
  type AtDecisionPolicy,
  type AtDecisionPublicStatus,
  type AtDecisionResult,
} from "./types.js";

function pushCheck(
  checks: AtDecisionCheck[],
  code: string,
  status: AtDecisionCheck["status"],
  message: string,
): void {
  checks.push({ code, status, message });
}

function isAccountIdentityVerified(v: AutomatedTradingVerificationResult | null): boolean {
  return isVerificationAccountIdentityOk(v);
}

function isMarketQuoteFresh(v: AutomatedTradingVerificationResult | null): boolean {
  return isVerificationMarketQuoteFresh(v);
}

function normalizeSymbol(s: string | null | undefined): string {
  return String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export interface AtDecisionEvaluateInput {
  analysis: AtOpenAiAnalysisResult | null;
  /** Newest analysis for the same environment (supersede detection). */
  latestAnalysis: AtOpenAiAnalysisResult | null;
  verification: AutomatedTradingVerificationResult | null;
  currentEnvironment: AutomatedTradingEnvironment;
  currentEnvironmentEpoch: number;
  selectedInstrument: string | null;
  /** Optional expected epoch from client. */
  expectedEnvironmentEpoch?: number | null;
  policy?: AtDecisionPolicy;
  nowMs?: number;
}

export function evaluateTradingDecision(input: AtDecisionEvaluateInput): AtDecisionResult {
  const nowMs = input.nowMs ?? Date.now();
  const decidedAtUtc = new Date(nowMs).toISOString();
  const policy = input.policy ?? getAtDecisionStore().getPolicy();
  const checks: AtDecisionCheck[] = [];
  const blockers: Array<{ code: string; message: string }> = [];
  const rejectionReasons: string[] = [];

  const fail = (code: string, message: string) => {
    pushCheck(checks, code, "FAIL", message);
    blockers.push({ code, message });
    rejectionReasons.push(message);
  };
  const pass = (code: string, message: string) => pushCheck(checks, code, "PASS", message);
  const skip = (code: string, message: string) => pushCheck(checks, code, "SKIPPED", message);

  const analysis = input.analysis;
  let direction: AtDecisionResult["direction"] = null;
  let directionalConfidencePct: number | null = null;
  let instrument: string | null = null;
  let timeframe: string | null = null;
  let forecastHorizon: string | null = null;
  let sourceAnalysisId: string | null = null;
  let sourceEvidenceFingerprint: string | null = null;
  let sourceCreatedAtUtc: string | null = null;
  let environment: AutomatedTradingEnvironment | null = null;
  let environmentEpoch: number | null = null;
  let monitorConfigEpoch: number | null = null;
  let analysisAgeMs: number | null = null;
  let quoteFresh: boolean | null = null;
  let feedStatus: string | null = null;
  let verificationIdentityStatus: string | null = null;
  let historicalOnly: boolean | null = null;
  let chartApplicable = false;
  let chartAvailable: boolean | null = null;
  let chartIncluded: boolean | null = null;
  let chartHash: string | null = null;
  let fingerprintMatch: boolean | null = null;

  const verification = input.verification;
  const accountOk = isAccountIdentityVerified(verification);
  const marketOk = isMarketQuoteFresh(verification);
  quoteFresh = verification ? marketOk : null;
  feedStatus = verification?.market?.feedStatus ?? null;
  verificationIdentityStatus = verification?.identityStatus ?? null;

  if (!analysis) {
    fail("SOURCE_ANALYSIS_MISSING", "No source OpenAI analysis available to validate.");
  } else {
    sourceAnalysisId = analysis.analysisId;
    sourceEvidenceFingerprint = analysis.inputFingerprint || null;
    sourceCreatedAtUtc = analysis.createdAtUtc;
    instrument = analysis.instrument || null;
    timeframe = analysis.primaryTimeframe;
    forecastHorizon = analysis.forecastHorizon;
    environment = analysis.environment;
    environmentEpoch = analysis.environmentEpoch;
    monitorConfigEpoch = analysis.monitorConfigEpoch;
    historicalOnly = analysis.historicalOnly;

    // 1. Lifecycle
    if (analysis.lifecycle === "ANALYSIS_VALID") {
      pass("ANALYSIS_LIFECYCLE", "Source analysis lifecycle is ANALYSIS_VALID.");
    } else if (analysis.lifecycle === "STALE_RESULT") {
      fail("STALE_RESULT", "Source analysis is marked STALE_RESULT (out-of-order / superseded).");
    } else {
      fail(
        "ANALYSIS_NOT_VALID",
        `Source analysis lifecycle is ${analysis.lifecycle} — only ANALYSIS_VALID can be accepted.`,
      );
    }

    // 2. Direction
    const dirParsed = parseAtBinaryDirection(analysis.direction);
    if (dirParsed.ok) {
      direction = dirParsed.direction;
      pass("DIRECTION", `Source direction is ${dirParsed.direction}.`);
    } else {
      fail("DIRECTION_INVALID", dirParsed.message);
    }

    // 3. Confidence range + label
    const confParsed = parseAtDirectionalConfidencePct(analysis.directionalConfidencePct);
    if (confParsed.ok) {
      directionalConfidencePct = confParsed.directionalConfidencePct;
      pass(
        "CONFIDENCE_RANGE",
        `directionalConfidencePct=${confParsed.directionalConfidencePct} (NOT CALIBRATED).`,
      );
    } else {
      fail("CONFIDENCE_INVALID", confParsed.message);
    }
    const noteOk =
      analysis.directionalConfidenceNote === AT_DIRECTIONAL_CONFIDENCE_NOTE
      || analysis.confidenceLabel === AT_CONFIDENCE_LABEL;
    if (noteOk) {
      pass("CONFIDENCE_LABEL", "Confidence is labelled NOT CALIBRATED (not a win probability).");
    } else {
      fail(
        "CONFIDENCE_LABEL_MISSING",
        "Source analysis missing NOT CALIBRATED confidence labelling.",
      );
    }

    // 4. Forecast horizon
    if (analysis.forecastHorizon && String(analysis.forecastHorizon).trim()) {
      pass("FORECAST_HORIZON", "Forecast horizon is present on the source analysis.");
    } else {
      fail("FORECAST_HORIZON_MISSING", "Source analysis is missing forecastHorizon.");
    }

    // 5. Fingerprint
    if (analysis.inputFingerprint && analysis.inputFingerprint !== "none" && analysis.inputFingerprint !== "insufficient") {
      pass("EVIDENCE_FINGERPRINT", `Evidence fingerprint ${analysis.inputFingerprint.slice(0, 12)}…`);
    } else {
      fail("EVIDENCE_FINGERPRINT_MISSING", "Source analysis lacks a usable evidence fingerprint.");
    }

    // 6. Environment / epoch isolation
    if (analysis.environment !== input.currentEnvironment) {
      fail(
        "ENVIRONMENT_MISMATCH",
        `Analysis environment ${analysis.environment} does not match selection ${input.currentEnvironment}.`,
      );
    } else {
      pass("ENVIRONMENT", `Environment matches (${analysis.environment}).`);
    }
    if (analysis.environmentEpoch !== input.currentEnvironmentEpoch) {
      fail(
        "EPOCH_MISMATCH",
        `Analysis environmentEpoch ${analysis.environmentEpoch} ≠ current ${input.currentEnvironmentEpoch}.`,
      );
    } else {
      pass("ENVIRONMENT_EPOCH", `Environment epoch matches (${analysis.environmentEpoch}).`);
    }
    if (
      Number.isFinite(input.expectedEnvironmentEpoch)
      && Math.floor(Number(input.expectedEnvironmentEpoch)) !== input.currentEnvironmentEpoch
    ) {
      fail("STALE_CLIENT_EPOCH", "Client expectedEnvironmentEpoch is stale — refresh and retry.");
    } else if (Number.isFinite(input.expectedEnvironmentEpoch)) {
      pass("CLIENT_EPOCH", "Client environment epoch matches.");
    } else {
      skip("CLIENT_EPOCH", "No expectedEnvironmentEpoch supplied.");
    }

    // 7. Instrument match
    const selected = normalizeSymbol(input.selectedInstrument);
    const analysisInst = normalizeSymbol(analysis.instrument);
    if (!analysisInst) {
      fail("INSTRUMENT_MISSING", "Source analysis has no instrument.");
    } else if (selected && selected !== analysisInst) {
      fail(
        "INSTRUMENT_MISMATCH",
        `Analysis instrument ${analysis.instrument} ≠ selected ${input.selectedInstrument}.`,
      );
    } else {
      pass("INSTRUMENT", `Instrument ${analysis.instrument} consistent with selection.`);
    }

    // Verification instrument consistency when present
    const verifiedSym = normalizeSymbol(verification?.instrument?.symbol);
    if (verifiedSym && analysisInst && verifiedSym !== analysisInst) {
      fail(
        "VERIFICATION_INSTRUMENT_MISMATCH",
        `Verification instrument ${verification?.instrument?.symbol} ≠ analysis ${analysis.instrument}.`,
      );
    } else if (verifiedSym) {
      pass("VERIFICATION_INSTRUMENT", "Verification instrument matches analysis.");
    } else {
      skip("VERIFICATION_INSTRUMENT", "Verification instrument not available.");
    }

    // 8. Superseded / out-of-order
    const latest = input.latestAnalysis;
    if (
      latest
      && latest.analysisId !== analysis.analysisId
      && latest.environment === analysis.environment
      && normalizeSymbol(latest.instrument) === analysisInst
      && Date.parse(latest.createdAtUtc) > Date.parse(analysis.createdAtUtc)
    ) {
      fail(
        "SUPERSEDED",
        `A newer analysis (${latest.analysisId}) exists for this instrument/environment.`,
      );
    } else {
      pass("NOT_SUPERSEDED", "No newer competing analysis for this instrument/environment.");
    }

    // 9. Analysis age / freshness of the analysis itself
    const createdMs = Date.parse(analysis.createdAtUtc);
    if (!Number.isFinite(createdMs)) {
      fail("TIMESTAMP_INVALID", "Source analysis createdAtUtc is not a valid timestamp.");
    } else {
      analysisAgeMs = Math.max(0, nowMs - createdMs);
      const maxAge = resolveMaxAnalysisAgeMs(policy, analysis.primaryTimeframe);
      if (analysisAgeMs > maxAge) {
        fail(
          "ANALYSIS_STALE",
          `Source analysis age ${analysisAgeMs}ms exceeds max ${maxAge}ms.`,
        );
      } else {
        pass("ANALYSIS_AGE", `Analysis age ${analysisAgeMs}ms within ${maxAge}ms limit.`);
      }
    }

    // 10. Data quality / historical-only at analysis time
    if (analysis.historicalOnly || analysis.dataQuality === "HISTORICAL_ONLY" || analysis.dataQuality === "STALE_QUOTE") {
      fail(
        "ANALYSIS_NOT_LIVE",
        `Source analysis is historical/stale (dataQuality=${analysis.dataQuality}, historicalOnly=${analysis.historicalOnly}).`,
      );
    } else if (analysis.dataQuality === "INSUFFICIENT") {
      fail("DATA_QUALITY_INSUFFICIENT", "Source analysis dataQuality is INSUFFICIENT.");
    } else {
      pass("DATA_QUALITY", `dataQuality=${analysis.dataQuality}; historicalOnly=${analysis.historicalOnly}.`);
    }

    // 11. Live verification at decision time
    if (!verification) {
      fail("VERIFICATION_MISSING", "Phase 52 verification is required before accepting a signal.");
    } else {
      if (accountOk) {
        pass("ACCOUNT_IDENTITY", `Account identity verified (${verification.identityStatus}).`);
      } else {
        fail(
          "ACCOUNT_IDENTITY_UNVERIFIED",
          `Account identity not verified (status=${verification.identityStatus}, fresh=${verification.account.isFresh}).`,
        );
      }
      if (verification.environmentMatches === false) {
        fail("VERIFICATION_ENV_MISMATCH", "Verification reports environment mismatch.");
      } else {
        pass("VERIFICATION_ENV", "Verification environment match is acceptable.");
      }
      if (marketOk) {
        pass("QUOTE_FRESH", `Market feed LIVE with Bid/Ask (status=${verification.market.feedStatus}).`);
      } else {
        fail(
          "STALE_QUOTES",
          `Quotes are not LIVE with valid Bid/Ask (feedStatus=${verification.market.feedStatus}).`,
        );
      }
      if (verification.readiness?.readyForTrading) {
        // Should never be true in current phases — hard reject if somehow flipped.
        fail("EXECUTION_READINESS_LEAK", "readyForTrading must remain false — execution is forbidden.");
      } else {
        pass("EXECUTION_DISABLED", "readyForTrading is false — decision does not authorize orders.");
      }
    }

    // 12. Chart / image inclusion when applicable
    const chart = analysis.chartImage;
    chartAvailable = chart?.available ?? null;
    chartIncluded = chart?.includedInOpenAiRequest ?? null;
    chartHash = chart?.imageHash ?? null;
    const monitorBound = analysis.trigger === "scheduled" || analysis.monitorConfigEpoch != null;
    const claimedChart = Boolean(chart?.available);
    chartApplicable = monitorBound || claimedChart;

    if (!chartApplicable) {
      skip(
        "CHART_IMAGE",
        "Chart image not required for this (text-only) analysis path.",
      );
    } else if (!chart || !chart.available) {
      fail("IMAGE_UNAVAILABLE", "Chart image was required/applicable but is unavailable.");
    } else if (!chart.includedInOpenAiRequest) {
      fail(
        "IMAGE_NOT_INCLUDED",
        "Chart image was not included in the successful OpenAI request — cannot accept signal.",
      );
    } else {
      pass("CHART_IMAGE", "Chart image was included in the OpenAI request.");
      if (
        chart.marketDataFingerprint
        && analysis.inputFingerprint
        && chart.marketDataFingerprint !== analysis.inputFingerprint
      ) {
        fingerprintMatch = false;
        fail(
          "CHART_FINGERPRINT_MISMATCH",
          "Chart marketDataFingerprint does not match analysis evidence fingerprint.",
        );
      } else {
        fingerprintMatch = chart.marketDataFingerprint
          ? chart.marketDataFingerprint === analysis.inputFingerprint
          : null;
        if (fingerprintMatch === true) {
          pass("CHART_FINGERPRINT", "Chart fingerprint matches analysis evidence.");
        } else {
          skip("CHART_FINGERPRINT", "Chart fingerprint association not present; image inclusion verified.");
        }
      }
    }

    // 13. Optional confidence threshold (disabled by default)
    if (!policy.confidenceThresholdEnabled) {
      skip(
        "CONFIDENCE_THRESHOLD",
        "Confidence threshold policy is disabled (default) — range check only.",
      );
    } else if (directionalConfidencePct == null) {
      fail("CONFIDENCE_THRESHOLD", "Threshold enabled but confidence value is missing.");
    } else if (directionalConfidencePct < policy.minDirectionalConfidencePct) {
      fail(
        "CONFIDENCE_BELOW_THRESHOLD",
        `Confidence ${directionalConfidencePct}% < configured minimum ${policy.minDirectionalConfidencePct}% (NOT CALIBRATED).`,
      );
    } else {
      pass(
        "CONFIDENCE_THRESHOLD",
        `Confidence ${directionalConfidencePct}% meets minimum ${policy.minDirectionalConfidencePct}% (NOT CALIBRATED).`,
      );
    }

    // BUY/SELL alone is never enough — already enforced by cumulative checks.
    pass(
      "BUY_SELL_NOT_SUFFICIENT",
      "Direction alone does not accept a signal; all safety/data checks must pass.",
    );
  }

  const decisionStatus: AtDecisionResult["decisionStatus"] =
    blockers.length === 0 ? "ACCEPTED_FOR_REVIEW" : "REJECTED";

  return {
    schemaVersion: AT_DECISION_SCHEMA,
    phase: AT_DECISION_PHASE,
    decisionId: randomUUID(),
    decisionStatus,
    direction,
    instrument,
    timeframe,
    forecastHorizon,
    sourceAnalysisId,
    sourceEvidenceFingerprint,
    sourceCreatedAtUtc,
    environment,
    environmentEpoch,
    monitorConfigEpoch,
    directionalConfidencePct,
    directionalConfidenceNote: AT_DECISION_CONFIDENCE_NOTE,
    confidenceLabel: AT_DECISION_CONFIDENCE_LABEL,
    confidenceIsCalibratedWinProbability: false,
    decidedAtUtc,
    checks,
    blockers,
    rejectionReasons,
    freshness: {
      quoteFresh,
      feedStatus,
      verificationIdentityStatus,
      analysisAgeMs,
      historicalOnly,
    },
    verification: {
      present: Boolean(verification),
      environmentMatches: verification?.environmentMatches ?? null,
      accountIdentityVerified: accountOk,
      marketDataHealthVerified: marketOk,
      readyForTrading: false,
    },
    chartImage: {
      applicable: chartApplicable,
      available: chartAvailable,
      includedInOpenAiRequest: chartIncluded,
      imageHash: chartHash,
      fingerprintMatch,
    },
    policySnapshot: {
      confidenceThresholdEnabled: policy.confidenceThresholdEnabled,
      minDirectionalConfidencePct: policy.confidenceThresholdEnabled
        ? policy.minDirectionalConfidencePct
        : null,
      maxAnalysisAgeMs: policy.maxAnalysisAgeMs,
    },
    placesOrders: false,
    acceptsForExecution: false,
  };
}

export class AtDecisionEngine {
  private readonly store: AtDecisionStore;

  constructor(deps?: { store?: AtDecisionStore; storageRoot?: string }) {
    this.store = deps?.store ?? getAtDecisionStore(deps?.storageRoot);
  }

  getPolicy(): AtDecisionPolicy {
    return this.store.getPolicy();
  }

  async updatePolicy(patch: Partial<AtDecisionPolicy>): Promise<AtDecisionPolicy> {
    const current = this.store.getPolicy();
    return this.store.setPolicy({
      ...current,
      ...patch,
      schemaVersion: "at-decision-policy-v1",
      updatedAtUtc: new Date().toISOString(),
      updatedBy: "admin",
    });
  }

  getLatest(): AtDecisionResult | null {
    return this.store.latest();
  }

  getById(id: string): AtDecisionResult | null {
    return this.store.get(id);
  }

  listHistory(limit = 12): AtDecisionResult[] {
    return this.store.list(limit);
  }

  async publicStatus(): Promise<AtDecisionPublicStatus> {
    return {
      phase: AT_DECISION_PHASE,
      schemaVersion: AT_DECISION_SCHEMA,
      policy: this.store.getPolicy(),
      latest: this.store.latest(),
      historyCount: this.store.count(),
      placesOrders: false,
      acceptsForExecution: false,
      note:
        "Phase 54 validates whether a BUY/SELL analysis is eligible for human review only. "
        + "It never places broker orders. Confidence remains NOT CALIBRATED.",
    };
  }

  async evaluateAndPersist(input: AtDecisionEvaluateInput): Promise<AtDecisionResult> {
    const result = evaluateTradingDecision({
      ...input,
      policy: input.policy ?? this.store.getPolicy(),
    });
    await this.store.save(result);
    return result;
  }
}

let engineSingleton: AtDecisionEngine | null = null;

export function getAtDecisionEngine(storageRoot?: string): AtDecisionEngine {
  if (storageRoot) return new AtDecisionEngine({ storageRoot });
  if (!engineSingleton) engineSingleton = new AtDecisionEngine();
  return engineSingleton;
}

export function resetAtDecisionEngineForTests(): void {
  engineSingleton = null;
}
