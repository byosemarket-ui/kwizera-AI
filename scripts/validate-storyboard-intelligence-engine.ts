import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  CreativePlatform,
  CreativeDirectionStyle,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAnalysisIndustry,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  type StoryboardIntelligenceEngineStatusReport,
  type StoryboardIntelligenceRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-storyboard-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step5g-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description:
    "Professional AI-powered creative workstation empowering marketing teams to produce brand-consistent content at scale",
  features: ["AI video generation", "brand consistency", "multi-platform export"],
  specifications: { license: "pro", deployment: "cloud" },
  materials: ["digital-license"],
  price: 299.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: ProductAnalysisIndustry.Technology,
  useCase: "creative-production",
  targetCustomer: "creative professionals and marketing teams",
  businessType: ProductBusinessType.B2B,
  tags: ["software", "validation"],
  keywords: ["AI studio", "kwizera"],
};

const SAMPLE_FASHION: ProductAnalysisEngineInput = {
  productId: "step5g-kwizera-jacket",
  productName: "KWIZERA Urban Jacket",
  category: ProductAnalysisCategory.Fashion,
  subcategory: "outerwear",
  brand: "KWIZERA",
  description: "Premium urban jacket for creators who need weather-resistant style on the move",
  features: ["water-resistant", "breathable", "minimal branding"],
  specifications: { fabric: "cotton-blend" },
  materials: ["cotton", "polyester"],
  price: 129.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: ProductAnalysisIndustry.Fashion,
  businessType: ProductBusinessType.D2C,
  tags: ["fashion", "validation"],
  keywords: ["jacket", "kwizera"],
};

const SAMPLE_BEAUTY: ProductAnalysisEngineInput = {
  productId: "step5g-glow-serum",
  productName: "Radiance Vitamin C Serum",
  category: ProductAnalysisCategory.Beauty,
  subcategory: "skincare",
  brand: "GlowLab",
  description: "Clinical-grade vitamin C serum delivering radiant skin and anti-aging benefits",
  features: ["vitamin-c", "anti-aging", "hydrating"],
  specifications: { volume: "30ml" },
  materials: ["glass-bottle"],
  price: 45.0,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: ProductAnalysisIndustry.Beauty,
  tags: ["beauty", "validation"],
  keywords: ["serum", "glowlab"],
};

