import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../ai/core/ai-core-manager.js";
import { CreativeGenerationCertificationManager } from "../ai/creative-generation-certification/creative-generation-certification-manager.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-creative-gen-cert-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `creative-gen-cert-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  console.log("KWIZERA AI STUDIO — AI Creative Generation Pipeline Step 10");
  console.log("Creative Generation Certification & Production Readiness");
  console.log("Storage root:", storageRoot);
  console.log("---");
  console.log("Running full Product-to-Video certification (shoe, bag, phone, watch)...");
  console.log("This end-to-end suite may take several minutes.");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  try {
    const manager = new CreativeGenerationCertificationManager();
    await manager.initialize(storageRoot, { core: undefined as unknown as AiCoreManager });
    const full = await manager.certify({ autoRepair: true });
    const explained = await manager.explainCertification();
    const awareness = manager.getAiMeCreativeGenerationCertificationAwareness();
    const reportPath = path.join(process.cwd(), "CREATIVE-GENERATION-CERTIFICATION-REPORT.md");

    results.pipelineIntegration = {
      passed: Object.values(full.stages).every((item) => item.status === "passed"),
      detail: `stagesPassed=${Object.values(full.stages).filter((item) => item.status === "passed").length}/11; overall=${full.overallCreativeGenerationScore}`,
    };
    results.endToEndScenarios = {
      passed: full.scenarios.length === 4 && full.scenarios.every((item) => item.passed),
      detail: `passed=${full.scenarios.filter((item) => item.passed).length}/4`,
    };
    results.productPreservation = {
      passed: full.productPreservationScore >= 70,
      detail: `score=${full.productPreservationScore}`,
    };
    results.marketingQuality = {
      passed: full.marketingQualityScore >= 70,
      detail: `score=${full.marketingQualityScore}`,
    };
    results.platformExports = {
      passed: full.scenarios.every((item) => item.platformExportCount >= 6),
      detail: `minPlatforms=${Math.min(...full.scenarios.map((item) => item.platformExportCount))}`,
    };
    results.performance = {
      passed: full.performanceScore >= 40 && full.performance.pipelineStability.status === "passed",
      detail: `score=${full.performanceScore}; genMs=${full.performance.generationTimeMs}`,
    };
    results.aiMeCapability = {
      passed:
        awareness.available
        && awareness.canCertifyPipeline
        && awareness.canExplainCertification
        && full.aiMeProductionCapability.producesMarketingVideos
        && full.aiMeProductionCapability.explainsProductionDecisions
        && Boolean(explained.summary),
      detail: `aiMeScore=${full.aiMeProductionCapability.score}`,
    };
    results.consistency = {
      passed: Object.values(full.consistency).every((item) => item.status === "passed"),
      detail: Object.values(full.consistency).map((item) => `${item.id}:${item.status}`).join(","),
    };
    results.productionReady = {
      passed: full.productionReady === true && Boolean(full.certificate),
      detail: `ready=${full.productionReady}; blockers=${full.blockers.length}; certificate=${Boolean(full.certificate)}`,
    };
    results.reportPublished = {
      passed: fs.existsSync(reportPath) && fs.readFileSync(reportPath, "utf8").includes("### 20. Is Product-to-Video Pipeline Production Ready?"),
      detail: reportPath,
    };
    results.creativePipelineStep = {
      passed: full.creativePipelineStep === 10 && full.version === "1.0",
      detail: `step=${full.creativePipelineStep}; version=${full.version}`,
    };

    console.log("Checks:");
    for (const [name, value] of Object.entries(results)) {
      console.log(`- ${value.passed ? "PASS" : "FAIL"} ${name}: ${value.detail}`);
    }
    console.log("---");
    console.log(`Production ready: ${full.productionReady ? "YES" : "NO"}`);
    if (full.blockers.length) {
      console.log("Blockers:");
      for (const blocker of full.blockers) console.log(`- ${blocker}`);
    }
    console.log(`Report: ${reportPath}`);

    const failed = Object.entries(results).filter(([, value]) => !value.passed);
    console.log(`Overall: ${failed.length === 0 ? "PASS" : "FAIL"} (${Object.keys(results).length - failed.length}/${Object.keys(results).length})`);

    if (useTemp) fs.rmSync(storageRoot, { recursive: true, force: true });
    if (failed.length) process.exitCode = 1;
  } catch (error) {
    console.error("Validation failed:", error);
    process.exitCode = 1;
  }
}

void main();
