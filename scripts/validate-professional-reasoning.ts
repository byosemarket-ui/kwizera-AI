import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore } from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-professional-reasoning-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Professional Reasoning & Decision Intelligence Step 1");
  console.log("Professional Reasoning Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    console.log("Starting Knowledge Foundation (cold start may take several minutes)...");
    await core.start("validate-professional-reasoning");
    console.log("Knowledge Foundation ready.");
    const foundation = core.getManager().knowledgeFoundation!;
    const engine = foundation.getKnowledgeReasoningEngine();
    console.log("Running professional reasoning checks...");

    const awareness = engine.getAiMeAwareness();
    results.aiMeAwareness = {
      passed: awareness.available && awareness.groundedInKnowledgeFoundation && awareness.decisionIntelligenceEnabled,
      detail: `available=${awareness.available}; grounded=${awareness.groundedInKnowledgeFoundation}; decisionIntel=${awareness.decisionIntelligenceEnabled}`,
    };

    const knowledgeReasoning = await engine.reasonProfessional({
      request: "recommend professional camera lighting for a luxury product video",
      objective: "Select a knowledge-backed lighting recommendation",
      includeDomainModules: true,
      context: { product: "luxury watch", audience: "affluent buyers" },
      requiredDomains: ["camera-knowledge", "lighting-knowledge", "industry-standards-knowledge"],
    });
    results.knowledgeReasoning = {
      passed:
        knowledgeReasoning.grounded &&
        Boolean(knowledgeReasoning.selected) &&
        knowledgeReasoning.knowledgeUsed.length > 0 &&
        knowledgeReasoning.processSteps.length === 8,
      detail: `grounded=${knowledgeReasoning.grounded}; selected=${knowledgeReasoning.selected?.knowledgeId}; knowledgeUsed=${knowledgeReasoning.knowledgeUsed.length}; steps=${knowledgeReasoning.processSteps.length}`,
    };

    const multiDomain = await engine.reasonProfessional({
      request:
        "compare professional options for camera movement, lighting, storytelling, marketing, and social media for a product advertisement",
      objective: "Multi-domain professional recommendation",
      includeDomainModules: true,
      context: { product: "skincare serum", audience: "women 25-40", platform: "tiktok" },
      requiredDomains: [
        "camera-movement-knowledge",
        "lighting-knowledge",
        "storytelling-knowledge",
        "marketing-knowledge",
        "social-media-knowledge",
        "industry-standards-knowledge",
      ],
    });
    results.multiDomainReasoning = {
      passed:
        multiDomain.multiDomain &&
        multiDomain.domainsUsed.length > 1 &&
        multiDomain.domainContributions.length > 0 &&
        multiDomain.consideredOptions.length > 1,
      detail: `multiDomain=${multiDomain.multiDomain}; domains=${multiDomain.domainsUsed.length}; contributions=${multiDomain.domainContributions.length}; options=${multiDomain.consideredOptions.length}`,
    };

    results.decisionExplanation = {
      passed:
        multiDomain.explanation.toLowerCase().includes("selected") &&
        multiDomain.rejectedOptions.length > 0 &&
        Boolean(multiDomain.rejectedOptions[0]?.rejectionReason),
      detail: `explanationChars=${multiDomain.explanation.length}; rejected=${multiDomain.rejectedOptions.length}`,
    };

    results.recommendationQuality = {
      passed:
        Boolean(multiDomain.selected?.guidance) &&
        multiDomain.improvements.length > 0 &&
        (multiDomain.professionalStandards.length > 0 || multiDomain.decisionRules.length > 0),
      detail: `guidance=${Boolean(multiDomain.selected?.guidance)}; improvements=${multiDomain.improvements.length}; standards=${multiDomain.professionalStandards.length}; rules=${multiDomain.decisionRules.length}`,
    };

    results.confidenceScoring = {
      passed:
        multiDomain.confidenceScore > 50 &&
        multiDomain.confidenceExplanation.includes("Confidence") &&
        knowledgeReasoning.confidenceScore > 0,
      detail: `multi=${multiDomain.confidenceScore}; single=${knowledgeReasoning.confidenceScore}`,
    };

    const editingGap = await engine.reasonProfessional({
      request: "professional video editing cut and timeline recommendation",
      requiredDomains: ["video-editing-knowledge"],
    });
    results.editingGapHonesty = {
      passed:
        editingGap.missingInformation.some((item) => item.field.includes("video-editing")) &&
        editingGap.problemAnalysis.toLowerCase().includes("editing"),
      detail: `missing=${editingGap.missingInformation.map((item) => item.field).join("|")}`,
    };

    let health = await engine.runHealthCheck();
    if (!health.healthy) {
      const repair = await engine.repair();
      results.autoRepair = {
        passed: repair.repaired,
        detail: `actions=${repair.actions.join("; ")}; remaining=${repair.remainingIssues.join("; ")}`,
      };
      health = await engine.runHealthCheck();
    } else {
      results.autoRepair = { passed: true, detail: "No repair required" };
    }
    results.health = {
      passed: health.healthy && health.canReason,
      detail: `healthy=${health.healthy}; canReason=${health.canReason}; issues=${health.issues.join("; ")}`,
    };

    results.decisionIntelligenceAvailable = {
      passed: awareness.decisionIntelligenceEnabled,
      detail: "Decision Intelligence is enabled and consumes Professional Reasoning",
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
