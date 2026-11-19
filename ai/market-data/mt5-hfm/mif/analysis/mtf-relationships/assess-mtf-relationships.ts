/**
 * Phase 5C Step 3 — assessMifMultiTimeframeRelationships public entry.
 * Deterministic cross-timeframe analytical relationships. No LLM. No execution.
 */
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import { MIF_SUPPORTED_FIXED_TIMEFRAMES } from "../../quality/multi-timeframe/requirements.js";
import { analyzeConflicts } from "./conflicts.js";
import {
  MIF_MTF_DUPLICATE_TIMEFRAME,
  MIF_MTF_INSUFFICIENT_COVERAGE,
  MIF_MTF_MIXED_INSTRUMENTS,
  MIF_MTF_OK,
  MIF_MTF_POLICY_INVALID,
  MIF_MTF_POLICY_UNAVAILABLE,
  MIF_MTF_SOURCE_DEGRADED,
  MIF_MTF_TIMEBASE_INCOMPARABLE,
  MIF_MTF_UNSUPPORTED_TIMEFRAME,
  MIF_MTF_CONFLICT_PRESERVED,
  type MifMtfRelationshipsReasonCode,
} from "./codes.js";
import {
  MIF_MTF_RELATIONSHIPS_CONTRACT_ID,
  MIF_MTF_RELATIONSHIPS_CONTRACT_VERSION,
  MIF_MTF_RELATIONSHIPS_ENGINE_ID,
  MIF_MTF_RELATIONSHIPS_ENGINE_VERSION,
  MIF_MTF_RELATIONSHIPS_POLICY_ID,
  MIF_MTF_RELATIONSHIPS_POLICY_VERSION,
} from "./contracts.js";
import { analyzeDirectionalRelationships, computeAlignmentScore } from "./directional.js";
import { buildMtfDiagnostics } from "./diagnostics.js";
import { normalizeTimeframeContext, summarizeBand } from "./normalize-context.js";
import { analyzePatternRelationships } from "./pattern-relations.js";
import {
  MIF_POLICY_HFM_MTF_RELATIONSHIPS,
  validateMifMtfRelationshipsPolicy,
  type MifMtfRelationshipsPolicyRegistry,
} from "./policies.js";
import { analyzeRegimeRelationships } from "./regime-relations.js";
import { computeMtfRelationshipsInputIdentity } from "./stable-identity.js";
import type {
  MifMtfAssessmentStatus,
  MifMtfFinding,
  MifMtfRelationshipsAssessment,
  MifMtfRelationshipsPolicy,
  MifMtfTimeframeSources,
} from "./types.js";

