/**
 * Trusted Source Discovery — ranks, covers, and explains sources without downloading.
 */

import { TrustedSourceClassifier } from "./trusted-source-classifier.js";
import {
  REQUIRED_DISCOVERY_TOPIC_IDS,
  TRUSTED_SOURCE_DISCOVERY_TOPICS,
  type TrustedSourceDiscoveryTopic,
} from "./trusted-source-discovery-topics.js";
import { EXISTING_TRUSTED_SOURCE_IDS, NEW_TRUSTED_SOURCE_IDS, TRUSTED_SOURCE_LIBRARY } from "./trusted-knowledge-source-library.js";
import {
  KnowledgeSourceTrustClass,
  type AiMeTrustedSourceAwareness,
  type RegisteredKnowledgeSource,
  type TrustedSourceDiscoveryCoverage,
  type TrustedSourceDiscoveryRecommendation,
  type TrustedSourceDiscoveryReportData,
  type TrustedSourceMissingReport,
} from "./types.js";

const TRUST_CLASS_RANK: Record<KnowledgeSourceTrustClass, number> = {
  [KnowledgeSourceTrustClass.Official]: 0,
  [KnowledgeSourceTrustClass.HighlyTrusted]: 1,
  [KnowledgeSourceTrustClass.Trusted]: 2,
  [KnowledgeSourceTrustClass.Community]: 3,
  [KnowledgeSourceTrustClass.UserProvided]: 4,
};

export class TrustedSourceDiscoveryService {
  private readonly classifier = new TrustedSourceClassifier();

  listTopics(): TrustedSourceDiscoveryTopic[] {
    return TRUSTED_SOURCE_DISCOVERY_TOPICS.map((topic) => structuredClone(topic));
  }

  findTopic(topicOrDomain: string): TrustedSourceDiscoveryTopic | undefined {
    const needle = topicOrDomain.trim().toLowerCase();
    return TRUSTED_SOURCE_DISCOVERY_TOPICS.find(
      (topic) =>
        topic.topicId === needle ||
        topic.label.toLowerCase() === needle ||
        topic.domainIds.includes(needle) ||
        topic.keywords.some((keyword) => needle.includes(keyword) || keyword.includes(needle))
    );
  }

  sourcesForTopic(sources: RegisteredKnowledgeSource[], topicId: string): RegisteredKnowledgeSource[] {
    const topic = TRUSTED_SOURCE_DISCOVERY_TOPICS.find((item) => item.topicId === topicId);
    if (!topic) return [];
    return sources.filter((source) => {
      const domainMatch = (source.domainIds ?? []).some((id) => topic.domainIds.includes(id));
      const tagMatch = (source.tags ?? []).some((tag) => tag === topic.topicId || topic.keywords.includes(tag));
      const text = `${source.name} ${source.description} ${(source.tags ?? []).join(" ")}`.toLowerCase();
      const keywordMatch = topic.keywords.some((keyword) => text.includes(keyword));
      return domainMatch || tagMatch || keywordMatch;
    });
  }

  buildCoverage(sources: RegisteredKnowledgeSource[]): TrustedSourceDiscoveryCoverage[] {
    return TRUSTED_SOURCE_DISCOVERY_TOPICS.map((topic) => {
      const matched = this.sourcesForTopic(sources, topic.topicId);
      const averageTrustScore = matched.length
        ? Math.round(matched.reduce((sum, source) => sum + source.verification.trustScore, 0) / matched.length)
        : 0;
      const averageQualityScore = matched.length
        ? Math.round(matched.reduce((sum, source) => sum + (source.quality?.qualityScore ?? 0), 0) / matched.length)
        : 0;
      const ranked = [...matched].sort((a, b) => this.compareSources(a, b));
      const best = ranked[0] ?? null;
      return {
        topicId: topic.topicId,
        topicLabel: topic.label,
        domainIds: topic.domainIds,
        sourceIds: matched.map((source) => source.id),
        sourceCount: matched.length,
        bestSourceId: best?.id ?? null,
        bestTrustClass: best ? this.classifier.classify(best) : null,
        averageTrustScore,
        averageQualityScore,
        coverageLevel:
          matched.length === 0 ? "missing" : matched.length === 1 ? "weak" : matched.length <= 3 ? "adequate" : "strong",
      };
    });
  }

