import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DocumentContentAnalyzer,
  DocumentIndexer,
  DocumentReader,
  DocumentStructureParser,
  DocumentUnderstandingEngine,
} from "../../../../ai/knowledge-processing-engine/index.js";

describe("Document Understanding (Step 4)", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-document-understanding-test-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("reads and understands markdown structure, topics, and difficulty", async () => {
    const file = path.join(root, "camera-guide.md");
    fs.writeFileSync(
      file,
      `# Professional Camera Guide

## Introduction
Beginner basics for getting started with camera exposure.

## Advanced Lighting Setup
Professional studio lighting and key light technique for production.

## Storytelling With Motion
Narrative arc and hook for product photography storytelling.

| Setting | Value |
| --- | --- |
| Aperture | f/2.8 |
| ISO | 200 |

![Product diagram](diagram-flow.png)
[Reference](https://example.com/camera)
`,
      "utf8"
    );

    const reader = new DocumentReader();
    const read = await reader.read(file);
    expect(read.format).toBe("markdown");
    expect(read.text).toContain("Professional Camera Guide");

    const structure = new DocumentStructureParser().parse(read.text, read.format, "fallback");
    expect(structure.title).toBe("Professional Camera Guide");
    expect(structure.chapters.length).toBeGreaterThan(0);
    expect(structure.headings.length).toBeGreaterThan(2);
    expect(structure.tables.length).toBeGreaterThan(0);
    expect(structure.diagrams.length + structure.images.length).toBeGreaterThan(0);
    expect(structure.references.length).toBeGreaterThan(0);

    const analysis = new DocumentContentAnalyzer().analyze(
      read.text,
      structure.sections.map((section) => section.title)
    );
    expect(["beginner", "intermediate", "advanced", "professional"]).toContain(analysis.difficultyLevel);
    expect(analysis.keywords.length).toBeGreaterThan(0);
    expect(analysis.domainConcepts.some((entry) => entry.category === "camera")).toBe(true);
    expect(analysis.learningTopics.length).toBeGreaterThan(0);
  });

  it("indexes documents and supports search without modifying originals", async () => {
    const file = path.join(root, "marketing.md");
    const original = `# Marketing Funnel

## Conversion CTA
Professional marketing campaign conversion and audience retention.
`;
    fs.writeFileSync(file, original, "utf8");

    const engine = new DocumentUnderstandingEngine();
    const fakeFoundation = {
      getKnowledgeResearchEngine: () => ({
        isStartupComplete: () => false,
        markDownloadProcessed: async () => undefined,
      }),
    };
    engine.initialize(fakeFoundation as never, root);
    await engine.runStartup();

    const understood = await engine.understandLocalFile({
      resourceId: "res-marketing-1",
      filePath: file,
      fileName: "marketing.md",
      title: "Marketing Funnel",
      domainId: "marketing-knowledge",
      sourceName: "Local Pack",
    });

    expect(understood.status).toBe("understood");
    expect(understood.originalPreserved).toBe(true);
    expect(fs.readFileSync(file, "utf8")).toBe(original);

    const duplicate = await engine.understandLocalFile({
      resourceId: "res-marketing-1",
      filePath: file,
      fileName: "marketing.md",
      domainId: "marketing-knowledge",
    });
    expect(duplicate.status).toBe("duplicate");

    const hits = engine.searchDocuments("marketing");
    expect(hits.some((hit) => hit.resourceId === "res-marketing-1")).toBe(true);
    expect(engine.explainDocument("res-marketing-1")).toContain("Marketing Funnel");
    expect(engine.summarizeDocument("res-marketing-1").length).toBeGreaterThan(20);

    const indexes = engine.getIndexes();
    expect(indexes.topicIndex.length).toBeGreaterThan(0);
    expect(indexes.keywordIndex.length).toBeGreaterThan(0);
    expect(indexes.domainIndex.some((entry) => entry.domainId === "marketing-knowledge")).toBe(true);

    const awareness = engine.getAiMeAwareness();
    expect(awareness.totalUnderstood).toBe(1);
    expect(awareness.summary).toContain("Document understanding");
  });

  it("repairs missing-file understanding records", async () => {
    const file = path.join(root, "temp.md");
    fs.writeFileSync(file, "# Temp\nLighting basics\n", "utf8");
    const engine = new DocumentUnderstandingEngine();
    engine.initialize(
      {
        getKnowledgeResearchEngine: () => ({
          isStartupComplete: () => false,
          markDownloadProcessed: async () => undefined,
        }),
      } as never,
      root
    );
    await engine.runStartup();
    const result = await engine.understandLocalFile({
      resourceId: "res-temp",
      filePath: file,
      fileName: "temp.md",
      domainId: "lighting-knowledge",
    });
    expect(result.status).toBe("understood");
    fs.rmSync(file);
    const repair = await engine.repair();
    expect(repair.actions.length).toBeGreaterThan(0);
    expect(engine.getByResourceId("res-temp")?.status).toBe("failed");
  });

  it("builds relationship index across related documents", async () => {
    const indexer = new DocumentIndexer();
    const reader = new DocumentReader();
    const parser = new DocumentStructureParser();
    const analyzer = new DocumentContentAnalyzer();

    const make = async (name: string, body: string) => {
      const file = path.join(root, name);
      fs.writeFileSync(file, body, "utf8");
      const read = await reader.read(file);
      const structure = parser.parse(read.text, read.format, name);
      const analysis = analyzer.analyze(read.text, structure.sections.map((section) => section.title));
      return {
        understandingId: name,
        resourceId: name,
        status: "understood" as const,
        metadata: {
          resourceId: name,
          fileName: name,
          filePath: file,
          format: read.format,
          language: "en",
          domainId: "video-production-knowledge",
          fileSizeBytes: read.fileSizeBytes,
          analyzedAt: new Date().toISOString(),
          encoding: "utf8",
          pageOrChunkEstimate: 1,
        },
        structure,
        analysis,
        summary: "test",
        searchableText: read.text,
        issues: [],
        originalPreserved: true as const,
      };
    };

    const a = await make("a.md", "# Editing\nTimeline cut pacing and montage editing.\n");
    const b = await make("b.md", "# Editing Advanced\nTimeline cut pacing for professional editing.\n");
    const indexes = indexer.build([a, b]);
    expect(indexes.relationshipIndex.length).toBeGreaterThan(0);
  });
});