async function prepareFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>,
  sample: ProductAnalysisEngineInput,
  objective: MarketingObjective,
  platform: CreativePlatform
): Promise<void> {
  await foundation.getProductAnalysisEngine().analyzeProduct(sample);
  await foundation.getProductUnderstandingEngine().understandProduct({
    productId: sample.productId!,
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: sample.productId!,
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: sample.productId!,
    marketingObjective: objective,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: sample.productId!,
    platform,
    campaignGoal: objective,
  });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 5G Storyboard Intelligence Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-5g-validation");

    const foundation = core.getManager().productIntelligenceFoundation!;
    const engine = foundation.getStoryboardIntelligenceEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Storyboard Intelligence Engine operational",
    };

    await prepareFullPipeline(foundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);

    const planStart = Date.now();
    const tech = await engine.createStoryboard({ productId: "step5g-kwizera-pro" });
    const planMs = Date.now() - planStart;

    results.storyboardCreation = {
      passed: tech.success && Boolean(tech.record),
      detail: `Technology storyboard created in ${planMs}ms, quality ${tech.record?.scores.storyboardQualityScore}`,
    };

    results.storyboardProfile = {
      passed:
        Boolean(tech.record?.profile.storyboardId) &&
        (tech.record?.profile.totalScenes ?? 0) >= 5 &&
        Boolean(tech.record?.profile.estimatedDuration),
      detail: `${tech.record?.profile.totalScenes} scenes, ${tech.record?.profile.estimatedDuration}`,
    };

    results.scenePlanning = {
      passed:
        (tech.record?.scenes.length ?? 0) >= 5 &&
        tech.record?.scenes.every((s) => Boolean(s.cameraDirection) && Boolean(s.visualObjective)) === true,
      detail: `Scenes with full planning: ${tech.record?.scenes.length}`,
    };

    results.storyFlow = {
      passed:
        Boolean(tech.record?.storyFlow.hook) &&
        Boolean(tech.record?.storyFlow.callToAction) &&
        Boolean(tech.record?.storyFlow.ending),
      detail: "Opening through ending story flow prepared",
    };

    results.timingIntelligence = {
      passed:
        Boolean(tech.record?.timing.hookTiming) &&
        Boolean(tech.record?.timing.ctaTiming) &&
        (tech.record?.timing.totalEstimatedSeconds ?? 0) > 0,
      detail: `Hook ${tech.record?.timing.hookTiming}, CTA ${tech.record?.timing.ctaTiming}`,
    };

    results.continuityValidation = {
      passed:
        tech.record?.continuity.storyConsistency === true &&
        tech.record?.continuity.sceneConsistency === true &&
        tech.record?.continuity.issues.length === 0,
      detail: `Issues: ${tech.record?.continuity.issues.length}, recommendations: ${tech.record?.continuity.recommendations.length}`,
    };

    results.platformAdaptation = {
      passed:
        Boolean(tech.record?.platformRules.platform) &&
        (tech.record?.platformRules.pacingRules.length ?? 0) >= 1,
      detail: `${tech.record?.platformRules.platform} — ${tech.record?.platformRules.recommendedSceneCount} scenes`,
    };

    await prepareFullPipeline(foundation, SAMPLE_FASHION, MarketingObjective.BrandAwareness, CreativePlatform.InstagramReels);
    await prepareFullPipeline(foundation, SAMPLE_BEAUTY, MarketingObjective.SalesGrowth, CreativePlatform.TikTok);

    const fashion = await engine.createStoryboard({ productId: "step5g-kwizera-jacket" });
    const beauty = await engine.createStoryboard({ productId: "step5g-glow-serum", includeSocialProof: true });

    results.multiIndustry = {
      passed: fashion.success && beauty.success,
      detail: `Fashion ${fashion.record?.profile.totalScenes} scenes, Beauty ${beauty.record?.profile.totalScenes} scenes`,
    };

    results.storyboardScores = {
      passed:
        (tech.record?.scores.storyboardQualityScore ?? 0) >= 55 &&
        (tech.record?.scores.storytellingScore ?? 0) >= 50 &&
        (tech.record?.scores.visualPlanningScore ?? 0) >= 50 &&
        (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Quality ${tech.record?.scores.storyboardQualityScore}, storytelling ${tech.record?.scores.storytellingScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.relationshipDetection = {
      passed:
        (tech.record?.relationships.creativeDirections.length ?? 0) >= 1 &&
        (tech.record?.relationships.products.length ?? 0) >= 1 &&
        (tech.record?.relationships.marketingStrategies.length ?? 0) >= 1,
      detail: `Creative ${tech.record?.relationships.creativeDirections.length}, scripts ${tech.record?.relationships.scripts.length}, production ${tech.record?.relationships.productionPlans.length}`,
    };

    const noPipeline = await engine.createStoryboard({ productId: "step5g-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without upstream pipeline",
    };

    const repaired = await engine.repairStoryboard("step5g-kwizera-jacket", CreativePlatform.Facebook);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Storyboard repair pipeline verified" : "Repair failed",
    };

    const sceneSearch = engine.searchStoryboards({ scenePurpose: "hook" });
    results.searchByScene = {
      passed: sceneSearch.length >= 1,
      detail: `${sceneSearch.length} result(s) by scene purpose`,
    };

    const platformSearch = engine.searchStoryboards({ platform: CreativePlatform.YouTube });
    results.searchByPlatform = {
      passed: platformSearch.length >= 1,
      detail: `${platformSearch.length} result(s) by platform`,
    };

    const styleSearch = engine.searchStoryboards({ creativeStyle: CreativeDirectionStyle.Storytelling });
    results.searchByStyle = {
      passed: styleSearch.length >= 1,
      detail: `${styleSearch.length} result(s) by creative style`,
    };

    const brandSearch = engine.searchStoryboards({ brand: "KWIZERA" });
    results.searchByBrand = {
      passed: brandSearch.length >= 1,
      detail: `${brandSearch.length} result(s) by brand`,
    };

    const goalSearch = engine.searchStoryboards({ campaignGoal: MarketingObjective.ProductLaunch });
    results.searchByCampaignGoal = {
      passed: goalSearch.length >= 1,
      detail: `${goalSearch.length} result(s) by campaign goal`,
    };

    const status = engine.buildStatusReport();
    results.performance = {
      passed: status.performance.averagePlanningMs < 120000,
      detail: `avg planning ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `storyboard-intelligence-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const registered = foundation.getRegistry().getModule("storyboard-intelligence");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}`,
    };

    results.recommendationReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: "Production-ready storyboard validated for script and visual planning modules",
    };

    await core.stop("step-5g-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Storyboard-Report.md"),
      buildStoryboardReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Scene-Planning-Report.md"),
      buildScenePlanningReport(tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Storyboard-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-5G-VALIDATION-REPORT.md"),
      buildStoryboardReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record),
      "utf8"
    );

    console.log("Reports written:", projectStateDir);
    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);

    if (useTemp && fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildStoryboardReport(
  status: StoryboardIntelligenceEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: StoryboardIntelligenceRecord,
  fashion?: StoryboardIntelligenceRecord,
  beauty?: StoryboardIntelligenceRecord
): string {
  return [
    "# Storyboard Report — Step 5G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage:** \`${storageRoot}\``,
    `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
    `**Readiness:** ${status.readinessScore}/100`,
    "",
    "## Validation Results",
    "",
    "| Check | Status | Detail |",
    "|-------|--------|--------|",
    ...Object.entries(results).map(([k, r]) => `| ${k} | ${r.passed ? "✅" : "❌"} | ${r.detail} |`),
    "",
    "## Storyboards Prepared",
    "",
    `- Technology: ${tech?.profile.totalScenes ?? 0} scenes on ${tech?.profile.platform ?? "n/a"} (${tech?.scores.storyboardQualityScore ?? 0}/100)`,
    `- Fashion: ${fashion?.profile.totalScenes ?? 0} scenes (${fashion?.scores.storyboardQualityScore ?? 0}/100)`,
    `- Beauty: ${beauty?.profile.totalScenes ?? 0} scenes (${beauty?.scores.storyboardQualityScore ?? 0}/100)`,
    "",
    `Storyboards prepared: ${status.storyboardsPrepared}`,
    "",
  ].join("\n");
}

function buildScenePlanningReport(
  tech?: StoryboardIntelligenceRecord,
  fashion?: StoryboardIntelligenceRecord,
  beauty?: StoryboardIntelligenceRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as StoryboardIntelligenceRecord[];
  const lines = [
    "# Scene Planning Report — Step 5G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
  ];

  for (const record of rows) {
    lines.push(`## ${record.productId} — ${record.profile.totalScenes} scenes`, "");
    lines.push("| # | Purpose | Duration | Camera | CTA |", "|---|---------|----------|--------|-----|");
    for (const scene of record.scenes) {
      lines.push(
        `| ${scene.sceneNumber} | ${scene.scenePurpose} | ${scene.estimatedDuration} | ${scene.cameraDirection.slice(0, 30)}... | ${scene.ctaPlacement === "none" ? "—" : "✓"} |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildReadinessReport(
  status: StoryboardIntelligenceEngineStatusReport,
  tech?: StoryboardIntelligenceRecord,
  fashion?: StoryboardIntelligenceRecord,
  beauty?: StoryboardIntelligenceRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as StoryboardIntelligenceRecord[];
  return [
    "# Storyboard Readiness Report — Step 5G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Product | Quality | Storytelling | Visual | Brand | Production Ready | Validated |",
    "|---------|---------|--------------|--------|-------|------------------|-----------|",
    ...rows.map(
      (r) =>
        `| ${r.productId} | ${r.scores.storyboardQualityScore}/100 | ${r.scores.storytellingScore}/100 | ${r.scores.visualPlanningScore}/100 | ${r.scores.brandConsistencyScore}/100 | ${r.productionReady ? "✅" : "❌"} | ${r.validated ? "✅" : "❌"} |`
    ),
    "",
    "## Performance",
    "",
    `- Average planning: ${status.performance.averagePlanningMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    "",
  ].join("\n");
}

void main();
