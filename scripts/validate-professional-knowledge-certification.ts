import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DecisionPriority,
  DecisionStatus,
  DecisionType,
  createAiCore,
} from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-professional-cert-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Step 10: Professional Knowledge Certification & Capability Verification");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("validate-professional-knowledge-certification");
    const manager = core.getManager();
    const foundation = manager.knowledgeFoundation!;
    const certification = foundation.getProfessionalKnowledgeCertificationEngine();
    const result = await certification.verify({ autoRepair: true });

    const editing = result.professionalCoverage.find((domain) => domain.domainId === "video-editing-knowledge");
    const otherDomains = result.professionalCoverage.filter((domain) => domain.domainId !== "video-editing-knowledge");
    const capabilities = result.capabilities;
    const requiredCapabilities = [
      capabilities.search,
      capabilities.explain,
      capabilities.compare,
      capabilities.bestPractices,
      capabilities.workflow,
      capabilities.camera,
      capabilities.lighting,
      capabilities.storytelling,
      capabilities.rendering,
      capabilities.marketing,
      capabilities.socialMedia,
      capabilities.industryQuality,
      capabilities.reasoning,
      capabilities.planningIntegration,
      capabilities.decisionIntegration,
      capabilities.workflowIntegration,
    ];

    results.professionalDomainCoverage = {
      passed: result.professionalCoverage.length === 17 && otherDomains.every((domain) => domain.status === "passed"),
      detail: `domains=${result.professionalCoverage.length}; nonEditingPassed=${otherDomains.filter((domain) => domain.status === "passed").length}/${otherDomains.length}`,
    };
    results.videoEditingBlocker = {
      passed:
        editing?.status === "blocked" &&
        editing.issues.some((issue) => issue.includes("No dedicated Professional Video Editing Knowledge expansion")),
      detail: editing?.issues.join(" ") ?? "Video Editing domain result missing",
    };
    results.certificationTruthfulness = {
      passed: result.certified === false && result.certificatePath === null && result.remainingGaps.length > 0,
      detail: `certified=${result.certified}; maturity=${result.maturityPercentage}; gaps=${result.remainingGaps.length}`,
    };

    results.packs = {
      passed:
        result.foundation.packs.status === "passed" &&
        result.totalKnowledgePacks >= 16 &&
        result.foundation.metadata.status === "passed",
      detail: `packs=${result.totalKnowledgePacks}; metadata=${result.foundation.metadata.status}`,
    };
    results.graph = {
      passed:
        result.foundation.relationships.status === "passed" &&
        result.foundation.knowledgeGraph.status === "passed" &&
        result.totalKnowledgeRelationships > 0,
      detail: `relationships=${result.totalKnowledgeRelationships}`,
    };
    results.search = {
      passed:
        result.foundation.searchIndex.status === "passed" &&
        result.foundation.semanticSearch.status === "passed" &&
        capabilities.search.status === "passed",
      detail: result.foundation.semanticSearch.detail,
    };
    results.versionHistory = {
      passed: result.foundation.versionHistory.status === "passed",
      detail: result.foundation.versionHistory.detail,
    };
    results.scores = {
      passed: result.foundation.scores.status === "passed",
      detail: result.foundation.scores.detail,
    };
    results.capabilities = {
      passed: requiredCapabilities.every((capability) => capability.status === "passed"),
      detail: requiredCapabilities.map((capability) => `${capability.id}=${capability.status}`).join("; "),
    };
    results.editingCapability = {
      passed: capabilities.editing.status === "blocked",
      detail: capabilities.editing.detail,
    };

    const decision = await manager.decisionEngine?.decide({
      requestId: "professional-certification-decision",
      type: DecisionType.Marketing,
      priority: DecisionPriority.Normal,
      userRequest: "Plan a professional product advertisement using verified local knowledge.",
      statedObjective: "Create a knowledge-backed advertising plan for a reusable water bottle.",
      availableData: {
        productName: "Reusable Water Bottle",
        audience: "environmentally conscious urban professionals",
        objective: "awareness and consideration",
        platform: "social-media",
        budget: "planned",
        deadline: "planned",
      },
    });
    results.decisionSupport = {
      passed: Boolean(decision && decision.status !== DecisionStatus.Failed && decision.stepsCompleted.length >= 2),
      detail: decision ? `status=${decision.status}; steps=${decision.stepsCompleted.length}` : "Decision Engine unavailable",
    };
    results.planning = {
      passed: Boolean(manager.planningEngine?.isInitialized() && manager.workflowEngine?.isInitialized()),
      detail: `planning=${manager.planningEngine?.isInitialized() ?? false}; workflow=${manager.workflowEngine?.isInitialized() ?? false}`,
    };

    results.repair = {
      passed: result.issuesRepaired.every(Boolean),
      detail: `repairActions=${result.issuesRepaired.length}; remainingGaps=${result.remainingGaps.length}`,
    };
    results.verificationArtifact = {
      passed: fs.existsSync(result.verificationPath),
      detail: result.verificationPath,
    };
    results.noAutomaticCertification = {
      passed: result.certificatePath === null,
      detail: "No Step 10 certificate was issued because the verified editing knowledge blocker remains.",
    };

    await core.stop();
  } catch (error) {
    results.runtime = {
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (useTemp && fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  }

  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    const mark = result.passed ? "PASS" : "FAIL";
    if (!result.passed) failed += 1;
    console.log(`[${mark}] ${name}: ${result.detail}`);
  }
  console.log("---");
  if (failed) {
    console.error(`Professional Knowledge Certification validation failed: ${failed} check(s).`);
    process.exit(1);
  }
  console.log("Professional Knowledge Certification verification passed with the expected Video Editing blocker.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
