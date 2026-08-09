import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore } from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-decision-intelligence-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Professional Reasoning & Decision Intelligence Step 2");
  console.log("Decision Intelligence Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");
  console.log("Starting Knowledge Foundation (cold start may take several minutes)...");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-decision-intelligence");
    console.log("Knowledge Foundation ready.");
    const engine = core.getManager().decisionEngine!;

    const awareness = engine.getAiMeProfessionalDecisionAwareness();
    results.aiMeAwareness = {
      passed: awareness.available && awareness.enabled && awareness.groundedInKnowledgeFoundation && awareness.planningIntelligenceEnabled,
      detail: `available=${awareness.available}; enabled=${awareness.enabled}; planning=${awareness.planningIntelligenceEnabled}`,
    };

    const decision = await engine.decideProfessional({
      request: "decide professional camera lighting and marketing approach for a product advertisement on social media",
      objective: "Multi-domain professional product ad decision",
      context: { product: "skincare serum", audience: "women 25-40", platform: "tiktok" },
      requiredDomains: [
        "camera-knowledge",
        "lighting-knowledge",
        "marketing-knowledge",
        "social-media-knowledge",
        "industry-standards-knowledge",
      ],
      includeDomainModules: true,
    });

    results.decisionQuality = {
      passed:
        decision.grounded &&
        !decision.unsupported &&
        Boolean(decision.framework.finalRecommendation) &&
        decision.framework.availableOptions.length > 0 &&
        decision.confidenceScore > 50,
      detail: `grounded=${decision.grounded}; options=${decision.framework.availableOptions.length}; confidence=${decision.confidenceScore}`,
    };

    results.knowledgeUsage = {
      passed:
        decision.explanation.knowledgeIdsUsed.length + decision.explanation.knowledgePacksUsed.length > 0 &&
        decision.memoryRecord.knowledgeUsed.length > 0,
      detail: `knowledgeIds=${decision.explanation.knowledgeIdsUsed.length}; packs=${decision.explanation.knowledgePacksUsed.length}; memoryKnowledge=${decision.memoryRecord.knowledgeUsed.length}`,
    };

    results.explanationQuality = {
      passed:
        decision.explanation.whySelected.length > 20 &&
        decision.explanation.expectedOutcome.length > 10 &&
        (decision.explanation.alternativesRejected.length > 0 || decision.framework.availableOptions.length === 1),
      detail: `whyChars=${decision.explanation.whySelected.length}; rejected=${decision.explanation.alternativesRejected.length}; outcomeChars=${decision.explanation.expectedOutcome.length}`,
    };

    results.confidenceScoring = {
      passed: decision.confidenceScore > 50 && decision.confidenceExplanation.includes("Confidence"),
      detail: `confidence=${decision.confidenceScore}`,
    };

    const followUp = await engine.decideProfessional({
      request: "decide professional camera lighting and marketing approach for a product advertisement on social media",
      objective: "Multi-domain professional product ad decision",
      context: { product: "skincare serum", audience: "women 25-40", platform: "tiktok" },
      requiredDomains: [
        "camera-knowledge",
        "lighting-knowledge",
        "marketing-knowledge",
        "social-media-knowledge",
        "industry-standards-knowledge",
      ],
      includeDomainModules: true,
    });

    results.decisionConsistency = {
      passed: followUp.grounded && followUp.learnedFromHistory && followUp.memoryRecord.priorDecisionIds.includes(decision.decisionId),
      detail: `learned=${followUp.learnedFromHistory}; priorIncludesFirst=${followUp.memoryRecord.priorDecisionIds.includes(decision.decisionId)}`,
    };

    const memoryPath = path.join(storageRoot, "decisions", "professional-decision-memory.jsonl");
    results.decisionHistory = {
      passed:
        fs.existsSync(memoryPath) &&
        engine.getProfessionalDecisionHistory().length >= 2 &&
        Boolean(engine.getProfessionalDecisionHistory()[0]?.reasoningPath.length),
      detail: `pathExists=${fs.existsSync(memoryPath)}; count=${engine.getProfessionalDecisionHistory().length}`,
    };

    let health = await engine.runProfessionalDecisionHealthCheck();
    if (!health.healthy) {
      const repair = await engine.repairProfessionalDecisionIntelligence();
      results.autoRepair = {
        passed: repair.repaired,
        detail: `actions=${repair.actions.join("; ")}; remaining=${repair.remainingIssues.join("; ")}`,
      };
      health = await engine.runProfessionalDecisionHealthCheck();
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }
    results.health = {
      passed: health.healthy && health.canDecide && health.memoryWritable,
      detail: `healthy=${health.healthy}; canDecide=${health.canDecide}; memoryWritable=${health.memoryWritable}`,
    };

    results.planningIntelligenceAvailable = {
      passed: awareness.planningIntelligenceEnabled,
      detail: "Planning Intelligence is enabled and consumes Professional Decisions",
    };

    await core.stop();
  } finally {
    if (useTemp) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
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
