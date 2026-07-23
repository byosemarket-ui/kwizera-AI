import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  MonitoredProductIntelligenceModule,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-pi-health-monitor-test-"));
}

const ANALYSIS_SAMPLE = {
  productId: "pihm-test-product",
  productName: "PI Health Monitor Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description:
    "A comprehensive SaaS product for product intelligence health monitor validation testing",
  features: ["automation", "analytics", "collaboration"],
  specifications: { tier: "pro" },
  materials: ["digital"],
  price: 199.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  businessType: ProductBusinessType.B2B,
  tags: ["test"],
  keywords: ["saas", "test"],
};

async function prepareFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>
): Promise<void> {
  await foundation.getProductAnalysisEngine().analyzeProduct(ANALYSIS_SAMPLE);
  await foundation.getProductUnderstandingEngine().understandProduct({
    productId: "pihm-test-product",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: "pihm-test-product",
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "pihm-test-product",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "pihm-test-product",
    platform: CreativePlatform.Website,
  });
  await foundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: "pihm-test-product",
  });
  await foundation.getScriptPlanningEngine().createScriptPlan({
    productId: "pihm-test-product",
  });
  await foundation.getVisualPlanningEngine().createVisualPlan({
    productId: "pihm-test-product",
  });
  await foundation.getAudioPlanningEngine().createAudioPlan({
    productId: "pihm-test-product",
  });
  await foundation.getProductionPlanningEngine().createProductionPlan({
    productId: "pihm-test-product",
  });
  await foundation.getQualityPredictionEngine().predictQuality({
    productId: "pihm-test-product",
  });
}

describe("AiProductIntelligenceHealthMonitorEngine", () => {
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

  it("initializes and registers with product intelligence foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("pi-health-monitor-test");

    const engine = core
      .getManager()
      .productIntelligenceFoundation!.getProductIntelligenceHealthMonitorEngine();
    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);

    const mod = core
      .getManager()
      .productIntelligenceFoundation!.getRegistry()
      .getModule("product-intelligence-health-monitor");
    expect(mod?.implemented).toBe(true);

    const healthDir = path.join(
      core.getManager().productIntelligenceFoundation!.getIntelligenceRoot(),
      "health",
      "engine"
    );
    expect(fs.existsSync(healthDir)).toBe(true);

    await core.stop();
  });

  it("runs health checks with module scores after pipeline", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const monitor = foundation.getProductIntelligenceHealthMonitorEngine();
    const check = await monitor.runHealthCheck();

    expect(check.overallScore).toBeGreaterThanOrEqual(75);
    expect(check.moduleScores.length).toBeGreaterThanOrEqual(18);
    expect(check.planningIntegrity).toBe(true);

    const foundationModule = check.moduleScores.find(
      (m) => m.module === MonitoredProductIntelligenceModule.ProductIntelligenceFoundation
    );
    expect(foundationModule).toBeDefined();

    await core.stop();
  });

  it("runs audits and maintains health history", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const monitor = foundation.getProductIntelligenceHealthMonitorEngine();
    await monitor.runHealthCheck();
    const audit = await monitor.runAudit();

    expect(audit.valid).toBe(true);
    expect(monitor.getHealthHistory().length).toBeGreaterThanOrEqual(2);

    const trend = monitor.getTrendAnalysis();
    expect(trend.prediction.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("generates health reports", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().productIntelligenceFoundation!;
    await prepareFullPipeline(foundation);

    const monitor = foundation.getProductIntelligenceHealthMonitorEngine();
    await monitor.runHealthCheck();
    const paths = monitor.generateReports();

    expect(fs.existsSync(paths.healthReportPath)).toBe(true);
    expect(fs.existsSync(paths.historyReportPath)).toBe(true);
    expect(fs.existsSync(paths.performanceReportPath)).toBe(true);
    expect(fs.existsSync(paths.recommendationsReportPath)).toBe(true);

    await core.stop();
  });
});
