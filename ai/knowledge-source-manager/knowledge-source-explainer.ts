import type {
  KnowledgeSourceComparison,
  KnowledgeSourceExplanation,
  KnowledgeSourceRecommendation,
  RegisteredKnowledgeSource,
} from "./types.js";
import type { QualityRatedSource } from "./knowledge-source-comparator.js";

/** Explains AI Me's source selection/rejection decisions and produces upgrade recommendations. */
export class KnowledgeSourceExplainer {
  explainApproval(source: RegisteredKnowledgeSource, qualityScore: number): KnowledgeSourceExplanation {
    return {
      summary: `"${source.name}" is trusted with a composite quality score of ${qualityScore}.`,
      whyBest: `Verification trust score ${source.verification.trustScore}/100; verified: ${source.verification.verified}.`,
      rejectedAlternatives: [],
      internalNotes: [`Verification issues: ${source.verification.issues.join(", ") || "none"}.`],
    };
  }

  explainRejection(source: RegisteredKnowledgeSource): KnowledgeSourceExplanation {
    const reason = source.verification.issues.join(" ") || source.lastError || "Did not meet the minimum trust requirements.";
    return {
      summary: `"${source.name}" was not trusted.`,
      rejectedAlternatives: [{ sourceId: source.id, reason }],
      internalNotes: [],
    };
  }

  recommend(comparison: KnowledgeSourceComparison, rated: QualityRatedSource[]): KnowledgeSourceRecommendation | null {
    const topId = comparison.rankedSourceIds[0];
    const top = rated.find(({ source }) => source.id === topId);
    if (!top) return null;
    const others = rated.filter(({ source }) => source.id !== topId);
    return {
      sourceId: top.source.id,
      label: top.source.name,
      summary: `"${top.source.name}" has the highest composite quality score (${top.qualityScore}) among the compared sources.`,
      qualityScore: top.qualityScore,
      improvements: others.map(
        ({ source, qualityScore }) => `Improve or deprioritize "${source.name}" (score ${qualityScore}) relative to the top choice.`
      ),
    };
  }
}
