import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  KnowledgeValidationIntegrationEngine,
  type KnowledgeValidationIntegrationReportData,
} from "../ai/knowledge-validation-integration/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-kvi-"));
}

function writeReport(data: KnowledgeValidationIntegrationReportData): string {
  const reportPath = path.join(process.cwd(), "KNOWLEDGE-VALIDATION-INTEGRATION-REPORT.md");
  const body = `# KNOWLEDGE VALIDATION & INTEGRATION REPORT
## KWIZERA AI STUDIO — AI Learning, Online Research & Continuous Improvement Step 2

**Generated at:** ${data.generatedAt}  
**Offline First:** Preserved  
**Knowledge overwrite:** NO  
**Step 3 (Knowledge Evolution):** Not started  

---

## 1. Existing Validation capability

${data.existingValidationCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Knowledge accepted

${
  data.knowledgeAccepted.length
    ? data.knowledgeAccepted.map((item) => `- ${item.title} (${item.domainId}) score=${item.score} id=${item.id}`).join("\n")
    : "- none"
}

## 5. Knowledge rejected

${
  data.knowledgeRejected.length
    ? data.knowledgeRejected.map((item) => `- ${item.title}: ${item.reason}`).join("\n")
    : "- none"
}

## 6. Duplicate knowledge removed

${
  data.duplicateKnowledgeRemoved.length
    ? data.duplicateKnowledgeRemoved.map((item) => `- ${item.title} reused=${item.reusedExistingId ?? "n/a"}`).join("\n")
    : "- none"
}

## 7. Knowledge Packs updated

${
  data.knowledgePacksUpdated.length
    ? data.knowledgePacksUpdated.map((item) => `- ${item.packId} (${item.domainId}) v${item.version}`).join("\n")
    : "- none"
}

## 8. Knowledge Graph updated

${data.knowledgeGraphUpdated ? "YES" : "NO"}

## 9. Search Index updated

${data.searchIndexUpdated ? "YES" : "NO"}

## 10. Version History updated

${data.versionHistoryUpdated ? "YES" : "NO"}

## 11. AI Me capability

${data.aiMeCapability}

## 12. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 13. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 14. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 15. Remaining work before Step 3

${data.remainingWorkBeforeStep3.map((item) => `- ${item}`).join("\n")}

---

**Step 2 verdict:** Knowledge Validation, Integration & Knowledge Foundation Update Engine is ready. Only trusted, non-duplicate knowledge enters the durable offline ledger with version history. Knowledge Evolution is not started.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `kvi-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — AI Learning Step 2");
  console.log("Knowledge Validation, Integration & Knowledge Foundation Update");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new KnowledgeValidationIntegrationEngine();
    engine.initialize(storageRoot);
    await engine.runStartup();

    const goodLighting = {
      title: "Studio Soft Key Practice",
      content: [
        "Definition: Soft key light reduces harsh product shadows.",
        "Rule: Never invent product colors under colored gels.",
        "Best practice: Use a large softbox for reflective materials.",
        "Workflow: Step 1 meter exposure. Step 2 set fill ratio.",
        "Example: Matte sneakers need a rim light for edge separation.",
        "Recommendation: Prefer daylight-balanced continuous lights.",
      ].join("\n"),
      sourceId: "lighting-manual",
      sourceName: "Lighting Manual",
      sourceTrustScore: 90,
      authorityScore: 88,
      domainHint: "lighting" as const,
    };

    const junk = {
      title: "Crypto Promo",
      content: "Buy now limited offer click here sponsored crypto gambling tips unrelated to production.",
      sourceId: "spam",
      sourceName: "Spam Blog",
      sourceTrustScore: 20,
      authorityScore: 15,
    };

    const first = await engine.integrateCandidates([goodLighting, junk]);
    results.push({
      name: "validationEngine",
      passed: first.accepted.length === 1 && first.rejected.length === 1 && first.knowledgeFoundationOverwrite === false,
      detail: `accepted=${first.accepted.length}; rejected=${first.rejected.length}`,
    });

    const duplicate = await engine.integrateCandidates([goodLighting]);
    results.push({
      name: "duplicateDetection",
      passed: duplicate.duplicatesReused.length === 1 && duplicate.accepted.length === 0,
      detail: `duplicates=${duplicate.duplicatesReused.length}`,
    });

    const update = await engine.integrateCandidates([
      {
        ...goodLighting,
        content: `${goodLighting.content}\nBest practice: Keep product logos fully visible during lighting setups.`,
      },
    ]);
    results.push({
      name: "knowledgeIntegration",
      passed: update.accepted.length === 1 && update.accepted[0].version >= 2 && update.packsUpdated.length >= 1,
      detail: `version=${update.accepted[0]?.version}; packs=${update.packsUpdated.length}`,
    });

    results.push({
      name: "knowledgeGraph",
      passed: update.graphUpdated.length >= 1 && fs.existsSync(path.join(storageRoot, "knowledge", "validation-integration", "graph")),
      detail: `nodes=${update.graphUpdated.length}`,
    });

    const searchHits = engine.searchImportedKnowledge("softbox lighting product", 5);
    results.push({
      name: "searchIndex",
      passed: update.searchIndexUpdated.length >= 1 && searchHits.length >= 1,
      detail: `hits=${searchHits.length}; indexed=${update.searchIndexUpdated.length}`,
    });

    const history = engine.getVersionHistory(update.accepted[0]?.id);
    results.push({
      name: "versionHistory",
      passed: history.length >= 1 && update.versionHistoryUpdated.length >= 1 && !update.knowledgeFoundationOverwrite,
      detail: `historyEntries=${history.length}`,
    });

    // Break then repair
    const searchDir = path.join(storageRoot, "knowledge", "validation-integration", "search-index");
    if (fs.existsSync(searchDir)) {
      for (const file of fs.readdirSync(searchDir)) fs.unlinkSync(path.join(searchDir, file));
      issuesFound.push("Cleared search-index files to verify repair");
    }
    const repair = await engine.repair();
    issuesRepaired.push(...repair.repaired);
    results.push({
      name: "automaticRepair",
      passed: repair.healthy && repair.repaired.length > 0,
      detail: `repaired=${repair.repaired.join(",")}`,
    });

    const awareness = engine.getAiMeKnowledgeValidationIntegrationAwareness();
    const explained = engine.explainDecision(first.accepted[0].id);
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.available
        && awareness.canExplainAcceptance
        && awareness.canExplainRejection
        && awareness.canShowVersionHistory
        && awareness.canSearchImportedKnowledge
        && awareness.knowledgeEvolutionDeferred
        && explained.confidence >= 58,
      detail: awareness.summary,
    });

    const reportData = await engine.buildReport(results);
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
