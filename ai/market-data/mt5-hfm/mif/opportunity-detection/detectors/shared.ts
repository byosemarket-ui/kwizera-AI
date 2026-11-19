/**
 * Phase 5D Step 3 — shared read-only helpers for strategy detectors.
 * Never mutates context or source assessments.
 */
import type { MifMtfDirectionalRelation } from "../../analysis/mtf-relationships/types.js";
import type { MifRegimeDirection, MifRegimeStructure, MifRegimeVolatility } from "../../analysis/regime/types.js";
import type {
  MifDetectionEvidenceRef,
  MifOpportunityDetectionContext,
} from "../types.js";
import type { MifEvidenceFamily } from "../../strategy-intelligence/types.js";

export interface ResolvedRegimeView {
  direction: MifRegimeDirection;
  structure: MifRegimeStructure;
  volatility: MifRegimeVolatility;
  assessmentId: string | null;
  status: string | null;
  source: "assessment" | "evidenceSummary" | "absent";
}

export interface ResolvedMtfView {
  relation: MifMtfDirectionalRelation;
  higherDirection: "UP" | "DOWN" | "NEUTRAL" | "UNKNOWN";
  intermediateDirection: "UP" | "DOWN" | "NEUTRAL" | "UNKNOWN";
  lowerDirection: "UP" | "DOWN" | "NEUTRAL" | "UNKNOWN";
  pullbackCompatible: boolean;
  hasConflict: boolean;
  conflictKind: string | null;
  alignmentScore: number | null;
  assessmentId: string | null;
  status: string | null;
  source: "assessment" | "evidenceNotes" | "absent";
  explanation: string;
}

const RELATION_SET = new Set<string>([
  "ALIGNMENT",
  "PARTIAL_ALIGNMENT",
  "CONFLICT",
  "COUNTERTREND_PULLBACK",
  "POTENTIAL_REVERSAL",
  "TRANSITION",
  "INSUFFICIENT_DATA",
  "UNKNOWN",
]);

/** Parse `key=VALUE` tokens from evidence notes (case-insensitive key). */
export function noteValue(notes: string | undefined, key: string): string | null {
  if (!notes) return null;
  const m = new RegExp(`(?:^|[;,]\\s*)${key}\\s*=\\s*([A-Za-z0-9_]+)`, "i").exec(notes);
  return m ? m[1]!.toUpperCase() : null;
}

export function findEvidenceById(
  ctx: MifOpportunityDetectionContext,
  evidenceId: string,
): MifDetectionEvidenceRef | undefined {
  return ctx.evidence.find((e) => e.evidenceId === evidenceId);
}

export function findEvidenceByFamily(
  ctx: MifOpportunityDetectionContext,
  family: MifEvidenceFamily,
): MifDetectionEvidenceRef | undefined {
  return ctx.evidence.find((e) => e.family === family);
}

export function isPresentUsable(e: MifDetectionEvidenceRef | undefined): boolean {
  if (!e) return false;
  if (e.presence !== "PRESENT") return false;
  if (e.qualityStatus === "BLOCKED" || e.qualityStatus === "MISSING") return false;
  return true;
}

export function resolveRegimeView(ctx: MifOpportunityDetectionContext): ResolvedRegimeView {
  if (ctx.regime) {
    return {
      direction: ctx.regime.direction,
      structure: ctx.regime.structure,
      volatility: ctx.regime.volatility,
      assessmentId: ctx.regime.assessmentId,
      status: ctx.regime.status,
      source: "assessment",
    };
  }
  if (ctx.evidenceSummary) {
    return {
      direction: (ctx.evidenceSummary.regimeDirection ?? "UNKNOWN") as MifRegimeDirection,
      structure: (ctx.evidenceSummary.regimeStructure ?? "UNKNOWN") as MifRegimeStructure,
      volatility: (ctx.evidenceSummary.regimeVolatility ?? "UNKNOWN") as MifRegimeVolatility,
      assessmentId: null,
      status: null,
      source: "evidenceSummary",
    };
  }
  return {
    direction: "UNKNOWN",
    structure: "UNKNOWN",
    volatility: "UNKNOWN",
    assessmentId: null,
    status: null,
    source: "absent",
  };
}

