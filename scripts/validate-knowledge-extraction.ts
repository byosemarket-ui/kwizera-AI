import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DocumentUnderstandingEngine,
  KnowledgeExtractionEngine,
  ProfessionalKnowledgeExtractor,
} from "../ai/knowledge-processing-engine/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-knowledge-extraction-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Seeding Step 5: Knowledge Extraction Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const docsDir = path.join(storageRoot, "sample-docs");
    fs.mkdirSync(docsDir, { recursive: true });
    const files = {
      lighting: path.join(docsDir, "lighting.md"),
      camera: path.join(docsDir, "camera.md"),
      marketing: path.join(docsDir, "marketing.md"),
    };
    fs.writeFileSync(
      files.lighting,
      `# Lighting Manual\n\nYou must always set key light first.\nBest practice: ensure soft diffusion.\nTechnique: use fill light carefully.\nStep 1: Key. Step 2: Fill. Step 3: Rim.\nExample: softbox at 45 degrees.\nAvoid specular hotspots.\n`,
      "utf8"
    );
    fs.writeFileSync(
      files.camera,
      `# Camera Guide\n\nYou must never crush highlights.\nBest practice: recommend base ISO.\nTechnique: use aperture for depth.\nStep 1: ISO. Step 2: Aperture. Step 3: Shutter.\nExample: f/5.6 product set.\n`,
      "utf8"
    );
    fs.writeFileSync(
      files.marketing,
      `# Marketing Funnel\n\nYou must always define audience CTA.\nBest practice: ensure message clarity.\nTechnique: use retention hooks.\nStep 1: Awareness. Step 2: Consideration. Step 3: Conversion.\nExample: carousel CTA above fold.\n`,
      "utf8"
    );

    const originals = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, "utf8")]));

    const understanding = new DocumentUnderstandingEngine();
    understanding.initialize(
      {
        getKnowledgeResearchEngine: () => ({
          isStartupComplete: () => false,
          markDownloadProcessed: async () => undefined,
        }),
      } as never,
      storageRoot
    );
    await understanding.runStartup();

    const understood = [];
    for (const [key, file, domain, id] of [
      ["lighting", files.lighting, "lighting-knowledge", "doc-light"],
      ["camera", files.camera, "camera-knowledge", "doc-camera"],
      ["marketing", files.marketing, "marketing-knowledge", "doc-market"],
    ] as const) {
      understood.push(
        await understanding.understandLocalFile({
          resourceId: id,
          filePath: file,
          fileName: path.basename(file),
          domainId: domain,
        })
      );
      void key;
    }

    const extraction = new KnowledgeExtractionEngine();
    extraction.initialize(
      {
        getDocumentUnderstandingEngine: () => understanding,
        getKnowledgeResearchEngine: () => ({
          isStartupComplete: () => false,
          markDownloadExtracted: async () => undefined,
        }),
        getStorageEngine: () => ({
          isStartupComplete: () => false,
        }),
      } as never,
      storageRoot
    );
    await extraction.runStartup();

    const extracted = [];
    for (const document of understood) {
      extracted.push(await extraction.extractFromUnderstanding(document));
    }

    results.knowledgeExtraction = {
      passed: extracted.every((item) => ["extracted", "merged", "weak"].includes(item.status)),
      detail: `Statuses: ${extracted.map((item) => item.status).join(", ")}`,
    };

    const packs = extraction.listPacks();
    results.knowledgePackGeneration = {
      passed: packs.length >= 3 && packs.every((pack) => pack.items.length > 0 && pack.originalDocumentsPreserved),
      detail: `Packs: ${packs.map((pack) => `${pack.packSlug} v${pack.version} (${pack.items.length})`).join("; ")}`,
    };

    results.knowledgeStructure = {
      passed: extracted.every(
        (item) =>
          item.knowledgeItem &&
          item.knowledgeItem.knowledgeId &&
          item.knowledgeItem.title &&
          item.knowledgeItem.domain &&
          Array.isArray(item.knowledgeItem.rules) &&
          typeof item.knowledgeItem.confidenceScore === "number" &&
          typeof item.knowledgeItem.qualityScore === "number" &&
          item.knowledgeItem.version >= 1
      ),
      detail: "KnowledgeItem fields present with scores and version",
    };

    const dup = await extraction.extractFromUnderstanding(understood[0]);
    results.duplicateDetection = {
      passed: dup.status === "duplicate",
      detail: `Re-extract status=${dup.status}`,
    };

    results.metadata = {
      passed: packs.every(
        (pack) =>
          pack.packId &&
          pack.contentFingerprint &&
          pack.structuredKnowledge.sourceMetadata.length > 0 &&
          pack.resourceIds.length > 0
      ),
      detail: "Pack ids, fingerprints, source metadata, resource ids present",
    };

    const awareness = extraction.getAiMeAwareness();
    results.aiMeIntegration = {
      passed:
        awareness.totalPacks >= 3 &&
        awareness.totalItems >= 3 &&
        (awareness.topWorkflows.length > 0 || awareness.topBestPractices.length > 0),
      detail: awareness.summary,
    };

    results.originalsPreserved = {
      passed: Object.entries(files).every(([key, file]) => fs.readFileSync(file, "utf8") === originals[key]),
      detail: "Original sample documents unchanged",
    };

    results.noValidationStep = {
      passed: awareness.summary.includes("Knowledge Validation (Step 6) not started"),
      detail: "Step 6 validation deferred",
    };

    // Simulate issue + repair
    const brokenPackDir = path.join(storageRoot, "knowledge", "packs", "animation");
    fs.mkdirSync(brokenPackDir, { recursive: true });
    issuesFound.push("animation pack folder without pack.json");
    let attempts = 0;
    let healthy = false;
    while (attempts < 3) {
      attempts += 1;
      const repair = await extraction.repair();
      issuesRepaired.push(...repair.actions);
      if (repair.repaired && fs.existsSync(path.join(storageRoot, "knowledge", "packs", "camera"))) {
        healthy = true;
        break;
      }
    }
    results.autoRepair = {
      passed: healthy,
      detail: `Repair attempts=${attempts}; actions=${issuesRepaired.length}`,
    };

    const draft = new ProfessionalKnowledgeExtractor().extract(understood[0]);
    results.specializedExtraction = {
      passed: draft.packSlug === "lighting" && draft.coreConcepts.length > 0,
      detail: `packSlug=${draft.packSlug}; concepts=${draft.coreConcepts.slice(0, 5).join(", ")}`,
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
  console.log("Knowledge Extraction validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
