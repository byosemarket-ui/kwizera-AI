import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiCore,
  createAiCore,
  PROFESSIONAL_SCENE_DESIGN_TOPICS,
  PROFESSIONAL_STORYTELLING_SCENE_VERSION,
  PROFESSIONAL_STORYTELLING_TOPICS,
  REQUIRED_SCENE_DESIGN_TOPIC_IDS,
  REQUIRED_STORYTELLING_TOPIC_IDS,
  SCENE_DOMAIN_ID,
  STORYTELLING_DOMAIN_ID,
  STORYTELLING_SCENE_DOMAIN_BRIDGES,
} from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-storytelling-scene-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Expansion Step 4: Storytelling & Scene Design");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-storytelling-scene");
    const foundation = core.getManager().knowledgeFoundation!;
    const ss = foundation.getProfessionalStorytellingSceneKnowledge();

    results.storytellingCompleteness = {
      passed: REQUIRED_STORYTELLING_TOPIC_IDS.length === 16 && PROFESSIONAL_STORYTELLING_TOPICS.length === 16,
      detail: `storytelling=${PROFESSIONAL_STORYTELLING_TOPICS.length}`,
    };
    results.sceneCompleteness = {
      passed: REQUIRED_SCENE_DESIGN_TOPIC_IDS.length === 17 && PROFESSIONAL_SCENE_DESIGN_TOPICS.length === 17,
      detail: `scene=${PROFESSIONAL_SCENE_DESIGN_TOPICS.length}`,
    };

    const install = ss.getLastInstall();
    results.install = {
      passed: Boolean(install?.installed && install.domainsMarkedReady),
      detail: `installed=${install?.installed}; story=${install?.storytellingInstalled}/${install?.storytellingUpdated}; scene=${install?.sceneInstalled}/${install?.sceneUpdated}; rel=${install?.relationshipsCreated}`,
    };

    let persisted = 0;
    const all = [...PROFESSIONAL_STORYTELLING_TOPICS, ...PROFESSIONAL_SCENE_DESIGN_TOPICS];
    for (const topic of all) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, "validate");
      if (read.success && read.record) persisted += 1;
    }
    results.persistence = { passed: persisted === all.length, detail: `persisted=${persisted}/${all.length}` };

    results.domainBridges = {
      passed: STORYTELLING_SCENE_DOMAIN_BRIDGES.length === 11,
      detail: `bridges=${STORYTELLING_SCENE_DOMAIN_BRIDGES.length}`,
    };

    const health = await ss.runHealthCheck();
    results.health = {
      passed:
        health.healthy &&
        health.missingConcepts.length === 0 &&
        health.duplicateKnowledge.length === 0 &&
        health.brokenSceneRelationships.length === 0 &&
        health.missingStoryStructureConcepts.length === 0,
      detail: `healthy=${health.healthy}; completeness=${health.completenessScore}; storyGaps=${health.missingStoryStructureConcepts.length}; relGaps=${health.brokenSceneRelationships.length}`,
    };

    if (!health.healthy) {
      const repair = await ss.repair();
      const recheck = await ss.runHealthCheck();
      results.autoRepair = {
        passed: recheck.healthy,
        detail: `repaired=${repair.repaired}; actions=${repair.actions.length}; remaining=${repair.remainingIssues.length}`,
      };
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }

    const structure = ss.buildStoryStructure("brand film with emotional arc");
    results.aiMeStoryStructure = {
      passed: structure.available && structure.acts.length === 3,
      detail: structure.structureName,
    };

    const sequence = ss.recommendSceneSequence("testimonial social proof video");
    results.aiMeSceneSequence = {
      passed: sequence.available && sequence.scenes.length >= 3,
      detail: `${sequence.sequenceName} (${sequence.scenes.length} scenes)`,
    };

    const emotion = ss.recommendEmotionalFlow("warm friendly family brand");
    results.aiMeEmotionalFlow = {
      passed: emotion.available && emotion.stages.length >= 3,
      detail: emotion.flowName,
    };

    const layout = ss.recommendSceneLayout("demonstration scene staging");
    results.aiMeSceneLayout = {
      passed: layout.available,
      detail: layout.sceneName,
    };

    const explain = ss.explain("three-act structure");
    results.aiMeExplain = { passed: explain.available, detail: explain.title };

    const answer = ss.answer("Where should I place the call to action?");
    results.aiMeAnswer = { passed: answer.available, detail: `confidence=${answer.confidenceScore}` };

    const awareness = ss.getAiMeAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.canBuildStoryStructures &&
        awareness.canRecommendSceneSequences &&
        awareness.canExplainStorytellingDecisions &&
        awareness.canRecommendEmotionalFlow &&
        awareness.canRecommendSceneLayouts &&
        awareness.canAnswerQuestions,
      detail: awareness.summary.slice(0, 160),
    };

    results.domainsReady = {
      passed:
        foundation.getKnowledgeDomainPlanner().getDomain(STORYTELLING_DOMAIN_ID)?.metadata.contentReady === true &&
        foundation.getKnowledgeDomainPlanner().getDomain(SCENE_DOMAIN_ID)?.metadata.contentReady === true,
      detail: "storytelling + scene contentReady",
    };

    results.animationNotStarted = {
      passed: foundation.getKnowledgeDomainPlanner().getDomain("animation-knowledge")?.metadata.contentReady !== true,
      detail: "Animation/Motion/Rendering not started (Step 4 only)",
    };

    results.packsSynced = {
      passed:
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "storytelling", "pack.json")) &&
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "scene", "pack.json")),
      detail: "storytelling + scene packs",
    };

    results.version = {
      passed: PROFESSIONAL_STORYTELLING_SCENE_VERSION === "1.0.0",
      detail: `version=${PROFESSIONAL_STORYTELLING_SCENE_VERSION}`,
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
  console.log("Professional Storytelling & Scene Design Knowledge Expansion Step 4 passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