function parseRelationFromNotes(notes: string | undefined): MifMtfDirectionalRelation | null {
  if (!notes) return null;
  const m = /(?:^|[;,\s])relation\s*=\s*([A-Z_]+)/i.exec(notes);
  if (!m) return null;
  const rel = m[1]!.toUpperCase();
  return RELATION_SET.has(rel) ? (rel as MifMtfDirectionalRelation) : null;
}

export function resolveMtfView(
  ctx: MifOpportunityDetectionContext,
  preferredEvidenceIds: readonly string[] = ["tc.mtf", "pb.mtf", "rv.mtf", "bo.mtf"],
): ResolvedMtfView {
  const mtf = ctx.mtfRelationships;
  if (mtf) {
    return {
      relation: mtf.directional.relation,
      higherDirection: mtf.directional.higherDirection,
      intermediateDirection: mtf.directional.intermediateDirection,
      lowerDirection: mtf.directional.lowerDirection,
      pullbackCompatible: mtf.conflicts.pullbackCompatible,
      hasConflict: mtf.conflicts.hasConflict,
      conflictKind: mtf.conflicts.conflictKind,
      alignmentScore: mtf.alignmentScore,
      assessmentId: mtf.assessmentId,
      status: mtf.status,
      source: "assessment",
      explanation: mtf.directional.explanation || mtf.explanation,
    };
  }

  let mtfEv: MifDetectionEvidenceRef | undefined;
  for (const id of preferredEvidenceIds) {
    const hit = findEvidenceById(ctx, id);
    if (hit) {
      mtfEv = hit;
      break;
    }
  }
  if (!mtfEv) {
    mtfEv = findEvidenceByFamily(ctx, "MULTI_TIMEFRAME_RELATIONSHIP");
  }
  const fromNotes = parseRelationFromNotes(mtfEv?.notes);
  if (fromNotes) {
    const pullbackCompatible = fromNotes === "COUNTERTREND_PULLBACK"
      || /pullbackCompatible\s*=\s*true/i.test(mtfEv?.notes ?? "");
    return {
      relation: fromNotes,
      higherDirection: "UNKNOWN",
      intermediateDirection: "UNKNOWN",
      lowerDirection: "UNKNOWN",
      pullbackCompatible,
      hasConflict: fromNotes === "CONFLICT" || fromNotes === "POTENTIAL_REVERSAL",
      conflictKind: fromNotes === "POTENTIAL_REVERSAL" ? "DIRECTIONAL" : fromNotes === "CONFLICT" ? "DIRECTIONAL" : "NONE",
      alignmentScore: null,
      assessmentId: mtfEv?.sourceAssessmentId ?? null,
      status: mtfEv?.qualityStatus ?? null,
      source: "evidenceNotes",
      explanation: `MTF relation from evidence notes: ${fromNotes}`,
    };
  }

  return {
    relation: "UNKNOWN",
    higherDirection: "UNKNOWN",
    intermediateDirection: "UNKNOWN",
    lowerDirection: "UNKNOWN",
    pullbackCompatible: false,
    hasConflict: false,
    conflictKind: null,
    alignmentScore: null,
    assessmentId: null,
    status: null,
    source: "absent",
    explanation: "MTF assessment unavailable",
  };
}

export function collectOptionalMissingWarnings(
  ctx: MifOpportunityDetectionContext,
  optionalIds: readonly string[],
): string[] {
  const warnings: string[] = [];
  for (const id of optionalIds) {
    const e = findEvidenceById(ctx, id);
    if (!e || e.presence === "ABSENT") {
      warnings.push(`optional evidence missing: ${id}`);
    }
  }
  return warnings;
}
