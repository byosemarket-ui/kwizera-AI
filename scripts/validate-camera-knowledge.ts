import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiCore,
  CAMERA_DOMAIN_BRIDGES,
  CAMERA_DOMAIN_ID,
  CAMERA_MOVEMENT_DOMAIN_ID,
  createAiCore,
  PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION,
  PROFESSIONAL_CAMERA_MOVEMENT_TOPICS,
  PROFESSIONAL_CAMERA_SETTING_TOPICS,
  REQUIRED_CAMERA_MOVEMENT_TOPIC_IDS,
  REQUIRED_CAMERA_SETTING_TOPIC_IDS,
} from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-camera-knowledge-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Expansion Step 2: Professional Camera Knowledge");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-camera-knowledge");
    const foundation = core.getManager().knowledgeFoundation!;
    const camera = foundation.getProfessionalCameraKnowledge();

    results.settingCompleteness = {
      passed: REQUIRED_CAMERA_SETTING_TOPIC_IDS.length === 15 && PROFESSIONAL_CAMERA_SETTING_TOPICS.length === 15,
      detail: `settings=${PROFESSIONAL_CAMERA_SETTING_TOPICS.length}`,
    };
    results.movementCompleteness = {
      passed: REQUIRED_CAMERA_MOVEMENT_TOPIC_IDS.length === 22 && PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.length === 22,
      detail: `movements=${PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.length}`,
    };

    const install = camera.getLastInstall();
    results.install = {
      passed: Boolean(install?.installed && install.domainsMarkedReady),
      detail: `installed=${install?.installed}; settings=${install?.settingsInstalled}/${install?.settingsUpdated}; movements=${install?.movementsInstalled}/${install?.movementsUpdated}; rel=${install?.relationshipsCreated}`,
    };

    let persisted = 0;
    for (const topic of [...PROFESSIONAL_CAMERA_SETTING_TOPICS, ...PROFESSIONAL_CAMERA_MOVEMENT_TOPICS]) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, "validate");
      if (read.success && read.record) persisted += 1;
    }
    const expected = PROFESSIONAL_CAMERA_SETTING_TOPICS.length + PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.length;
    results.persistence = { passed: persisted === expected, detail: `persisted=${persisted}/${expected}` };

    results.domainBridges = {
      passed: CAMERA_DOMAIN_BRIDGES.length === 8,
      detail: `bridges=${CAMERA_DOMAIN_BRIDGES.length}`,
    };

    const health = await camera.runHealthCheck();
    results.health = {
      passed:
        health.healthy &&
        health.missingConcepts.length === 0 &&
        health.duplicateKnowledge.length === 0 &&
        health.brokenRelationships.length === 0,
      detail: `healthy=${health.healthy}; completeness=${health.completenessScore}; missing=${health.missingConcepts.length}; terminology=${health.missingTerminology.length}; brokenRel=${health.brokenRelationships.length}`,
    };

    if (!health.healthy) {
      const repair = await camera.repair();
      const recheck = await camera.runHealthCheck();
      results.autoRepair = {
        passed: recheck.healthy,
        detail: `repaired=${repair.repaired}; actions=${repair.actions.length}; remaining=${repair.remainingIssues.length}`,
      };
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }

    const movement = camera.recommendMovement("follow walking talent smoothly");
    results.aiMeRecommendMovement = {
      passed: movement.available && Boolean(movement.reason),
      detail: `${movement.name}: ${movement.reason.slice(0, 80)}`,
    };

    const settings = camera.recommendSettings("aperture and depth of field");
    results.aiMeRecommendSettings = {
      passed: settings.available && settings.settingsGuidance.length > 0,
      detail: settings.title,
    };

    const compare = camera.compareMovements("handheld", "gimbal");
    results.aiMeCompare = {
      passed: compare.confidenceScore > 0 && compare.differences.length > 0,
      detail: `${compare.movementA} vs ${compare.movementB}`,
    };

    const explain = camera.explain("white balance");
    results.aiMeExplain = { passed: explain.available, detail: explain.title };

    const answer = camera.answer("What is the difference between dolly and zoom?");
    results.aiMeAnswer = { passed: answer.available, detail: `confidence=${answer.confidenceScore}` };

    const awareness = camera.getAiMeAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.canRecommendMovement &&
        awareness.canExplainMovementChoice &&
        awareness.canRecommendSettings &&
        awareness.canCompareMovements &&
        awareness.canAnswerCameraQuestions,
      detail: awareness.summary.slice(0, 160),
    };

    results.domainsReady = {
      passed:
        foundation.getKnowledgeDomainPlanner().getDomain(CAMERA_DOMAIN_ID)?.metadata.contentReady === true &&
        foundation.getKnowledgeDomainPlanner().getDomain(CAMERA_MOVEMENT_DOMAIN_ID)?.metadata.contentReady === true,
      detail: "camera + camera-movement contentReady",
    };

    results.lightingNotStarted = {
      passed: foundation.getKnowledgeDomainPlanner().getDomain("lighting-knowledge")?.metadata.contentReady !== true,
      detail: "Lighting & Composition specialty not started (Step 2 only)",
    };

    results.packsSynced = {
      passed:
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "camera", "pack.json")) &&
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "camera-movement", "pack.json")),
      detail: "camera + camera-movement packs",
    };

    results.version = {
      passed: PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION === "1.0.0",
      detail: `version=${PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION}`,
    };

    const avgConfidence = Math.round(
      [...PROFESSIONAL_CAMERA_SETTING_TOPICS, ...PROFESSIONAL_CAMERA_MOVEMENT_TOPICS].reduce(
        (sum, t) => sum + t.confidenceScore,
        0
      ) / expected
    );
    const avgQuality = Math.round(
      [...PROFESSIONAL_CAMERA_SETTING_TOPICS, ...PROFESSIONAL_CAMERA_MOVEMENT_TOPICS].reduce(
        (sum, t) => sum + t.qualityScore,
        0
      ) / expected
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
  console.log("Professional Camera Knowledge Expansion Step 2 passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
