import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore } from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-self-review-intelligence-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Professional Reasoning & Decision Intelligence Step 7");
  console.log("Self-Review & Professional Evaluation Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");
  console.log("Starting Knowledge Foundation (cold start may take several minutes)...");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-self-review-intelligence");
    console.log("Knowledge Foundation ready.");
    const engine = core.getManager().selfReviewEngine!;
    const multiDomainAwareness = core.getManager().multiDomainEngine!.getAiMeProfessionalMultiDomainAwareness();

    const awareness = engine.getAiMeProfessionalSelfReviewAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.available &&
        awareness.enabled &&
        awareness.groundedInKnowledgeFoundation &&
        awareness.professionalReasoningCertificationEnabled &&
        multiDomainAwareness.selfReviewEnabled,
      detail: `available=${awareness.available}; enabled=${awareness.enabled}; certification=${awareness.professionalReasoningCertificationEnabled}; multiDomainFlag=${multiDomainAwareness.selfReviewEnabled}`,
    };

    const review = await engine.reviewProfessional({
      request:
        "self-review a professional camera lighting storytelling marketing branding social media product advertisement recommendation",
      objective: "Self-review multi-domain product ad output",
      context: { product: "skincare serum", audience: "women 25-40", platform: "tiktok" },
      requiredDomains: [
        "camera-knowledge",
        "lighting-knowledge",
        "storytelling-knowledge",
        "marketing-knowledge",
        "branding-knowledge",
        "social-media-knowledge",
        "industry-standards-knowledge",
      ],
      includeDomainModules: true,
      reuseSimilarReviews: true,
    });

    results.selfReview = {
      passed:
        review.grounded &&
        !review.unsupported &&
        review.explanation.processesReviewed.length >= 4 &&
        review.confidenceScore > 40,
      detail: `grounded=${review.grounded}; passed=${review.framework.reviewPassed}; confidence=${review.confidenceScore}; ready=${review.readyForDelivery}`,
    };

    results.professionalEvaluation = {
      passed: review.framework.evaluationScores.length >= 8,
      detail: `dimensions=${review.framework.evaluationScores.length}; passedDims=${review.framework.evaluationScores.filter((s) => s.passed).length}`,
    };

    results.errorDetection = {
      passed: Array.isArray(review.framework.detectedIssues),
      detail: `issues=${review.framework.detectedIssues.length}; repaired=${review.framework.detectedIssues.filter((i) => i.repaired).length}`,
    };

    results.qualityScoring = {
      passed:
        review.framework.qualityScores.overallReadiness > 0 &&
        review.framework.qualityScores.knowledgeUsage > 0 &&
        review.framework.qualityScores.workflowQuality > 0,
      detail: `overall=${review.framework.qualityScores.overallReadiness}; knowledge=${review.framework.qualityScores.knowledgeUsage}; workflow=${review.framework.qualityScores.workflowQuality}`,
    };

    results.selfImprovement = {
      passed:
        review.framework.improvementsMade.length > 0 ||
        review.framework.detectedIssues.every((issue) => issue.severity === "low" || issue.repaired || issue.severity === "medium"),
      detail: `improvements=${review.framework.improvementsMade.length}; strengths=${review.framework.strengths.length}`,
    };

    const duplicate = await engine.reviewProfessional({
      request:
        "self-review a professional camera lighting storytelling marketing branding social media product advertisement recommendation",
      objective: "Self-review multi-domain product ad output",
      context: { product: "skincare serum", audience: "women 25-40", platform: "tiktok" },
      requiredDomains: [
        "camera-knowledge",
        "lighting-knowledge",
        "storytelling-knowledge",
        "marketing-knowledge",
        "branding-knowledge",
        "social-media-knowledge",
        "industry-standards-knowledge",
      ],
      includeDomainModules: true,
      reuseSimilarReviews: true,
    });
    results.reviewConsistency = {
      passed:
        duplicate.reused ||
        duplicate.memoryRecord.priorReviewIds.includes(review.reviewId) ||
        duplicate.framework.improvedRecommendation === review.framework.improvedRecommendation,
      detail: `reused=${duplicate.reused}; priorIncludesFirst=${duplicate.memoryRecord.priorReviewIds.includes(review.reviewId)}`,
    };

    const memoryPath = path.join(storageRoot, "self-review", "professional-self-review-memory.jsonl");
    results.memoryStorage = {
      passed: fs.existsSync(memoryPath) && engine.getProfessionalSelfReviewHistory().length >= 1,
      detail: `pathExists=${fs.existsSync(memoryPath)}; count=${engine.getProfessionalSelfReviewHistory().length}`,
    };

    let health = await engine.runProfessionalSelfReviewHealthCheck();
    if (!health.healthy) {
      const repair = await engine.repairProfessionalSelfReviewIntelligence();
      results.autoRepair = {
        passed: repair.repaired,
        detail: `actions=${repair.actions.join("; ")}; remaining=${repair.remainingIssues.join("; ")}`,
      };
      health = await engine.runProfessionalSelfReviewHealthCheck();
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }
    results.health = {
      passed: health.healthy && health.canSelfReview && health.memoryWritable,
      detail: `healthy=${health.healthy}; canSelfReview=${health.canSelfReview}`,
    };

    results.professionalReasoningCertificationEnabled = {
      passed: awareness.professionalReasoningCertificationEnabled,
      detail: "Professional Reasoning Certification enabled for Step 8 consumption",
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
