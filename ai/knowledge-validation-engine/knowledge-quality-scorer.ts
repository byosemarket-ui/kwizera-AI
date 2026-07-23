import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import { KnowledgeQualityScores } from "./types.js";

export class KnowledgeQualityScorer {
  score(
    record: KnowledgeRecord,
    structureWarnings: string[],
    relationshipIssues: string[],
    sourceIssues: string[]
  ): KnowledgeQualityScores {
    const completenessScore = this.scoreCompleteness(record, structureWarnings);
    const consistencyScore = this.scoreConsistency(record, relationshipIssues, sourceIssues);
    const reliabilityScore = Math.min(100, Math.max(0, record.sourceReliability));
    const confidenceScore = Math.min(100, Math.max(0, record.confidenceScore));
    const qualityScore = Math.round(
      record.qualityScore * 0.35 +
        completenessScore * 0.2 +
        consistencyScore * 0.2 +
        reliabilityScore * 0.15 +
        confidenceScore * 0.1
    );

    return {
      qualityScore: Math.min(100, qualityScore),
      reliabilityScore,
      completenessScore,
      consistencyScore,
      confidenceScore,
    };
  }

  private scoreCompleteness(record: KnowledgeRecord, warnings: string[]): number {
    let score = 100;
    if (!record.summary || record.summary.length < 10) score -= 20;
    if (record.description.length < 20) score -= 15;
    if (record.tags.length === 0) score -= 10;
    if (record.keywords.length === 0) score -= 10;
    if (!record.classification.topic) score -= 10;
    score -= warnings.length * 5;
    return Math.max(0, score);
  }

  private scoreConsistency(
    record: KnowledgeRecord,
    relationshipIssues: string[],
    sourceIssues: string[]
  ): number {
    let score = 100;
    score -= relationshipIssues.length * 15;
    score -= sourceIssues.length * 20;
    if (record.relatedKnowledge.length > 0 && relationshipIssues.length === 0) {
      score = Math.min(100, score + 5);
    }
    return Math.max(0, score);
  }
}
