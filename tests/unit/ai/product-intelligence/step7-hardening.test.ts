import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { encodeRgbaPng } from "../../../../ai/creative-workspace/png-pixels.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { resolveProductKnowledgeTeach } from "../../../../ai/product-intelligence/product-intelligence-bridge.js";
import { collapseRepeatedProvenanceMarkers, appendProvenanceOnce } from "../../../../ai/product-intelligence/provenance-text.js";
import { normalizeProductIntelligenceProfile } from "../../../../ai/product-intelligence/normalize-profile.js";
import type { ProductIntelligenceProfile } from "../../../../ai/product-intelligence/types.js";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function brownProductPng(): string {
  const width = 48;
  const height = 32;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const inSole = y > height * 0.7;
      rgba[i] = inSole ? 40 : 132;
      rgba[i + 1] = inSole ? 28 : 86;
      rgba[i + 2] = inSole ? 18 : 42;
      rgba[i + 3] = 255;
    }
  }
  return encodeRgbaPng(width, height, rgba).toString("base64");
}

describe("STEP 7 hardening: provenance labels", () => {
  it("collapses duplicated inferred markers without hiding provenance", () => {
    expect(collapseRepeatedProvenanceMarkers("style-conscious shoppers (inferred) (inferred)"))
      .toBe("style-conscious shoppers (inferred)");
    expect(appendProvenanceOnce("style-conscious shoppers (inferred)", "inferred"))
      .toBe("style-conscious shoppers (inferred)");
    expect(appendProvenanceOnce("style-conscious shoppers", "inferred"))
      .toBe("style-conscious shoppers (inferred)");
  });
});

describe("STEP 7 hardening: Knowledge equivalents", () => {
  it("links first analysis and reuses same-project equivalent knowledge without an error", async () => {
    const records = new Map<string, { projectId: string; status: string }>([
      ["know-a", { projectId: "project-a", status: "active" }],
    ]);
    const teaching = {
      findReusableProjectEquivalents: async (projectId: string, ids: string[]) =>
        ids.filter((id) => records.get(id)?.projectId === projectId && records.get(id)?.status === "active"),
      storeTaughtKnowledge: async () => ({ ok: true, knowledgeId: "know-new", scope: "project" as const }),
      retrieve: async () => ({ ok: true, records: [], knowledgeIds: [], count: 0 }),
    };

    const first = await resolveProductKnowledgeTeach({
      taught: { ok: true, knowledgeId: "know-a", scope: "project" },
      teaching,
      projectId: "project-a",
      topic: "Product intelligence for Leather Oxford",
      content: "USER FACTS: name=Leather Oxford.",
      existingIds: [],
    });
    expect(first.knowledgeStatus).toBe("linked");
    expect(first.foundationKnowledgeIds).toContain("know-a");

    const again = await resolveProductKnowledgeTeach({
      taught: {
        ok: false,
        scope: "project",
        error: "The extracted knowledge lacks sufficient confidence. Equivalent knowledge already exists in the Knowledge Foundation.",
        preview: {
          requestId: "req-1",
          topic: "Product intelligence",
          knowledgeType: "product-knowledge" as never,
          status: "rejected",
          sources: [],
          duplicateKnowledgeIds: ["know-a"],
          conflicts: [],
          confidenceScore: 40,
          qualityScore: 40,
          rejectionReasons: ["Equivalent knowledge already exists in the Knowledge Foundation."],
          createdAt: new Date().toISOString(),
        } as never,
      },
      teaching,
      projectId: "project-a",
      topic: "Product intelligence for Leather Oxford",
      content: "USER FACTS: name=Leather Oxford.",
      existingIds: ["know-a"],
    });
    expect(again.knowledgeStatus).toBe("already-linked");
    expect(again.foundationKnowledgeIds).toContain("know-a");
  });

  it("does not link another project's equivalent knowledge", async () => {
    const teaching = {
      findReusableProjectEquivalents: async () => [],
      storeTaughtKnowledge: async () => ({ ok: true, knowledgeId: "know-b", scope: "project" as const }),
      retrieve: async () => ({ ok: true, records: [], knowledgeIds: [], count: 0 }),
    };
    const result = await resolveProductKnowledgeTeach({
      taught: {
        ok: false,
        scope: "project",
        error: "Equivalent knowledge already exists in the Knowledge Foundation.",
        preview: {
          requestId: "req-2",
          topic: "Product intelligence",
          knowledgeType: "product-knowledge" as never,
          status: "rejected",
          sources: [],
          duplicateKnowledgeIds: ["know-a"],
          conflicts: [],
          confidenceScore: 40,
          qualityScore: 40,
          rejectionReasons: ["Equivalent knowledge already exists in the Knowledge Foundation."],
          createdAt: new Date().toISOString(),
        } as never,
      },
      teaching,
      projectId: "project-b",
      topic: "Product intelligence for Steel Bottle",
      content: "USER FACTS: name=Steel Bottle.",
      existingIds: [],
    });
    expect(result.knowledgeStatus).toBe("linked");
    expect(result.foundationKnowledgeIds).toEqual(["know-b"]);
    expect(result.foundationKnowledgeIds).not.toContain("know-a");
  });
});

