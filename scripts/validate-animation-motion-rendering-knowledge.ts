import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiCore,
  AMR_DOMAIN_BRIDGES,
  ANIMATION_DOMAIN_ID,
  createAiCore,
  MOTION_GRAPHICS_DOMAIN_ID,
  PROFESSIONAL_ANIMATION_MOTION_RENDERING_VERSION,
  PROFESSIONAL_ANIMATION_TOPICS,
  PROFESSIONAL_MOTION_GRAPHICS_TOPICS,
  PROFESSIONAL_RENDERING_TOPICS,
  PROFESSIONAL_TRANSITION_TOPICS,
  RENDERING_DOMAIN_ID,
  REQUIRED_ANIMATION_TOPIC_IDS,
  REQUIRED_MOTION_GRAPHICS_TOPIC_IDS,
  REQUIRED_RENDERING_TOPIC_IDS,
  REQUIRED_TRANSITION_TOPIC_IDS,
} from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-amr-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Expansion Step 5: Animation, Motion Graphics & Rendering");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-amr");
    const foundation = core.getManager().knowledgeFoundation!;
    const amr = foundation.getProfessionalAnimationMotionRenderingKnowledge();

    results.animationCompleteness = {
      passed: REQUIRED_ANIMATION_TOPIC_IDS.length === 12 && PROFESSIONAL_ANIMATION_TOPICS.length === 12,
      detail: `animation=${PROFESSIONAL_ANIMATION_TOPICS.length}`,
    };
    results.motionCompleteness = {
      passed: REQUIRED_MOTION_GRAPHICS_TOPIC_IDS.length === 10 && PROFESSIONAL_MOTION_GRAPHICS_TOPICS.length === 10,
      detail: `motion=${PROFESSIONAL_MOTION_GRAPHICS_TOPICS.length}`,
    };
    results.transitionCompleteness = {
      passed: REQUIRED_TRANSITION_TOPIC_IDS.length === 10 && PROFESSIONAL_TRANSITION_TOPICS.length === 10,
      detail: `transitions=${PROFESSIONAL_TRANSITION_TOPICS.length}`,
    };
    results.renderingCompleteness = {
      passed: REQUIRED_RENDERING_TOPIC_IDS.length === 12 && PROFESSIONAL_RENDERING_TOPICS.length === 12,
      detail: `rendering=${PROFESSIONAL_RENDERING_TOPICS.length}`,
    };

    const install = amr.getLastInstall();
    results.install = {
      passed: Boolean(install?.installed && install.domainsMarkedReady),
      detail: `installed=${install?.installed}; anim=${install?.animationInstalled}; motion=${install?.motionInstalled}; trans=${install?.transitionInstalled}; render=${install?.renderingInstalled}; rel=${install?.relationshipsCreated}`,
    };

    const all = [
      ...PROFESSIONAL_ANIMATION_TOPICS,
      ...PROFESSIONAL_MOTION_GRAPHICS_TOPICS,
      ...PROFESSIONAL_TRANSITION_TOPICS,
      ...PROFESSIONAL_RENDERING_TOPICS,
    ];
    let persisted = 0;
    for (const topic of all) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, "validate");
      if (read.success && read.record) persisted += 1;
    }
    results.persistence = { passed: persisted === all.length, detail: `persisted=${persisted}/${all.length}` };

    results.domainBridges = {
      passed: AMR_DOMAIN_BRIDGES.length === 9,
      detail: `bridges=${AMR_DOMAIN_BRIDGES.length}`,
    };

    const health = await amr.runHealthCheck();
    results.health = {
      passed:
        health.healthy &&
        health.missingConcepts.length === 0 &&
        health.duplicateKnowledge.length === 0 &&
        health.brokenRelationships.length === 0,
      detail: `healthy=${health.healthy}; completeness=${health.completenessScore}`,
    };

    if (!health.healthy) {
      const repair = await amr.repair();
      const recheck = await amr.runHealthCheck();
      results.autoRepair = {
        passed: recheck.healthy,
        detail: `repaired=${repair.repaired}; remaining=${repair.remainingIssues.length}`,
      };
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }

    results.aiMeAnimation = {
      passed: amr.recommendAnimationStyle("character with follow through").available,
      detail: amr.recommendAnimationStyle("character with follow through").name,
    };
    results.aiMeMotion = {
      passed: amr.recommendMotionGraphics("kinetic text titles").available,
      detail: amr.recommendMotionGraphics("kinetic text titles").name,
    };
    results.aiMeRendering = {
      passed: amr.recommendRenderingSettings("ProRes master codec").available,
      detail: amr.recommendRenderingSettings("ProRes master codec").name,
    };
    results.aiMeExport = {
      passed: amr.recommendExportSettings("youtube 1080p").available,
      detail: amr.recommendExportSettings("youtube 1080p").name,
    };
    results.aiMeExplain = {
      passed: amr.explain("match cut").available,
      detail: amr.explain("match cut").title,
    };
    results.aiMeAnswer = {
      passed: amr.answer("How should I set bitrate for motion graphics with text?").available,
      detail: `confidence=${amr.answer("How should I set bitrate for motion graphics with text?").confidenceScore}`,
    };

    const awareness = amr.getAiMeAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.canRecommendAnimationStyles &&
        awareness.canRecommendMotionGraphics &&
        awareness.canRecommendRenderingSettings &&
        awareness.canExplainRenderingDecisions &&
        awareness.canRecommendExportSettings &&
        awareness.canAnswerQuestions,
      detail: awareness.summary.slice(0, 160),
    };

    results.domainsReady = {
      passed:
        foundation.getKnowledgeDomainPlanner().getDomain(ANIMATION_DOMAIN_ID)?.metadata.contentReady === true &&
        foundation.getKnowledgeDomainPlanner().getDomain(MOTION_GRAPHICS_DOMAIN_ID)?.metadata.contentReady === true &&
        foundation.getKnowledgeDomainPlanner().getDomain(RENDERING_DOMAIN_ID)?.metadata.contentReady === true,
      detail: "animation + motion + rendering contentReady",
    };

    results.editingNotStarted = {
      passed: foundation.getKnowledgeDomainPlanner().getDomain("video-editing-knowledge")?.metadata.contentReady !== true,
      detail: "Professional Video Editing not started (Step 5 only)",
    };

    results.packsSynced = {
      passed:
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "animation", "pack.json")) &&
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "motion", "pack.json")) &&
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "rendering", "pack.json")),
      detail: "animation + motion + rendering packs",
    };

    results.version = {
      passed: PROFESSIONAL_ANIMATION_MOTION_RENDERING_VERSION === "1.0.0",
      detail: `version=${PROFESSIONAL_ANIMATION_MOTION_RENDERING_VERSION}`,
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
  console.log("Professional Animation, Motion Graphics & Rendering Knowledge Expansion Step 5 passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