  detectMissing(sources: RegisteredKnowledgeSource[]): TrustedSourceMissingReport[] {
    return this.buildCoverage(sources)
      .filter((coverage) => coverage.coverageLevel === "missing" || coverage.coverageLevel === "weak")
      .map((coverage) => ({
        topicId: coverage.topicId,
        topicLabel: coverage.topicLabel,
        domainIds: coverage.domainIds,
        reason:
          coverage.coverageLevel === "missing"
            ? "No trusted sources discovered for this topic yet."
            : "Only weak coverage — recommend additional official or highly trusted sources.",
        suggestedSourceTypes: [
          "official-documentation",
          "official-api-documentation",
          "technical-manual",
          "open-educational-resource",
        ],
        suggestedTrustClasses: [
          KnowledgeSourceTrustClass.Official,
          KnowledgeSourceTrustClass.HighlyTrusted,
          KnowledgeSourceTrustClass.Trusted,
        ],
      }));
  }

  recommendBest(
    sources: RegisteredKnowledgeSource[],
    topicOrDomain: string
  ): TrustedSourceDiscoveryRecommendation | null {
    const topic = this.findTopic(topicOrDomain);
    const pool = topic
      ? this.sourcesForTopic(sources, topic.topicId)
      : sources.filter((source) => {
          const text = `${source.name} ${source.description} ${(source.tags ?? []).join(" ")}`.toLowerCase();
          return text.includes(topicOrDomain.trim().toLowerCase());
        });
    if (!pool.length) return null;
    const best = [...pool].sort((a, b) => this.compareSources(a, b))[0];
    const trustClass = this.classifier.classify(best);
    return {
      sourceId: best.id,
      name: best.name,
      trustClass,
      trustScore: best.verification.trustScore,
      qualityScore: best.quality?.qualityScore ?? 0,
      confidenceScore: best.quality?.confidenceScore ?? 0,
      whySelected: this.explainSelection(best, trustClass, topic?.label ?? topicOrDomain),
      domainIds: best.domainIds ?? [],
      category: best.category ?? (best.tags?.[0] ?? "uncategorized"),
    };
  }

  recommendAdditional(
    sources: RegisteredKnowledgeSource[],
    topicOrDomain: string,
    limit = 5
  ): TrustedSourceDiscoveryRecommendation[] {
    const topic = this.findTopic(topicOrDomain);
    const pool = topic ? this.sourcesForTopic(sources, topic.topicId) : sources;
    const bestId = this.recommendBest(sources, topicOrDomain)?.sourceId;
    return [...pool]
      .filter((source) => source.id !== bestId)
      .sort((a, b) => this.compareSources(a, b))
      .slice(0, limit)
      .map((source) => {
        const trustClass = this.classifier.classify(source);
        return {
          sourceId: source.id,
          name: source.name,
          trustClass,
          trustScore: source.verification.trustScore,
          qualityScore: source.quality?.qualityScore ?? 0,
          confidenceScore: source.quality?.confidenceScore ?? 0,
          whySelected: `Additional trusted candidate for ${topic?.label ?? topicOrDomain}: ${trustClass}, trust ${source.verification.trustScore}/100.`,
          domainIds: source.domainIds ?? [],
          category: source.category ?? (source.tags?.[0] ?? "uncategorized"),
        };
      });
  }

  buildAiMeAwareness(sources: RegisteredKnowledgeSource[]): AiMeTrustedSourceAwareness {
    const coverage = this.buildCoverage(sources);
    const missing = this.detectMissing(sources);
    const trustClassCounts = {
      [KnowledgeSourceTrustClass.Official]: 0,
      [KnowledgeSourceTrustClass.HighlyTrusted]: 0,
      [KnowledgeSourceTrustClass.Trusted]: 0,
      [KnowledgeSourceTrustClass.Community]: 0,
      [KnowledgeSourceTrustClass.UserProvided]: 0,
    };
    for (const source of sources) {
      trustClassCounts[this.classifier.classify(source)] += 1;
    }
    const topRecommendations = TRUSTED_SOURCE_DISCOVERY_TOPICS.map((topic) =>
      this.recommendBest(sources, topic.topicId)
    ).filter((item): item is TrustedSourceDiscoveryRecommendation => Boolean(item));

    const coveredTopics = coverage.filter((item) => item.coverageLevel !== "missing").map((item) => item.topicId);
    return {
      totalRegistered: sources.length,
      pendingApproval: sources.filter((source) => source.status === "pending").length,
      approved: sources.filter((source) => source.status === "approved").length,
      trustClassCounts,
      coveredTopics,
      missingTopics: missing,
      topRecommendations: topRecommendations.slice(0, 10),
      summary:
        `Trusted source discovery: ${sources.length} source(s) registered, ` +
        `${coveredTopics.length}/${REQUIRED_DISCOVERY_TOPIC_IDS.length} topics covered, ` +
        `${missing.length} topic gap(s). Sources remain pending until explicit approval — nothing is auto-approved.`,
    };
  }

