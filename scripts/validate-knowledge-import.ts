import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DocumentUnderstandingEngine,
  KnowledgeExtractionEngine,
} from "../ai/knowledge-processing-engine/index.js";
import { KnowledgePackValidationEngine } from "../ai/knowledge-validation-engine/index.js";
import { KnowledgePackImportEngine } from "../ai/knowledge-foundation/knowledge-pack-import-engine.js";
import { KnowledgeVerificationStatus } from "../ai/knowledge-foundation/types.js";
import { KnowledgeRecordStatus } from "../ai/knowledge-storage-engine/types.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-knowledge-import-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Seeding Step 7: Knowledge Import Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];
  const records = new Map<string, Record<string, unknown>>();

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
      `# Lighting Manual\n\nYou must always set key light first.\nBest practice: ensure soft diffusion.\nTechnique: use fill light carefully.\nStep 1: Key. Step 2: Fill. Step 3: Rim.\nExample: softbox at 45 degrees.\nAvoid specular hotspots.\nWhen shadows are harsh, soften the key.\nLighting is a studio standard.\n`,
      "utf8"
    );
    fs.writeFileSync(
      files.camera,
      `# Camera Guide\n\nYou must never crush highlights.\nBest practice: recommend base ISO.\nTechnique: use aperture for depth.\nStep 1: ISO. Step 2: Aperture. Step 3: Shutter.\nExample: f/5.6 product set.\nIf blur appears, raise shutter.\nCamera exposure is a professional standard.\n`,
      "utf8"
    );
    fs.writeFileSync(
      files.marketing,
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
      [files.lighting, "lighting-knowledge", "doc-light"],
      [files.camera, "camera-knowledge", "doc-camera"],
      [files.marketing, "marketing-knowledge", "doc-market"],
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
        getStorageEngine: () => ({ isStartupComplete: () => false }),
      } as never,
      storageRoot
    );
    await extraction.runStartup();
    for (const document of understood) await extraction.extractFromUnderstanding(document);

    const packValidation = new KnowledgePackValidationEngine();
    packValidation.initialize({ getKnowledgeExtractionEngine: () => extraction } as never, storageRoot);
    await packValidation.runStartup();
    await packValidation.validateAllPacks({ improve: true });

    const storage = {
      isStartupComplete: () => true,
      storeRecord: async (input: Record<string, unknown>) => {
        const knowledgeId = String(input.knowledgeId ?? `k-${records.size + 1}`);
        const record = { knowledgeId, ...input };
        records.set(knowledgeId, record);
        return { success: true, record };
      },
      updateRecord: async (knowledgeId: string, update: Record<string, unknown>) => {
        const existing = records.get(knowledgeId);
        if (!existing) return { success: false };
        const record = { ...existing, ...update, knowledgeId };
        records.set(knowledgeId, record);
        return { success: true, record };
      },
      getRecord: async (knowledgeId: string) => {
        const record = records.get(knowledgeId);
        return record ? { success: true, record } : { success: false };
      },
    };

    const importer = new KnowledgePackImportEngine();
    importer.initialize(
      {
        getKnowledgePackValidationEngine: () => packValidation,
        getKnowledgeExtractionEngine: () => extraction,
        getStorageEngine: () => storage,
        getRetrievalEngine: () => ({
          isStartupComplete: () => true,
          invalidateCache: () => undefined,
          search: async () => ({
            results: [...records.values()].map((record, index) => ({
              knowledgeId: String(record.knowledgeId),
              title: String(record.title ?? record.knowledgeId),
              ranking: { compositeScore: 95 - index },
            })),
          }),
        }),
        getGraphEngine: () => ({ evolveGraph: async () => undefined }),
        getKnowledgeReasoningEngine: () => ({ analyzeImpact: async () => undefined }),
        getKnowledgeDomainPlanner: () => ({ markDomainContentReady: () => null }),
        integration: {
          getStatus: () => ({
            aiCore: true,
            memoryEngine: true,
            decisionEngine: true,
            reasoningEngine: true,
            planningEngine: true,
            workflowEngine: true,
            communicationBus: true,
            stateManager: true,
            recoveryEngine: false,
            healthMonitor: true,
          }),
        },
        isStartupComplete: () => true,
      } as never,
      storageRoot
    );
    await importer.runStartup();

    const imported = await importer.importAllCertified();
    results.knowledgeImport = {
      passed: imported.filter((entry) => entry.status === "imported" || entry.status === "activated").length >= 3,
      detail: `Imports: ${imported.map((entry) => `${entry.packSlug}:${entry.status}`).join(", ")}`,
    };

    const activation = importer.getLastActivation();
    results.knowledgeActivation = {
      passed: Boolean(activation?.foundationReady && activation.activatedCount >= 3),
      detail: `activated=${activation?.activatedCount}; graph=${activation?.graphUpdated}; search=${activation?.searchReady}`,
    };

    results.knowledgeGraph = {
      passed: Boolean(activation?.graphUpdated),
      detail: `graphUpdated=${activation?.graphUpdated}`,
    };

    results.semanticSearch = {
      passed: (await importer.findImported("lighting")).length > 0,
      detail: `search hits=${(await importer.findImported("lighting")).length}`,
    };

    const awareness = importer.getAiMeAwareness();
    results.aiMeIntegration = {
      passed: awareness.canFind && awareness.canExplain && awareness.canRecommend && awareness.canApply,
      detail: awareness.summary,
    };

    const engines = importer.getEngineIntegrationStatus();
    results.planningIntegration = { passed: engines.planning, detail: `planning=${engines.planning}` };
    results.decisionIntegration = { passed: engines.decision, detail: `decision=${engines.decision}` };
    results.workflowIntegration = { passed: engines.workflow, detail: `workflow=${engines.workflow}` };
    results.imageGenerationIntegration = {
      passed: engines.imageGeneration,
      detail: `imageGeneration=${engines.imageGeneration}`,
    };
    results.videoGenerationIntegration = {
      passed: engines.videoGeneration,
      detail: `videoGeneration=${engines.videoGeneration}`,
    };
    results.renderingIntegration = { passed: engines.rendering, detail: `rendering=${engines.rendering}` };

    results.synchronization = {
      passed: Boolean(activation?.indexUpdated && activation.memorySynced && activation.searchReady),
      detail: `index=${activation?.indexUpdated}; memory=${activation?.memorySynced}; search=${activation?.searchReady}`,
    };

    const nonCertified = await importer.importCertifiedPack("general");
    results.onlyCertified = {
      passed: nonCertified.status === "failed" || nonCertified.status === "duplicate",
      detail: `non-certified attempt status=${nonCertified.status}`,
    };

    const verifiedPayloads = [...records.values()].every(
      (record) =>
        record.verificationStatus === KnowledgeVerificationStatus.Verified &&
        (record.payload as { validationDeferred?: boolean } | undefined)?.validationDeferred === false
    );
    results.foundationRecords = {
      passed: records.size >= 3 && verifiedPayloads,
      detail: `records=${records.size}; deferredCleared=${verifiedPayloads}`,
    };

    // Corrupt import meta + repair
    const importsFile = path.join(storageRoot, "knowledge", "imports", "imports.json");
    if (fs.existsSync(importsFile)) {
      // leave file; delete one cert sync marker by clearing a record deferred incorrectly
      const firstId = [...records.keys()][0];
      const first = records.get(firstId)!;
      first.payload = { ...(first.payload as object), validationDeferred: true, imported: false };
      records.set(firstId, first);
      issuesFound.push("validationDeferred reintroduced on imported record");
    }
    let attempts = 0;
    let healthy = false;
    while (attempts < 3) {
      attempts += 1;
      const repair = await importer.repair();
      issuesRepaired.push(...repair.actions);
      const health = await importer.runHealthCheck();
      if (health.healthy || health.synchronizationFailures.length === 0) {
        healthy = true;
        break;
      }
    }
    results.autoRepair = {
      passed: healthy,
      detail: `Repair attempts=${attempts}; actions=${issuesRepaired.length}`,
    };

    results.noPersistenceTesting = {
      passed: awareness.summary.includes("Step 8"),
      detail: "Step 8 persistence testing deferred",
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
  console.log("Knowledge Import validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
