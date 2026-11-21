/**
 * Phase 6 — compact public summaries of Phase 2–4 packages for Charts UI.
 * Read-only. No OHLC arrays, image bytes, or secrets.
 */
import type { MifMarketEvidencePackage, MifUnifiedMarketEvidence } from "../mif/market-evidence/types.js";
import type { MifOrchestrationResult } from "../mif/orchestration/types.js";
import type {
  MifDirectionalScenario,
  MifScenarioPackage,
} from "../mif/scenario-intelligence/types.js";

export const HFM_INTELLIGENCE_PUBLIC_MAX_EVIDENCE = 80;
const MAX_NOTE = 240;

function clip(s: unknown, n = MAX_NOTE): string {
  const t = String(s ?? "");
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function summarizeEvidenceItem(e: MifUnifiedMarketEvidence): Record<string, unknown> {
  return {
    evidenceId: e.evidenceId,
    evidenceType: e.evidenceType,
    direction: e.direction,
    timeframe: e.timeframe,
    sourceEngine: e.sourceEngine,
    engineVersion: e.engineVersion,
    candleStatus: e.candleStatus,
    observedAt: e.observedAt,
    eventTime: e.eventTime,
    levels: (e.levels ?? []).slice(0, 12).map((lv) => ({
      id: lv.id,
      kind: lv.kind,
      price: lv.price,
      side: lv.side,
      note: lv.note != null ? clip(lv.note, 80) : null,
    })),
    supportingEvidenceIds: e.supportingEvidenceIds ?? [],
    conflictingEvidenceIds: e.conflictingEvidenceIds ?? [],
    warnings: (e.warnings ?? []).slice(0, 6).map((w) => clip(w, 120)),
    limitations: (e.limitations ?? []).slice(0, 6).map((w) => clip(w, 120)),
    score: e.score
      ? {
          confidenceType: e.score.confidenceType,
          value: e.score.value,
          isWinProbability: e.score.isWinProbability,
          definition: clip(e.score.definition, 120),
        }
      : null,
    provenance: {
      sourceAssessmentId: e.provenance?.sourceAssessmentId ?? null,
      snapshotId: e.provenance?.snapshotId ?? null,
      snapshotIdSourceVerified: e.provenance?.snapshotIdSourceVerified ?? false,
      sourceFingerprint: e.provenance?.sourceFingerprint ?? null,
    },
  };
}

function summarizeScenario(s: MifDirectionalScenario): Record<string, unknown> {
  return {
    scenarioId: s.scenarioId,
    setupFingerprint: s.setupFingerprint,
    side: s.side,
    status: s.status,
    lifecycleState: s.lifecycleState,
    thesis: clip(s.thesis, 400),
    rationale: clip(s.rationale, 400),
    supportingEvidenceIds: [...(s.supportingEvidenceIds ?? [])],
    conflictingEvidenceIds: [...(s.conflictingEvidenceIds ?? [])],
    missingConfirmations: (s.missingConfirmations ?? []).map((x) => clip(x)),
    invalidationConditions: (s.invalidationConditions ?? []).map((x) => clip(x)),
    contributingCandidateIds: [...(s.contributingCandidateIds ?? [])].slice(0, 20),
    levels: {
      status: s.levels.status,
      entry: s.levels.entry,
      invalidation: s.levels.invalidation,
      targets: s.levels.targets,
      riskReward: s.levels.riskReward,
      notes: (s.levels.notes ?? []).map((n) => clip(n)),
    },
    evidenceCompleteness: s.evidenceCompleteness,
    warnings: (s.warnings ?? []).map((w) => clip(w)),
    assessmentTimestamp: s.assessmentTimestamp,
    snapshotId: s.snapshotId,
    snapshotIdSourceVerified: s.snapshotIdSourceVerified,
  };
}

export type HfmPackageIdentityCheck =
  | { ok: true; warnings: string[] }
  | { ok: false; code: string; message: string; warnings: string[] };

export function verifyPackageSnapshotIdentity(input: {
  requestedSnapshotId: string;
  expectedSymbol?: string | null;
  packageSnapshotId: string | null | undefined;
  packageSymbol: string | null | undefined;
}): HfmPackageIdentityCheck {
  const requested = String(input.requestedSnapshotId ?? "").trim();
  const warnings: string[] = [];
  if (!requested) {
    return { ok: false, code: "SNAPSHOT_REQUIRED", message: "snapshotId required", warnings };
  }
  if (input.packageSnapshotId != null && String(input.packageSnapshotId) !== requested) {
    return {
      ok: false,
      code: "SNAPSHOT_MISMATCH",
      message: `Package snapshotId ${input.packageSnapshotId} does not match requested ${requested}`,
      warnings,
    };
  }
  if (input.packageSnapshotId == null) {
    warnings.push("package_snapshot_id_absent");
  }
  const expected = String(input.expectedSymbol ?? "").trim().toUpperCase();
  if (expected && input.packageSymbol) {
    if (String(input.packageSymbol).toUpperCase() !== expected) {
      return {
        ok: false,
        code: "SYMBOL_MISMATCH",
        message: `Package symbol ${input.packageSymbol} does not match expected ${expected}`,
        warnings,
      };
    }
  }
  return { ok: true, warnings };
}

export function buildPublicIntelligenceSummary(input: {
  snapshotId: string;
  expectedSymbol?: string | null;
  orchestration: unknown | null;
}): {
  ok: boolean;
  found: boolean;
  status: "COMPLETE" | "PARTIAL" | "FAILED" | "SKIPPED" | "NOT_FOUND" | "MISMATCH";
  code?: string;
  message?: string;
  summary: Record<string, unknown> | null;
} {
  const raw = input.orchestration;
  if (raw == null) {
    return {
      ok: false,
      found: false,
      status: "NOT_FOUND",
      code: "INTELLIGENCE_NOT_FOUND",
      message: "No intelligence orchestration for this snapshotId",
      summary: null,
    };
  }
  if (!isObj(raw) || typeof (raw as MifOrchestrationResult).snapshotId !== "string") {
    return {
      ok: false,
      found: true,
      status: "FAILED",
      code: "INTELLIGENCE_MALFORMED",
      message: "Intelligence artifact is malformed",
      summary: null,
    };
  }
  const orch = raw as MifOrchestrationResult;
  const idCheck = verifyPackageSnapshotIdentity({
    requestedSnapshotId: input.snapshotId,
    expectedSymbol: input.expectedSymbol,
    packageSnapshotId: orch.snapshotId,
    packageSymbol: orch.providerSymbol,
  });
  if (!idCheck.ok) {
    return {
      ok: false,
      found: true,
      status: "MISMATCH",
      code: idCheck.code,
      message: idCheck.message,
      summary: null,
    };
  }

  const evidencePkg = orch.evidencePackage as MifMarketEvidencePackage | null;
  const items = evidencePkg?.items ?? [];
  const truncated = items.length > HFM_INTELLIGENCE_PUBLIC_MAX_EVIDENCE;
  const bounded = items.slice(0, HFM_INTELLIGENCE_PUBLIC_MAX_EVIDENCE);

  const summary = {
    snapshotId: orch.snapshotId,
    snapshotHash: orch.snapshotHash,
    snapshotIdSourceVerified: orch.snapshotIdSourceVerified,
    providerId: orch.providerId,
    providerSymbol: orch.providerSymbol,
    orchestrationStatus: orch.orchestrationStatus,
    correlationId: orch.correlationId,
    mifRequestId: orch.mifRequestId,
    mifRunId: orch.mifRunId,
    evidencePackageId: orch.evidencePackageId ?? evidencePkg?.packageId ?? null,
    scenarioPackageId: orch.scenarioPackageId ?? null,
    timeframePack: orch.timeframePack,
    candleTipStates: orch.candleTipStates,
    completeness: orch.completeness,
    warnings: [...(orch.warnings ?? []), ...idCheck.warnings].map((w) => clip(w)),
    failureReason: orch.failureReason,
    timingsMs: orch.timingsMs,
    capturedAt: orch.capturedAt,
    evidence: evidencePkg
      ? {
          packageId: evidencePkg.packageId,
          contractId: evidencePkg.contractId,
          contractVersion: evidencePkg.contractVersion,
          itemCount: bounded.length,
          totalAvailable: items.length,
          truncated,
          assembledAt: evidencePkg.assembledAt,
          snapshotIdSourceVerified: evidencePkg.snapshotIdSourceVerified,
          warnings: (evidencePkg.warnings ?? []).map((w) => clip(w)),
          limitations: (evidencePkg.limitations ?? []).map((w) => clip(w)),
          items: bounded.map(summarizeEvidenceItem),
        }
      : null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };

  const status =
    orch.orchestrationStatus === "COMPLETE"
    || orch.orchestrationStatus === "PARTIAL"
    || orch.orchestrationStatus === "FAILED"
    || orch.orchestrationStatus === "SKIPPED"
      ? orch.orchestrationStatus
      : "PARTIAL";

  return { ok: true, found: true, status, summary };
}

export function buildPublicScenarioSummary(input: {
  snapshotId: string;
  expectedSymbol?: string | null;
  scenarioPackage: unknown | null;
}): {
  ok: boolean;
  found: boolean;
  status: "AVAILABLE" | "PARTIAL" | "NOT_FOUND" | "MISMATCH" | "MALFORMED";
  code?: string;
  message?: string;
  summary: Record<string, unknown> | null;
} {
  const raw = input.scenarioPackage;
  if (raw == null) {
    return {
      ok: false,
      found: false,
      status: "NOT_FOUND",
      code: "SCENARIO_NOT_FOUND",
      message: "No scenario package for this snapshotId",
      summary: null,
    };
  }
  if (
    !isObj(raw)
    || typeof (raw as MifScenarioPackage).packageId !== "string"
    || !(raw as MifScenarioPackage).bullishScenario
    || !(raw as MifScenarioPackage).bearishScenario
  ) {
    return {
      ok: false,
      found: true,
      status: "MALFORMED",
      code: "SCENARIO_MALFORMED",
      message: "Scenario package is malformed",
      summary: null,
    };
  }
  const pkg = raw as MifScenarioPackage;
  const idCheck = verifyPackageSnapshotIdentity({
    requestedSnapshotId: input.snapshotId,
    expectedSymbol: input.expectedSymbol,
    packageSnapshotId: pkg.snapshotId,
    packageSymbol: pkg.providerSymbol,
  });
  if (!idCheck.ok) {
    return {
      ok: false,
      found: true,
      status: "MISMATCH",
      code: idCheck.code,
      message: idCheck.message,
      summary: null,
    };
  }

  const summary = {
    snapshotId: pkg.snapshotId,
    snapshotHash: pkg.snapshotHash,
    snapshotIdSourceVerified: pkg.snapshotIdSourceVerified,
    packageId: pkg.packageId,
    contractId: pkg.contractId,
    contractVersion: pkg.contractVersion,
    engineId: pkg.engineId,
    engineVersion: pkg.engineVersion,
    providerId: pkg.providerId,
    providerSymbol: pkg.providerSymbol,
    assessmentTimestamp: pkg.assessmentTimestamp,
    outcome: pkg.outcome,
    strongerSide: pkg.strongerSide,
    comparisonExplanation: clip(pkg.comparisonExplanation, 400),
    completenessTrusted: pkg.completenessTrusted,
    warnings: [...(pkg.warnings ?? []), ...idCheck.warnings].map((w) => clip(w)),
    timeframeContext: pkg.timeframeContext,
    bullishScenario: summarizeScenario(pkg.bullishScenario),
    bearishScenario: summarizeScenario(pkg.bearishScenario),
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };

  return {
    ok: true,
    found: true,
    status: pkg.completenessTrusted ? "AVAILABLE" : "PARTIAL",
    summary,
  };
}
