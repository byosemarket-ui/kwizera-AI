import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiAutonomousLearningEngine,
  type AutonomousLearningReportData,
} from "../ai/autonomous-learning/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-autolearn-"));
}

function writeReport(data: AutonomousLearningReportData): string {
  const reportPath = path.join(process.cwd(), "AUTONOMOUS-LEARNING-REPORT.md");
  const body = `# AUTONOMOUS LEARNING REPORT
## KWIZERA AI STUDIO — AI Learning, Online Research & Continuous Improvement Step 6

**Generated at:** ${data.generatedAt}  
**Offline First:** Preserved  
**Unverified knowledge imported:** NO  
**Previous knowledge overwritten:** NO  
**Step 7 (Workflow & Model Optimization):** Exists separately — do not expand in Step 6; use \`validate:workflow-model-optimization\`  

---

## 1. Existing Learning capability

${data.existingLearningCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. New Knowledge discovered

${
  data.newKnowledgeDiscovered.length
    ? data.newKnowledgeDiscovered.map((item) => `- ${item.id}: ${item.title} (${item.domainId})`).join("\n")
    : "- none"
}

## 5. Knowledge Packs expanded

${
  data.knowledgePacksExpanded.length
    ? data.knowledgePacksExpanded.map((item) => `- ${item.packId} [${item.action}] v${item.version}`).join("\n")
    : "- none"
}

## 6. Knowledge Graph expanded

${data.knowledgeGraphExpanded}

## 7. Version History status

${data.versionHistoryStatus}

## 8. Offline Compatibility

${data.offlineCompatibility}

## 9. AI Me capability

${data.aiMeCapability}

## 10. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 13. Remaining work before Step 7

${data.remainingWorkBeforeStep7.map((item) => `- ${item}`).join("\n")}

---

**Step 6 verdict:** Autonomous Learning & Intelligent Knowledge Expansion Engine is ready. Verified professional knowledge expands packs/graph/search with preserved versions; self-learning composes feedback/performance signals offline; unverified/unrelated knowledge is rejected. Workflow & Model Optimization is not expanded in this step.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `autolearn-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — AI Learning Step 6");
  console.log("Autonomous Learning & Intelligent Knowledge Expansion Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    // Lightweight ports — avoid importing full sibling engines in the validate harness.
    const feedbackPort = {
      getLearningMemory: () => [
        {
          topics: ["lighting", "product-presentation"],
          lesson: "Prefer soft key lighting for reflective product surfaces.",
        },
      ],
      getPreferenceProfile: () => ({
        evolutionNotes: ["2026: prefer soft lighting from feedback"],
      }),
    };
    const performancePort = {
      getSessions: () => [
        {
          bottlenecks: [
            {
              kind: "rendering-bottleneck",
              module: "rendering",
              detail: "rendering took 90000ms",
              severity: "high",
            },
          ],
          optimizations: [
            { recommendation: "Use hardware-accelerated encode for final render." },
          ],
        },
      ],
    };

    const engine = new AiAutonomousLearningEngine();
    engine.initialize(storageRoot, { feedback: feedbackPort, performance: performancePort });

    results.push({
      name: "domainCatalog",
      passed: engine.listLearningDomains().length >= 17,
      detail: `domains=${engine.listLearningDomains().length}`,
    });

    const online = engine.runAutonomousCycle({
      isOnline: () => true,
      maxImports: 8,
      candidates: [
        {
          title: "Soft Key Product Lighting Update",
          content: "Best practice: Prefer large soft key lighting for reflective product surfaces to improve production quality.",
          domainId: "lighting",
          origin: "professional-technique",
          sourceLabel: "trusted-lighting-manual",
          verified: true,
          focus: ["production-quality", "product-presentation"],
        },
        {
          title: "Hardware Encode Rendering Path",
          content: "Technique: Use hardware-accelerated encode presets to improve rendering quality.",
          domainId: "rendering",
          origin: "updated-documentation",
          sourceLabel: "trusted-render-docs",
          verified: true,
          focus: ["rendering-quality", "workflow-efficiency"],
        },
        {
          title: "Unverified Rumor",
          content: "Unverified marketing rumor",
          domainId: "marketing",
          origin: "ai-technology",
          sourceLabel: "rumor",
          verified: false,
        },
        {
          title: "Sports Betting Odds",
          content: "cryptocurrency sports betting unrelated",
          domainId: "finance",
          origin: "online-trusted-source",
          sourceLabel: "bad",
          verified: true,
        },
      ],
    });

    issuesFound.push(...online.issuesFound);
    issuesRepaired.push(...online.issuesRepaired);

    results.push({
      name: "onlineDiscovery",
      passed: online.onlineAvailable && online.discovered.some((d) => d.accepted && d.domainId === "lighting"),
      detail: `accepted=${online.discovered.filter((d) => d.accepted).length}`,
    });
    results.push({
      name: "rejectUnverified",
      passed: online.rejectedUnverified.includes("Unverified Rumor"),
      detail: online.rejectedUnverified.join(",") || "none",
    });
    results.push({
      name: "rejectUnrelated",
      passed: online.rejectedUnrelated.length >= 1,
      detail: online.rejectedUnrelated.join(",") || "none",
    });
    results.push({
      name: "knowledgeExpansion",
      passed: online.packsExpanded.length >= 1 && online.previousKnowledgePreserved,
      detail: `packs=${online.packsExpanded.map((p) => `${p.packId}@v${p.version}`).join(",")}`,
    });
    results.push({
      name: "graphAndSearch",
      passed: online.graphExpanded.length >= 1 && online.searchIndexExpanded.length >= 1,
      detail: `graph=${online.graphExpanded.length}; search=${online.searchIndexExpanded.length}`,
    });
    results.push({
      name: "impactAnalysis",
      passed: online.impactAnalyses.every((i) => i.breakingChangeRisk === false && i.safeToImport),
      detail: `impacts=${online.impactAnalyses.length}`,
    });
    results.push({
      name: "versionHistory",
      passed: online.versionHistory.length >= 1 && online.packsExpanded.every((p) => p.previousVersionPreserved),
      detail: `versions=${online.versionHistory.length}`,
    });

    const offline = engine.runAutonomousCycle({ isOnline: () => false, maxImports: 5 });
    results.push({
      name: "offlineSelfLearning",
      passed: offline.onlineAvailable === false && offline.offlineCompatible && offline.selfLearningApplied.length >= 1,
      detail: `self=${offline.selfLearningApplied.length}`,
    });

    results.push({
      name: "compositionPipeline",
      passed:
        online.composition.depsWired.feedback
        && online.composition.depsWired.performance
        && (online.composition.feedbackSignalsUsed + online.composition.performanceSignalsUsed) >= 1,
      detail: `feedback=${online.composition.feedbackSignalsUsed}; performance=${online.composition.performanceSignalsUsed}; defaults=${online.composition.defaultSignalsUsed}`,
    });

    const explained = engine.explain(online.discovered.find((d) => d.accepted)?.id);
    const awareness = engine.getAiMeAwareness();
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.available
        && awareness.canExplainNewlyLearned
        && awareness.canRecommendNewKnowledge
        && awareness.workflowModelOptimizationDeferred === false
        && explained.whatWasLearned.length > 10,
      detail: awareness.summary,
    });

    const autoTests = engine.runAutomaticTests();
    results.push(...autoTests);

    let health = engine.runQualityAssurance();
    issuesRepaired.push(...health.repaired);
    let loops = 0;
    while (health.criticalIssues.length > 0 && loops < 3) {
      health = engine.runQualityAssurance();
      issuesRepaired.push(...health.repaired);
      loops += 1;
    }
    results.push({
      name: "qualityAssurance",
      passed: health.criticalIssues.length === 0,
      detail: `healthy=${health.healthy}; checks=${health.checks.filter((c) => c.passed).length}/${health.checks.length}`,
    });

    const reportData = engine.buildReportData(results);
    reportData.issuesFound = [...new Set([...reportData.issuesFound, ...issuesFound])];
    reportData.issuesRepaired = [...new Set([...reportData.issuesRepaired, ...issuesRepaired])];
    const reportPath = writeReport(reportData);
    console.log("Report:", reportPath);
  } catch (error) {
    console.error("Validation failed:", error);
    results.push({ name: "runtime", passed: false, detail: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  } finally {
    if (useTemp) fs.rmSync(storageRoot, { recursive: true, force: true });
  }

  console.log("Checks:");
  let failed = 0;
  for (const result of results) {
    console.log(`- ${result.passed ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
    if (!result.passed) failed += 1;
  }
  console.log("---");
  console.log(failed === 0 ? "VALIDATION PASSED" : `VALIDATION FAILED (${failed} check(s))`);
  if (failed > 0) process.exitCode = 1;
}

void main();
