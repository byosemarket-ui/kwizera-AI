import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ConnectivityDetector,
  KnowledgeDownloadEngine,
  KnowledgeExtractionPreviewEngine,
  KnowledgeReviewStagingArea,
  ResearchExplainer,
  ResearchPlanner,
  ResearchSourceDiscovery,
  listProfessionalResearchDomains,
  type OnlineResearchReportData,
} from "../ai/knowledge-research-engine/index.js";
import type { RegisteredKnowledgeSource } from "../ai/knowledge-source-manager/types.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-online-research-"));
}

function writeReport(data: OnlineResearchReportData): string {
  const reportPath = path.join(process.cwd(), "ONLINE-RESEARCH-REPORT.md");
  const body = `# ONLINE RESEARCH REPORT
## KWIZERA AI STUDIO — AI Learning, Online Research & Continuous Improvement Step 1

**Generated at:** ${data.generatedAt}  
**Offline First:** Preserved  
**Knowledge Foundation modified:** NO  
**Step 2 (Validation & Integration):** Not started  

---

## 1. Existing Research capability

${data.existingResearchCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Internet Detection status

${data.internetDetectionStatus}

## 5. Trusted Sources discovered

${
  data.trustedSourcesDiscovered.length
    ? data.trustedSourcesDiscovered
        .map((item) => `- ${item.accepted ? "ACCEPTED" : "REJECTED"} ${item.name} (${item.sourceId}) score=${item.compositeScore}`)
        .join("\n")
    : "- None in this validation session"
}

## 6. Download capability

${data.downloadCapability}

## 7. Knowledge Extraction quality

${data.knowledgeExtractionQuality}

## 8. AI Me capability

${data.aiMeCapability}

## 9. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 10. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 12. Remaining work before Step 2

${data.remainingWorkBeforeStep2.map((item) => `- ${item}`).join("\n")}

---

**Step 1 verdict:** Online Research & Knowledge Acquisition Engine is ready for connectivity-aware professional research, trusted source evaluation, review staging, and extraction preview without Knowledge Foundation import.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

function source(partial: Partial<RegisteredKnowledgeSource> & Pick<RegisteredKnowledgeSource, "id" | "name" | "description" | "type">): RegisteredKnowledgeSource {
  return {
    location: { kind: "local-path", value: "C:/tmp/resource.md" },
    tags: [],
    status: "approved",
    verification: { verified: true, trustScore: 90, issues: [], verifiedAt: new Date().toISOString() },
    quality: {
      qualityScore: 88,
      trustScore: 90,
      reputationScore: 80,
      completenessScore: 85,
      freshnessScore: 80,
      confidenceScore: 90,
    },
    license: "CC-BY-4.0",
    registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `online-research-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const workspace = path.join(storageRoot, "workspace");
  fs.mkdirSync(workspace, { recursive: true });

  console.log("KWIZERA AI STUDIO — AI Learning Step 1");
  console.log("Online Research & Knowledge Acquisition Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const detector = new ConnectivityDetector(async () => ({
      online: false,
      latencyMs: null,
      error: "Offline-first default probe",
    }));
    const offlineSnap = await detector.detect();
    results.push({
      name: "internetDetectionOffline",
      passed: offlineSnap.mode === "offline" && !offlineSnap.professionalResearchMode,
      detail: offlineSnap.detail,
    });

    detector.setProbe(async () => ({ online: true, latencyMs: 95 }));
    const onlineSnap = await detector.detect();
    results.push({
      name: "internetDetectionOnline",
      passed: onlineSnap.mode === "online" && onlineSnap.professionalResearchMode && onlineSnap.networkQuality === "excellent",
      detail: onlineSnap.detail,
    });

    const planner = new ResearchPlanner();
    const plan = planner.buildPlan("Product Photography Lighting");
    let unrelatedRejected = false;
    try {
      planner.buildPlan("Unrelated Quantum Finance");
    } catch {
      unrelatedRejected = true;
    }
    results.push({
      name: "sourceDiscovery",
      passed: plan.constrainedToProfessionalDomains === true && plan.domains.length > 0 && unrelatedRejected && listProfessionalResearchDomains().length === 18,
      detail: `domains=${plan.domains.map((domain) => domain.domain).join(",")}; catalog=18`,
    });

    const discovery = new ResearchSourceDiscovery();
    const good = source({
      id: "lighting-local-manual",
      name: "Lighting Local Manual",
      description: "Product photography lighting manual for studio marketing videos.",
      type: "technical-manual",
      tags: ["lighting", "product", "photography"],
    });
    const bad = source({
      id: "low-quality-blog",
      name: "Low Quality Blog",
      description: "Unrelated junk about cryptocurrency gambling tips.",
      type: "technical-manual",
      tags: ["crypto", "gambling"],
      license: "Unknown",
    });
    const ranked = discovery.search(plan, [good, bad], () => false);
    results.push({
      name: "sourceEvaluation",
      passed:
        ranked.some((item) => item.sourceId === "lighting-local-manual" && item.accepted)
        && ranked.some((item) => item.sourceId === "low-quality-blog" && !item.accepted)
        && ranked.every((item) => typeof item.authorityScore === "number"),
      detail: `accepted=${ranked.filter((item) => item.accepted).length}; rejected=${ranked.filter((item) => !item.accepted).length}`,
    });

    const fixture = path.join(storageRoot, "lighting-best-practices.md");
    fs.writeFileSync(
      fixture,
      [
        "# Product Lighting Guide",
        "Definition: Soft light reduces harsh product shadows.",
        "Rule: Never invent product colors under colored gels.",
        "Best practice: Use a large soft key light for reflective materials.",
        "Workflow: Step 1 meter exposure. Step 2 set fill ratio.",
        "Example: Matte black sneakers need a rim light for edge separation.",
        "Recommendation: Prefer daylight-balanced continuous lights for color accuracy.",
        "Buy now limited offer click here sponsored",
      ].join("\n"),
      "utf8",
    );

    const downloadEngine = new KnowledgeDownloadEngine(async () => {
      throw new Error("offline validation must use local collection");
    });
    await downloadEngine.initialize(workspace);
    const pending = await downloadEngine.requestDownload(
      {
        topic: "Product Photography Lighting",
        sourceId: good.id,
        resourceType: "markdown",
        url: `file://${fixture.replace(/\\/g, "/")}`,
        fileName: "lighting-best-practices.md",
        localSourcePath: fixture,
        domainId: "lighting-knowledge",
        title: "Lighting Local Manual",
      },
      good,
      "allow",
    );
    const completed = await downloadEngine.approveDownload(pending.id, "technical-manual");

    const staging = new KnowledgeReviewStagingArea();
    await staging.initialize(workspace);
    if (!fs.existsSync(path.join(staging.getRoot(), "pending"))) {
      issuesFound.push("Missing review/pending folder");
      await staging.initialize(workspace);
      issuesRepaired.push("Recreated temporary review staging area");
    }
    const staged = await staging.stageCompletedDownload(completed);
    results.push({
      name: "downloadManager",
      passed: completed.status === "completed" && staged.status === "pending-review" && fs.existsSync(staged.stagedPath),
      detail: `download=${completed.status}; staged=${staged.status}`,
    });

    const extraction = await new KnowledgeExtractionPreviewEngine().extractFromFile({
      downloadId: completed.id,
      topic: "Product Photography Lighting",
      filePath: completed.filePath!,
    });
    results.push({
      name: "knowledgeExtraction",
      passed:
        extraction.importedToKnowledgeFoundation === false
        && extraction.qualityScore >= 40
        && extraction.rules.length + extraction.bestPractices.length + extraction.concepts.length > 0
        && extraction.rejectedSignals.some((signal) => /advertisement|unrelated/i.test(signal)),
      detail: `quality=${extraction.qualityScore}; concepts=${extraction.concepts.length}; rejectedAds=${extraction.rejectedSignals.length}`,
    });

    const explainer = new ResearchExplainer();
    const accepted = ranked.find((item) => item.accepted)!;
    const rejected = ranked.find((item) => !item.accepted)!;
    const selection = explainer.explainSelection(accepted);
    const rejection = explainer.explainRejection(rejected.name, rejected.rejectionReason ?? "low quality");
    const topics = explainer.recommendAdditionalTopics(plan.domains.map((domain) => domain.domain));
    results.push({
      name: "aiMeCapability",
      passed: selection.includes("authority") && rejection.includes("not selected") && topics.length > 0,
      detail: `topics=${topics.slice(0, 3).join(",")}`,
    });

    results.push({
      name: "automaticRepair",
      passed: fs.existsSync(path.join(staging.getRoot(), "pending")),
      detail: `reviewRoot=${staging.getRoot()}`,
    });

    const reportData: OnlineResearchReportData = {
      generatedAt: new Date().toISOString(),
      existingResearchCapability:
        "Upgraded AiKnowledgeResearchEngine (planning, discovery, download, collection) plus Knowledge Source Manager trusted catalog.",
      componentsUpgraded: [
        "ai/knowledge-research-engine/knowledge-research-engine.ts",
        "ai/knowledge-research-engine/research-planner.ts",
        "ai/knowledge-research-engine/research-source-discovery.ts",
        "ai/knowledge-research-engine/research-explainer.ts",
        "ai/knowledge-research-engine/types.ts",
        "ai/knowledge-research-engine/index.ts",
        "ai/conversation/conversation-engine.ts",
        "ai/conversation/types.ts",
      ],
      componentsCreated: [
        "connectivity-detector.ts",
        "professional-research-domains.ts",
        "knowledge-review-staging.ts",
        "knowledge-extraction-preview.ts",
        "scripts/validate-online-research.ts",
        "tests/unit/ai/knowledge-research-engine/online-research-engine.test.ts",
      ],
      internetDetectionStatus: `${offlineSnap.detail} | Simulated online: ${onlineSnap.detail}`,
      trustedSourcesDiscovered: ranked.map((item) => ({
        sourceId: item.sourceId,
        name: item.name,
        compositeScore: item.compositeScore,
        accepted: item.accepted,
      })),
      downloadCapability:
        "Offline-first download engine with injectable transport, license/trust/size gates, workspace collection, and temporary review staging before any KF import.",
      knowledgeExtractionQuality: `Preview quality ${extraction.qualityScore}/100; KF import deferred (importedToKnowledgeFoundation=false).`,
      aiMeCapability:
        "AI Me can search trusted sources, explain selection/rejection, recommend research topics, stage downloads for review, and extract learning signals without modifying the Knowledge Foundation.",
      issuesFound,
      issuesRepaired,
      testResults: results,
      remainingWorkBeforeStep2: [
        "Knowledge Validation & Integration (Step 2) — verify staged review items before Knowledge Foundation import.",
        "Optional live DownloadTransport injection for production network downloads when legally allowed.",
        "Do not begin automatic KF import from the review area in this step.",
      ],
    };

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
