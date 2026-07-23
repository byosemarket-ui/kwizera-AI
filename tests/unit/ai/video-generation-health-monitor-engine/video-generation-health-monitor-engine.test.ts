import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  CreativePlatform,
  createAiCore,
  MarketingObjective,
  MonitoredVideoGenerationModule,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  StoryboardGenerationPlatform,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-vg-health-test-"));
}

const SAMPLE = {
  productId: "vg-health-test",
  productName: "Health Test Product",
  category: ProductAnalysisCategory.Software,
  subcategory: "saas",
  brand: "TestBrand",
  description: "Product for health monitor validation",
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
  genFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["videoGenerationFoundation"]>
): Promise<string> {
  await piFoundation.getProductAnalysisEngine().analyzeProduct(SAMPLE);
  await piFoundation.getProductUnderstandingEngine().understandProduct({
    productId: "vg-health-test",
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: "vg-health-test" });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: "vg-health-test",
    marketingObjective: MarketingObjective.ProductPromotion,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: "vg-health-test",
    platform: CreativePlatform.Website,
  });
  await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({ productId: "vg-health-test" });

  const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: "vg-health-test",
    platform: StoryboardGenerationPlatform.Website,
  });
  expect(story.success).toBe(true);

  const storyboardId = story.record!.storyboardId;
  const steps = [
    () => genFoundation.getSceneGenerationEngine().generateScenes({ storyboardId }),
    () => genFoundation.getCameraDirectorEngine().planCamera({ storyboardId }),
    () => genFoundation.getMotionGenerationEngine().generateMotionPlans({ storyboardId }),
    () => genFoundation.getAnimationGenerationEngine().generateAnimationPlans({ storyboardId }),
    () => genFoundation.getVisualEffectsGenerationEngine().generateVisualEffectPlans({ storyboardId }),
    () => genFoundation.getAudioSynchronizationEngine().generateAudioSyncPlans({ storyboardId }),
    () => genFoundation.getMarketingVideoEngine().generateMarketingVideoPlans({ storyboardId }),
    () => genFoundation.getVideoProductionEngine().generateProductionPlans({ storyboardId }),
    () => genFoundation.getRenderingPreparationEngine().prepareRenderPlans({ storyboardId }),
    () => genFoundation.getVideoQualityValidationEngine().validateVideoQuality({ storyboardId }),
    () => genFoundation.getVideoGenerationOptimizationEngine().optimizeVideoGeneration({ storyboardId }),
  ];

  for (const step of steps) {
    const result = await step();
    expect(result.success).toBe(true);
  }

  return storyboardId;
}

describe("AiVideoGenerationHealthMonitorEngine", () => {
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

  it("initializes and registers with video generation foundation", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("vg-health-test");

    const monitor = core.getManager().videoGenerationFoundation!.getVideoGenerationHealthMonitorEngine();
    expect(monitor.isInitialized()).toBe(true);
    expect(monitor.isStartupComplete()).toBe(true);

    const module = core
      .getManager()
      .videoGenerationFoundation!.getRegistry()
      .getModule("generation-health-monitor");
    expect(module?.implemented).toBe(true);
  });

  it("runs health checks and monitors all modules", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("vg-health-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    await preparePipeline(core.getManager().productIntelligenceFoundation!, genFoundation);

    const monitor = genFoundation.getVideoGenerationHealthMonitorEngine();
    const check = await monitor.runHealthCheck();

    expect(check.overallScore).toBeGreaterThanOrEqual(75);
    expect(check.moduleScores.length).toBeGreaterThanOrEqual(17);
    expect(check.storyboardIntegrity).toBe(true);
    expect(check.productionIntegrity).toBe(true);
  });

  it("runs audits and maintains health history", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("vg-health-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    await preparePipeline(core.getManager().productIntelligenceFoundation!, genFoundation);

    const monitor = genFoundation.getVideoGenerationHealthMonitorEngine();
    await monitor.runHealthCheck();
    const audit = await monitor.runAudit();

    expect(audit.durationMs).toBeGreaterThan(0);
    expect(monitor.getHealthHistory().length).toBeGreaterThanOrEqual(2);
  });

  it("generates project state reports", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("vg-health-test");

    const genFoundation = core.getManager().videoGenerationFoundation!;
    await preparePipeline(core.getManager().productIntelligenceFoundation!, genFoundation);

    const monitor = genFoundation.getVideoGenerationHealthMonitorEngine();
    await monitor.runHealthCheck();
    const paths = monitor.generateReports();

    expect(fs.existsSync(paths.healthReportPath)).toBe(true);
    expect(fs.existsSync(paths.historyReportPath)).toBe(true);
    expect(fs.existsSync(paths.performanceReportPath)).toBe(true);
    expect(fs.existsSync(paths.recommendationsReportPath)).toBe(true);

    const modules = monitor.getModuleScores();
    expect(modules.some((m) => m.module === MonitoredVideoGenerationModule.StoryboardGeneration)).toBe(true);
  });
});
