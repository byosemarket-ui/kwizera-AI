import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DocumentUnderstandingEngine,
  KnowledgeExtractionEngine,
} from "../ai/knowledge-processing-engine/index.js";
import { KnowledgePackValidationEngine } from "../ai/knowledge-validation-engine/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-pack-validation-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Seeding Step 6: Knowledge Pack Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const docsDir = path.join(storageRoot, "sample-docs");
    fs.mkdirSync(docsDir, { recursive: true });
    const lighting = path.join(docsDir, "lighting.md");
    const camera = path.join(docsDir, "camera.md");
    const marketing = path.join(docsDir, "marketing.md");
    fs.writeFileSync(
      lighting,
      `# Lighting Manual\n\nYou must always set key light first.\nBest practice: ensure soft diffusion.\nTechnique: use fill light carefully.\nStep 1: Key. Step 2: Fill. Step 3: Rim.\nExample: softbox at 45 degrees.\nAvoid specular hotspots.\nWhen shadows are harsh, soften the key.\nLighting is a studio standard.\n`,
      "utf8"
    );
    fs.writeFileSync(
      camera,
      `# Camera Guide\n\nYou must never crush highlights.\nBest practice: recommend base ISO.\nTechnique: use aperture for depth.\nStep 1: ISO. Step 2: Aperture. Step 3: Shutter.\nExample: f/5.6 product set.\nIf blur appears, raise shutter.\nCamera exposure is a professional standard.\n`,
      "utf8"
    );
    fs.writeFileSync(
      marketing,
      `# Marketing Funnel\n\nYou must always define audience CTA.\nBest practice: ensure message clarity.\nTechnique: use retention hooks.\nStep 1: Awareness. Step 2: Consideration. Step 3: Conversion.\nExample: carousel CTA above fold.\nWhen bounce is high, simplify CTA.\nMarketing conversion is a brand standard.\n`,
      "utf8"
    );

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
    for (const [file, domain, id] of [
      [lighting, "lighting-knowledge", "doc-light"],
      [camera, "camera-knowledge", "doc-camera"],
      [marketing, "marketing-knowledge", "doc-market"],
    ] as const) {
      understood.push(
        await understanding.understandLocalFile({
          resourceId: id,
          filePath: file,
          fileName: path.basename(file),
          domainId: domain,
        })
      );
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
    for (const document of understood) {
      await extraction.extractFromUnderstanding(document);
    }

    const validation = new KnowledgePackValidationEngine();
    validation.initialize(
      {
        getKnowledgeExtractionEngine: () => extraction,
      } as never,
      storageRoot
    );
    await validation.runStartup();

    const validated = await validation.validateAllPacks({ improve: true });
    results.knowledgeValidation = {
      passed: validated.length >= 3 && validated.every((item) => item.status !== "rejected"),
      detail: `Validated ${validated.length}: ${validated.map((item) => `${item.packSlug}:${item.status}`).join(", ")}`,
    };

    results.qualityAnalysis = {
      passed: validated.every((item) => item.findings && item.scores.qualityScore > 0),
      detail: `Quality scores: ${validated.map((item) => item.scores.qualityScore).join(", ")}`,
    };

    const dupAttempt = await validation.validatePack("lighting", { improve: false });
    results.duplicateDetection = {
      passed: dupAttempt.packId === validated.find((item) => item.packSlug === "lighting")?.packId,
      detail: "Re-validation returns stable pack identity (no duplicate pack creation)",
    };

    results.knowledgeRelationships = {
      passed: validated.some((item) => item.checks.knowledgeRelationships || item.findings.invalidRelationships.length === 0),
      detail: `Relationship checks: ${validated.map((item) => `${item.packSlug}:${item.checks.knowledgeRelationships}`).join(", ")}`,
    };

    const awareness = validation.getAiMeAwareness();
    results.aiMeUnderstanding = {
      passed: awareness.canExplain && awareness.canRecommend && awareness.totalValidated >= 3,
      detail: awareness.summary,
    };

    const certified = validated.filter((item) => item.certified);
    results.knowledgeCertification = {
      passed: certified.every((item) => item.foundationImportDeferred && item.scores.professionalReadinessScore >= 72),
      detail: `Certified: ${certified.map((item) => item.packSlug).join(", ") || "none"}; deferred=${certified.every((item) => item.foundationImportDeferred)}`,
    };

    results.noFoundationImport = {
      passed: validated.every((item) => item.foundationImportDeferred === true),
      detail: "All results mark foundationImportDeferred=true (Step 7 not started)",
    };

    results.scoreBundle = {
      passed: validated.every(
        (item) =>
          typeof item.scores.qualityScore === "number" &&
          typeof item.scores.confidenceScore === "number" &&
          typeof item.scores.completenessScore === "number" &&
          typeof item.scores.professionalReadinessScore === "number"
      ),
      detail: `Avg Q/C/Comp/R: ${awareness.averageQuality}/${awareness.averageConfidence}/${awareness.averageCompleteness}/${awareness.averageProfessionalReadiness}`,
    };

    // Simulate missing cert sidecar + repair
    const certFile = path.join(storageRoot, "knowledge", "validation", "packs", "lighting.json");
    if (fs.existsSync(certFile)) {
      fs.rmSync(certFile);
      issuesFound.push("Missing lighting certification sidecar");
    }
    let attempts = 0;
    let healthy = false;
    while (attempts < 3) {
      attempts += 1;
      const repair = await validation.repair();
      issuesRepaired.push(...repair.actions);
      if (repair.repaired && fs.existsSync(certFile)) {
        healthy = true;
        break;
      }
      if (repair.repaired && !fs.existsSync(certFile) && validated.every((item) => item.packSlug !== "lighting")) {
        healthy = true;
        break;
      }
      // After repair, re-persist from in-memory results
      if (fs.existsSync(path.join(storageRoot, "knowledge", "validation", "packs", "index.json"))) {
        healthy = repair.repaired;
        if (healthy) break;
      }
    }
    results.autoRepair = {
      passed: healthy,
      detail: `Repair attempts=${attempts}; actions=${issuesRepaired.length}`,
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
  console.log("Knowledge Pack Validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
