import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  CreativePlatform,
  createAiCore,
  ImageProductionPlatform,
  ImageRenderPlatform,
  MarketingObjective,
  MonitoredImageGenerationModule,
  MultiStyleGenPlatform,
  MultiStyleImageCategory,
  OptimizationPlatform,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageGenPlatform,
  ProductUnderstandingMarketingGoal,
  QualityValidationPlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-ig-health-test-"));
}

const SAMPLE = {
  productId: "ig-health-test",
  productName: "Health Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "Product for image health monitor validation",
  features: ["automation"],
  specifications: { tier: "pro" },
  materials: ["digital"],
  price: 199.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  businessType: ProductBusinessType.B2B,
  tags: ["test"],
  keywords: ["saas"],
};

async function preparePipeline(
  piFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>,
  imgFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageGenerationFoundation"]>
): Promise<void> {
  await piFoundation.getProductAnalysisEngine().analyzeProduct(SAMPLE);
  await piFoundation.getProductUnderstandingEngine().understandProduct({
    productId: "ig-health-test",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "ig-health-test" });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "ig-health-test",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "ig-health-test",
    platform: CreativePlatform.Website,
  });

  const product = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
    productId: "ig-health-test",
    platform: ProductImageGenPlatform.Ecommerce,
  });
  const style = await imgFoundation.getMultiStyleImageGenerationEngine().generateStylePlan({
    productId: "ig-health-test",
    productImagePlanId: product.record!.productImagePlanId,
    sourceImageId: product.record!.productImagePlanId,
    brandId: "TestBrand",
    platform: MultiStyleGenPlatform.Website,
    styleCategory: MultiStyleImageCategory.Technology,
    generateVariations: true,
  });
  const production = await imgFoundation.getImageProductionEngine().generateProductionPlan({
    productId: "ig-health-test",
    stylePlanId: style.record!.stylePlanId,
    productImagePlanId: product.record!.productImagePlanId,
    brandId: "TestBrand",
    platform: ImageProductionPlatform.Website,
    prepareExports: true,
  });
  const render = await imgFoundation.getImageRenderingPreparationEngine().generateRenderPlan({
    productId: "ig-health-test",
    productionId: production.record!.imageProductionId,
    platform: ImageRenderPlatform.Website,
    prepareOutputProfiles: true,
    generateRenderJobs: true,
  });
  await imgFoundation.getImageQualityValidationEngine().validateQuality({
    productId: "ig-health-test",
    renderPlanId: render.record!.imageRenderPlanId,
    productionId: production.record!.imageProductionId,
    platform: QualityValidationPlatform.Website,
    autoRepair: true,
  });
  await imgFoundation.getImageGenerationOptimizationEngine().optimizeImageGeneration({
    productId: "ig-health-test",
    platform: OptimizationPlatform.Website,
  });
}

describe("AiImageGenerationHealthMonitorEngine", () => {
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

  it("initializes and registers with image generation foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("ig-health-test");

    const monitor = core.getManager().imageGenerationFoundation!.getImageGenerationHealthMonitorEngine();
    expect(monitor.isInitialized()).toBe(true);
    expect(monitor.isStartupComplete()).toBe(true);

    const module = core
      .getManager()
      .imageGenerationFoundation!.getRegistry()
      .getModule("image-generation-health-monitor");
    expect(module?.implemented).toBe(true);
  });

  it("runs health checks and monitors all modules", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("ig-health-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    await preparePipeline(core.getManager().productIntelligenceFoundation!, imgFoundation);

    const monitor = imgFoundation.getImageGenerationHealthMonitorEngine();
    const check = await monitor.runHealthCheck();

    expect(check.overallScore).toBeGreaterThanOrEqual(75);
    expect(check.moduleScores.length).toBeGreaterThanOrEqual(17);
    expect(check.promptIntegrity).toBe(true);
    expect(check.productionIntegrity).toBe(true);
  });

  it("runs audits and maintains health history", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("ig-health-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    await preparePipeline(core.getManager().productIntelligenceFoundation!, imgFoundation);

    const monitor = imgFoundation.getImageGenerationHealthMonitorEngine();
    await monitor.runHealthCheck();
    const audit = await monitor.runAudit();

    expect(audit.durationMs).toBeGreaterThan(0);
    expect(monitor.getHealthHistory().length).toBeGreaterThanOrEqual(2);
  });

  it("generates project state reports", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("ig-health-test");

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    await preparePipeline(core.getManager().productIntelligenceFoundation!, imgFoundation);

    const monitor = imgFoundation.getImageGenerationHealthMonitorEngine();
    await monitor.runHealthCheck();
    const paths = monitor.generateReports();

    expect(fs.existsSync(paths.healthReportPath)).toBe(true);
    expect(fs.existsSync(paths.historyReportPath)).toBe(true);
    expect(fs.existsSync(paths.performanceReportPath)).toBe(true);
    expect(fs.existsSync(paths.recommendationsReportPath)).toBe(true);

    const modules = monitor.getModuleScores();
    expect(modules.some((m) => m.module === MonitoredImageGenerationModule.ProductImageGeneration)).toBe(true);
  });
});
