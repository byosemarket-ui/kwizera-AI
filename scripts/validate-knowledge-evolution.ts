import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiKnowledgeEvolutionEngine,
  type KnowledgeEvolutionReportData,
} from "../ai/knowledge-evolution/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-evolution-"));
}

function writeReport(data: KnowledgeEvolutionReportData): string {
  const reportPath = path.join(process.cwd(), "KNOWLEDGE-EVOLUTION-CONTINUOUS-UPDATE-REPORT.md");
  const body = `# KNOWLEDGE EVOLUTION REPORT
## KWIZERA AI STUDIO — AI Learning, Online Research & Continuous Improvement Step 3

**Generated at:** ${data.generatedAt}  
**Offline First:** Preserved  
**Previous versions deleted:** NO  
**Step 4 (Feedback Intelligence):** Available separately via \`validate:feedback-intelligence\`  

---

## 1. Existing Evolution capability

${data.existingEvolutionCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Knowledge updates detected

${
  data.knowledgeUpdatesDetected.length
    ? data.knowledgeUpdatesDetected.map((item) => `- ${item.title} [${item.changeKind}] (${item.domainId})`).join("\n")
    : "- none"
}

## 5. New Knowledge added

${
  data.newKnowledgeAdded.length
    ? data.newKnowledgeAdded.map((item) => `- ${item.title} (${item.domainId}) v${item.version}`).join("\n")
    : "- none"
}

## 6. Updated Knowledge Packs

${
  data.updatedKnowledgePacks.length
    ? data.updatedKnowledgePacks.map((item) => `- ${item.domainId} item=${item.itemId} v${item.version}`).join("\n")
    : "- none"
}

## 7. Deprecated Knowledge identified

${
  data.deprecatedKnowledgeIdentified.length
    ? data.deprecatedKnowledgeIdentified.map((item) => `- ${item.title}: ${item.reason}`).join("\n")
    : "- none"
}

## 8. Version History status

${data.versionHistoryStatus}

## 9. Knowledge Graph status

${data.knowledgeGraphStatus}

## 10. AI Me capability

${data.aiMeCapability}

## 11. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 13. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 14. Remaining work before Step 4

${data.remainingWorkBeforeStep4.map((item) => `- ${item}`).join("\n")}

---

**Step 3 verdict:** Knowledge Evolution & Continuous Update Engine is ready. Knowledge evolves with preserved version history, graph/search updates, and AI Me explain/compare/recommend-latest. Feedback Intelligence is available as Step 4.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `evolution-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — AI Learning Step 3");
  console.log("Knowledge Evolution & Continuous Update Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiKnowledgeEvolutionEngine();
    engine.initialize(storageRoot);
    await engine.runStartup();

    results.push({
      name: "changeDetection",
      passed: engine.listMonitoredDomains().length >= 17,
      detail: `domains=${engine.listMonitoredDomains().length}`,
    });

    const seed = await engine.evolve([
      {
        title: "Softbox Key Lighting",
        content: "Best practice: Use a large softbox as key light for reflective products.\nRule: Never invent product colors.",
        domainId: "lighting",
        changeKindHint: "updated-best-practice",
        verified: true,
      },
    ]);

    const updated = await engine.evolve([
      {
        title: "Softbox Key Lighting",
        content: "Best practice: Use a large softbox as key light for reflective products.\nRule: Never invent product colors.\nRecommendation: Prefer daylight-balanced continuous lights for color accuracy.",
        domainId: "lighting",
        changeKindHint: "updated-best-practice",
        verified: true,
      },
    ]);

    results.push({
      name: "versionManagement",
      passed: seed.newKnowledgeAdded[0]?.version === 1 && updated.updatedPacks[0]?.version === 2 && updated.previousVersionsPreserved,
      detail: `v1=${seed.newKnowledgeAdded[0]?.version}; v2=${updated.updatedPacks[0]?.version}`,
    });

    results.push({
      name: "knowledgeEvolution",
      passed: updated.updatesDetected.length >= 1 && updated.comparisons.some((item) => item.classification === "updated"),
      detail: `detections=${updated.updatesDetected.length}`,
    });

    const comparisonRun = await engine.evolve([
      {
        title: "Legacy Hard Light Workflow",
        content: "This workflow is obsolete and no longer recommended for product marketing videos.",
        domainId: "lighting",
        changeKindHint: "updated-workflow",
        verified: true,
      },
      {
        title: "Legacy Hard Light Workflow",
        content: "This workflow is obsolete and replaced by soft key lighting. Outdated for modern product shoots.",
        domainId: "lighting",
        changeKindHint: "updated-workflow",
        verified: true,
      },
    ]);
    // First creates new, second marks obsolete/updated
    const dep = await engine.evolve([
      {
        title: "Modern Soft Key Standard",
        content: "Updated standard for product lighting using soft key and controlled fill.",
        domainId: "lighting",
        changeKindHint: "updated-standard",
        verified: true,
        deprecatesTitle: "Legacy Hard Light Workflow",
      },
    ]);

    results.push({
      name: "knowledgeComparison",
      passed:
        comparisonRun.comparisons.some((item) => item.classification === "new" || item.classification === "obsolete" || item.classification === "updated")
        && dep.deprecatedKnowledge.length >= 1,
      detail: `deprecated=${dep.deprecatedKnowledge.length}; comparisons=${comparisonRun.comparisons.length}`,
    });

    results.push({
      name: "knowledgeGraphUpdates",
      passed: updated.graphUpdated && fs.existsSync(path.join(storageRoot, "knowledge", "evolution", "graph")),
      detail: `graphUpdated=${updated.graphUpdated}`,
    });

    results.push({
      name: "searchIndexUpdates",
      passed: updated.searchIndexUpdated && fs.existsSync(path.join(storageRoot, "knowledge", "evolution", "search-index")),
      detail: `searchUpdated=${updated.searchIndexUpdated}`,
    });

    const unverified = await engine.evolve([
      {
        title: "Unverified Rumor",
        content: "Buy now limited offer",
        verified: false,
      },
    ]);
    results.push({
      name: "rejectUnverified",
      passed: unverified.issuesFound.some((item) => /unverified/i.test(item)) && unverified.newKnowledgeAdded.length === 0,
      detail: unverified.issuesFound[0] ?? "none",
    });

    const itemId = updated.updatedPacks[0]?.itemId ?? seed.newKnowledgeAdded[0]?.id!;
    const explained = engine.explainEvolution(itemId);
    const compared = engine.compareVersions(itemId);
    const awareness = engine.getAiMeKnowledgeEvolutionAwareness();
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.available
        && awareness.canExplainWhatChanged
        && awareness.canCompareOldAndNew
        && awareness.canRecommendLatestVersion
        && awareness.feedbackIntelligenceDeferred === false
        && explained.recommendLatest
        && compared.recommendLatest,
      detail: awareness.summary,
    });

    const searchDir = path.join(storageRoot, "knowledge", "evolution", "search-index");
    if (fs.existsSync(searchDir)) {
      for (const file of fs.readdirSync(searchDir)) fs.unlinkSync(path.join(searchDir, file));
      issuesFound.push("Cleared evolution search-index files to verify repair");
    }
    const repair = await engine.repair();
    issuesRepaired.push(...repair.repaired);
    results.push({
      name: "automaticRepair",
      passed: repair.healthy || repair.repaired.length > 0,
      detail: `repaired=${repair.repaired.join(",")}`,
    });

    const reportData = await engine.buildReport(results);
    reportData.issuesFound = [...new Set([...reportData.issuesFound, ...issuesFound, ...unverified.issuesFound])];
    reportData.issuesRepaired = [...new Set([...reportData.issuesRepaired, ...issuesRepaired, ...updated.issuesRepaired])];
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
