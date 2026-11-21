/**
 * Stable setup fingerprint + scenarioId — excludes assessment timestamps.
 * Continuity across Analyze Now snapshots for the same underlying setup.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../quality/stable-identity.js";
import type { MifOpportunityCandidate } from "../opportunity-detection/types.js";
import type { MifScenarioDirection } from "./types.js";

function parseLevelToken(conditions: readonly string[], key: string): number | null {
  const re = new RegExp(`^${key}=([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)$`);
  for (const raw of conditions) {
    const m = String(raw).trim().match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function roundLevel(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Build a stable fingerprint from symbol, direction, strategies, and source-backed levels.
 * Does NOT include assessmentTimestamp or snapshotId.
 */
export function computeSetupFingerprint(input: {
  providerSymbol: string;
  side: MifScenarioDirection;
  strategyIds: readonly string[];
  candidates: readonly MifOpportunityCandidate[];
}): string {
  const levels = {
    entries: [] as number[],
    invalidations: [] as number[],
    targets: [] as number[],
  };
  const assessmentKeys = new Set<string>();
  for (const c of input.candidates) {
    const e = parseLevelToken(c.invalidationConditions, "entryPrice");
    const inv = parseLevelToken(c.invalidationConditions, "invalidationPrice");
    const t = parseLevelToken(c.invalidationConditions, "targetPrice");
    const er = roundLevel(e);
    const ir = roundLevel(inv);
    const tr = roundLevel(t);
    if (er != null) levels.entries.push(er);
    if (ir != null) levels.invalidations.push(ir);
    if (tr != null) levels.targets.push(tr);
    for (const id of c.supportingEvidenceIds) assessmentKeys.add(id);
  }
  levels.entries.sort((a, b) => a - b);
  levels.invalidations.sort((a, b) => a - b);
  levels.targets.sort((a, b) => a - b);

  const payload = {
    providerId: "HFM_MT5",
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    side: input.side,
    strategyIds: [...new Set(input.strategyIds.map(String))].sort(),
    levels,
    // Stable evidence identity refs only (ids), not timestamps
    supportingEvidenceIds: [...assessmentKeys].sort(),
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

/**
 * Deterministic scenarioId from fingerprint (not a new random id per snapshot).
 */
export function computeScenarioId(input: {
  setupFingerprint: string;
  side: MifScenarioDirection;
}): string {
  const payload = {
    kind: "mif.scenario.v1",
    setupFingerprint: input.setupFingerprint,
    side: input.side,
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

export function computeScenarioPackageId(input: {
  providerSymbol: string;
  snapshotId: string | null;
  bullishFingerprint: string;
  bearishFingerprint: string;
}): string {
  const payload = {
    kind: "mif.scenario-package.v1",
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    snapshotId: input.snapshotId,
    bullishFingerprint: input.bullishFingerprint,
    bearishFingerprint: input.bearishFingerprint,
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}