  buildDiscoveryReport(sources: RegisteredKnowledgeSource[]): TrustedSourceDiscoveryReportData {
    const existingSourcesFound = TRUSTED_SOURCE_LIBRARY.filter((entry) => entry.upgradedFromExisting).map((entry) => ({
      sourceId: entry.definition.id,
      name: entry.definition.name,
      category: entry.category,
    }));
    const sourcesUpgraded = TRUSTED_SOURCE_LIBRARY.filter((entry) => entry.upgradedFromExisting).map((entry) => ({
      sourceId: entry.definition.id,
      name: entry.definition.name,
      upgradeSummary: `Upgraded with discovery metadata: category, domainIds, trustClass, language, updateFrequency, accessMethod, officialWebsite.`,
    }));
    const newSourcesRegistered = TRUSTED_SOURCE_LIBRARY.filter((entry) => !entry.upgradedFromExisting).map((entry) => ({
      sourceId: entry.definition.id,
      name: entry.definition.name,
      category: entry.category,
      trustClass: entry.definition.trustClass ?? this.classifier.classify(entry.definition),
    }));

    const categories = [...new Set(sources.map((source) => source.category ?? source.tags?.[0] ?? "uncategorized"))].sort();
    const coverage = this.buildCoverage(sources);
    const missing = this.detectMissing(sources);

    return {
      generatedAt: new Date().toISOString(),
      existingSourcesFound,
      sourcesUpgraded,
      newSourcesRegistered,
      sourceCategories: categories,
      trustScores: sources.map((source) => ({
        sourceId: source.id,
        trustScore: source.verification.trustScore,
        trustClass: this.classifier.classify(source),
      })),
      qualityScores: sources.map((source) => ({
        sourceId: source.id,
        qualityScore: source.quality?.qualityScore ?? 0,
        confidenceScore: source.quality?.confidenceScore ?? 0,
      })),
      domainCoverage: coverage,
      missingTrustedSources: missing,
      totals: {
        catalogSize: TRUSTED_SOURCE_LIBRARY.length,
        registered: sources.length,
        upgraded: EXISTING_TRUSTED_SOURCE_IDS.length,
        newlyRegistered: NEW_TRUSTED_SOURCE_IDS.length,
        topicsCovered: coverage.filter((item) => item.coverageLevel !== "missing").length,
        topicsMissing: coverage.filter((item) => item.coverageLevel === "missing").length,
      },
    };
  }

  private compareSources(a: RegisteredKnowledgeSource, b: RegisteredKnowledgeSource): number {
    const classDiff =
      TRUST_CLASS_RANK[this.classifier.classify(a)] - TRUST_CLASS_RANK[this.classifier.classify(b)];
    if (classDiff !== 0) return classDiff;
    const qualityDiff = (b.quality?.qualityScore ?? 0) - (a.quality?.qualityScore ?? 0);
    if (qualityDiff !== 0) return qualityDiff;
    return b.verification.trustScore - a.verification.trustScore;
  }

  private explainSelection(
    source: RegisteredKnowledgeSource,
    trustClass: KnowledgeSourceTrustClass,
    topicLabel: string
  ): string {
    return (
      `Selected "${source.name}" for ${topicLabel} because it is classified as ${trustClass} ` +
      `(trust ${source.verification.trustScore}/100, quality ${source.quality?.qualityScore ?? 0}/100, ` +
      `confidence ${source.quality?.confidenceScore ?? 0}/100). ` +
      `Publisher: ${source.publisher ?? "unknown"}. Access: ${source.accessMethod ?? "unspecified"}. ` +
      `Status remains ${source.status} until explicit approval.`
    );
  }
}
