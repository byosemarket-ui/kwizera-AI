import { TrustedSourceClassifier } from "./trusted-source-classifier.js";
import type {
  KnowledgeSourcePolicyEvaluation,
  KnowledgeSourceQualityScores,
  RegisteredKnowledgeSource,
} from "./types.js";

const DAY_MS = 86_400_000;

/** Scores an approved-or-candidate source across trust, reputation, completeness, and freshness. */
export class KnowledgeSourceQualityScorer {
  private readonly classifier = new TrustedSourceClassifier();

  score(
    source: RegisteredKnowledgeSource,
    policyEvaluation: KnowledgeSourcePolicyEvaluation
  ): KnowledgeSourceQualityScores {
    const trustScore = source.verification.trustScore;
    const reputationScore = this.scoreReputation(source, policyEvaluation);
    const completenessScore = this.scoreCompleteness(source);
    const freshnessScore = this.scoreFreshness(source);
    const confidenceScore = this.scoreConfidence(source);
    const qualityScore = Math.round(
      trustScore * 0.3 +
        reputationScore * 0.25 +
        completenessScore * 0.2 +
        freshnessScore * 0.15 +
        confidenceScore * 0.1
    );

    return {
      qualityScore: Math.min(100, Math.max(0, qualityScore)),
      trustScore,
      reputationScore,
      completenessScore,
      freshnessScore,
      confidenceScore,
    };
  }

  private scoreReputation(source: RegisteredKnowledgeSource, policyEvaluation: KnowledgeSourcePolicyEvaluation): number {
    if (policyEvaluation.decision === "block") return 0;
    let score = 50;
    if (policyEvaluation.matchedList === "preferred") score += 30;
    else if (policyEvaluation.matchedList === "internal" || policyEvaluation.matchedList === "company") score += 20;
    else if (policyEvaluation.matchedList === "allowed" || policyEvaluation.matchedList === "user") score += 10;
    if (source.publisher?.trim()) score += 10;
    score += this.classifier.reputationBoost(this.classifier.classify(source));
    return Math.max(0, Math.min(100, score));
  }

  private scoreCompleteness(source: RegisteredKnowledgeSource): number {
    let score = 100;
    if (!source.publisher?.trim()) score -= 15;
    if (!source.license?.trim()) score -= 10;
    if (!source.version?.trim()) score -= 5;
    if (!source.lastUpdated) score -= 10;
    if (!source.tags || source.tags.length === 0) score -= 5;
    if (!source.category?.trim()) score -= 5;
    if (!source.domainIds || source.domainIds.length === 0) score -= 5;
    if (!source.officialWebsite?.trim()) score -= 5;
    if (!source.language) score -= 5;
    if (!source.updateFrequency) score -= 5;
    if (!source.accessMethod) score -= 5;
    if (!source.trustClass && !source.resourceType) score -= 5;
    return Math.max(0, score);
  }

  private scoreFreshness(source: RegisteredKnowledgeSource): number {
    if (!source.lastUpdated) return 50;
    const ageMs = Date.now() - Date.parse(source.lastUpdated);
    if (!Number.isFinite(ageMs) || ageMs < 0) return 50;
    const ageDays = ageMs / DAY_MS;
    if (ageDays <= 180) return 100;
    if (ageDays <= 365) return 80;
    if (ageDays <= 730) return 60;
    if (ageDays <= 1460) return 40;
    return 20;
  }

  private scoreConfidence(source: RegisteredKnowledgeSource): number {
    const fields = [
      source.publisher,
      source.license,
      source.version,
      source.lastUpdated,
      source.category,
      source.officialWebsite,
      source.language,
      source.accessMethod,
      source.updateFrequency,
      source.trustClass,
    ];
    const provided = fields.filter((value) => Boolean(value && String(value).trim())).length;
    return Math.round((provided / fields.length) * 100);
  }
}
