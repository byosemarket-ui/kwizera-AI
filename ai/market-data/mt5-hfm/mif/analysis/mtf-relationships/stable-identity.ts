/**
 * Phase 5C Step 3 — deterministic MTF relationships identities (excludes wall-clock).
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../../quality/stable-identity.js";
import type { MifMtfNormalizedContext, MifMtfRelationshipsPolicy, MifMtfTimeframeSources } from "./types.js";

function sourceSlice(s: MifMtfTimeframeSources): Record<string, unknown> {
  return {
    timeframe: s.timeframe,
    providerSymbol: String(s.providerSymbol || "").trim().toUpperCase(),
    tipCandleState: s.tipCandleState ?? null,
    tipTimebase: s.tipTimebase ?? null,
    tipOpenTimeSec: s.tipOpenTimeSec ?? null,
    qualityStatus: s.qualityStatus ?? null,
    regimeId: s.regime?.assessmentId ?? null,
    regimeIdentity: s.regime?.inputIdentity ?? null,
    harmonicId: s.harmonic?.assessmentId ?? null,
    fibonacciId: s.fibonacci?.assessmentId ?? null,
    patternsId: s.chartPatterns?.assessmentId ?? null,
    unifiedId: s.unified?.assessmentId ?? null,
  };
}

export function computeMtfRelationshipsInputIdentity(input: {
  contractId: string;
  contractVersion: string;
  engineId: string;
  engineVersion: string;
  policy: MifMtfRelationshipsPolicy;
  providerSymbol: string;
  sources: readonly MifMtfTimeframeSources[];
  contexts: Array<Pick<MifMtfNormalizedContext, "timeframe" | "direction" | "structure" | "available">>;
  directionalRelation: string;
}): string {
  const payload = {
    contractId: input.contractId,
    contractVersion: input.contractVersion,
    engineId: input.engineId,
    engineVersion: input.engineVersion,
    policyId: input.policy.policyId,
    policyVersion: input.policy.policyVersion,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    sources: input.sources
      .map(sourceSlice)
      .slice()
      .sort((a, b) => String(a.timeframe).localeCompare(String(b.timeframe))),
    contexts: input.contexts
      .map((c) => ({
        timeframe: c.timeframe,
        direction: c.direction,
        structure: c.structure,
        available: c.available,
      }))
      .slice()
      .sort((a, b) => a.timeframe.localeCompare(b.timeframe)),
    directionalRelation: input.directionalRelation,
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}
