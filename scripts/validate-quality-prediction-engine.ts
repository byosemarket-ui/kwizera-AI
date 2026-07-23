import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAnalysisIndustry,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  type QualityPredictionEngineStatusReport,
  type QualityPredictionRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-quality-prediction-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step5l-kwizera-pro",
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
  productId: "step5l-kwizera-jacket",
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
  productId: "step5l-glow-serum",
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
  await foundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: sample.productId!,
  });
  await foundation.getScriptPlanningEngine().createScriptPlan({
    productId: sample.productId!,
  });
  await foundation.getVisualPlanningEngine().createVisualPlan({
    productId: sample.productId!,
  });
  await foundation.getAudioPlanningEngine().createAudioPlan({
    productId: sample.productId!,
  });
  await foundation.getProductionPlanningEngine().createProductionPlan({
    productId: sample.productId!,
  });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 5L Quality Prediction Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-5l-validation");

    const foundation = core.getManager().productIntelligenceFoundation!;
    const engine = foundation.getQualityPredictionEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Quality Prediction Engine operational",
    };

    await prepareFullPipeline(foundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);

    const predictStart = Date.now();
    const tech = await engine.predictQuality({ productId: "step5l-kwizera-pro" });
    const predictMs = Date.now() - predictStart;

    results.qualityPrediction = {
      passed: tech.success && Boolean(tech.record),
      detail: `Technology quality prediction in ${predictMs}ms, overall ${tech.record?.scores.overallQualityScore}`,
    };

    const productionPlan = foundation
      .getProductionPlanningEngine()
      .getProductionPlansByProduct("step5l-kwizera-pro")[0];

    results.qualityProfile = {
      passed:
        Boolean(tech.record?.profile.predictionId) &&
        Boolean(tech.record?.profile.productionPlanId) &&
        Boolean(tech.record?.profile.platform),
      detail: `Prediction ${tech.record?.profile.predictionId}, v${tech.record?.profile.predictionVersion}`,
    };

    results.qualityAnalysis = {
      passed:
        Boolean(tech.record?.analysis.storyboard) &&
        Boolean(tech.record?.analysis.scriptPlan) &&
        Boolean(tech.record?.analysis.visualPlan) &&
        Boolean(tech.record?.analysis.audioPlan) &&
        Boolean(tech.record?.analysis.productionPlan),
      detail: "All planning modules analyzed",
    };

    results.qualityScores = {
      passed:
        (tech.record?.scores.overallQualityScore ?? 0) >= 55 &&
        (tech.record?.scores.visualQualityScore ?? 0) >= 50 &&
        (tech.record?.scores.storytellingScore ?? 0) >= 50 &&
        (tech.record?.scores.marketingEffectivenessScore ?? 0) >= 50 &&
        (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Overall ${tech.record?.scores.overallQualityScore}, production ${tech.record?.scores.productionReadinessScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.qualityChecks = {
      passed:
        tech.record?.checks.brandConsistency === true &&
        tech.record?.checks.storyConsistency === true &&
        tech.record?.checks.dependencyValidation === true &&
        (tech.record?.checks.issues.length ?? 0) === 0,
      detail: `Checks passed — ${tech.record?.checks.issues.length ?? 0} issues`,
    };

    results.predictionEngine = {
      passed:
        (tech.record?.predictions.successProbability ?? 0) >= 55 &&
        Boolean(tech.record?.predictions.productionRisk) &&
        (tech.record?.predictions.improvementOpportunities.length ?? 0) >= 1,
      detail: `Success ${tech.record?.predictions.successProbability}%, risk ${tech.record?.predictions.productionRisk}`,
    };

    results.riskAnalysis = {
      passed:
        (tech.record?.risks.length ?? 0) >= 1 &&
        !tech.record?.risks.some((r) => r.severity === "critical" && !r.resolved),
      detail: `${tech.record?.risks.length} risks, no unresolved critical`,
    };

    results.recommendations = {
      passed:
        (tech.record?.recommendations.storyImprovements.length ?? 0) >= 1 &&
        (tech.record?.recommendations.platformOptimization.length ?? 0) >= 1 &&
        (tech.record?.recommendations.productionOptimization.length ?? 0) >= 1,
      detail: "Story, platform and production recommendations generated",
    };

    results.platformQuality = {
      passed:
        Boolean(tech.record?.platformQuality.platform) &&
        (tech.record?.platformQuality.readinessScore ?? 0) >= 50,
      detail: `${tech.record?.platformQuality.platform} readiness ${tech.record?.platformQuality.readinessScore}/100`,
    };

    results.upstreamAlignment = {
      passed: tech.record?.productionPlanId === productionPlan?.productionPlanId,
      detail: "Production plan aligned with quality prediction",
    };

    await prepareFullPipeline(foundation, SAMPLE_FASHION, MarketingObjective.BrandAwareness, CreativePlatform.InstagramReels);
    await prepareFullPipeline(foundation, SAMPLE_BEAUTY, MarketingObjective.SalesGrowth, CreativePlatform.TikTok);

    const fashion = await engine.predictQuality({ productId: "step5l-kwizera-jacket" });
    const beauty = await engine.predictQuality({ productId: "step5l-glow-serum" });

    results.multiIndustry = {
      passed: fashion.success && beauty.success,
      detail: `Fashion overall ${fashion.record?.scores.overallQualityScore}, Beauty ${beauty.record?.scores.overallQualityScore}`,
    };

    results.relationshipDetection = {
      passed:
        (tech.record?.relationships.productionPlans.length ?? 0) >= 1 &&
        (tech.record?.relationships.storyboards.length ?? 0) >= 1,
      detail: `Production plans ${tech.record?.relationships.productionPlans.length}, knowledge ${tech.record?.relationships.knowledgeRecords.length}`,
    };

    const noPipeline = await engine.predictQuality({ productId: "step5l-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without upstream pipeline",
    };

    const repaired = await engine.repairQualityPrediction("step5l-kwizera-jacket", CreativePlatform.Facebook);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Quality prediction repair pipeline verified" : "Repair failed",
    };

    const predictionSearch = engine.searchQualityPredictions({ predictionId: tech.record?.predictionId });
    results.searchByPrediction = {
      passed: predictionSearch.length >= 1,
      detail: `${predictionSearch.length} result(s) by prediction`,
    };

    const brandSearch = engine.searchQualityPredictions({ brand: "KWIZERA" });
    results.searchByBrand = {
      passed: brandSearch.length >= 1,
      detail: `${brandSearch.length} result(s) by brand`,
    };

    const platformSearch = engine.searchQualityPredictions({ platform: CreativePlatform.YouTube });
    results.searchByPlatform = {
      passed: platformSearch.length >= 1,
      detail: `${platformSearch.length} result(s) by platform`,
    };

    const campaignSearch = engine.searchQualityPredictions({ campaign: MarketingObjective.ProductLaunch });
    results.searchByCampaign = {
      passed: campaignSearch.length >= 1,
      detail: `${campaignSearch.length} result(s) by campaign`,
    };

    const scoreSearch = engine.searchQualityPredictions({ minQualityScore: 55 });
    results.searchByQualityScore = {
      passed: scoreSearch.length >= 1,
      detail: `${scoreSearch.length} result(s) above quality threshold`,
    };

    const riskSearch = engine.searchQualityPredictions({ riskLevel: tech.record?.predictions.productionRisk });
    results.searchByRiskLevel = {
      passed: riskSearch.length >= 1,
      detail: `${riskSearch.length} result(s) by risk level`,
    };

    const status = engine.buildStatusReport();
    results.performance = {
      passed: status.performance.averagePredictionMs < 120000,
      detail: `avg prediction ${status.performance.averagePredictionMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `quality-prediction-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const registered = foundation.getRegistry().getModule("quality-prediction");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}`,
    };

    results.recommendationReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: "Quality-approved project ready for media generation modules",
    };

    await core.stop("step-5l-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Quality-Prediction-Report.md"),
      buildQualityPredictionReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Risk-Analysis-Report.md"),
      buildRiskAnalysisReport(tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Production-Quality-Report.md"),
      buildProductionQualityReport(tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Quality-Recommendations.md"),
      buildRecommendationsReport(tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-5L-VALIDATION-REPORT.md"),
      buildQualityPredictionReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record),
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

function buildQualityPredictionReport(
  status: QualityPredictionEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: QualityPredictionRecord,
  fashion?: QualityPredictionRecord,
  beauty?: QualityPredictionRecord
): string {
  return [
    "# Quality Prediction Report — Step 5L",
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
    "## Quality Predictions",
    "",
    `- Technology: overall ${tech?.scores.overallQualityScore ?? 0}/100 on ${tech?.profile.platform ?? "n/a"}`,
    `- Fashion: overall ${fashion?.scores.overallQualityScore ?? 0}/100`,
    `- Beauty: overall ${beauty?.scores.overallQualityScore ?? 0}/100`,
    "",
    `Predictions prepared: ${status.predictionsPrepared}`,
    "",
  ].join("\n");
}

function buildRiskAnalysisReport(
  tech?: QualityPredictionRecord,
  fashion?: QualityPredictionRecord,
  beauty?: QualityPredictionRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as QualityPredictionRecord[];
  const lines = [
    "# Risk Analysis Report — Step 5L",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
  ];

  for (const record of rows) {
    lines.push(
      `## ${record.productId} — ${record.profile.platform}`,
      "",
      `- **Production Risk:** ${record.predictions.productionRisk}`,
      `- **Success Probability:** ${record.predictions.successProbability}%`,
      `- **Complexity:** ${record.predictions.productionComplexity}`,
      "",
      "| Category | Description | Severity | Resolved |",
      "|----------|-------------|----------|----------|"
    );
    for (const risk of record.risks) {
      lines.push(`| ${risk.category} | ${risk.description.slice(0, 50)} | ${risk.severity} | ${risk.resolved ? "✅" : "❌"} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildProductionQualityReport(
  tech?: QualityPredictionRecord,
  fashion?: QualityPredictionRecord,
  beauty?: QualityPredictionRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as QualityPredictionRecord[];
  return [
    "# Production Quality Report — Step 5L",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Overall | Visual | Story | Marketing | Brand | Audience | Technical | Production | Confidence |",
    "|---------|---------|--------|-------|-----------|-------|----------|-----------|------------|------------|",
    ...rows.map(
      (r) =>
        `| ${r.productId} | ${r.scores.overallQualityScore}/100 | ${r.scores.visualQualityScore}/100 | ${r.scores.storytellingScore}/100 | ${r.scores.marketingEffectivenessScore}/100 | ${r.scores.brandConsistencyScore}/100 | ${r.scores.audienceAlignmentScore}/100 | ${r.scores.technicalReadinessScore}/100 | ${r.scores.productionReadinessScore}/100 | ${r.scores.aiConfidenceScore}/100 |`
    ),
    "",
    "## Platform Readiness",
    "",
    ...rows.map(
      (r) =>
        `- **${r.productId}:** ${r.platformQuality.platform} — ${r.platformQuality.readinessScore}/100 (${r.platformQuality.pacingFit})`
    ),
    "",
  ].join("\n");
}

function buildRecommendationsReport(
  tech?: QualityPredictionRecord,
  fashion?: QualityPredictionRecord,
  beauty?: QualityPredictionRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as QualityPredictionRecord[];
  const lines = [
    "# Quality Recommendations — Step 5L",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
  ];

  for (const record of rows) {
    const r = record.recommendations;
    lines.push(
      `## ${record.productId}`,
      "",
      "### Story",
      ...r.storyImprovements.map((i) => `- ${i}`),
      "",
      "### Visual",
      ...r.visualImprovements.map((i) => `- ${i}`),
      "",
      "### Audio",
      ...r.audioImprovements.map((i) => `- ${i}`),
      "",
      "### Branding",
      ...r.brandingImprovements.map((i) => `- ${i}`),
      "",
      "### Marketing",
      ...r.marketingImprovements.map((i) => `- ${i}`),
      "",
      "### Platform",
      ...r.platformOptimization.map((i) => `- ${i}`),
      "",
      "### Production",
      ...r.productionOptimization.map((i) => `- ${i}`),
      ""
    );
  }

  return lines.join("\n");
}

void main();