describe("STEP 7 hardening: cached originals and creative plan", () => {
  it("removes derived thumbnail IDs from cached Product Intelligence evidence", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step7-hard-"));
    roots.push(root);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const created = await workspace.createProject("STEP7 Hardening Shoe");
    await workspace.updateProject(created.id, {
      productInformation: {
        name: "Leather Oxford",
        category: "Footwear",
        description: "Brown leather men's shoe",
        materials: ["leather"],
        colors: ["brown"],
      },
    });
    await workspace.uploadImage(created.id, {
      fileName: "brown-leather-shoe-front.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });
    const project = await workspace.getProject(created.id);
    expect(project).toBeTruthy();
    const original = project!.productImages.find((image) => !image.parentAssetId)!;
    const derivedId = "derived-thumbnail-not-an-original";

    const dirty = {
      projectId: project!.id,
      imageIds: [original.id, derivedId],
      imageObservations: [
        { field: "color", value: "brown", kind: "observed-from-image", confidence: 0.8, assetId: original.id },
        { field: "thumb", value: "should-drop", kind: "observed-from-image", confidence: 0.2, assetId: derivedId },
      ],
      inferences: [{ field: "audience", value: "style-conscious shoppers (inferred)", kind: "inferred", confidence: 42 }],
      customerIntelligence: {
        customerType: "style-conscious shoppers (inferred)",
        useCase: "wearable product",
        needs: [],
        buyingMotivations: [],
        possibleObjections: [],
        relevantBenefits: [],
        label: "inferred",
      },
      knowledgeStatus: "error",
      knowledgeMessage: "Equivalent knowledge already exists in the Knowledge Foundation.",
      foundationKnowledgeIds: ["know-a"],
    } as unknown as ProductIntelligenceProfile;

    const normalized = normalizeProductIntelligenceProfile(dirty, project!);
    expect(normalized.profile.imageIds).toEqual([original.id]);
    expect(normalized.profile.imageObservations?.every((item) => item.assetId === original.id)).toBe(true);
    expect(normalized.profile.customerIntelligence?.customerType).toBe("style-conscious shoppers");
    expect(normalized.profile.knowledgeStatus).toBe("already-linked");

    const products = new ProductIntelligenceManager();
    await products.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const images = new ImageIntelligenceManager();
    await images.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    products.attachImageIntelligence(images);
    const analyzed = await products.analyze(project!.id);
    expect(analyzed.imageIds).toEqual([original.id]);
    const cached = await products.analyze(project!.id);
    expect(cached.cached).toBe(true);
    expect(cached.imageIds).toEqual([original.id]);
    expect(cached.customerIntelligence?.customerType).not.toMatch(/\(inferred\).*inferred/i);

    const planning = new CreativePlanningManager();
    await planning.initialize(root);
    planning.attachProductIntelligence(products);
    const plan = (await planning.createPlan(project!, planning.validateForPlan(project!))).plan!;
    expect(plan.scenes.every((scene) => scene.assetId === original.id)).toBe(true);
    expect(plan.analyses.audience).not.toMatch(/\(inferred\)\s*\(inferred\)/);
    expect(plan.audience?.includes("(inferred) (inferred)")).toBe(false);
  });

  it("keeps a realistic product still isolated from a second project", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step7-real-"));
    roots.push(root);
    const workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    const projectA = await workspace.createProject("STEP7 Realistic A");
    await workspace.updateProject(projectA.id, {
      productInformation: { name: "Chestnut Oxford", category: "Footwear", description: "Brown leather oxford" },
    });
    await workspace.uploadImage(projectA.id, {
      fileName: "chestnut-oxford.png",
      mimeType: "image/png",
      dataBase64: brownProductPng(),
    });
    const projectB = await workspace.createProject("STEP7 Realistic B");
    await workspace.updateProject(projectB.id, {
      productInformation: { name: "Steel Flask", category: "Beverage", description: "Insulated steel flask" },
    });
    await workspace.uploadImage(projectB.id, {
      fileName: "steel-flask.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });
    const a = await workspace.getProject(projectA.id);
    const b = await workspace.getProject(projectB.id);
    const originalA = a!.productImages.find((image) => !image.parentAssetId)!;
    const originalB = b!.productImages.find((image) => !image.parentAssetId)!;
    expect(originalA.width).toBeGreaterThan(1);
    expect(originalA.height).toBeGreaterThan(1);

    const images = new ImageIntelligenceManager();
    await images.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const products = new ProductIntelligenceManager();
    await products.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    products.attachImageIntelligence(images);
    const profileA = await products.analyze(a!.id);
    const profileB = await products.analyze(b!.id);
    expect(profileA.imageIds).toEqual([originalA.id]);
    expect(profileB.imageIds).toEqual([originalB.id]);
    expect(profileA.productName).toBe("Chestnut Oxford");
    expect(profileB.productName).toBe("Steel Flask");

    const planning = new CreativePlanningManager();
    await planning.initialize(root);
    planning.attachProductIntelligence(products);
    const planA = (await planning.createPlan(a!, planning.validateForPlan(a!))).plan!;
    const planB = (await planning.createPlan(b!, planning.validateForPlan(b!))).plan!;
    expect(planA.scenes.every((scene) => scene.assetId === originalA.id)).toBe(true);
    expect(planB.scenes.every((scene) => scene.assetId === originalB.id)).toBe(true);
    expect(planA.callToAction).toContain("Chestnut Oxford");
    expect(planB.callToAction).toContain("Steel Flask");
  });
});
