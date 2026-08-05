import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiCore,
  createAiCore,
  PROFESSIONAL_VIDEO_PRODUCTION_TOPICS,
  PROFESSIONAL_VIDEO_PRODUCTION_VERSION,
  REQUIRED_VIDEO_PRODUCTION_TOPIC_IDS,
  VIDEO_PRODUCTION_DOMAIN_BRIDGES,
  VIDEO_PRODUCTION_DOMAIN_ID,
} from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-video-production-knowledge-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Expansion Step 1: Professional Video Production Knowledge");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-video-production-knowledge");
    const foundation = core.getManager().knowledgeFoundation!;
    const professional = foundation.getProfessionalVideoProductionKnowledge();
    const builder = foundation.getVideoProductionKnowledgeBuilder();

    results.topicCompleteness = {
      passed: REQUIRED_VIDEO_PRODUCTION_TOPIC_IDS.length === 19 && PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.length === 19,
      detail: `topics=${PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.length}`,
    };

    const install = professional.getLastInstall();
    results.install = {
      passed: Boolean(install?.installed && install.domainMarkedReady),
      detail: `installed=${install?.installed}; new=${install?.topicsInstalled}; updated=${install?.topicsUpdated}; rel=${install?.relationshipsCreated}; pack=${install?.packSynced}`,
    };

    let persisted = 0;
    for (const topic of PROFESSIONAL_VIDEO_PRODUCTION_TOPICS) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, "validate");
      if (read.success && read.record) persisted += 1;
    }
    results.persistence = {
      passed: persisted === PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.length,
      detail: `persisted=${persisted}/${PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.length}`,
    };

    results.domainBridges = {
      passed: VIDEO_PRODUCTION_DOMAIN_BRIDGES.length === 8,
      detail: `bridges=${VIDEO_PRODUCTION_DOMAIN_BRIDGES.length}`,
    };

    const health = await professional.runHealthCheck();
    results.health = {
      passed: health.healthy && health.missingConcepts.length === 0 && health.duplicateKnowledge.length === 0,
      detail: `healthy=${health.healthy}; completeness=${health.completenessScore}; missing=${health.missingConcepts.length}; dupes=${health.duplicateKnowledge.length}; brokenRel=${health.brokenRelationships.length}`,
    };

    if (!health.healthy) {
      const repair = await professional.repair();
      const recheck = await professional.runHealthCheck();
      results.autoRepair = {
        passed: recheck.healthy,
        detail: `repaired=${repair.repaired}; actions=${repair.actions.length}; remaining=${repair.remainingIssues.length}`,
      };
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }

    const explain = builder.explain("commercial video production");
    results.aiMeExplain = { passed: explain.available, detail: explain.title };

    const workflow = builder.recommendWorkflow("production workflow");
    results.aiMeWorkflow = { passed: workflow.available && workflow.workflow.length > 0, detail: workflow.reason };

    const practices = builder.recommendBestPractices("pre-production");
    results.aiMeBestPractices = {
      passed: practices.available && practices.practices.length > 0,
      detail: `practices=${practices.practices.length}`,
    };

    const compare = builder.compare("social media videos", "corporate videos");
    results.aiMeCompare = {
      passed: compare.confidenceScore > 0 && compare.differences.length > 0,
      detail: `${compare.topicA} vs ${compare.topicB}`,
    };

    const answer = builder.answer("What is professional shot planning?");
    results.aiMeAnswer = { passed: answer.available, detail: `confidence=${answer.confidenceScore}` };

    const awareness = professional.getAiMeAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.canExplain &&
        awareness.canRecommendWorkflows &&
        awareness.canRecommendBestPractices &&
        awareness.canCompareMethods &&
        awareness.canAnswerProfessionalQuestions,
      detail: awareness.summary.slice(0, 160),
    };

    results.domainReady = {
      passed: foundation.getKnowledgeDomainPlanner().getDomain(VIDEO_PRODUCTION_DOMAIN_ID)?.metadata.contentReady === true,
      detail: `contentReady=${foundation.getKnowledgeDomainPlanner().getDomain(VIDEO_PRODUCTION_DOMAIN_ID)?.metadata.contentReady}`,
    };

    results.cameraNotStarted = {
      passed: foundation.getKnowledgeDomainPlanner().getDomain("camera-knowledge")?.metadata.contentReady !== true,
      detail: "Camera Knowledge specialty content not started (Step 1 only)",
    };

    results.packSynced = {
      passed: fs.existsSync(path.join(storageRoot, "knowledge", "packs", "video-production", "pack.json")),
      detail: "video-production/pack.json",
    };

    results.version = {
      passed: PROFESSIONAL_VIDEO_PRODUCTION_VERSION === "1.0.0",
      detail: `version=${PROFESSIONAL_VIDEO_PRODUCTION_VERSION}`,
    };

    const avgConfidence = Math.round(
      PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.reduce((sum, topic) => sum + topic.confidenceScore, 0) /
        PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.length
    );
    const avgQuality = Math.round(
      PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.reduce((sum, topic) => sum + topic.qualityScore, 0) /
        PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.length
    );
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
  console.log("Professional Video Production Knowledge Expansion Step 1 passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
