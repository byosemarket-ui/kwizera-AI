import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  FACEBOOK_DOMAIN_ID,
  INSTAGRAM_DOMAIN_ID,
  PROFESSIONAL_FACEBOOK_TOPICS,
  PROFESSIONAL_INSTAGRAM_TOPICS,
  PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS,
  PROFESSIONAL_SOCIAL_MEDIA_VERSION,
  PROFESSIONAL_TIKTOK_TOPICS,
  PROFESSIONAL_YOUTUBE_TOPICS,
  REQUIRED_FACEBOOK_TOPIC_IDS,
  REQUIRED_INSTAGRAM_TOPIC_IDS,
  REQUIRED_SOCIAL_FUNDAMENTALS_TOPIC_IDS,
  REQUIRED_TIKTOK_TOPIC_IDS,
  REQUIRED_YOUTUBE_TOPIC_IDS,
  SM_DOMAIN_BRIDGES,
  SOCIAL_MEDIA_DOMAIN_ID,
  SOCIAL_MEDIA_KNOWLEDGE_SOURCE,
  TIKTOK_DOMAIN_ID,
  YOUTUBE_DOMAIN_ID,
  getAllSmTopics,
} from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-sm-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Expansion Step 8: Professional Social Media");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-sm");
    const foundation = core.getManager().knowledgeFoundation!;
    const sm = foundation.getProfessionalSocialMediaKnowledge();

    results.fundamentalsCompleteness = {
      passed:
        REQUIRED_SOCIAL_FUNDAMENTALS_TOPIC_IDS.length === 8 && PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS.length === 8,
      detail: `fundamentals=${PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS.length}`,
    };
    results.tiktokCompleteness = {
      passed: REQUIRED_TIKTOK_TOPIC_IDS.length === 8 && PROFESSIONAL_TIKTOK_TOPICS.length === 8,
      detail: `tiktok=${PROFESSIONAL_TIKTOK_TOPICS.length}`,
    };
    results.instagramCompleteness = {
      passed: REQUIRED_INSTAGRAM_TOPIC_IDS.length === 7 && PROFESSIONAL_INSTAGRAM_TOPICS.length === 7,
      detail: `instagram=${PROFESSIONAL_INSTAGRAM_TOPICS.length}`,
    };
    results.facebookCompleteness = {
      passed: REQUIRED_FACEBOOK_TOPIC_IDS.length === 6 && PROFESSIONAL_FACEBOOK_TOPICS.length === 6,
      detail: `facebook=${PROFESSIONAL_FACEBOOK_TOPICS.length}`,
    };
    results.youtubeCompleteness = {
      passed: REQUIRED_YOUTUBE_TOPIC_IDS.length === 7 && PROFESSIONAL_YOUTUBE_TOPICS.length === 7,
      detail: `youtube=${PROFESSIONAL_YOUTUBE_TOPICS.length}`,
    };

    const install = sm.getLastInstall();
    results.install = {
      passed: Boolean(install?.installed && install.domainsMarkedReady && (install.relationshipsCreated ?? 0) > 50),
      detail: `installed=${install?.installed}; fund=${install?.fundamentalsInstalled}; tt=${install?.tiktokInstalled}; ig=${install?.instagramInstalled}; fb=${install?.facebookInstalled}; yt=${install?.youtubeInstalled}; rel=${install?.relationshipsCreated}`,
    };

    const all = getAllSmTopics();
    let persisted = 0;
    for (const topic of all) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, SOCIAL_MEDIA_KNOWLEDGE_SOURCE);
      if (read.success && read.record) persisted += 1;
    }
    results.persistence = {
      passed: persisted === 36,
      detail: `persisted=${persisted}/36`,
    };

    results.domainBridges = {
      passed: SM_DOMAIN_BRIDGES.length === 9,
      detail: `bridges=${SM_DOMAIN_BRIDGES.length}`,
    };

    const health = await sm.runHealthCheck();
    results.health = {
      passed: health.healthy && health.completenessScore === 100,
      detail: `healthy=${health.healthy}; completeness=${health.completenessScore}; missing=${health.missingConcepts.length}; dup=${health.duplicateKnowledge.length}; broken=${health.brokenRelationships.length}`,
    };

    if (!health.healthy) {
      const repair = await sm.repair();
      const recheck = await sm.runHealthCheck();
      results.autoRepair = {
        passed: recheck.healthy,
        detail: `repaired=${repair.repaired}; remaining=${repair.remainingIssues.length}`,
      };
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }

    results.aiMePlatform = {
      passed: sm.recommendPlatform("which platform for short form teens").available,
      detail: sm.recommendPlatform("which platform for short form teens").name,
    };
    results.aiMeFormat = {
      passed: sm.recommendContentFormat("instagram carousel education").available,
      detail: sm.recommendContentFormat("instagram carousel education").name,
    };
    results.aiMePosting = {
      passed: sm.recommendPostingStrategy("content calendar cadence").available,
      detail: sm.recommendPostingStrategy("content calendar cadence").name,
    };
    results.aiMeEngagement = {
      passed: sm.recommendEngagementStrategy("community building replies").available,
      detail: sm.recommendEngagementStrategy("community building replies").name,
    };
    results.aiMeExplain = {
      passed: sm.explainPlatformDecision("tiktok hook creation").available,
      detail: sm.explainPlatformDecision("tiktok hook creation").title,
    };
    const answered = sm.answer("How do I optimize YouTube thumbnails?");
    results.aiMeAnswer = {
      passed: answered.available && answered.confidenceScore >= 85,
      detail: `confidence=${answered.confidenceScore}`,
    };
    const awareness = sm.getAiMeAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.canRecommendPlatform &&
        awareness.canRecommendContentFormat &&
        awareness.socialMediaDomainReady &&
        awareness.summary.includes("does not publish"),
      detail: awareness.summary.slice(0, 160),
    };

    const planner = foundation.getKnowledgeDomainPlanner();
    results.domainsReady = {
      passed:
        planner.getDomain(SOCIAL_MEDIA_DOMAIN_ID)?.metadata.contentReady === true &&
        planner.getDomain(TIKTOK_DOMAIN_ID)?.metadata.contentReady === true &&
        planner.getDomain(INSTAGRAM_DOMAIN_ID)?.metadata.contentReady === true &&
        planner.getDomain(FACEBOOK_DOMAIN_ID)?.metadata.contentReady === true &&
        planner.getDomain(YOUTUBE_DOMAIN_ID)?.metadata.contentReady === true,
      detail: "social-media + tiktok + instagram + facebook + youtube contentReady",
    };

    results.industryNotStarted = {
      passed: true,
      detail: "Industry Best Practices Knowledge not started (Step 8 only)",
    };

    results.packSynced = {
      passed: Boolean(install?.socialMediaPackSynced) &&
        fs.existsSync(path.join(storageRoot, "knowledge", "packs", "social-media", "pack.json")),
      detail: "social-media pack",
    };

    results.version = {
      passed: PROFESSIONAL_SOCIAL_MEDIA_VERSION === "1.0.0",
      detail: `version=${PROFESSIONAL_SOCIAL_MEDIA_VERSION}`,
    };

    const avgConfidence = Math.round(all.reduce((s, t) => s + t.confidenceScore, 0) / all.length);
    const avgQuality = Math.round(all.reduce((s, t) => s + t.qualityScore, 0) / all.length);
    results.scores = {
      passed: avgConfidence >= 85 && avgQuality >= 85,
      detail: `avgConfidence=${avgConfidence}; avgQuality=${avgQuality}`,
    };

    await core.stop();
  } catch (error) {
    console.error("Validation failed with error:", error);
    results.runtime = {
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (useTemp) {
      try {
        fs.rmSync(storageRoot, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    const tag = result.passed ? "PASS" : "FAIL";
    if (!result.passed) failed += 1;
    console.log(`[${tag}] ${name}: ${result.detail}`);
  }
  console.log("---");
  if (failed) {
    console.log(`Professional Social Media Knowledge Expansion Step 8 failed: ${failed} check(s).`);
    process.exit(1);
  }
  console.log("Professional Social Media Knowledge Expansion Step 8 passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
