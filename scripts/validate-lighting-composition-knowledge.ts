import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiCore,
  COMPOSITION_DOMAIN_ID,
  createAiCore,
  LIGHTING_COMPOSITION_DOMAIN_BRIDGES,
  LIGHTING_DOMAIN_ID,
  PROFESSIONAL_COMPOSITION_TOPICS,
  PROFESSIONAL_LIGHTING_COMPOSITION_VERSION,
  PROFESSIONAL_LIGHTING_TOPICS,
  REQUIRED_COMPOSITION_TOPIC_IDS,
  REQUIRED_LIGHTING_TOPIC_IDS,
} from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-lighting-composition-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Expansion Step 3: Lighting & Composition Knowledge");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-lighting-composition");
    const foundation = core.getManager().knowledgeFoundation!;
    const lc = foundation.getProfessionalLightingCompositionKnowledge();

    results.lightingCompleteness = {
      passed: REQUIRED_LIGHTING_TOPIC_IDS.length === 20 && PROFESSIONAL_LIGHTING_TOPICS.length === 20,
      detail: `lighting=${PROFESSIONAL_LIGHTING_TOPICS.length}`,
    };
    results.compositionCompleteness = {
      passed: REQUIRED_COMPOSITION_TOPIC_IDS.length === 16 && PROFESSIONAL_COMPOSITION_TOPICS.length === 16,
      detail: `composition=${PROFESSIONAL_COMPOSITION_TOPICS.length}`,
    };

    const install = lc.getLastInstall();
    results.install = {
      passed: Boolean(install?.installed && install.domainsMarkedReady),
      detail: `installed=${install?.installed}; lighting=${install?.lightingInstalled}/${install?.lightingUpdated}; composition=${install?.compositionInstalled}/${install?.compositionUpdated}; rel=${install?.relationshipsCreated}`,
    };

    let persisted = 0;
    const all = [...PROFESSIONAL_LIGHTING_TOPICS, ...PROFESSIONAL_COMPOSITION_TOPICS];
    for (const topic of all) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, "validate");
      if (read.success && read.record) persisted += 1;
    }
    results.persistence = { passed: persisted === all.length, detail: `persisted=${persisted}/${all.length}` };

    results.domainBridges = {
      passed: LIGHTING_COMPOSITION_DOMAIN_BRIDGES.length === 8,
      detail: `bridges=${LIGHTING_COMPOSITION_DOMAIN_BRIDGES.length}`,
    };

    const health = await lc.runHealthCheck();
    results.health = {
      passed:
        health.healthy &&
        health.missingConcepts.length === 0 &&
        health.duplicateKnowledge.length === 0 &&
        health.brokenRelationships.length === 0,
      detail: `healthy=${health.healthy}; completeness=${health.completenessScore}; lightingTermsMissing=${health.missingLightingTerminology.length}; compositionTermsMissing=${health.missingCompositionTerminology.length}`,
    };

    if (!health.healthy) {
      const repair = await lc.repair();
      const recheck = await lc.runHealthCheck();
      results.autoRepair = {
        passed: recheck.healthy,
        detail: `repaired=${repair.repaired}; actions=${repair.actions.length}; remaining=${repair.remainingIssues.length}`,
      };
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }

    const lighting = lc.recommendLighting("dramatic low contrast luxury night product");
    results.aiMeRecommendLighting = {
      passed: lighting.available && Boolean(lighting.reason),
      detail: `${lighting.name}`,
    };

    const composition = lc.recommendComposition("direct eye along architecture to subject");
    results.aiMeRecommendComposition = {
      passed: composition.available,
      detail: `${composition.name}`,
    };

    const compareL = lc.compareLighting("high-key lighting", "low-key lighting");
    results.aiMeCompareLighting = {
      passed: compareL.confidenceScore > 0 && compareL.topicA !== compareL.topicB,
      detail: `${compareL.topicA} vs ${compareL.topicB}`,
    };

    const compareC = lc.compareComposition("negative space", "positive space");
    results.aiMeCompareComposition = {
      passed: compareC.confidenceScore > 0 && compareC.topicA !== compareC.topicB,
      detail: `${compareC.topicA} vs ${compareC.topicB}`,
    };

    const explain = lc.explain("rule of thirds");
    results.aiMeExplain = { passed: explain.available, detail: explain.title };

    const answer = lc.answer("What is the best lighting for portraits?");
    results.aiMeAnswer = { passed: answer.available, detail: `confidence=${answer.confidenceScore}` };

    const awareness = lc.getAiMeAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.canRecommendLighting &&
        awareness.canRecommendComposition &&
        awareness.canExplainSelection &&
        awareness.canCompareLighting &&
        awareness.canCompareComposition &&
        awareness.canAnswerQuestions,
      detail: awareness.summary.slice(0, 160),
    };

    results.domainsReady = {
      passed:
        foundation.getKnowledgeDomainPlanner().getDomain(LIGHTING_DOMAIN_ID)?.metadata.contentReady === true &&
        foundation.getKnowledgeDomainPlanner().getDomain(COMPOSITION_DOMAIN_ID)?.metadata.contentReady === true,
      detail: "lighting + composition contentReady",
    };

    results.storytellingNotStarted = {
      passed: foundation.getKnowledgeDomainPlanner().getDomain("storytelling-knowledge")?.metadata.contentReady !== true,
      detail: "Storytelling & Scene Design not started (Step 3 only)",
    };

    results.packsSynced = {
      passed:
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "lighting", "pack.json")) &&
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "composition", "pack.json")),
      detail: "lighting + composition packs",
    };

    results.version = {
      passed: PROFESSIONAL_LIGHTING_COMPOSITION_VERSION === "1.0.0",
      detail: `version=${PROFESSIONAL_LIGHTING_COMPOSITION_VERSION}`,
    };

    const avgConfidence = Math.round(all.reduce((sum, t) => sum + t.confidenceScore, 0) / all.length);
    const avgQuality = Math.round(all.reduce((sum, t) => sum + t.qualityScore, 0) / all.length);
    results.scores = {
      passed: avgConfidence >= 85 && avgQuality >= 85,
      detail: `avgConfidence=${avgConfidence}; avgQuality=${avgQuality}`,
    };

    await core.stop();
    AiCore.resetInstance();
  } catch (error) {
    results.fatal = {
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (useTemp && fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  }

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
  console.log("Professional Lighting & Composition Knowledge Expansion Step 3 passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
