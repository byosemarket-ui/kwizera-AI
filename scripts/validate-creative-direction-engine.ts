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
  type CreativeDirectionEngineStatusReport,
  type CreativeDirectionRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-creative-direction-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step5f-kwizera-pro",
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
  productId: "step5f-kwizera-jacket",
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
  productId: "step5f-glow-serum",
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

async function preparePipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>,
  sample: ProductAnalysisEngineInput,
  objective: MarketingObjective
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
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 5F Creative Direction Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-5f-validation");

    const foundation = core.getManager().productIntelligenceFoundation!;
    const engine = foundation.getCreativeDirectionEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Creative Direction Engine operational",
    };

    await preparePipeline(foundation, SAMPLE_TECH, MarketingObjective.ProductLaunch);

    const planStart = Date.now();
    const tech = await engine.planCreativeDirection({
      productId: "step5f-kwizera-pro",
      platform: CreativePlatform.YouTube,
      campaignGoal: MarketingObjective.ProductLaunch,
    });
    const planMs = Date.now() - planStart;

    results.creativeDirection = {
      passed: tech.success && Boolean(tech.record),
      detail: `Technology creative direction prepared in ${planMs}ms, quality ${tech.record?.scores.creativeQualityScore}`,
    };

    results.creativeProfile = {
      passed:
        Boolean(tech.record?.profile.creativeId) &&
        Boolean(tech.record?.profile.creativeStyle) &&
        Boolean(tech.record?.profile.creativeTheme),
      detail: `${tech.record?.profile.creativeStyle} — ${tech.record?.profile.mood}`,
    };

    results.visualDirection = {
      passed:
        (tech.record?.visualDirection.colorPalette.length ?? 0) >= 3 &&
        Boolean(tech.record?.visualDirection.typographyStyle) &&
        Boolean(tech.record?.visualDirection.lightingStyle),
      detail: `${tech.record?.visualDirection.colorPalette.length} colors, ${tech.record?.visualDirection.designStyle}`,
    };

    results.cinematicDirection = {
      passed:
        Boolean(tech.record?.cinematicDirection.cameraStyle) &&
        Boolean(tech.record?.cinematicDirection.editingStyle),
      detail: tech.record?.cinematicDirection.cameraStyle ?? "missing",
    };

    results.brandDirection = {
      passed:
        (tech.record?.brandDirection.brandColors.length ?? 0) >= 2 &&
        Boolean(tech.record?.brandDirection.brandVoice),
      detail: `Brand voice: ${tech.record?.brandDirection.brandVoice}`,
    };

    results.marketingDirection = {
      passed:
        Boolean(tech.record?.marketingDirection.hookDirection) &&
        Boolean(tech.record?.marketingDirection.storytellingDirection),
      detail: "Hook and storytelling direction prepared",
    };

    results.platformDirection = {
      passed: (tech.record?.platformDirections.length ?? 0) >= 2,
      detail: `${tech.record?.platformDirections.length} platform directions: ${tech.record?.platformDirections.map((p) => p.platform).join(", ")}`,
    };

    await preparePipeline(foundation, SAMPLE_FASHION, MarketingObjective.BrandAwareness);
    await preparePipeline(foundation, SAMPLE_BEAUTY, MarketingObjective.SalesGrowth);

    const fashion = await engine.planCreativeDirection({
      productId: "step5f-kwizera-jacket",
      platform: CreativePlatform.InstagramReels,
    });
    const beauty = await engine.planCreativeDirection({
      productId: "step5f-glow-serum",
      platform: CreativePlatform.TikTok,
    });

    results.multiIndustry = {
      passed: fashion.success && beauty.success,
      detail: `Fashion ${fashion.record?.profile.creativeStyle}, Beauty ${beauty.record?.profile.creativeStyle}`,
    };

    results.creativeScores = {
      passed:
        (tech.record?.scores.creativeQualityScore ?? 0) >= 55 &&
        (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
        (tech.record?.scores.marketingAlignmentScore ?? 0) >= 50 &&
        (tech.record?.scores.audienceAlignmentScore ?? 0) >= 50 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Quality ${tech.record?.scores.creativeQualityScore}, brand ${tech.record?.scores.brandConsistencyScore}, marketing ${tech.record?.scores.marketingAlignmentScore}`,
    };

    results.relationshipDetection = {
      passed:
        (tech.record?.relationships.products.length ?? 0) >= 1 &&
        (tech.record?.relationships.brands.length ?? 0) >= 1 &&
        (tech.record?.relationships.creativeStyles.length ?? 0) >= 1,
      detail: `Products ${tech.record?.relationships.products.length}, storyboards ${tech.record?.relationships.storyboards.length}, knowledge ${tech.record?.relationships.knowledgeRecords.length}`,
    };

    const noPipeline = await engine.planCreativeDirection({ productId: "step5f-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without upstream pipeline",
    };

    const repaired = await engine.repairCreativeDirection("step5f-kwizera-jacket", CreativePlatform.Facebook);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Creative direction repair pipeline verified" : "Repair failed",
    };

    const styleSearch = engine.searchCreativeDirections({ creativeStyle: CreativeDirectionStyle.Storytelling });
    results.searchByStyle = {
      passed: styleSearch.length >= 1,
      detail: `${styleSearch.length} result(s) by creative style`,
    };

    const platformSearch = engine.searchCreativeDirections({ platform: CreativePlatform.YouTube });
    results.searchByPlatform = {
      passed: platformSearch.length >= 1,
      detail: `${platformSearch.length} result(s) by platform`,
    };

    const brandSearch = engine.searchCreativeDirections({ brand: "KWIZERA" });
    results.searchByBrand = {
      passed: brandSearch.length >= 1,
      detail: `${brandSearch.length} result(s) by brand`,
    };

    const moodSearch = engine.searchCreativeDirections({ mood: "innovative" });
    results.searchByMood = {
      passed: moodSearch.length >= 1,
      detail: `${moodSearch.length} result(s) by mood`,
    };

    const goalSearch = engine.searchCreativeDirections({
      campaignGoal: MarketingObjective.ProductLaunch,
    });
    results.searchByCampaignGoal = {
      passed: goalSearch.length >= 1,
      detail: `${goalSearch.length} result(s) by campaign goal`,
    };

    const audienceSearch = engine.searchCreativeDirections({
      audience: tech.record?.profile.targetAudience.split(" ")[0] ?? "creative",
    });
    results.searchByAudience = {
      passed: audienceSearch.length >= 1,
      detail: `${audienceSearch.length} result(s) by audience`,
    };

    const status = engine.buildStatusReport();
    results.performance = {
      passed: status.performance.averagePlanningMs < 120000,
      detail: `avg planning ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `creative-direction-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const registered = foundation.getRegistry().getModule("creative-direction");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}`,
    };

    results.recommendationReadiness = {
      passed:
        tech.record?.validated === true &&
        (tech.record.platformDirections.length ?? 0) >= 2 &&
        tech.record.relationships.storyboards.length >= 1,
      detail: "Validated creative direction ready for storyboard, script, and production planning",
    };

    await core.stop("step-5f-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Creative-Direction-Report.md"),
      buildCreativeDirectionReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Creative-Style-Report.md"),
      buildCreativeStyleReport(tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Creative-Readiness-Report.md"),
      buildCreativeReadinessReport(status, tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-5F-VALIDATION-REPORT.md"),
      buildCreativeDirectionReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record),
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

function buildCreativeDirectionReport(
  status: CreativeDirectionEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: CreativeDirectionRecord,
  fashion?: CreativeDirectionRecord,
  beauty?: CreativeDirectionRecord
): string {
  return [
    "# Creative Direction Report — Step 5F",
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
    "## Creative Directions Prepared",
    "",
    `- Technology: ${tech?.profile.creativeStyle ?? "n/a"} on ${tech?.profile.platform ?? "n/a"} (${tech?.scores.creativeQualityScore ?? 0}/100)`,
    `- Fashion: ${fashion?.profile.creativeStyle ?? "n/a"} on ${fashion?.profile.platform ?? "n/a"} (${fashion?.scores.creativeQualityScore ?? 0}/100)`,
    `- Beauty: ${beauty?.profile.creativeStyle ?? "n/a"} on ${beauty?.profile.platform ?? "n/a"} (${beauty?.scores.creativeQualityScore ?? 0}/100)`,
    "",
    `Directions prepared: ${status.directionsPrepared}`,
    "",
  ].join("\n");
}

function buildCreativeStyleReport(
  tech?: CreativeDirectionRecord,
  fashion?: CreativeDirectionRecord,
  beauty?: CreativeDirectionRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as CreativeDirectionRecord[];
  return [
    "# Creative Style Report — Step 5F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Style | Theme | Mood | Tone | Platform | Brand Consistency |",
    "|---------|-------|-------|------|------|----------|-------------------|",
    ...rows.map(
      (r) =>
        `| ${r.productId} | ${r.profile.creativeStyle} | ${r.profile.creativeTheme.slice(0, 40)}... | ${r.profile.mood} | ${r.profile.tone.slice(0, 30)} | ${r.profile.platform} | ${r.scores.brandConsistencyScore}/100 |`
    ),
    "",
  ].join("\n");
}

function buildCreativeReadinessReport(
  status: CreativeDirectionEngineStatusReport,
  tech?: CreativeDirectionRecord,
  fashion?: CreativeDirectionRecord,
  beauty?: CreativeDirectionRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as CreativeDirectionRecord[];
  return [
    "# Creative Readiness Report — Step 5F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Product | Quality | Marketing | Visual | Audience | Confidence | Platforms | Validated |",
    "|---------|---------|-----------|--------|----------|------------|-----------|-----------|",
    ...rows.map(
      (r) =>
        `| ${r.productId} | ${r.scores.creativeQualityScore}/100 | ${r.scores.marketingAlignmentScore}/100 | ${r.scores.visualDirectionScore}/100 | ${r.scores.audienceAlignmentScore}/100 | ${r.scores.aiConfidenceScore}/100 | ${r.platformDirections.length} | ${r.validated ? "✅" : "❌"} |`
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
