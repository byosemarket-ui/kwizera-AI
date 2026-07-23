import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MemoryStorageType,
  ProjectType,
  RelationshipType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-relationship-memory-test-"));
}

describe("AiRelationshipMemoryEngine", () => {
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
    await core.start("relationship-memory-test");
    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const products = foundation.getProductMemoryEngine();
    const relationships = foundation.getRelationshipMemoryEngine();
    return { core, foundation, projects, products, relationships };
  }

  async function seedProject(projects: Awaited<ReturnType<typeof startCore>>["projects"]) {
    await projects.createProject({
      projectId: "proj-rel-001",
      projectName: "Relationship Test Project",
      projectType: ProjectType.Product,
      description: "Project for relationship memory tests",
      tags: ["kwizera", "brand-kwizera"],
    });
  }

  it("initializes with memory foundation startup", async () => {
    const { core, relationships } = await startCore();
    expect(relationships.isInitialized()).toBe(true);
    expect(relationships.isStartupComplete()).toBe(true);

    const relationshipDir = path.join(storageRoot, "memory", "relationships");
    expect(fs.existsSync(relationshipDir)).toBe(true);
    expect(fs.existsSync(path.join(relationshipDir, "relationship-graph.json"))).toBe(true);

    await core.stop();
  });

  it("discovers relationships from project and tag links", async () => {
    const { core, projects, products, relationships } = await startCore();
    await seedProject(projects);

    await products.createProduct({
      productId: "prod-rel-001",
      projectId: "proj-rel-001",
      productName: "KWIZERA Pro",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-REL-001",
      description: "Test product for relationship discovery.",
      features: ["AI workflow"],
      specifications: { version: "1.0" },
      materials: ["digital"],
      colors: ["#000"],
      sizes: ["standard"],
      price: 99,
      currency: "USD",
      availability: "in-stock",
      countryOfOrigin: "US",
      supplier: "KWIZERA Inc",
      language: "en",
      marketingGoal: "conversion",
      tags: ["software", "kwizera"],
    });

    const discovery = await relationships.discoverRelationships("prod-rel-001");
    expect(discovery.discovered).toBeGreaterThanOrEqual(0);

    const edges = relationships.getRelationships("prod-rel-001");
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.some((e) => e.relationshipType === RelationshipType.ParentChild)).toBe(true);

    await core.stop();
  });

  it("creates and validates manual relationships", async () => {
    const { core, projects, products, relationships } = await startCore();
    await seedProject(projects);

    await products.createProduct({
      productId: "prod-rel-002",
      projectId: "proj-rel-001",
      productName: "KWIZERA Lite",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-REL-002",
      description: "Second product for relationship tests.",
      features: ["AI workflow"],
      specifications: { version: "1.0" },
      materials: ["digital"],
      colors: ["#111"],
      sizes: ["standard"],
      price: 49,
      currency: "USD",
      availability: "in-stock",
      countryOfOrigin: "US",
      supplier: "KWIZERA Inc",
      language: "en",
      marketingGoal: "conversion",
      tags: ["software"],
    });

    const edge = relationships.createRelationship({
      sourceId: "prod-rel-002",
      targetId: "proj-rel-001",
      sourceType: MemoryStorageType.Product,
      targetType: MemoryStorageType.Project,
      relationshipType: RelationshipType.Reference,
      reason: "Manual test reference",
      strengthScore: 85,
      confidenceScore: 90,
    });

    expect(edge).not.toBeNull();
    expect(edge!.strengthScore).toBe(85);
    expect(edge!.confidenceScore).toBe(90);

    await core.stop();
  });

  it("rejects invalid relationship targets", async () => {
    const { core, relationships } = await startCore();

    expect(() =>
      relationships.createRelationship({
        sourceId: "missing-source",
        targetId: "missing-target",
        sourceType: MemoryStorageType.Product,
        targetType: MemoryStorageType.Project,
        relationshipType: RelationshipType.Related,
        reason: "Invalid",
      })
    ).toThrow();

    await core.stop();
  });

  it("generates recommendations grouped by memory type", async () => {
    const { core, projects, products, relationships } = await startCore();
    await seedProject(projects);

    await products.createProduct({
      productId: "prod-rel-003",
      projectId: "proj-rel-001",
      productName: "KWIZERA Enterprise",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-REL-003",
      description: "Enterprise product for recommendation tests.",
      features: ["AI workflow"],
      specifications: { version: "2.0" },
      materials: ["digital"],
      colors: ["#222"],
      sizes: ["enterprise"],
      price: 299,
      currency: "USD",
      availability: "in-stock",
      countryOfOrigin: "US",
      supplier: "KWIZERA Inc",
      language: "en",
      marketingGoal: "conversion",
      tags: ["software", "enterprise"],
    });

    await relationships.discoverRelationships("prod-rel-003");
    const recs = relationships.getRecommendations("prod-rel-003");
    expect(recs.memoryId).toBe("prod-rel-003");
    expect(recs.all.length).toBeGreaterThan(0);
    expect(recs.projects.length + recs.products.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("traverses graph within depth limit", async () => {
    const { core, projects, products, relationships } = await startCore();
    await seedProject(projects);

    await products.createProduct({
      productId: "prod-rel-004",
      projectId: "proj-rel-001",
      productName: "KWIZERA Starter",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-REL-004",
      description: "Starter product for traversal tests.",
      features: ["AI workflow"],
      specifications: { version: "1.0" },
      materials: ["digital"],
      colors: ["#333"],
      sizes: ["standard"],
      price: 29,
      currency: "USD",
      availability: "in-stock",
      countryOfOrigin: "US",
      supplier: "KWIZERA Inc",
      language: "en",
      marketingGoal: "conversion",
      tags: ["software"],
    });

    await relationships.discoverRelationships();
    const visited = relationships.traverse("prod-rel-004", 2);
    expect(visited).toContain("proj-rel-001");

    await core.stop();
  });

  it("validates integrity and repairs broken references", async () => {
    const { core, projects, products, relationships } = await startCore();
    await seedProject(projects);

    await products.createProduct({
      productId: "prod-rel-005",
      projectId: "proj-rel-001",
      productName: "KWIZERA Integrity Test",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-REL-005",
      description: "Product for integrity validation.",
      features: ["AI workflow"],
      specifications: { version: "1.0" },
      materials: ["digital"],
      colors: ["#444"],
      sizes: ["standard"],
      price: 59,
      currency: "USD",
      availability: "in-stock",
      countryOfOrigin: "US",
      supplier: "KWIZERA Inc",
      language: "en",
      marketingGoal: "conversion",
      tags: ["software"],
    });

    relationships.graph.createEdge(
      "prod-rel-005",
      "ghost-memory-id",
      MemoryStorageType.Product,
      MemoryStorageType.Project,
      RelationshipType.Dependency,
      "Broken edge for integrity test",
      50,
      50
    );

    const report = relationships.validateIntegrity();
    expect(report.issuesFound).toBeGreaterThan(0);
    expect(report.issuesRepaired).toBeGreaterThan(0);

    await core.stop();
  });

  it("writes logs to storage root logs directory", async () => {
    const { core, relationships } = await startCore();
    const logDir = path.join(storageRoot, "logs");
    expect(fs.existsSync(logDir)).toBe(true);

    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `relationship-memory-engine-${date}.jsonl`);
    expect(fs.existsSync(logFile)).toBe(true);

    const content = fs.readFileSync(logFile, "utf8");
    expect(content).toContain("startup");
    expect(relationships.logger.getLogDirectory()).toBe(logDir);

    await core.stop();
  });

  it("builds status report with readiness score", async () => {
    const { core, relationships } = await startCore();
    const report = relationships.buildStatusReport();

    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBe(100);
    expect(report.totalNodes).toBeGreaterThanOrEqual(0);
    expect(report.relationshipGraphStatus).toContain("nodes");

    await core.stop();
  });
});
