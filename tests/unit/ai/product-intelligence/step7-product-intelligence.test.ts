import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import { PRODUCT_INTELLIGENCE_VERSION } from "../../../../ai/product-intelligence/types.js";
import { CreativePlanningManager } from "../../../../ai/creative-planning/creative-planning-manager.js";
import { MarketingIntelligenceManager } from "../../../../ai/marketing-intelligence/marketing-intelligence-manager.js";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function setup(name: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step7-"));
  roots.push(root);
  const workspace = new CreativeWorkspaceManager();
  await workspace.initialize(root);
  const project = await workspace.createProject(name);
  await workspace.updateProject(project.id, {
    productInformation: {
      name: "Leather Oxford",
      category: "Footwear",
      description: "Brown leather men's shoe for everyday wear",
      materials: ["leather"],
      colors: ["brown"],
    },
  });
  await workspace.uploadImage(project.id, {
    fileName: "brown-leather-shoe-front.png",
    mimeType: "image/png",
    dataBase64: PNG_1X1,
  });
  const refreshed = await workspace.getProject(project.id);
  const images = new ImageIntelligenceManager();
  await images.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
  const products = new ProductIntelligenceManager();
  await products.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
  products.attachImageIntelligence(images);
  return { root, workspace, project: refreshed!, products, images };
}

describe("STEP 7 Product Intelligence", () => {
  it("keeps user facts, image observations, inferences, and marketing recommendations distinct", async () => {
    const { project, products } = await setup("STEP7 Shoe");
    expect(products.getAnalysisState(project.id)).toBe("not-analyzed");
    const profile = await products.analyze(project.id);
    expect(profile.productId).toBe(project.id);
    expect(profile.analysisVersion).toBe(PRODUCT_INTELLIGENCE_VERSION);
    expect(profile.userFacts?.some((item) => item.field === "name" && item.kind === "user-provided")).toBe(true);
    expect(profile.userFacts?.some((item) => item.field === "material" && item.value === "leather")).toBe(true);
    expect(profile.inferences?.every((item) => item.kind === "inferred")).toBe(true);
    expect(profile.recommendations?.every((item) => item.kind === "marketing-recommendation")).toBe(true);
    expect(profile.valueProposition?.productSummary).toContain("Leather Oxford");
    expect(profile.creativeAngles?.some((item) => item.id === "product-hero")).toBe(true);
    expect(profile.marketingDirections?.some((item) => item.id === "fashion" || item.id === "lifestyle" || item.id === "practical")).toBe(true);
    expect(profile.cached).toBe(false);
    expect((await products.analyze(project.id)).cached).toBe(true);
    expect(products.getAnalysisState(project.id)).toBe(profile.analysisState ?? "ready");
  });

  it("does not treat a product-name change as a reason to invent prices", async () => {
    const { workspace, project, products } = await setup("STEP7 Price Guard");
    const first = await products.analyze(project.id);
    expect(first.userFacts?.some((item) => item.field === "price")).toBe(false);
    await workspace.updateProject(project.id, {
      productInformation: { name: "Leather Oxford Pro", description: "Brown leather men's shoe" },
    });
    const second = await products.analyze(project.id);
    expect(second.cached).toBe(false);
    expect(second.recommendations?.some((item) => /discount|guarantee|certif/i.test(item.value))).toBe(false);
    expect(second.valueProposition?.customerBenefit).not.toMatch(/\$|RWF|discount/i);
  });
});

describe("STEP 7 Marketing + Creative Planning", () => {
  it("builds product-specific marketing directions and a persisted scene plan with real asset IDs", async () => {
    const { root, workspace, project, products, images } = await setup("STEP7 Plan");
    const marketing = new MarketingIntelligenceManager();
    await marketing.initialize(root, {
      core: undefined as unknown as AiCoreManager,
      workspace,
      products,
      images,
    });
    const marketingProfile = await marketing.analyze(project.id);
    expect(marketingProfile.productId).toBe(project.id);
    expect(marketingProfile.audience.label === "inferred" || marketingProfile.audience.label === "recommended" || marketingProfile.audience.label === "user-provided").toBe(true);
    expect(marketingProfile.directions?.every((item) => item.evidence.length > 0 || !item.recommended)).toBe(true);

    const planning = new CreativePlanningManager();
    await planning.initialize(root);
    planning.attachProductIntelligence(products);
    planning.attachImageIntelligence(images);
    planning.attachMarketingIntelligence(marketing);
    const created = await planning.createPlan(project, planning.validateForPlan(project));
    expect(created.plan).toBeDefined();
    const plan = created.plan!;
    expect(plan.productId).toBe(project.id);
    expect(plan.scenes.length).toBeGreaterThanOrEqual(3);
    expect(plan.scenes.every((scene) => Boolean(scene.assetId))).toBe(true);
    expect(plan.scenes[0]?.assetId).toBe(project.productImages[0]?.id);
    expect(plan.scenes.some((scene) => scene.purpose === "CTA" || /call to action/i.test(scene.purpose))).toBe(true);
    expect(plan.callToAction).toBeTruthy();

    const edited = await planning.updatePlan(project.id, {
      scenes: plan.scenes.map((scene, index) => index === 0 ? { ...scene, purpose: "Custom intro", text: "Edited headline" } : scene),
    });
    expect(edited.version).toBe(plan.version + 1);
    expect(edited.scenes[0]?.purpose).toBe("Custom intro");
    expect(edited.scenes[0]?.userEdited).toBe(true);

    const restored = new CreativePlanningManager();
    await restored.initialize(root);
    const reloaded = await restored.getPlan(project.id);
    expect(reloaded?.scenes[0]?.purpose).toBe("Custom intro");
    expect(reloaded?.scenes[0]?.assetId).toBe(plan.scenes[0]?.assetId);
  });

  it("keeps creative plans isolated between projects", async () => {
    const { root, workspace, project: projectA, products, images } = await setup("STEP7 A");
    const projectB = await workspace.createProject("STEP7 B");
    await workspace.updateProject(projectB.id, {
      productInformation: { name: "Steel Bottle", category: "Beverage", description: "Insulated bottle" },
    });
    await workspace.uploadImage(projectB.id, {
      fileName: "bottle-front.png",
      mimeType: "image/png",
      dataBase64: PNG_1X1,
    });
    const refreshedB = await workspace.getProject(projectB.id);
    const planning = new CreativePlanningManager();
    await planning.initialize(root);
    planning.attachProductIntelligence(products);
    planning.attachImageIntelligence(images);
    const planA = (await planning.createPlan(projectA, planning.validateForPlan(projectA))).plan!;
    const planB = (await planning.createPlan(refreshedB!, planning.validateForPlan(refreshedB!))).plan!;
    expect(planA.projectId).not.toBe(planB.projectId);
    expect(planA.scenes[0]?.assetId).not.toBe(planB.scenes[0]?.assetId);
    expect((await planning.getPlan(projectA.id))?.callToAction).not.toBeUndefined();
    expect((await planning.getPlan(projectB.id))?.projectId).toBe(projectB.id);
  });
});
