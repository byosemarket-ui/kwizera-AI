import {
  EXISTING_TRUSTED_SOURCE_IDS,
  NEW_TRUSTED_SOURCE_IDS,
  REQUIRED_DISCOVERY_TOPIC_IDS,
  TRUSTED_SOURCE_LIBRARY,
  TrustedSourceClassifier,
  TrustedSourceDiscoveryService,
  verifyKnowledgeSource,
  KnowledgeSourceTrustClass,
  type RegisteredKnowledgeSource,
} from "../ai/knowledge-source-manager/index.js";

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
      completenessScore: 85,
      freshnessScore: 80,
      confidenceScore: 85,
    },
    registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  console.log("KWIZERA AI STUDIO — Knowledge Seeding Step 2: Trusted Source Discovery Validation");
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const classifier = new TrustedSourceClassifier();
  const discovery = new TrustedSourceDiscoveryService();
  const sources = TRUSTED_SOURCE_LIBRARY.map(asRegistered);

  const failedVerification = TRUSTED_SOURCE_LIBRARY.filter(
    (entry) => !verifyKnowledgeSource(entry.definition).verified
  );
  results.catalogVerification = {
    passed: failedVerification.length === 0,
    detail:
      failedVerification.length === 0
        ? `${TRUSTED_SOURCE_LIBRARY.length} catalog sources verify statically`
        : `Failed: ${failedVerification.map((entry) => entry.definition.id).join(", ")}`,
  };

  results.existingUpgraded = {
    passed: EXISTING_TRUSTED_SOURCE_IDS.length === 25,
    detail: `${EXISTING_TRUSTED_SOURCE_IDS.length} existing sources upgraded with discovery metadata`,
  };

  results.newSources = {
    passed: NEW_TRUSTED_SOURCE_IDS.length > 15,
    detail: `${NEW_TRUSTED_SOURCE_IDS.length} new sources registered in discovery catalog`,
  };

  const incomplete = TRUSTED_SOURCE_LIBRARY.filter((entry) => {
    const d = entry.definition;
    return (
      !d.id ||
      !d.name ||
      !d.category ||
      !d.domainIds?.length ||
      !d.officialWebsite ||
      !d.resourceType ||
      !d.language ||
      !d.trustClass ||
      !d.updateFrequency ||
      !d.accessMethod ||
      !d.license
    );
  });
  results.metadataCompleteness = {
    passed: incomplete.length === 0,
    detail: incomplete.length ? `Incomplete: ${incomplete.map((e) => e.definition.id).join(", ")}` : "All required discovery fields present",
  };

  results.trustClassification = {
    passed: classifier.mayAutoApprove() === false && sources.every((source) => Boolean(classifier.classify(source))),
    detail: "Trust classes assigned; auto-approval disabled",
  };

  const coverage = discovery.buildCoverage(sources);
  const missing = coverage.filter((item) => item.coverageLevel === "missing");
  results.topicCoverage = {
    passed: coverage.length === REQUIRED_DISCOVERY_TOPIC_IDS.length && missing.length === 0,
    detail: `${coverage.length - missing.length}/${REQUIRED_DISCOVERY_TOPIC_IDS.length} topics covered`,
  };

  const recommendation = discovery.recommendBest(sources, "video-production");
  results.recommendation = {
    passed: Boolean(recommendation?.whySelected && recommendation.trustScore > 0),
    detail: recommendation
      ? `Best video-production source: ${recommendation.name} (${recommendation.trustClass})`
      : "No recommendation",
  };

  const awareness = discovery.buildAiMeAwareness(sources);
  results.aiMeAwareness = {
    passed: awareness.totalRegistered === TRUSTED_SOURCE_LIBRARY.length && awareness.approved === 0,
    detail: awareness.summary,
  };

  const report = discovery.buildDiscoveryReport(sources);
  results.discoveryReport = {
    passed:
      report.existingSourcesFound.length === 25 &&
      report.newSourcesRegistered.length === NEW_TRUSTED_SOURCE_IDS.length &&
      report.trustScores.length === sources.length &&
      report.qualityScores.length === sources.length,
    detail: `existing=${report.existingSourcesFound.length}, new=${report.newSourcesRegistered.length}, categories=${report.sourceCategories.length}`,
  };

  results.noDownload = {
    passed: sources.every((source) => source.status === "pending"),
    detail: "Discovery-only: all catalog sources remain pending (not downloaded, not auto-approved)",
  };

  const trustClasses = new Set(sources.map((source) => classifier.classify(source)));
  results.trustTiersPresent = {
    passed:
      trustClasses.has(KnowledgeSourceTrustClass.Official) &&
      trustClasses.has(KnowledgeSourceTrustClass.HighlyTrusted) &&
      trustClasses.has(KnowledgeSourceTrustClass.Trusted),
    detail: `Trust tiers present: ${[...trustClasses].join(", ")}`,
  };

  console.log("");
  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    const mark = result.passed ? "PASS" : "FAIL";
    if (!result.passed) failed += 1;
    console.log(`[${mark}] ${name}: ${result.detail}`);
  }
  console.log("---");
  if (failed > 0) {
    console.error(`Validation failed: ${failed} check(s)`);
    process.exit(1);
  }
  console.log("Trusted Source Discovery validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
