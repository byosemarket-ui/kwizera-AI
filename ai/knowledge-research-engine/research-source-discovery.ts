import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";
import type { RegisteredKnowledgeSource } from "../knowledge-source-manager/types.js";
import type { RankedSourceCandidate, ResearchPlan } from "./types.js";

/** Reject sources below these floors automatically. */
export const SOURCE_SCORE_FLOORS = {
  trust: 55,
  quality: 50,
  authority: 50,
  relevance: 40,
  composite: 58,
} as const;

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2),
  );
}

function relevance(topicWords: Set<string>, source: RegisteredKnowledgeSource): number {
  const sourceWords = tokenize(`${source.name} ${source.description} ${(source.tags ?? []).join(" ")}`);
  if (topicWords.size === 0 || sourceWords.size === 0) return 35;
  let shared = 0;
  for (const word of topicWords) if (sourceWords.has(word)) shared++;
  if (shared === 0) return 35;
  const ratio = shared / topicWords.size;
  return Math.round(40 + Math.min(1, ratio) * 60);
}

function authorityScore(source: RegisteredKnowledgeSource): number {
  const typeBoost: Partial<Record<KnowledgeAcquisitionSourceType, number>> = {
    "official-documentation": 95,
    "official-api-documentation": 94,
    "technical-standard": 93,
    "technical-manual": 88,
    "research-paper": 86,
    "white-paper": 82,
    "user-manual": 80,
    book: 78,
    "open-educational-resource": 74,
    "approved-website": 70,
    "local-documentation": 72,
  };
  const base = typeBoost[source.type] ?? 60;
  const verifiedBoost = source.verification.verified ? 5 : 0;
  const trustBlend = Math.round((source.verification.trustScore + base) / 2);
  return Math.min(100, trustBlend + verifiedBoost);
}

/** Ranks approved sources and rejects low-quality candidates automatically. */
export class ResearchSourceDiscovery {
  search(
    plan: ResearchPlan,
    approvedSources: RegisteredKnowledgeSource[],
    isBlocked: (sourceId: string) => boolean,
  ): RankedSourceCandidate[] {
    const requiredTypes = new Set<KnowledgeAcquisitionSourceType>(plan.domains.flatMap((domain) => domain.sourceTypes));
    const topicWords = tokenize(plan.topic);

    const candidates = approvedSources
      .filter((source) => !isBlocked(source.id))
      .filter((source) => requiredTypes.size === 0 || requiredTypes.has(source.type))
      .map((source) => this.rate(source, topicWords))
      .map((candidate) => this.applyRejectionGates(candidate));

    return candidates.sort((a, b) => Number(b.accepted) - Number(a.accepted) || b.compositeScore - a.compositeScore);
  }

  listAccepted(candidates: RankedSourceCandidate[]): RankedSourceCandidate[] {
    return candidates.filter((candidate) => candidate.accepted);
  }

  listRejected(candidates: RankedSourceCandidate[]): RankedSourceCandidate[] {
    return candidates.filter((candidate) => !candidate.accepted);
  }

  private rate(source: RegisteredKnowledgeSource, topicWords: Set<string>): RankedSourceCandidate {
    const trustScore = source.verification.trustScore;
    const qualityScore = source.quality?.qualityScore ?? trustScore;
    const freshnessScore = source.quality?.freshnessScore ?? 50;
    const completenessScore = source.quality?.completenessScore ?? 50;
    const relevanceScore = relevance(topicWords, source);
    const authority = authorityScore(source);
    const compositeScore = Math.round(
      trustScore * 0.2
        + qualityScore * 0.2
        + authority * 0.2
        + freshnessScore * 0.15
        + relevanceScore * 0.15
        + completenessScore * 0.1,
    );

    return {
      sourceId: source.id,
      name: source.name,
      type: source.type,
      trustScore,
      qualityScore,
      authorityScore: authority,
      freshnessScore,
      relevanceScore,
      completenessScore,
      compositeScore,
      accepted: true,
    };
  }

  private applyRejectionGates(candidate: RankedSourceCandidate): RankedSourceCandidate {
    const reasons: string[] = [];
    if (candidate.trustScore < SOURCE_SCORE_FLOORS.trust) reasons.push(`trust ${candidate.trustScore} < ${SOURCE_SCORE_FLOORS.trust}`);
    if (candidate.qualityScore < SOURCE_SCORE_FLOORS.quality) reasons.push(`quality ${candidate.qualityScore} < ${SOURCE_SCORE_FLOORS.quality}`);
    if (candidate.authorityScore < SOURCE_SCORE_FLOORS.authority) reasons.push(`authority ${candidate.authorityScore} < ${SOURCE_SCORE_FLOORS.authority}`);
    if (candidate.relevanceScore < SOURCE_SCORE_FLOORS.relevance) reasons.push(`relevance ${candidate.relevanceScore} < ${SOURCE_SCORE_FLOORS.relevance}`);
    if (candidate.compositeScore < SOURCE_SCORE_FLOORS.composite) reasons.push(`composite ${candidate.compositeScore} < ${SOURCE_SCORE_FLOORS.composite}`);
    if (reasons.length) {
      return {
        ...candidate,
        accepted: false,
        rejectionReason: `Rejected low-quality source (${reasons.join("; ")}).`,
      };
    }
    return candidate;
  }
}
