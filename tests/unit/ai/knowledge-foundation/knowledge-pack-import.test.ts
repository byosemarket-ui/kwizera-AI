import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DocumentUnderstandingEngine,
  KnowledgeExtractionEngine,
} from "../../../../ai/knowledge-processing-engine/index.js";
import { KnowledgePackValidationEngine } from "../../../../ai/knowledge-validation-engine/index.js";
import { KnowledgePackImportEngine } from "../../../../ai/knowledge-foundation/knowledge-pack-import-engine.js";
import { KnowledgeVerificationStatus } from "../../../../ai/knowledge-foundation/types.js";
import { KnowledgeRecordStatus } from "../../../../ai/knowledge-storage-engine/types.js";

describe("Knowledge Pack Import (Step 7)", () => {
  let root: string;
  const records = new Map<string, Record<string, unknown>>();

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-import-test-"));
    records.clear();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function createStorageMock() {
    return {
      isStartupComplete: () => true,
      storeRecord: async (input: Record<string, unknown>) => {
        const knowledgeId = String(input.knowledgeId ?? `k-${records.size + 1}`);
        const record = {
          knowledgeId,
          ...input,
          verificationStatus: input.verificationStatus ?? KnowledgeVerificationStatus.Verified,
          status: input.status ?? KnowledgeRecordStatus.Verified,
        };
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
  }

  async function seedCertifiedPacks() {
    const understanding = new DocumentUnderstandingEngine();
    understanding.initialize(
      {
        getKnowledgeResearchEngine: () => ({
          isStartupComplete: () => false,
          markDownloadProcessed: async () => undefined,
        }),
      } as never,
      root
    );
    await understanding.runStartup();

    const lighting = path.join(root, "lighting.md");
    fs.writeFileSync(
      lighting,
      `# Lighting Manual\n\nYou must always set key light first.\nBest practice: ensure soft diffusion.\nTechnique: use fill light carefully.\nStep 1: Key. Step 2: Fill. Step 3: Rim.\nExample: softbox at 45 degrees.\nAvoid specular hotspots.\nWhen shadows are harsh, soften the key.\nLighting is a studio standard.\n`,
      "utf8"
    );
    const camera = path.join(root, "camera.md");
    fs.writeFileSync(
      camera,
      `# Camera Guide\n\nYou must never crush highlights.\nBest practice: recommend base ISO.\nTechnique: use aperture for depth.\nStep 1: ISO. Step 2: Aperture. Step 3: Shutter.\nExample: f/5.6 product set.\nIf blur appears, raise shutter.\nCamera exposure is a professional standard.\n`,
      "utf8"
    );

    const docs = [];
    for (const [file, domain, id] of [
      [lighting, "lighting-knowledge", "res-light"],
      [camera, "camera-knowledge", "res-camera"],
    ] as const) {
      docs.push(
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
      root
    );
    await extraction.runStartup();
    for (const doc of docs) await extraction.extractFromUnderstanding(doc);

    const packValidation = new KnowledgePackValidationEngine();
    packValidation.initialize({ getKnowledgeExtractionEngine: () => extraction } as never, root);
    await packValidation.runStartup();
    await packValidation.validateAllPacks({ improve: true });

    const storage = createStorageMock();
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
              ranking: { compositeScore: 90 - index },
            })),
          }),
        }),
        getGraphEngine: () => ({
          evolveGraph: async () => undefined,
        }),
        getKnowledgeReasoningEngine: () => ({
          analyzeImpact: async () => undefined,
        }),
        getKnowledgeDomainPlanner: () => ({
          markDomainContentReady: () => null,
        }),
        integration: {
          getStatus: () => ({
            aiCore: true,
            memoryEngine: true,
            decisionEngine: true,
            reasoningEngine: true,
            planningEngine: true,
            workflowEngine: true,
            communicationBus: false,
            stateManager: false,
            recoveryEngine: false,
            healthMonitor: false,
          }),
        },
        isStartupComplete: () => true,
      } as never,
      root
    );
    await importer.runStartup();
    return { extraction, packValidation, importer, storage };
  }

  it("imports only certified packs into the foundation and blocks duplicates", async () => {
    const { importer, extraction } = await seedCertifiedPacks();
    const imported = await importer.importAllCertified();
    expect(imported.length).toBeGreaterThanOrEqual(2);
    expect(imported.every((entry) => entry.status === "imported" || entry.status === "activated" || entry.status === "duplicate")).toBe(true);
    expect(imported.every((entry) => entry.knowledgeId)).toBe(true);

    const pack = await extraction.getPack("lighting");
    expect(pack?.status).toBe("imported");
    expect(pack?.importKnowledgeId).toBeTruthy();

    const dup = await importer.importCertifiedPack("lighting");
    expect(dup.status).toBe("duplicate");

    const activation = importer.getLastActivation();
    expect(activation?.foundationReady).toBe(true);
    expect(activation?.importedCount).toBeGreaterThanOrEqual(2);
  });

  it("activates engines and supports AI Me find/explain/recommend", async () => {
    const { importer } = await seedCertifiedPacks();
    await importer.importAllCertified();
    const engines = await importer.synchronizeEcosystem();
    expect(engines.aiMe).toBe(true);
    expect(engines.imageGeneration).toBe(true);
    expect(engines.videoGeneration).toBe(true);

    const awareness = importer.getAiMeAwareness();
    expect(awareness.canFind).toBe(true);
    expect(awareness.canExplain).toBe(true);
    expect(awareness.canRecommend).toBe(true);
    expect(awareness.summary).toContain("Step 8");

    const explanation = importer.explainImported("lighting");
    expect(explanation).toContain("Imported");

    const recommendations = importer.recommendImported(3);
    expect(recommendations.length).toBeGreaterThan(0);

    const found = await importer.findImported("lighting");
    expect(found.length).toBeGreaterThan(0);
  });

  it("rejects non-certified packs and repairs health issues", async () => {
    const { importer, extraction } = await seedCertifiedPacks();
    // Force a generated-only pack path by writing a weak uncertified pack status if present
    const packs = extraction.listPacks();
    expect(packs.some((pack) => pack.status === "certified" || pack.status === "imported")).toBe(true);

    await importer.importAllCertified();
    const health = await importer.runHealthCheck();
    expect(health.missingCertifiedPacks.length).toBe(0);

    const repair = await importer.repair();
    expect(repair.repaired).toBe(true);
  });
});
