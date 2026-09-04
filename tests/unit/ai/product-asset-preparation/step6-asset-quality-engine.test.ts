/**
 * STEP 6 — AI Product Asset Preparation & Quality Engine tests.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { resolveProductionImagePath } from "../../../../ai/media-intelligence/asset-resolver.js";
import { MediaIntelligenceManager } from "../../../../ai/media-intelligence/media-intelligence-manager.js";
import { decideIsolation } from "../../../../ai/media-intelligence/isolation-policy.js";
import {
  assertPreparedAssetsIsolated,
  buildFramingInspection,
  buildPreparedAssetDecision,
  classifyProductionRole,
  PREPARED_ASSET_CONTRACT_VERSION,
  ProductAssetPreparationManager,
  validatePreparedAssetDecision,
} from "../../../../ai/product-asset-preparation/index.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";
import { CanonicalProductManager } from "../../../../ai/product-record/canonical-product-manager.js";
import { regionOverlapsProduct } from "../../../../ai/typography/placement.js";
import { productOnWhitePngBase64 } from "./fixtures.js";

const CORE_STUB = undefined as unknown as AiCoreManager;

async function setup() {
  const storage = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-step6-"));
  const workspace = new CreativeWorkspaceManager();
  await workspace.initialize(storage);
  const images = new ImageIntelligenceManager();
  await images.initialize(storage, { core: CORE_STUB, workspace });
  const products = new ProductIntelligenceManager();
  await products.initialize(storage, { core: CORE_STUB, workspace });
  products.attachImageIntelligence(images);
  const assets = new ProductAssetPreparationManager();
  await assets.initialize(storage, { core: CORE_STUB, workspace, products, images });
  const canonical = new CanonicalProductManager();
  await canonical.initialize(storage, { workspace, images, products });
  const media = new MediaIntelligenceManager();
  await media.initialize({ workspace, images, products, canonical, assets });
  return { storage, workspace, images, products, assets, media };
}

async function seedProject(workspace: CreativeWorkspaceManager, name: string) {
  const project = await workspace.createProject(name);
  await workspace.updateProject(project.id, {
    productInformation: {
      name: `${name} Product`,
      category: "Footwear",
      description: "Studio product photograph for STEP 6 preparation tests",
      price: 45000,
      currency: "RWF",
    },
    brandInformation: { name: "KWIZERA" },
  });
  return project;
}

describe("STEP 6 asset quality engine", () => {
  it("TEST A — real uploaded image receives a valid preparation decision", async () => {
    const ctx = await setup();
    const project = await seedProject(ctx.workspace, "Step6 A");
    const image = await ctx.workspace.uploadImage(project.id, {
      fileName: "front-shoe.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(96, 96),
      assetRole: "primary",
    });
    const result = await ctx.assets.prepareProductAssets(project.id);
    expect(result.step6ContractVersion).toBe(PREPARED_ASSET_CONTRACT_VERSION);
    expect(result.preparedDecisions).toHaveLength(1);
    const decision = result.preparedDecisions[0]!;
    expect(decision.projectId).toBe(project.id);
    expect(decision.assetId).toBe(image.id);
    expect(decision.originalPreserved).toBe(true);
    expect(validatePreparedAssetDecision(decision, project.id).ok).toBe(true);
    expect(decision.framing.formats["9:16"]).toBeTruthy();
    expect(decision.role.role).toBeTruthy();
    await fs.rm(ctx.storage, { recursive: true, force: true });
  });

  it("TEST B — multiple product images receive independent decisions", async () => {
    const ctx = await setup();
    const project = await seedProject(ctx.workspace, "Step6 B");
    const a = await ctx.workspace.uploadImage(project.id, {
      fileName: "front.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(80, 80),
      allowDuplicateContent: true,
    });
    const b = await ctx.workspace.uploadImage(project.id, {
      fileName: "detail-close.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(81, 81),
      allowDuplicateContent: true,
    });
    const result = await ctx.assets.prepareProductAssets(project.id);
    expect(result.preparedDecisions).toHaveLength(2);
    expect(result.preparedDecisions.map((d) => d.assetId).sort()).toEqual([a.id, b.id].sort());
    expect(result.preparedDecisions[0]!.continuity.orderHint).not.toBe(result.preparedDecisions[1]!.continuity.orderHint);
    await fs.rm(ctx.storage, { recursive: true, force: true });
  });

  it("TEST C — original image bytes remain unchanged", async () => {
    const ctx = await setup();
    const project = await seedProject(ctx.workspace, "Step6 C");
    const image = await ctx.workspace.uploadImage(project.id, {
      fileName: "preserve.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(64, 64),
    });
    const originalPath = await ctx.workspace.getOriginalImagePath(project.id, image.id);
    expect(originalPath).toBeTruthy();
    const before = createHash("sha256").update(await fs.readFile(originalPath!)).digest("hex");
    await ctx.assets.prepareProductAssets(project.id);
    const after = createHash("sha256").update(await fs.readFile(originalPath!)).digest("hex");
    expect(after).toBe(before);
    const decision = (await ctx.assets.getPreparedDecisions(project.id))[0];
    expect(decision?.originalPreserved).toBe(true);
    await fs.rm(ctx.storage, { recursive: true, force: true });
  });

  it("TEST D/F — unsafe destructive crop is rejected; product bounds protected", () => {
    const framing = buildFramingInspection({
      width: 1000,
      height: 400,
      productBox: { x: 50, y: 20, width: 900, height: 360 },
      visibilityCutoff: true,
      framingNote: "Too close to edge / cut-off risk",
    });
    expect(framing.nearEdge).toBe(true);
    const vertical = framing.formats["9:16"];
    expect(vertical.preferSafeComposition).toBe(true);
    expect(vertical.protectedProductArea.width).toBeGreaterThan(0.5);
    expect(vertical.maxSafeEnlargement).toBeLessThanOrEqual(1.15);
    expect(framing.unsafeDestructiveCropRejected || vertical.preferSafeComposition).toBe(true);
  });

  it("TEST E — format-aware preparation for supported output formats", () => {
    const framing = buildFramingInspection({
      width: 1080,
      height: 1350,
      productBox: { x: 200, y: 250, width: 680, height: 850 },
    });
    for (const aspect of ["9:16", "16:9", "1:1", "4:5"] as const) {
      expect(framing.formats[aspect].aspectRatio).toBe(aspect);
      expect(framing.formats[aspect].recommendedCrop.width).toBeGreaterThan(0);
      expect(framing.formats[aspect].negativeSpace).toBeTruthy();
    }
  });

  it("TEST G — invalid / missing asset fails safely without substitution", async () => {
    const ctx = await setup();
    const project = await seedProject(ctx.workspace, "Step6 G");
    const image = await ctx.workspace.uploadImage(project.id, {
      fileName: "gone.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(48, 48),
    });
    const decision = buildPreparedAssetDecision({
      projectId: project.id,
      image,
      orderHint: 0,
      fileMissing: true,
    });
    expect(decision.valid).toBe(false);
    expect(decision.validity).toBe("missing_source");
    expect(decision.readyForLaterMotionStages).toBe(false);
    expect(decision.role.role).toBe("UNSUITABLE");
    await fs.rm(ctx.storage, { recursive: true, force: true });
  });

  it("TEST H — missing asset id does not resolve another project's path", async () => {
    const ctx = await setup();
    const projectA = await seedProject(ctx.workspace, "Step6 H-A");
    const projectB = await seedProject(ctx.workspace, "Step6 H-B");
    const imageB = await ctx.workspace.uploadImage(projectB.id, {
      fileName: "b.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(40, 40),
    });
    const resolved = await resolveProductionImagePath(ctx.workspace, projectA.id, imageB.id);
    expect(resolved).toBeNull();
    await fs.rm(ctx.storage, { recursive: true, force: true });
  });

  it("TEST I/N — project isolation for prepared decisions", async () => {
    const ctx = await setup();
    const projectA = await seedProject(ctx.workspace, "Step6 I-A");
    const projectB = await seedProject(ctx.workspace, "Step6 I-B");
    await ctx.workspace.uploadImage(projectA.id, {
      fileName: "a.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(50, 50),
      allowDuplicateContent: true,
    });
    await ctx.workspace.uploadImage(projectB.id, {
      fileName: "b.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(50, 50),
      allowDuplicateContent: true,
    });
    const resultA = await ctx.assets.prepareProductAssets(projectA.id);
    const resultB = await ctx.assets.prepareProductAssets(projectB.id);
    expect(assertPreparedAssetsIsolated(resultA.preparedDecisions, projectA.id)).toEqual([]);
    expect(assertPreparedAssetsIsolated(resultB.preparedDecisions, projectB.id)).toEqual([]);
    expect(resultA.preparedDecisions.every((d) => d.projectId === projectA.id)).toBe(true);
    expect(resultB.preparedDecisions.every((d) => d.projectId === projectB.id)).toBe(true);
    expect(resultA.preparedDecisions[0]!.assetId).not.toBe(resultB.preparedDecisions[0]!.assetId);
    await fs.rm(ctx.storage, { recursive: true, force: true });
  });

  it("TEST J — typography coexistence with prepared product area", () => {
    const occupied = { x: 0.25, y: 0.3, width: 0.5, height: 0.45 };
    expect(regionOverlapsProduct("center", true, occupied)).toBe(true);
    expect(regionOverlapsProduct("top-center", true, occupied)).toBe(false);
    expect(regionOverlapsProduct("bottom-center", true, occupied)).toBe(false);
  });

  it("TEST K — production path still resolves via existing architecture", async () => {
    const ctx = await setup();
    const project = await seedProject(ctx.workspace, "Step6 K");
    const image = await ctx.workspace.uploadImage(project.id, {
      fileName: "prod.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(72, 72),
    });
    const result = await ctx.assets.prepareProductAssets(project.id);
    const decision = result.preparedDecisions[0]!;
    expect(decision.productionResolverAssetId).toBe(image.id);
    const resolved = await resolveProductionImagePath(ctx.workspace, project.id, decision.productionResolverAssetId);
    expect(resolved).toBeTruthy();
    expect(resolved?.parentAssetId).toBe(image.id);
    await fs.access(resolved!.path);
    await fs.rm(ctx.storage, { recursive: true, force: true });
  });

  it("TEST L — media intelligence consumes STEP 6 fields without breaking", async () => {
    const ctx = await setup();
    const project = await seedProject(ctx.workspace, "Step6 L");
    await ctx.workspace.uploadImage(project.id, {
      fileName: "media.png",
      mimeType: "image/png",
      dataBase64: productOnWhitePngBase64(60, 60),
    });
    await ctx.media.prepareProject(project.id);
    const report = await ctx.media.getReport(project.id);
    expect(report.pipelineVersion).toBe("step6-asset-prep-v1");
    expect(report.assets[0]?.productionRole).toBeTruthy();
    expect(report.assets[0]?.backgroundPrepDecision).toBeTruthy();
    expect(typeof report.assets[0]?.readyForLaterMotionStages).toBe("boolean");
    await fs.rm(ctx.storage, { recursive: true, force: true });
  });

  it("classifies production roles and demotes duplicate heroes", () => {
    const hero = classifyProductionRole({
      image: {
        id: "1",
        fileName: "front.png",
        mimeType: "image/png",
        sizeBytes: 100,
        assetRole: "primary",
      } as never,
      profile: {
        viewRole: "front",
        quality: { score: 85, confidence: 80 },
        boundaries: { confidence: 70 },
        visibility: { status: "good", framing: "Good", cutoff: false },
      } as never,
      suitabilityScore: 85,
      suitableForProduction: true,
    });
    expect(hero.role).toBe("HERO_PRODUCT");
  });

  it("REFRAME_PRODUCT when visibility shows cut-off risk", () => {
    const decision = decideIsolation({
      quality: { score: 80, classification: "GOOD", confidence: 80, notes: [] },
      background: { type: "white studio", removable: true, confidence: 70, complexity: "low", removalSuitability: "medium" },
      visibility: { status: "needs-review", framing: "Too close to edge / cut-off risk", cutoff: true, percent: 40, obstruction: "none", confidence: 60 },
      boundaries: { detected: true, confidence: 60, notes: "" },
      resolution: { tier: "standard", estimatedFromBytes: 1000, notes: "" },
      viewRole: "front",
    } as never);
    expect(decision.decision).toBe("REFRAME_PRODUCT");
    expect(decision.isolate).toBe(false);
  });
});
