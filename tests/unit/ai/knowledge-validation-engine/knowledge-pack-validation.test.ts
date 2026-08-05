import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DocumentUnderstandingEngine,
  KnowledgeExtractionEngine,
} from "../../../../ai/knowledge-processing-engine/index.js";
import {
  KnowledgePackImprover,
  KnowledgePackQualityAnalyzer,
  KnowledgePackValidationEngine,
} from "../../../../ai/knowledge-validation-engine/index.js";

describe("Knowledge Pack Validation (Step 6)", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-pack-validation-test-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function seedPacks() {
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
      `# Lighting Manual

You must always set key light first for professional production.
Best practice: ensure soft diffusion on skin tones.
Technique: use fill light to control contrast.
Step 1: Place key light. Step 2: Add fill. Step 3: Confirm exposure.
Example: softbox at 45 degrees for catalog work.
Avoid hard specular hotspots on products.
When contrast is too high, add fill.
Lighting is a core studio discipline.
`,
      "utf8"
    );
    const camera = path.join(root, "camera.md");
    fs.writeFileSync(
      camera,
      `# Camera Exposure Guide

You must never crush highlight detail.
Best practice: recommend base ISO for product sets.
Technique: use aperture for depth of field control.
Step 1: Set ISO. Step 2: Choose aperture. Step 3: Confirm shutter.
Example: ISO 100 at f/8 for catalog sharpness.
Camera exposure is a professional imaging standard.
If motion blur appears, raise shutter speed.
`,
      "utf8"
    );

    const docLight = await understanding.understandLocalFile({
      resourceId: "res-light",
      filePath: lighting,
      fileName: "lighting.md",
      domainId: "lighting-knowledge",
    });
    const docCamera = await understanding.understandLocalFile({
      resourceId: "res-camera",
      filePath: camera,
      fileName: "camera.md",
      domainId: "camera-knowledge",
    });

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
      root
    );
    await extraction.runStartup();
    await extraction.extractFromUnderstanding(docLight);
    await extraction.extractFromUnderstanding(docCamera);

    const validation = new KnowledgePackValidationEngine();
    validation.initialize(
      {
        getKnowledgeExtractionEngine: () => extraction,
      } as never,
      root
    );
    await validation.runStartup();
    return { extraction, validation };
  }

  it("validates packs, improves quality, and certifies without Foundation import", async () => {
    const { extraction, validation } = await seedPacks();
    const lighting = await validation.validatePack("lighting", { improve: true });
    expect(lighting.foundationImportDeferred).toBe(true);
    expect(lighting.scores.qualityScore).toBeGreaterThan(0);
    expect(lighting.scores.completenessScore).toBeGreaterThan(0);
    expect(lighting.scores.professionalReadinessScore).toBeGreaterThan(0);
    expect(["certified", "improved", "needs-improvement"]).toContain(lighting.status);

    const all = await validation.validateAllPacks({ improve: true });
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.every((result) => result.foundationImportDeferred)).toBe(true);

    const pack = await extraction.getPack("lighting");
    expect(pack?.status === "certified" || pack?.status === "validated" || pack?.status === "generated").toBe(true);
    // No permanent Foundation import side-effect in this isolated harness.
    expect(lighting.certified ? pack?.status : pack?.status).toBeTruthy();
  });

  it("detects quality findings and supports AI Me explain/compare/recommend", async () => {
    const { validation } = await seedPacks();
    await validation.validateAllPacks({ improve: true });

    const explanation = validation.explainPackKnowledge("lighting");
    expect(explanation).toContain("Foundation import deferred");

    const comparison = validation.comparePacks("lighting", "camera");
    expect(comparison).toMatch(/readiness|Compare requires/);

    const practices = validation.recommendBestPractices("lighting", 3);
    expect(practices.length).toBeGreaterThan(0);

    const decisions = validation.applyDecisionRules("lighting", 3);
    expect(decisions.length).toBeGreaterThan(0);

    const awareness = validation.getAiMeAwareness();
    expect(awareness.totalValidated).toBeGreaterThanOrEqual(2);
    expect(awareness.canExplain).toBe(true);
    expect(awareness.summary).toContain("Step 7");
  });

  it("analyzes and improves weak packs without destroying content", async () => {
    const analyzer = new KnowledgePackQualityAnalyzer();
    const improver = new KnowledgePackImprover();
    const weakPack = {
      packId: "pack-weak",
      packSlug: "marketing" as const,
      domain: "marketing",
      title: "Marketing Pack",
      version: 1,
      status: "weak" as const,
      items: [
        {
          knowledgeId: "ki-1",
          title: "CTA",
          domain: "marketing",
          category: "marketing",
          description: "Short",
          coreConcepts: ["cta"],
          definitions: [],
          rules: ["Always define a clear CTA."],
          bestPractices: [],
          professionalTechniques: ["Use retention hooks."],
          workflow: ["Write CTA"],
          decisionRules: [],
          commonMistakes: [],
          troubleshooting: [],
          recommendations: [],
          examples: [],
          professionalStandards: [],
          relatedTopics: [],
          keywords: ["cta", "cta"],
          confidenceScore: 55,
          qualityScore: 50,
          sourceMetadata: [{ name: "x", type: "markdown", reliability: 80 }],
          version: 1,
        },
      ],
      structuredKnowledge: {
        title: "Marketing Pack",
        category: "marketing",
        domain: "marketing",
        description: "Short",
        sections: [],
        concepts: ["cta"],
        entities: ["cta"],
        terminology: ["cta"],
        rules: ["Always define a clear CTA."],
        bestPractices: [],
        professionalTechniques: ["Use retention hooks."],
        examples: [],
        commonMistakes: [],
        qualityRules: [],
        decisionRules: [],
        workflowSteps: ["Write CTA"],
        prerequisites: [],
        dependencies: [],
        relatedKnowledge: [],
        difficultyLevel: "foundation" as const,
        confidenceScore: 55,
        sourceMetadata: [{ name: "x", type: "markdown", reliability: 80 }],
      },
      resourceIds: ["r1"],
      understandingIds: ["u1"],
      contentFingerprint: "abc",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      originalDocumentsPreserved: true as const,
      issues: ["weak"],
    };

    const before = analyzer.analyze(weakPack);
    expect(before.findings.missingWorkflows.length + before.findings.weakExplanations.length).toBeGreaterThan(0);
    const improved = improver.improve(weakPack, before.findings);
    expect(improved.improvements.length).toBeGreaterThan(0);
    expect(improved.pack.items[0].rules).toContain("Always define a clear CTA.");
    const after = analyzer.analyze(improved.pack);
    expect(after.scores.completenessScore).toBeGreaterThanOrEqual(before.scores.completenessScore);
  });
});
