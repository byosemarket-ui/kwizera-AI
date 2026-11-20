/**
 * Phase 5E Step 1 — evidence provenance + double-count prevention.
 * Multiple refs to the same underlying assessment count once.
 * Correlated family groups share a contribution slot.
 */
import type { MifDetectionEvidenceRef } from "../opportunity-detection/types.js";
import type { MifEvidenceFamily } from "../strategy-intelligence/types.js";
import type { MifEvidenceContribution, MifEvidencePolarity, MifRankingPolicy } from "./types.js";

export function provenanceKey(ev: MifDetectionEvidenceRef): string {
  if (ev.sourceAssessmentId) return `assess:${ev.sourceAssessmentId}`;
  if (ev.sourceInputIdentity) return `input:${ev.sourceInputIdentity}`;
  if (ev.sourceContractId && ev.sourceEngine) {
    return `engine:${ev.sourceEngine}:${ev.sourceContractId}:${ev.evidenceId}`;
  }
  return `id:${ev.evidenceId}`;
}

export function correlatedGroupId(
  family: MifEvidenceFamily,
  groups: readonly (readonly MifEvidenceFamily[])[],
): string {
  for (let i = 0; i < groups.length; i++) {
    if (groups[i]!.includes(family)) return `corr:${i}`;
  }
  return `solo:${family}`;
}

function polarityFromEvidence(
  ev: MifDetectionEvidenceRef,
  candidateDirection: string,
): MifEvidencePolarity {
  if (ev.presence === "ABSENT") return "MISSING";
  if (ev.presence === "UNSUPPORTED") return "UNAVAILABLE";
  if (ev.presence === "INVALID") return "BLOCKED";
  if (ev.qualityStatus === "BLOCKED" || ev.qualityStatus === "MISSING") return "BLOCKED";
  if (ev.qualityStatus === "DEGRADED" || /PARTIAL|provisional|FORMING/i.test(ev.notes ?? "")) {
    // still classify direction but mark as partial at contribution level
  }
  if (ev.presence !== "PRESENT") return "UNKNOWN";

  const notes = (ev.notes ?? "").toUpperCase();
  const dir = candidateDirection.toUpperCase();
  // Avoid substring false positives (e.g. LL inside BULLISH, HL inside DISPLACEMENT).
  const bullishHints =
    /DIRECTION=UP|BIAS=BULLISH|KIND=BULLISH(?:_|$|;|,)|SIDE=BUY|REF SIDE=BUY|(?:^|[;,\s])BULLISH(?:[;,\s]|$)|(?:^|[;=\s])(?:HH|HL)(?:[;,\s]|$)/.test(
      notes,
    );
  const bearishHints =
    /DIRECTION=DOWN|BIAS=BEARISH|KIND=BEARISH(?:_|$|;|,)|SIDE=SELL|REF SIDE=SELL|(?:^|[;,\s])BEARISH(?:[;,\s]|$)|(?:^|[;=\s])(?:LH|LL)(?:[;,\s]|$)/.test(
      notes,
    );
  const conflictHint = /CONFLICT|CONTRADICT|OPPOSING/.test(notes);

  if (conflictHint) return "CONFLICTING";
  if (bullishHints && bearishHints) return "CONFLICTING";
  if (dir === "BUY" || dir === "BULLISH") {
    if (bearishHints && !bullishHints) return "CONFLICTING";
    if (bullishHints) return "BULLISH_SUPPORT";
  }
  if (dir === "SELL" || dir === "BEARISH") {
    if (bullishHints && !bearishHints) return "CONFLICTING";
    if (bearishHints) return "BEARISH_SUPPORT";
  }
  if (bullishHints) return "BULLISH_SUPPORT";
  if (bearishHints) return "BEARISH_SUPPORT";
  return "NEUTRAL";
}

/**
 * Build contributions with provenance dedupe.
 * Within a correlated group, only the highest-quality PRESENT ref contributes fully;
 * others are marked deduplicated.
 */