export interface AssessMifMultiTimeframeRelationshipsInput {
  /** One entry per timeframe — duplicates blocked. */
  sources: readonly MifMtfTimeframeSources[];
  providerSymbol?: string;
  instrument?: MifCanonicalInstrument | null;
  policy?: MifMtfRelationshipsPolicy | null;
  policyId?: string;
  policyVersion?: string;
  policyRegistry?: MifMtfRelationshipsPolicyRegistry | null;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function resolvePolicy(input: AssessMifMultiTimeframeRelationshipsInput): {
  policy: MifMtfRelationshipsPolicy | null;
  findings: MifMtfFinding[];
} {
  const findings: MifMtfFinding[] = [];
  if (input.policy) {
    const v = validateMifMtfRelationshipsPolicy(input.policy);
    if (!v.ok) {
      findings.push({
        code: MIF_MTF_POLICY_INVALID,
        severity: "blocking",
        message: `invalid policy: ${v.errors.join("; ")}`,
      });
      return { policy: null, findings };
    }
    return { policy: input.policy, findings };
  }
  const policyId = input.policyId ?? MIF_MTF_RELATIONSHIPS_POLICY_ID;
  const policyVersion = input.policyVersion ?? MIF_MTF_RELATIONSHIPS_POLICY_VERSION;
  if (input.policyRegistry) {
    const found = input.policyRegistry.get(policyId, policyVersion);
    if (!found) {
      findings.push({
        code: MIF_MTF_POLICY_UNAVAILABLE,
        severity: "blocking",
        message: `policy ${policyId}@${policyVersion} unavailable`,
      });
      return { policy: null, findings };
    }
    return { policy: found, findings };
  }
  if (policyId === MIF_MTF_RELATIONSHIPS_POLICY_ID && policyVersion === MIF_MTF_RELATIONSHIPS_POLICY_VERSION) {
    return { policy: MIF_POLICY_HFM_MTF_RELATIONSHIPS, findings };
  }
  findings.push({
    code: MIF_MTF_POLICY_UNAVAILABLE,
    severity: "blocking",
    message: `policy ${policyId}@${policyVersion} unavailable (no registry)`,
  });
  return { policy: null, findings };
}

function emptyBand(band: "HIGHER" | "INTERMEDIATE" | "LOWER") {
  return {
    band,
    timeframesPresent: [] as string[],
    timeframesMissing: [] as string[],
    consensusDirection: "UNKNOWN" as const,
    consensusStructure: null,
    agreement: "INSUFFICIENT" as const,
    notes: ["not assessed"],
  };
}

function emptyDirectional() {
  return {
    relation: "INSUFFICIENT_DATA" as const,
    higherDirection: "UNKNOWN" as const,
    intermediateDirection: "UNKNOWN" as const,
    lowerDirection: "UNKNOWN" as const,
    explanation: "not assessed",
    supportingTimeframes: [] as string[],
    opposingTimeframes: [] as string[],
  };
}

/**
 * Assess multi-timeframe analytical relationships from existing MIF assessments.
 */
export function assessMifMultiTimeframeRelationships(
  input: AssessMifMultiTimeframeRelationshipsInput,
): MifMtfRelationshipsAssessment {
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const instrument = input.instrument ?? null;
  const sources = input.sources ?? [];
  const { policy, findings: policyFindings } = resolvePolicy(input);
  const findings: MifMtfFinding[] = [...policyFindings];

  const providerSymbol = String(
    input.providerSymbol
      || sources[0]?.providerSymbol
      || instrument?.providerSymbol
      || "",
  )
    .trim()
    .toUpperCase();

  const buildBlocked = (
    status: MifMtfAssessmentStatus,
    reason: string,
    extraFindings: MifMtfFinding[] = [],
  ): MifMtfRelationshipsAssessment => {
    const allFindings = [...findings, ...extraFindings];
    const policyForId = policy ?? MIF_POLICY_HFM_MTF_RELATIONSHIPS;
    const inputIdentity = computeMtfRelationshipsInputIdentity({
      contractId: MIF_MTF_RELATIONSHIPS_CONTRACT_ID,
      contractVersion: MIF_MTF_RELATIONSHIPS_CONTRACT_VERSION,
      engineId: MIF_MTF_RELATIONSHIPS_ENGINE_ID,
      engineVersion: MIF_MTF_RELATIONSHIPS_ENGINE_VERSION,
      policy: policyForId,
      providerSymbol,
      sources,
      contexts: [],
      directionalRelation: "INSUFFICIENT_DATA",
    });
    return {
      contractId: MIF_MTF_RELATIONSHIPS_CONTRACT_ID,
      contractVersion: MIF_MTF_RELATIONSHIPS_CONTRACT_VERSION,
      scope: "step3-multi-timeframe-relationships",
      assessmentId: input.assessmentId ?? `mtf:${inputIdentity.slice(0, 16)}`,
      inputIdentity,
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      instrument,
      policyId: policy?.policyId ?? null,
      policyVersion: policy?.policyVersion ?? null,
      engineId: MIF_MTF_RELATIONSHIPS_ENGINE_ID,
      engineVersion: MIF_MTF_RELATIONSHIPS_ENGINE_VERSION,
      assessmentTimestamp,
      status,
      contexts: [],
      higherSummary: emptyBand("HIGHER"),
      intermediateSummary: emptyBand("INTERMEDIATE"),
      lowerSummary: emptyBand("LOWER"),
      directional: emptyDirectional(),
      patternRelationships: {
        status: "NONE",
        higherPatternDirs: [],
        lowerPatternDirs: [],
        harmonicOrientationsByTf: {},
        formingVsConfirmed: { forming: 0, confirmed: 0 },
        explanation: "not assessed",
        alignmentComponentScore: null,
      },
      regimeRelationships: {
        status: "INSUFFICIENT",
        higherRegime: null,
        intermediateRegime: null,
        lowerRegime: null,
        volatilitySpread: null,
        explanation: "not assessed",
      },
      conflicts: {
        hasConflict: false,
        conflictKind: "INSUFFICIENT",
        pullbackCompatible: false,
        transitionCompatible: false,
        agreeingTimeframes: [],
        disagreeingTimeframes: [],
        explanation: reason,
      },
      completeness: {
        suppliedTimeframes: [],
        missingRequired: [...(policy?.requiredTimeframes ?? [])],
        missingOptional: [...(policy?.optionalTimeframes ?? [])],
        unsupportedInputs: [],
        coverageRatio: 0,
        coverageIsNotConfidence: true,
      },
      alignmentScore: null,
      alignmentScoreDefinition: "not assessed",
      findings: allFindings,
      warningCodes: allFindings.filter((f) => f.severity === "warning").map((f) => f.code),
      blockingCodes: allFindings.filter((f) => f.severity === "blocking").map((f) => f.code),
      diagnostics: buildMtfDiagnostics({ reason, contexts: [] }),
      diagnosticsSummary: reason,
      explanation: reason,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalMtfInformationOnly: true,
    };
  };

  if (!policy) {
    return buildBlocked("BLOCKED", policyFindings[0]?.message ?? "policy unavailable");
  }

  // Instrument / symbol consistency
  const symbols = new Set<string>();
  if (providerSymbol) symbols.add(providerSymbol);
  for (const s of sources) {
    const sym = String(s.providerSymbol || "").trim().toUpperCase();
    if (sym) symbols.add(sym);
    const fromRegime = s.regime?.providerSymbol;
    const fromHar = s.harmonic?.providerSymbol;
    const fromFib = s.fibonacci?.providerSymbol;
    const fromPat = s.chartPatterns?.providerSymbol;
    for (const x of [fromRegime, fromHar, fromFib, fromPat]) {
      if (x) symbols.add(String(x).trim().toUpperCase());
    }
  }
  if (symbols.size > 1) {
    findings.push({
      code: MIF_MTF_MIXED_INSTRUMENTS,
      severity: "blocking",
      message: `mixed instruments: ${[...symbols].sort().join(",")}`,
    });
    return buildBlocked("BLOCKED", "mixed instruments blocked");
  }

  // Duplicate / unsupported timeframes
  const seen = new Set<string>();
  const unsupported: string[] = [];
  const supported = new Set<string>(MIF_SUPPORTED_FIXED_TIMEFRAMES);
  for (const s of sources) {
    const tf = String(s.timeframe || "").trim();
    if (!tf) continue;
    if (seen.has(tf)) {
      findings.push({
        code: MIF_MTF_DUPLICATE_TIMEFRAME,
        severity: "blocking",
        message: `duplicate timeframe input ${tf}`,
      });
      return buildBlocked("BLOCKED", `duplicate timeframe ${tf}`);
    }
    seen.add(tf);
    if (!supported.has(tf) || !policy.hierarchy.includes(tf)) {
      unsupported.push(tf);
      findings.push({
        code: MIF_MTF_UNSUPPORTED_TIMEFRAME,
        severity: "warning",
        message: `unsupported or out-of-hierarchy timeframe ${tf}`,
      });
    }
  }

  // Timebase comparability — UNKNOWN does not invent conversions; known mixed domains block.
  const timebases = new Set(
    sources
      .map((s) => s.tipTimebase)
      .filter((t): t is NonNullable<typeof t> => t != null),
  );
  const knownTimebases = [...timebases].filter((t) => t !== "UNKNOWN");
  if (new Set(knownTimebases).size > 1) {
    findings.push({
      code: MIF_MTF_TIMEBASE_INCOMPARABLE,
      severity: "blocking",
      message: `mixed tip timebases: ${[...timebases].sort().join(",")}`,
    });
    return buildBlocked("BLOCKED", "mixed tip timebases — refusing cross-TF sync claims");
  }
  if (timebases.has("UNKNOWN")) {
    findings.push({
      code: MIF_MTF_TIMEBASE_INCOMPARABLE,
      severity: "warning",
      message: "tip timebase UNKNOWN on one or more TFs — synchronization claims limited",
    });
  }

  // Normalize contexts in hierarchy order
  const contexts = sources
    .map((s) => normalizeTimeframeContext(s, policy))
    .slice()
    .sort((a, b) => {
      const ia = policy.hierarchy.indexOf(a.timeframe);
      const ib = policy.hierarchy.indexOf(b.timeframe);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

  const higherSummary = summarizeBand("HIGHER", contexts, policy);
  const intermediateSummary = summarizeBand("INTERMEDIATE", contexts, policy);
  const lowerSummary = summarizeBand("LOWER", contexts, policy);

  const directional = analyzeDirectionalRelationships({
    higher: higherSummary,
    intermediate: intermediateSummary,
    lower: lowerSummary,
    contexts,
    policy,
  });
  const patternRelationships = analyzePatternRelationships({ contexts, sources });
  const regimeRelationships = analyzeRegimeRelationships({
    higher: higherSummary,
    intermediate: intermediateSummary,
    lower: lowerSummary,
    contexts,
  });
  const conflicts = analyzeConflicts({
    contexts,
    directional,
    patterns: patternRelationships,
    regimes: regimeRelationships,
  });
  const { score: alignmentScore, definition: alignmentScoreDefinition } = computeAlignmentScore({
    higher: higherSummary,
    intermediate: intermediateSummary,
    lower: lowerSummary,
    policy,
  });

  const supplied = contexts.filter((c) => c.available).map((c) => c.timeframe);
  const missingRequired = policy.requiredTimeframes.filter((tf) => !supplied.includes(tf));
  const missingOptional = policy.optionalTimeframes.filter((tf) => !supplied.includes(tf));
  const requiredCount = policy.requiredTimeframes.length || 1;
  const coverageRatio = (requiredCount - missingRequired.length) / requiredCount;

  if (missingRequired.length) {
    findings.push({
      code: MIF_MTF_INSUFFICIENT_COVERAGE,
      severity: policy.missingRequiredBlocks ? "blocking" : "warning",
      message: `missing required timeframes: ${missingRequired.join(",")}`,
      evidence: { missingRequired: missingRequired.join(",") },
    });
  }

  const degraded = contexts.filter(
    (c) =>
      c.available
      && (c.qualityStatus === "DEGRADED"
        || c.qualityStatus === "BLOCKED"
        || c.tipCandleState === "STALE"
        || c.tipCandleState === "MISSING"),
  );
  if (degraded.length) {
    findings.push({
      code: MIF_MTF_SOURCE_DEGRADED,
      severity: "warning",
      message: `degraded/stale/missing tip quality on: ${degraded.map((d) => d.timeframe).join(",")}`,
    });
  }

  if (conflicts.hasConflict) {
    findings.push({
      code: MIF_MTF_CONFLICT_PRESERVED,
      severity: "info",
      message: conflicts.explanation,
    });
  }

  findings.push({
    code: MIF_MTF_OK,
    severity: "info",
    message: `mtf relation=${directional.relation} — analytical information only`,
  });

  let status: MifMtfAssessmentStatus = "VALID";
  if (missingRequired.length && policy.missingRequiredBlocks) status = "BLOCKED";
  else if (supplied.length === 0) status = "INSUFFICIENT_DATA";
  else if (directional.relation === "INSUFFICIENT_DATA" && supplied.length < 2) {
    status = "INSUFFICIENT_DATA";
  } else if (degraded.some((d) => d.qualityStatus === "DEGRADED")) status = "DEGRADED";
  else if (
    conflicts.hasConflict
    || missingRequired.length
    || timebases.has("UNKNOWN")
    || unsupported.length
  ) {
    status = "WARNING";
  }

  const explanation = [
    directional.explanation,
    regimeRelationships.explanation,
    patternRelationships.explanation,
    conflicts.explanation,
  ].join(" | ");

  const inputIdentity = computeMtfRelationshipsInputIdentity({
    contractId: MIF_MTF_RELATIONSHIPS_CONTRACT_ID,
    contractVersion: MIF_MTF_RELATIONSHIPS_CONTRACT_VERSION,
    engineId: MIF_MTF_RELATIONSHIPS_ENGINE_ID,
    engineVersion: MIF_MTF_RELATIONSHIPS_ENGINE_VERSION,
    policy,
    providerSymbol,
    sources,
    contexts,
    directionalRelation: directional.relation,
  });

  return {
    contractId: MIF_MTF_RELATIONSHIPS_CONTRACT_ID,
    contractVersion: MIF_MTF_RELATIONSHIPS_CONTRACT_VERSION,
    scope: "step3-multi-timeframe-relationships",
    assessmentId: input.assessmentId ?? `mtf:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    instrument,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    engineId: MIF_MTF_RELATIONSHIPS_ENGINE_ID,
    engineVersion: MIF_MTF_RELATIONSHIPS_ENGINE_VERSION,
    assessmentTimestamp,
    status,
    contexts,
    higherSummary,
    intermediateSummary,
    lowerSummary,
    directional,
    patternRelationships,
    regimeRelationships,
    conflicts,
    completeness: {
      suppliedTimeframes: supplied,
      missingRequired,
      missingOptional,
      unsupportedInputs: unsupported,
      coverageRatio: Math.max(0, Math.min(1, coverageRatio)),
      coverageIsNotConfidence: true,
    },
    alignmentScore,
    alignmentScoreDefinition,
    findings,
    warningCodes: findings.filter((f) => f.severity === "warning").map((f) => f.code),
    blockingCodes: findings.filter((f) => f.severity === "blocking").map((f) => f.code),
    diagnostics: buildMtfDiagnostics({
      reason: explanation.slice(0, 240),
      contexts,
    }),
    diagnosticsSummary: explanation.slice(0, 240),
    explanation,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalMtfInformationOnly: true,
  };
}

export type { MifMtfRelationshipsReasonCode };
