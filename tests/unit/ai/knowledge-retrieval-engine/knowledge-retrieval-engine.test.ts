import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  KnowledgeSearchMode,
  KnowledgeStorageType,
  KnowledgeVerificationStatus,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-retrieval-test-"));
}

describe("AiKnowledgeRetrievalEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  async function startCore() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-retrieval-test");
    const foundation = core.getManager().knowledgeFoundation!;
    const storage = foundation.getStorageEngine();
    const retrieval = foundation.getRetrievalEngine();
    return { core, foundation, storage, retrieval };
  }

  it("initializes with knowledge foundation startup", async () => {
    const { core, retrieval } = await startCore();
    expect(retrieval.isInitialized()).toBe(true);
    expect(retrieval.isStartupComplete()).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(
      fs.existsSync(path.join(storageRoot, "logs", `knowledge-retrieval-engine-${logDate}.jsonl`))
    ).toBe(true);

    await core.stop();
  });

  it("searches knowledge by keyword and category", async () => {
    const { core, storage, retrieval } = await startCore();

    await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Brand,
      category: "brand",
      title: "KWIZERA Brand Identity",
      description: "Brand knowledge for KWIZERA AI STUDIO visual identity and tone.",
      source: "test",
      keywords: ["brand", "identity"],
      qualityScore: 90,
      confidenceScore: 88,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    const keyword = await retrieval.search({
      mode: KnowledgeSearchMode.Keyword,
      keywords: ["brand"],
      limit: 5,
    });
    expect(keyword.success).toBe(true);
    expect(keyword.results.length).toBeGreaterThan(0);

    const category = await retrieval.search({
      mode: KnowledgeSearchMode.Category,
      category: "brand",
      limit: 5,
    });
    expect(category.results.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("ranks higher quality knowledge first", async () => {
    const { core, storage, retrieval } = await startCore();

    await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Technical,
      category: "technical",
      title: "Low Quality Technical Note",
      description: "Basic technical note for ranking test.",
      source: "test",
      qualityScore: 50,
      confidenceScore: 45,
    });

    await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Technical,
      category: "technical",
      title: "High Quality Technical Architecture",
      description: "Detailed technical architecture knowledge for KWIZERA platform.",
      source: "test",
      qualityScore: 95,
      confidenceScore: 92,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    const search = await retrieval.search({
      mode: KnowledgeSearchMode.Hybrid,
      text: "technical",
      limit: 5,
    });

    expect(search.results.length).toBeGreaterThanOrEqual(2);
    expect(search.results[0].ranking.compositeScore).toBeGreaterThanOrEqual(
      search.results[1].ranking.compositeScore
    );

    await core.stop();
  });

  it("retrieves knowledge with related recommendations and cache", async () => {
    const { core, storage, retrieval } = await startCore();

    const stored = await storage.storeRecord({
      knowledgeId: "retrieval-test-product",
      knowledgeType: KnowledgeStorageType.Product,
      category: "product",
      title: "Retrieval Test Product Knowledge",
      description: "Product knowledge for retrieval and recommendation testing.",
      source: "test",
      tags: ["retrieval", "test"],
      qualityScore: 91,
      confidenceScore: 89,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Marketing,
      category: "marketing",
      title: "Retrieval Test Marketing Knowledge",
      description: "Marketing knowledge related to retrieval test product.",
      source: "test",
      relatedKnowledge: [stored.record!.knowledgeId],
      qualityScore: 87,
      confidenceScore: 85,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    const first = await retrieval.retrieve(stored.record!.knowledgeId);
    expect(first.success).toBe(true);
    expect(first.fromCache).toBe(false);

    const second = await retrieval.retrieve(stored.record!.knowledgeId);
    expect(second.fromCache).toBe(true);
    expect(second.relatedKnowledge.length + second.recommendations.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("supports semantic and context search", async () => {
    const { core, storage, retrieval } = await startCore();

    await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Decision,
      category: "decision",
      title: "Creative Decision Framework",
      description: "Decision knowledge for AI reasoning and planning in creative workflows.",
      source: "test",
      qualityScore: 88,
      confidenceScore: 86,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    const semantic = await retrieval.search({
      mode: KnowledgeSearchMode.Semantic,
      text: "reasoning planning creative",
      limit: 5,
    });
    expect(semantic.results.length).toBeGreaterThan(0);

    const context = await retrieval.search({
      mode: KnowledgeSearchMode.Context,
      context: { objective: "creative workflow planning", domain: "creative" },
      limit: 5,
    });
    expect(context.results.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("matches offline semantic synonyms rather than requiring exact wording", async () => {
    const { core, storage, retrieval } = await startCore();

    await storage.storeRecord({
      knowledgeType: KnowledgeStorageType.Image,
      category: "image",
      title: "Commercial Lighting",
      description: "Lighting techniques for controlled product photography.",
      source: "test",
      qualityScore: 88,
      confidenceScore: 86,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    const semantic = await retrieval.search({ mode: KnowledgeSearchMode.Semantic, text: "product illumination", limit: 5 });
    expect(semantic.results.some((result) => result.record?.title === "Commercial Lighting")).toBe(true);
    await core.stop();
  });

  it("rejects invalid retrieval and builds status report", async () => {
    const { core, retrieval } = await startCore();

    const invalid = await retrieval.retrieve("missing-knowledge-id");
    expect(invalid.success).toBe(false);
    expect(invalid.recoverySuggestion).toBeTruthy();

    const report = retrieval.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBe(100);

    await core.stop();
  });
});