export function buildEvidenceContributions(input: {
  evidence: readonly MifDetectionEvidenceRef[];
  supportingIds: readonly string[];
  conflictingIds: readonly string[];
  candidateDirection: string;
  relevantFamilies: ReadonlySet<MifEvidenceFamily>;
  policy: MifRankingPolicy;
}): {
  contributions: MifEvidenceContribution[];
  positive: MifEvidenceContribution[];
  negative: MifEvidenceContribution[];
  missing: string[];
  partial: string[];
  contradictions: string[];
  uniqueProvenanceKeys: string[];
} {
  const relevant = input.evidence.filter((e) => input.relevantFamilies.has(e.family));
  const byGroup = new Map<string, MifDetectionEvidenceRef[]>();
  for (const ev of relevant) {
    const gid = `${correlatedGroupId(ev.family, input.policy.correlatedFamilyGroups)}|${provenanceKey(ev)}`;
    const list = byGroup.get(gid) ?? [];
    list.push(ev);
    byGroup.set(gid, list);
  }

  const qualityRank = (q: string) => {
    switch (q) {
      case "VALID":
        return 0;
      case "WARNING":
        return 1;
      case "DEGRADED":
        return 2;
      default:
        return 3;
    }
  };

  const contributions: MifEvidenceContribution[] = [];
  const seenProv = new Set<string>();
  const missing: string[] = [];
  const partial: string[] = [];
  const contradictions: string[] = [];

  for (const [, group] of [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sorted = [...group].sort(
      (a, b) =>
        qualityRank(a.qualityStatus) - qualityRank(b.qualityStatus)
        || a.evidenceId.localeCompare(b.evidenceId),
    );
    sorted.forEach((ev, idx) => {
      const pk = provenanceKey(ev);
      const deduplicated = idx > 0 || seenProv.has(pk);
      if (!deduplicated) seenProv.add(pk);

      let polarity = polarityFromEvidence(ev, input.candidateDirection);
      if (input.conflictingIds.includes(ev.evidenceId)) polarity = "CONFLICTING";
      if (
        ev.qualityStatus === "DEGRADED"
        || ev.qualityStatus === "WARNING"
        || /PARTIAL|FORMING|provisional/i.test(ev.notes ?? "")
      ) {
        if (polarity !== "MISSING" && polarity !== "BLOCKED" && polarity !== "UNAVAILABLE") {
          partial.push(ev.evidenceId);
          if (polarity === "NEUTRAL" || polarity === "UNKNOWN") polarity = "PARTIAL";
        }
      }
      if (ev.presence === "ABSENT" || polarity === "MISSING") missing.push(ev.evidenceId);
      if (polarity === "CONFLICTING") {
        contradictions.push(
          `${ev.family}:${ev.evidenceId} conflicts with direction=${input.candidateDirection}`,
        );
      }

      contributions.push({
        evidenceId: ev.evidenceId,
        family: ev.family,
        polarity,
        provenanceKey: pk,
        qualityStatus: ev.qualityStatus,
        candleState: ev.candleState,
        notes: ev.notes ?? "",
        deduplicated,
      });
    });
  }

  // Supporting/conflicting ids that weren't in filtered evidence
  for (const id of input.supportingIds) {
    if (!contributions.some((c) => c.evidenceId === id)) {
      contributions.push({
        evidenceId: id,
        family: "DATA_QUALITY",
        polarity: "NEUTRAL",
        provenanceKey: `support:${id}`,
        qualityStatus: "UNKNOWN",
        candleState: null,
        notes: "supportingEvidenceId without resolved evidence ref",
        deduplicated: false,
      });
    }
  }
  for (const id of input.conflictingIds) {
    if (!contributions.some((c) => c.evidenceId === id && c.polarity === "CONFLICTING")) {
      contradictions.push(`candidate.conflictingEvidenceIds:${id}`);
      contributions.push({
        evidenceId: id,
        family: "DATA_QUALITY",
        polarity: "CONFLICTING",
        provenanceKey: `conflict:${id}`,
        qualityStatus: "WARNING",
        candleState: null,
        notes: "candidate conflictingEvidenceId",
        deduplicated: false,
      });
    }
  }

  // Include deduplicated rows so callers can audit double-count prevention;
  // scoring filters !deduplicated when computing component totals.
  const positive = contributions.filter(
    (c) =>
      c.polarity === "BULLISH_SUPPORT"
      || c.polarity === "BEARISH_SUPPORT"
      || (c.polarity === "NEUTRAL" && input.supportingIds.includes(c.evidenceId)),
  );
  const negative = contributions.filter(
    (c) => c.polarity === "CONFLICTING" || c.polarity === "BLOCKED",
  );

  return {
    contributions,
    positive,
    negative,
    missing: [...new Set(missing)].sort(),
    partial: [...new Set(partial)].sort(),
    contradictions: [...new Set(contradictions)].sort(),
    uniqueProvenanceKeys: [...seenProv].sort(),
  };
}
