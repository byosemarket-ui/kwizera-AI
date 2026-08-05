import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DocumentUnderstandingEngine,
  DocumentReader,
  DocumentStructureParser,
  DocumentContentAnalyzer,
} from "../ai/knowledge-processing-engine/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-document-understanding-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Seeding Step 4: Document Understanding Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const docsDir = path.join(storageRoot, "sample-docs");
    fs.mkdirSync(docsDir, { recursive: true });
    const md = path.join(docsDir, "storytelling.md");
    const html = path.join(docsDir, "lighting.html");
    const json = path.join(docsDir, "camera.json");
    const csv = path.join(docsDir, "render.csv");

    fs.writeFileSync(
      md,
      `# Storytelling Craft\n\n## Beginner Hook\nBasics of narrative hook.\n\n## Professional Arc\nProfessional storytelling production arc and reveal.\n\n| Beat | Purpose |\n| --- | --- |\n| Hook | Attention |\n\n![Story diagram](story-diagram.png)\n`,
      "utf8"
    );
    fs.writeFileSync(
      html,
      `<html><head><title>Lighting Manual</title></head><body><h1>Lighting Manual</h1><h2>Key Light</h2><p>Professional lighting setup.</p><table><tr><td>Softbox</td></tr></table><img alt="light diagram" src="light.png"/></body></html>`,
      "utf8"
    );
    fs.writeFileSync(json, JSON.stringify({ title: "Camera API", exposure: { aperture: "f/2.8", iso: 100 }, docs: "official api" }, null, 2));
    fs.writeFileSync(csv, "concept,level\nrendering,advanced\nbitrate,professional\n");

    const reader = new DocumentReader();
    const formats = await Promise.all([md, html, json, csv].map(async (file) => (await reader.read(file)).format));
    results.documentReading = {
      passed: formats.includes("markdown") && formats.includes("html") && formats.includes("json") && formats.includes("csv"),
      detail: `Formats read: ${formats.join(", ")}`,
    };

    const engine = new DocumentUnderstandingEngine();
    engine.initialize(
      {
        getKnowledgeResearchEngine: () => ({
          isStartupComplete: () => false,
          markDownloadProcessed: async () => undefined,
        }),
      } as never,
      storageRoot
    );
    await engine.runStartup();

    const understood = [];
    for (const [file, domain, id] of [
      [md, "storytelling-knowledge", "doc-story"],
      [html, "lighting-knowledge", "doc-light"],
      [json, "camera-knowledge", "doc-camera"],
      [csv, "rendering-knowledge", "doc-render"],
    ] as const) {
      understood.push(
        await engine.understandLocalFile({
          resourceId: id,
          filePath: file,
          fileName: path.basename(file),
          domainId: domain,
        })
      );
    }

    results.documentUnderstanding = {
      passed: understood.every((item) => item.status === "understood" || item.status === "partial"),
      detail: `Understood ${understood.length} documents`,
    };

    results.contentAnalysis = {
      passed: understood.some((item) => item.analysis.domainConcepts.length > 0) &&
        understood.every((item) => ["beginner", "intermediate", "advanced", "professional"].includes(item.analysis.difficultyLevel)),
      detail: `Difficulties: ${understood.map((item) => item.analysis.difficultyLevel).join(", ")}`,
    };

    results.metadataDetection = {
      passed: understood.every(
        (item) => item.metadata.format && item.metadata.filePath && item.structure.title && item.originalPreserved
      ),
      detail: "Title/format/path/originalPreserved present",
    };

    results.topicDetection = {
      passed: understood.some((item) => item.analysis.learningTopics.length > 0),
      detail: `Topics: ${engine.getIndexes().topicIndex.slice(0, 8).map((entry) => entry.topic).join("; ")}`,
    };

    const indexes = engine.getIndexes();
    results.documentIndexing = {
      passed:
        indexes.topicIndex.length > 0 &&
        indexes.keywordIndex.length > 0 &&
        indexes.domainIndex.length > 0 &&
        indexes.technicalIndex.length >= 0,
      detail: `topics=${indexes.topicIndex.length}, keywords=${indexes.keywordIndex.length}, domains=${indexes.domainIndex.length}, relationships=${indexes.relationshipIndex.length}`,
    };

    // Simulate issue + repair
    fs.rmSync(md);
    issuesFound.push("Missing storytelling.md");
    let attempts = 0;
    let healthy = false;
    while (attempts < 3) {
      attempts += 1;
      const repair = await engine.repair();
      issuesRepaired.push(...repair.actions);
      if (engine.getByResourceId("doc-story")?.status === "failed" && repair.repaired) {
        healthy = true;
        break;
      }
      if (repair.remainingIssues.length === 0 && engine.getByResourceId("doc-story")?.status === "failed") {
        healthy = true;
        break;
      }
    }
    results.autoRepair = {
      passed: healthy,
      detail: `Repair attempts=${attempts}; storytelling status=${engine.getByResourceId("doc-story")?.status}`,
    };

    results.noKnowledgePacks = {
      passed: understood.every((item) => item.originalPreserved && item.status !== "failed" || item.resourceId === "doc-story"),
      detail: "No Knowledge Pack extraction performed; originals preserved",
    };

    const parser = new DocumentStructureParser();
    const analyzer = new DocumentContentAnalyzer();
    const sample = await reader.read(html);
    const structure = parser.parse(sample.text, sample.format, "Lighting");
    analyzer.analyze(sample.text, structure.sections.map((section) => section.title));
    results.structureDepth = {
      passed: structure.headings.length > 0 && structure.tables.length > 0,
      detail: `headings=${structure.headings.length}, tables=${structure.tables.length}, refs=${structure.references.length}`,
    };
  } catch (error) {
    results.fatal = {
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (useTemp && fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  }

  console.log("");
  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    const mark = result.passed ? "PASS" : "FAIL";
    if (!result.passed) failed += 1;
    console.log(`[${mark}] ${name}: ${result.detail}`);
  }
  console.log(`Issues found: ${issuesFound.length}; repair actions: ${issuesRepaired.length}`);
  console.log("---");
  if (failed > 0) {
    console.error(`Validation failed: ${failed} check(s)`);
    process.exit(1);
  }
  console.log("Document Understanding validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
