export class KnowledgeQualityScorer {
    score(record, structureWarnings, relationshipIssues, sourceIssues) {
        const completenessScore = this.scoreCompleteness(record, structureWarnings);
        const consistencyScore = this.scoreConsistency(record, relationshipIssues, sourceIssues);
        const reliabilityScore = Math.min(100, Math.max(0, record.sourceReliability));
        const confidenceScore = Math.min(100, Math.max(0, record.confidenceScore));
        const qualityScore = Math.round(record.qualityScore * 0.35 +
            completenessScore * 0.2 +
            consistencyScore * 0.2 +
            reliabilityScore * 0.15 +
            confidenceScore * 0.1);
        return {
            qualityScore: Math.min(100, qualityScore),
            reliabilityScore,
            completenessScore,
            consistencyScore,
            confidenceScore,
        };
    }
    scoreCompleteness(record, warnings) {
        let score = 100;
        if (!record.summary || record.summary.length < 10)
            score -= 20;
        if (record.description.length < 20)
            score -= 15;
        if (record.tags.length === 0)
            score -= 10;
        if (record.keywords.length === 0)
            score -= 10;
        if (!record.classification.topic)
            score -= 10;
        score -= warnings.length * 5;
        return Math.max(0, score);
    }
    scoreConsistency(record, relationshipIssues, sourceIssues) {
        let score = 100;
        score -= relationshipIssues.length * 15;
        score -= sourceIssues.length * 20;
        if (record.relatedKnowledge.length > 0 && relationshipIssues.length === 0) {
            score = Math.min(100, score + 5);
        }
        return Math.max(0, score);
    }
}
//# sourceMappingURL=knowledge-quality-scorer.js.map