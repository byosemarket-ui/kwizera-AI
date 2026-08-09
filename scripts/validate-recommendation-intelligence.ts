import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore } from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-recommendation-intelligence-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Professional Reasoning & Decision Intelligence Step 5");
  console.log("Recommendation Intelligence Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");
  console.log("Starting Knowledge Foundation (cold start may take several minutes)...");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-recommendation-intelligence");
    console.log("Knowledge Foundation ready.");
    const engine = core.getManager().recommendationEngine!;
    const workflowAwareness = core.getManager().workflowEngine!.getAiMeProfessionalWorkflowAwareness();

    const awareness = engine.getAiMeProfessionalRecommendationAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.available &&
        awareness.enabled &&
        awareness.groundedInKnowledgeFoundation &&
        awareness.multiDomainReasoningEnabled &&
        workflowAwareness.recommendationIntelligenceEnabled,
      detail: `available=${awareness.available}; enabled=${awareness.enabled}; multiDomain=${awareness.multiDomainReasoningEnabled}; workflowFlag=${workflowAwareness.recommendationIntelligenceEnabled}`,
    };

    const recommendation = await engine.recommendProfessional({
      request: "recommend a professional camera lighting storytelling marketing and social media product advertisement approach",
      objective: "Multi-domain professional product ad recommendation",
      context: { product: "skincare serum", audience: "women 25-40", platform: "tiktok" },
      requiredDomains: [
        "camera-knowledge",
        "lighting-knowledge",
        "storytelling-knowledge",
        "marketing-knowledge",
        "social-media-knowledge",
        "industry-standards-knowledge",
      ],
      includeDomainModules: true,
      reuseSimilarRecommendations: true,
    });

    results.recommendationQuality = {
      passed:
        recommendation.grounded &&
        !recommendation.unsupported &&
        Boolean(recommendation.framework.recommendedSolution) &&
        recommendation.confidenceScore > 50 &&
        recommendation.framework.bestPractices.length > 0,
      detail: `grounded=${recommendation.grounded}; confidence=${recommendation.confidenceScore}; solutionChars=${recommendation.framework.recommendedSolution.length}`,
    };

    results.alternativeAnalysis = {
      passed:
        recommendation.framework.alternativeSolutions.length >= 2 &&
        recommendation.framework.alternativeSolutions[0]?.rank === 1 &&
        Boolean(recommendation.explanation.rankingReason),
      detail: `alts=${recommendation.framework.alternativeSolutions.length}; rank1=${recommendation.framework.alternativeSolutions[0]?.title ?? "none"}`,
    };

    results.knowledgeUsage = {
      passed:
        recommendation.explanation.knowledgeIdsUsed.length + recommendation.explanation.knowledgePacksUsed.length > 0 &&
        recommendation.memoryRecord.knowledgeUsed.length > 0,
      detail: `knowledgeIds=${recommendation.explanation.knowledgeIdsUsed.length}; packs=${recommendation.explanation.knowledgePacksUsed.length}; memoryKnowledge=${recommendation.memoryRecord.knowledgeUsed.length}`,
    };

    results.explanationQuality = {
      passed:
        recommendation.explanation.whySelected.length > 40 &&
        recommendation.explanation.workflowsConsidered.length > 0 &&
        recommendation.explanation.expectedBenefits.length > 0 &&
        recommendation.explanation.professionalStandardsApplied.length > 0,
      detail: `whyChars=${recommendation.explanation.whySelected.length}; workflows=${recommendation.explanation.workflowsConsidered.length}; decisions=${recommendation.explanation.decisionsInfluenced.length}`,
    };

    const duplicate = await engine.recommendProfessional({
      request: "recommend a professional camera lighting storytelling marketing and social media product advertisement approach",
      objective: "Multi-domain professional product ad recommendation",
      context: { product: "skincare serum", audience: "women 25-40", platform: "tiktok" },
      requiredDomains: [
        "camera-knowledge",
        "lighting-knowledge",
        "storytelling-knowledge",
        "marketing-knowledge",
        "social-media-knowledge",
        "industry-standards-knowledge",
      ],
      includeDomainModules: true,
      reuseSimilarRecommendations: true,
    });
    results.recommendationConsistency = {
      passed:
        duplicate.reused ||
        duplicate.memoryRecord.priorRecommendationIds.includes(recommendation.recommendationId) ||
        duplicate.framework.recommendedSolution === recommendation.framework.recommendedSolution,
      detail: `reused=${duplicate.reused}; priorIncludesFirst=${duplicate.memoryRecord.priorRecommendationIds.includes(recommendation.recommendationId)}`,
    };

    const memoryPath = path.join(storageRoot, "recommendations", "professional-recommendation-memory.jsonl");
    results.recommendationMemory = {
      passed: fs.existsSync(memoryPath) && engine.getProfessionalRecommendationHistory().length >= 1,
      detail: `pathExists=${fs.existsSync(memoryPath)}; count=${engine.getProfessionalRecommendationHistory().length}`,
    };

    const withFeedback = engine.recordProfessionalRecommendationFeedback(
      recommendation.recommendationId,
      "Helpful multi-domain recommendation"
    );
    results.userFeedback = {
      passed: withFeedback.memoryRecord.userFeedback === "Helpful multi-domain recommendation",
      detail: `feedback=${withFeedback.memoryRecord.userFeedback ?? "none"}`,
    };

    let health = await engine.runProfessionalRecommendationHealthCheck();
    if (!health.healthy) {
      const repair = await engine.repairProfessionalRecommendationIntelligence();
      results.autoRepair = {
        passed: repair.repaired,
        detail: `actions=${repair.actions.join("; ")}; remaining=${repair.remainingIssues.join("; ")}`,
      };
      health = await engine.runProfessionalRecommendationHealthCheck();
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }
    results.health = {
      passed: health.healthy && health.canRecommend && health.memoryWritable,
      detail: `healthy=${health.healthy}; canRecommend=${health.canRecommend}`,
    };

    results.multiDomainReasoningEnabled = {
      passed: awareness.multiDomainReasoningEnabled,
      detail: "Multi-Domain Reasoning enabled for Step 6 consumption",
    };

    await core.stop();
  } finally {
    if (useTemp) fs.rmSync(storageRoot, { recursive: true, force: true });
  }

  console.log("");
  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    const mark = result.passed ? "PASS" : "FAIL";
    if (!result.passed) failed += 1;
    console.log(`[${mark}] ${name}: ${result.detail}`);
  }
  console.log("---");
  console.log(failed === 0 ? "VALIDATION PASSED" : `VALIDATION FAILED (${failed} check(s))`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
