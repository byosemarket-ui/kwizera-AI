import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DocumentUnderstandingEngine,
  KnowledgeExtractionEngine,
  ProfessionalKnowledgeExtractor,
} from "../../../../ai/knowledge-processing-engine/index.js";

describe("Knowledge Extraction & Packs (Step 5)", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-extraction-test-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function understandSample(fileName: string, content: string, domainId: string, resourceId: string) {
    const file = path.join(root, fileName);
    fs.writeFileSync(file, content, "utf8");
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
    return understanding.understandLocalFile({
      resourceId,
      filePath: file,
      fileName,
      domainId,
      title: fileName,
    });
  }

  it("extracts professional knowledge fields from understood documents", async () => {
    const doc = await understandSample(
      "lighting.md",
      `# Professional Lighting Manual

## Key Light Setup
You must always place the key light at 45 degrees for studio production.
Best practice: ensure softbox diffusion for consistent skin tones.
Technique: use fill light to reduce contrast.
Avoid hard shadows on product edges.
Step 1: Set key light. Step 2: Add fill. Step 3: Check exposure.
Example: softbox at f/5.6 for catalog shots.
`,
      "lighting-knowledge",
      "res-light"
    );

    const draft = new ProfessionalKnowledgeExtractor().extract(doc);
    expect(draft.packSlug).toBe("lighting");
    expect(draft.rules.length + draft.bestPractices.length + draft.professionalTechniques.length).toBeGreaterThan(2);
    expect(draft.workflow.length).toBeGreaterThan(0);
    expect(draft.confidenceScore).toBeGreaterThan(40);
    expect(draft.coreConcepts.length).toBeGreaterThan(0);
  });

  it("generates knowledge packs without modifying originals or duplicating", async () => {
    const file = path.join(root, "camera.md");
    const original = `# Camera Exposure Guide

## Professional Workflow
You must always meter exposure before shooting.
Best practice: ensure consistent ISO across takes.
Technique: use aperture priority for product photography.
Step 1: Set ISO. Step 2: Choose aperture. Step 3: Confirm shutter.
Example: ISO 100 at f/8 for catalog work.
Avoid raising ISO without need.
`;
    fs.writeFileSync(file, original, "utf8");

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
    const doc = await understanding.understandLocalFile({
      resourceId: "res-camera",
      filePath: file,
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

    const first = await extraction.extractFromUnderstanding(doc);
    expect(["extracted", "weak", "merged"]).toContain(first.status);
    expect(first.knowledgeItem).toBeTruthy();
    expect(first.knowledgeItem?.rules.length).toBeGreaterThan(0);
    expect(first.originalPreserved).toBe(true);

    const packs = extraction.listPacks();
    expect(packs.some((pack) => pack.packSlug === "camera")).toBe(true);
    expect(fs.existsSync(path.join(root, "knowledge", "packs", "camera", "pack.json"))).toBe(true);
    expect(fs.readFileSync(file, "utf8")).toBe(original);

    const second = await extraction.extractFromUnderstanding(doc);
    expect(second.status).toBe("duplicate");

    const awareness = extraction.getAiMeAwareness();
    expect(awareness.totalPacks).toBeGreaterThan(0);
    expect(awareness.totalItems).toBeGreaterThan(0);
    expect(awareness.summary).toContain("Knowledge Validation (Step 6) not started");
  });

  it("repairs empty pack layout and keeps version history on updates", async () => {
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

    const docA = await understanding.understandLocalFile({
      resourceId: "res-story-a",
      filePath: (() => {
        const file = path.join(root, "story-a.md");
        fs.writeFileSync(
          file,
          `# Storytelling Craft\n\nYou must always open with a narrative hook.\nBest practice: ensure conflict appears early.\nStep 1: Hook. Step 2: Conflict. Step 3: Reveal.\nExample: product hero opens on a problem.\n`,
          "utf8"
        );
        return file;
      })(),
      fileName: "story-a.md",
      domainId: "storytelling-knowledge",
    });
    const docB = await understanding.understandLocalFile({
      resourceId: "res-story-b",
      filePath: (() => {
        const file = path.join(root, "story-b.md");
        fs.writeFileSync(
          file,
          `# Advanced Storytelling\n\nYou must never bury the climax.\nTechnique: use reveal timing for emotional payoff.\nBest practice: recommend a clear protagonist goal.\nStep 1: Setup. Step 2: Turn. Step 3: Payoff.\nExample: brand film ends on transformation.\n`,
          "utf8"
        );
        return file;
      })(),
      fileName: "story-b.md",
      domainId: "storytelling-knowledge",
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
    await extraction.extractFromUnderstanding(docA);
    const merged = await extraction.extractFromUnderstanding(docB);
    expect(["merged", "extracted", "weak"]).toContain(merged.status);

    const pack = await extraction.getPack("storytelling");
    expect(pack?.items.length).toBeGreaterThanOrEqual(2);
    expect(pack?.version).toBeGreaterThanOrEqual(2);
    expect(fs.existsSync(path.join(root, "knowledge", "packs", "storytelling", "versions"))).toBe(true);

    const repair = await extraction.repair();
    expect(repair.repaired).toBe(true);
  });
});
