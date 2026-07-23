import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  KnowledgeRelationType,
  KnowledgeStorageType,
  KnowledgeVerificationStatus,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-graph-test-"));
}

describe("AiKnowledgeGraphEngine", () => {
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
    await core.start("knowledge-graph-test");
    const foundation = core.getManager().knowledgeFoundation!;
    const storage = foundation.getStorageEngine();
    const graph = foundation.getGraphEngine();
    return { core, foundation, storage, graph };
  }

  it("initializes with knowledge foundation startup", async () => {
    const { core, graph } = await startCore();
    expect(graph.isInitialized()).toBe(true);
    expect(graph.isStartupComplete()).toBe(true);

    expect(fs.existsSync(path.join(storageRoot, "knowledge", "graph", "knowledge-graph.json"))).toBe(
      true
    );

    const logDate = new Date().toISOString().slice(0, 10);
    expect(fs.existsSync(path.join(storageRoot, "logs", `knowledge-graph-engine-${logDate}.jsonl`))).toBe(
      true
    );

    await core.stop();
  });

  it("creates nodes and discovers relationships from knowledge", async () => {
    const { core, storage, graph } = await startCore();

    await storage.storeRecord({
      knowledgeId: "graph-test-product",
      knowledgeType: KnowledgeStorageType.Product,
      category: "product",
      title: "Graph Test Product",
      description: "Product knowledge for graph relationship discovery.",
      source: "test",
      tags: ["graph", "test"],
      relatedKnowledge: [],
      qualityScore: 90,
      confidenceScore: 88,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    await storage.storeRecord({
      knowledgeId: "graph-test-marketing",
      knowledgeType: KnowledgeStorageType.Marketing,
      category: "marketing",
      title: "Graph Test Marketing",
      description: "Marketing knowledge related to graph test product.",
      source: "test",
      relatedKnowledge: ["graph-test-product"],
      tags: ["graph", "test"],
      qualityScore: 87,
      confidenceScore: 85,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    const discovery = await graph.discoverRelationships();
    expect(discovery.discovered).toBeGreaterThan(0);
    expect(Object.keys(graph.getGraph().nodes).length).toBeGreaterThanOrEqual(2);

    await core.stop();
  });

  it("creates validated relationships with evidence", async () => {
    const { core, storage, graph } = await startCore();

    await storage.storeRecord({
      knowledgeId: "graph-node-a",
      knowledgeType: KnowledgeStorageType.Brand,
      category: "brand",
      title: "Brand Node A",
      description: "Brand knowledge node A",
      source: "test",
      qualityScore: 90,
      confidenceScore: 88,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    await storage.storeRecord({
      knowledgeId: "graph-node-b",
      knowledgeType: KnowledgeStorageType.Creative,
      category: "creative",
      title: "Creative Node B",
      description: "Creative style knowledge node B",
      source: "test",
      qualityScore: 88,
      confidenceScore: 86,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    await graph.discoverRelationships();

    const edge = graph.createRelationship({
      sourceId: "graph-node-a",
      targetId: "graph-node-b",
      relationshipType: KnowledgeRelationType.InspiredBy,
      evidence: "Brand identity inspires creative style direction",
      strengthScore: 75,
      confidenceScore: 80,
    });

    expect(edge).toBeTruthy();
    expect(graph.getRelationships("graph-node-a").length).toBeGreaterThan(0);

    await core.stop();
  });

  it("traverses graph and searches nodes", async () => {
    const { core, storage, graph } = await startCore();

    await storage.storeRecord({
      knowledgeId: "traverse-root",
      knowledgeType: KnowledgeStorageType.Workflow,
      category: "workflow",
      title: "Traverse Root Workflow",
      description: "Root workflow for graph traversal test.",
      source: "test",
      qualityScore: 85,
      confidenceScore: 83,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    await storage.storeRecord({
      knowledgeId: "traverse-child",
      knowledgeType: KnowledgeStorageType.Decision,
      category: "decision",
      title: "Traverse Child Decision",
      description: "Decision linked to workflow traversal root.",
      source: "test",
      relatedKnowledge: ["traverse-root"],
      qualityScore: 84,
      confidenceScore: 82,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    await graph.discoverRelationships();

    graph.createRelationship({
      sourceId: "traverse-root",
      targetId: "traverse-child",
      relationshipType: KnowledgeRelationType.Produces,
      evidence: "Workflow produces decision outcomes",
    });

    const traversed = graph.traverse("traverse-root", 2);
    expect(traversed).toContain("traverse-child");

    const nodes = graph.searchNodes({ text: "traverse", limit: 5 });
    expect(nodes.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("validates integrity and builds status report", async () => {
    const { core, graph } = await startCore();

    const integrity = graph.validateIntegrity();
    expect(integrity.diagnostics).toBeDefined();

    const report = graph.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBe(100);

    await core.stop();
  });

  it("rejects relationships without evidence", async () => {
    const { core, storage, graph } = await startCore();

    await storage.storeRecord({
      knowledgeId: "evidence-a",
      knowledgeType: KnowledgeStorageType.Technical,
      category: "technical",
      title: "Evidence Test A",
      description: "Technical knowledge A",
      source: "test",
      qualityScore: 80,
      confidenceScore: 78,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    await storage.storeRecord({
      knowledgeId: "evidence-b",
      knowledgeType: KnowledgeStorageType.Technical,
      category: "technical",
      title: "Evidence Test B",
      description: "Technical knowledge B",
      source: "test",
      qualityScore: 80,
      confidenceScore: 78,
      verificationStatus: KnowledgeVerificationStatus.Verified,
    });

    await graph.discoverRelationships();

    expect(() =>
      graph.createRelationship({
        sourceId: "evidence-a",
        targetId: "evidence-b",
        relationshipType: KnowledgeRelationType.RelatedTo,
        evidence: "",
      })
    ).toThrow();

    await core.stop();
  });
});
