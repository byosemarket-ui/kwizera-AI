import type { KnowledgeSourceComparison, RegisteredKnowledgeSource } from "./types.js";

export interface QualityRatedSource {
  source: RegisteredKnowledgeSource;
  qualityScore: number;
}

/** Ranks knowledge sources by composite quality score and surfaces tradeoff notes. */
export class KnowledgeSourceComparator {
  compare(rated: QualityRatedSource[]): KnowledgeSourceComparison {
    const ranked = [...rated].sort((a, b) => b.qualityScore - a.qualityScore);
    const tradeoffs = rated.map(({ source, qualityScore }) => ({
      sourceId: source.id,
      note: `${source.name}: quality ${qualityScore}, trust ${source.verification.trustScore}, status "${source.status}".`,
    }));
    const best = ranked[0];
    return {
      summary: best
        ? `Compared ${rated.length} source(s); highest composite quality is "${best.source.name}" (${best.qualityScore}).`
        : "No sources were provided for comparison.",
      rankedSourceIds: ranked.map(({ source }) => source.id),
      tradeoffs,
    };
  }
}
