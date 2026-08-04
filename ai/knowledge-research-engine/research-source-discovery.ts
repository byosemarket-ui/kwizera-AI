import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";
import type { RegisteredKnowledgeSource } from "../knowledge-source-manager/types.js";
import type { RankedSourceCandidate, ResearchPlan } from "./types.js";

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2)
  );
}

function relevance(topicWords: Set<string>, source: RegisteredKnowledgeSource): number {
  const sourceWords = tokenize(`${source.name} ${source.description} ${(source.tags ?? []).join(" ")}`);
  if (topicWords.size === 0 || sourceWords.size === 0) return 40;
  let shared = 0;
  for (const word of topicWords) if (sourceWords.has(word)) shared++;
  const ratio = shared / topicWords.size;
  return Math.round(40 + Math.min(1, ratio) * 60);
}

/** Ranks only approved, non-blocked sources against a research plan's required source types and topic relevance. */
export class ResearchSourceDiscovery {
  search(
    plan: ResearchPlan,
    approvedSources: RegisteredKnowledgeSource[],
    isBlocked: (sourceId: string) => boolean
  ): RankedSourceCandidate[] {
    const requiredTypes = new Set<KnowledgeAcquisitionSourceType>(plan.domains.flatMap((domain) => domain.sourceTypes));
    const topicWords = tokenize(plan.topic);

    const candidates = approvedSources
      .filter((source) => !isBlocked(source.id))
      .filter((source) => requiredTypes.size === 0 || requiredTypes.has(source.type))
      .map((source) => this.rate(source, topicWords));

    return candidates.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  private rate(source: RegisteredKnowledgeSource, topicWords: Set<string>): RankedSourceCandidate {
    const trustScore = source.verification.trustScore;
    const qualityScore = source.quality?.qualityScore ?? trustScore;
    const freshnessScore = source.quality?.freshnessScore ?? 50;
    const completenessScore = source.quality?.completenessScore ?? 50;
    const relevanceScore = relevance(topicWords, source);
    const compositeScore = Math.round(
      trustScore * 0.25 + qualityScore * 0.25 + freshnessScore * 0.2 + relevanceScore * 0.2 + completenessScore * 0.1
    );

    return {
      sourceId: source.id,
      name: source.name,
      type: source.type,
      trustScore,
      qualityScore,
      freshnessScore,
      relevanceScore,
      completenessScore,
      compositeScore,
    };
  }
}
