import { describe, expect, it } from "vitest";
import { verifyKnowledgeSource } from "../../../../ai/knowledge-source-manager/knowledge-source-verifier.js";
import { TrustedSourceClassifier } from "../../../../ai/knowledge-source-manager/trusted-source-classifier.js";
import { TrustedSourceDiscoveryService } from "../../../../ai/knowledge-source-manager/trusted-source-discovery.js";
import {
  EXISTING_TRUSTED_SOURCE_IDS,
  NEW_TRUSTED_SOURCE_IDS,
  TRUSTED_SOURCE_LIBRARY,
} from "../../../../ai/knowledge-source-manager/trusted-knowledge-source-library.js";
import { REQUIRED_DISCOVERY_TOPIC_IDS } from "../../../../ai/knowledge-source-manager/trusted-source-discovery-topics.js";
import {
  KnowledgeSourceTrustClass,
  type RegisteredKnowledgeSource,
} from "../../../../ai/knowledge-source-manager/types.js";

function asRegistered(entry: (typeof TRUSTED_SOURCE_LIBRARY)[number]): RegisteredKnowledgeSource {
  const verification = verifyKnowledgeSource(entry.definition);
  return {
    ...entry.definition,
    tags: entry.definition.tags ?? [],
    category: entry.definition.category ?? entry.category,
    trustClass: entry.definition.trustClass,
    status: verification.verified ? "pending" : "rejected",
    verification,
    quality: {
      qualityScore: verification.trustScore,
      trustScore: verification.trustScore,
      reputationScore: 70,
      completenessScore: 80,
      freshnessScore: 80,
      confidenceScore: 80,
    },
    registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("Trusted Source Discovery", () => {
  it("upgrades existing library entries and registers new discovery sources", () => {
    expect(EXISTING_TRUSTED_SOURCE_IDS).toHaveLength(25);
    expect(NEW_TRUSTED_SOURCE_IDS.length).toBeGreaterThan(15);
    expect(TRUSTED_SOURCE_LIBRARY.length).toBe(EXISTING_TRUSTED_SOURCE_IDS.length + NEW_TRUSTED_SOURCE_IDS.length);

    for (const entry of TRUSTED_SOURCE_LIBRARY) {
      const verification = verifyKnowledgeSource(entry.definition);
      expect(verification.verified, entry.definition.id).toBe(true);
      expect(entry.definition.category).toBeTruthy();
      expect(entry.definition.domainIds?.length).toBeGreaterThan(0);
      expect(entry.definition.officialWebsite).toBeTruthy();
      expect(entry.definition.resourceType).toBeTruthy();
      expect(entry.definition.language).toBeTruthy();
      expect(entry.definition.trustClass).toBeTruthy();
      expect(entry.definition.updateFrequency).toBeTruthy();
      expect(entry.definition.accessMethod).toBeTruthy();
      expect(entry.definition.license).toBeTruthy();
      expect(entry.discoveryTopics.length).toBeGreaterThan(0);
    }
  });

  it("classifies sources into professional trust tiers and never auto-approves", () => {
    const classifier = new TrustedSourceClassifier();
    expect(classifier.mayAutoApprove()).toBe(false);
    expect(classifier.classify({ id: "a", name: "A", description: "A", type: "official-documentation", location: { kind: "url", value: "https://a.example" } })).toBe(
      KnowledgeSourceTrustClass.Official
    );
    expect(classifier.classify({ id: "b", name: "B", description: "B", type: "research-paper", location: { kind: "url", value: "https://b.example" } })).toBe(
      KnowledgeSourceTrustClass.HighlyTrusted
    );
    expect(classifier.classify({ id: "c", name: "C", description: "C", type: "user-document", location: { kind: "local-path", value: "docs/c.md" } })).toBe(
      KnowledgeSourceTrustClass.UserProvided
    );
  });

  it("covers discovery topics, recommends best sources, and detects gaps", () => {
    const discovery = new TrustedSourceDiscoveryService();
    const sources = TRUSTED_SOURCE_LIBRARY.map(asRegistered);
    expect(REQUIRED_DISCOVERY_TOPIC_IDS).toHaveLength(26);

    const coverage = discovery.buildCoverage(sources);
    expect(coverage).toHaveLength(26);
    expect(coverage.every((item) => item.coverageLevel !== "missing")).toBe(true);

    const bestVideo = discovery.recommendBest(sources, "video-production");
    expect(bestVideo).toBeTruthy();
    expect(bestVideo!.whySelected).toContain("Selected");

    const explanationTopic = discovery.recommendBest(sources, "tiktok");
    expect(explanationTopic?.sourceId).toBeTruthy();

    const additional = discovery.recommendAdditional(sources, "marketing", 3);
    expect(additional.length).toBeGreaterThan(0);

    const awareness = discovery.buildAiMeAwareness(sources);
    expect(awareness.totalRegistered).toBe(TRUSTED_SOURCE_LIBRARY.length);
    expect(awareness.approved).toBe(0);
    expect(awareness.coveredTopics.length).toBe(26);

    const report = discovery.buildDiscoveryReport(sources);
    expect(report.existingSourcesFound).toHaveLength(25);
    expect(report.newSourcesRegistered.length).toBe(NEW_TRUSTED_SOURCE_IDS.length);
    expect(report.domainCoverage).toHaveLength(26);
  });
});
