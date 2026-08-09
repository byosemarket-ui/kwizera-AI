import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore } from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-multi-domain-intelligence-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Professional Reasoning & Decision Intelligence Step 6");
  console.log("Multi-Domain Reasoning Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");
  console.log("Starting Knowledge Foundation (cold start may take several minutes)...");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-multi-domain-intelligence");
    console.log("Knowledge Foundation ready.");
    const engine = core.getManager().multiDomainEngine!;
    const recommendationAwareness = core.getManager().recommendationEngine!.getAiMeProfessionalRecommendationAwareness();

    const awareness = engine.getAiMeProfessionalMultiDomainAwareness();
    results.aiMeAwareness = {
      passed:
        awareness.available &&
        awareness.enabled &&
        awareness.groundedInKnowledgeFoundation &&
        awareness.selfReviewEnabled &&
        recommendationAwareness.multiDomainReasoningEnabled,
      detail: `available=${awareness.available}; enabled=${awareness.enabled}; selfReview=${awareness.selfReviewEnabled}; recommendationFlag=${recommendationAwareness.multiDomainReasoningEnabled}`,
    };

    const reasoning = await engine.reasonMultiDomain({
      request:
        "multi-domain reason about camera lighting storytelling marketing branding social media and industry standards for a product advertisement",
      objective: "Cross-domain professional product ad reasoning",
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
      reuseSimilarReasoning: true,
    });

    results.crossDomainReasoning = {
      passed:
        reasoning.grounded &&
        !reasoning.unsupported &&
        reasoning.framework.domainsParticipating.length >= 3 &&
        reasoning.confidenceScore > 50,
      detail: `grounded=${reasoning.grounded}; domains=${reasoning.framework.domainsParticipating.length}; confidence=${reasoning.confidenceScore}`,
    };

    results.knowledgeIntegration = {
      passed:
        reasoning.explanation.knowledgeIdsUsed.length + reasoning.explanation.knowledgePacksUsed.length > 0 &&
        reasoning.memoryRecord.knowledgeUsed.length > 0 &&
        reasoning.framework.crossDomainAnalysis.length >= 6,
      detail: `knowledgeIds=${reasoning.explanation.knowledgeIdsUsed.length}; packs=${reasoning.explanation.knowledgePacksUsed.length}; dimensions=${reasoning.framework.crossDomainAnalysis.length}`,
    };

    results.conflictDetection = {
      passed: reasoning.framework.conflicts.length >= 1,
      detail: `conflicts=${reasoning.framework.conflicts.length}`,
    };

    results.conflictResolution = {
      passed:
        reasoning.framework.conflicts.every((conflict) => Boolean(conflict.resolution && conflict.whySelected)) &&
        Boolean(reasoning.framework.combinedRecommendation),
      detail: `resolved=${reasoning.framework.conflicts.filter((c) => c.resolution).length}; solutionChars=${reasoning.framework.combinedRecommendation.length}`,
    };

    results.explanationQuality = {
      passed:
        reasoning.explanation.whySelected.length > 40 &&
        reasoning.explanation.domainsParticipating.length >= 2 &&
        reasoning.explanation.decisionRulesApplied.length > 0 &&
        reasoning.explanation.workflowsReferenced.length > 0,
      detail: `whyChars=${reasoning.explanation.whySelected.length}; rules=${reasoning.explanation.decisionRulesApplied.length}; workflows=${reasoning.explanation.workflowsReferenced.length}`,
    };

    const duplicate = await engine.reasonMultiDomain({
      request:
        "multi-domain reason about camera lighting storytelling marketing branding social media and industry standards for a product advertisement",
      objective: "Cross-domain professional product ad reasoning",
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
      reuseSimilarReasoning: true,
    });
    results.reasoningConsistency = {
      passed:
        duplicate.reused ||
        duplicate.memoryRecord.priorReasoningIds.includes(reasoning.reasoningId) ||
        duplicate.framework.combinedRecommendation === reasoning.framework.combinedRecommendation,
      detail: `reused=${duplicate.reused}; priorIncludesFirst=${duplicate.memoryRecord.priorReasoningIds.includes(reasoning.reasoningId)}`,
    };

    const memoryPath = path.join(storageRoot, "multi-domain", "professional-multi-domain-memory.jsonl");
    results.memoryStorage = {
      passed: fs.existsSync(memoryPath) && engine.getMultiDomainReasoningHistory().length >= 1,
      detail: `pathExists=${fs.existsSync(memoryPath)}; count=${engine.getMultiDomainReasoningHistory().length}`,
    };

    let health = await engine.runMultiDomainHealthCheck();
    if (!health.healthy) {
      const repair = await engine.repairMultiDomainIntelligence();
      results.autoRepair = {
        passed: repair.repaired,
        detail: `actions=${repair.actions.join("; ")}; remaining=${repair.remainingIssues.join("; ")}`,
      };
      health = await engine.runMultiDomainHealthCheck();
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }
    results.health = {
      passed: health.healthy && health.canReasonMultiDomain && health.memoryWritable,
      detail: `healthy=${health.healthy}; canReason=${health.canReasonMultiDomain}`,
    };

    results.selfReviewEnabled = {
      passed: awareness.selfReviewEnabled,
      detail: "Self-Review & Professional Evaluation enabled for Step 7 consumption",
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
