import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AudienceCategory,
  AudiencePlatform,
  createAiCore,
  ProductAnalysisCategory,
  ProductAnalysisIndustry,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  type AudienceIntelligenceEngineStatusReport,
  type AudienceIntelligenceRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-audience-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step5d-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  model: "KWP-PRO-2026",
  sku: "KWZ-PRO-STUDIO-001",
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
  productId: "step5d-kwizera-jacket",
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
  productId: "step5d-glow-serum",
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

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 5D Target Audience Intelligence Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-5d-validation");

    const foundation = core.getManager().productIntelligenceFoundation!;
    const analysisEngine = foundation.getProductAnalysisEngine();
    const understandingEngine = foundation.getProductUnderstandingEngine();
    const engine = foundation.getTargetAudienceIntelligenceEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Target Audience Intelligence Engine operational",
    };

    await analysisEngine.analyzeProduct(SAMPLE_TECH);
    await understandingEngine.understandProduct({
      productId: "step5d-kwizera-pro",
      marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
    });

    const analysisStart = Date.now();
    const tech = await engine.analyzeAudience({
      productId: "step5d-kwizera-pro",
      preferredLanguage: "en",
      preferredPlatforms: [AudiencePlatform.YouTube, AudiencePlatform.Website],
      demographics: { language: "en" },
    });
    const analysisMs = Date.now() - analysisStart;

    results.audienceAnalysis = {
      passed: tech.success && Boolean(tech.record),
      detail: `Technology audience analyzed in ${analysisMs}ms, relevance ${tech.record?.scores.audienceRelevanceScore}`,
    };

    results.audienceProfile = {
      passed:
        Boolean(tech.record?.profile.audienceId) &&
        Boolean(tech.record?.profile.audienceName) &&
        tech.record?.profile.audienceCategory === AudienceCategory.B2BProfessional,
      detail: `${tech.record?.profile.audienceName} (${tech.record?.profile.audienceCategory})`,
    };

    results.demographicPreparation = {
      passed:
        Boolean(tech.record?.demographics.businessType) &&
        Boolean(tech.record?.demographics.customerType) &&
        tech.record?.demographics.ageGroup === undefined &&
        tech.record?.demographics.region === undefined,
      detail: "Business type and customer type set; age/region not invented",
    };

    results.psychologicalUnderstanding = {
      passed:
        (tech.record?.psychological.customerNeeds.length ?? 0) >= 2 &&
        (tech.record?.psychological.customerChallenges.length ?? 0) >= 1 &&
        Boolean(tech.record?.psychological.buyingIntent),
      detail: `${tech.record?.psychological.customerNeeds.length} needs, buying intent: ${tech.record?.psychological.buyingIntent?.slice(0, 40)}...`,
    };

    results.audienceSegmentation = {
      passed:
        Boolean(tech.record?.segmentation.productType) &&
        Boolean(tech.record?.segmentation.industry) &&
        (tech.record?.segmentation.customerNeeds.length ?? 0) >= 2,
      detail: `Segmented by ${tech.record?.segmentation.productType} in ${tech.record?.segmentation.industry}`,
    };

    results.platformPreferences = {
      passed:
        tech.record?.profile.preferredPlatforms.includes(AudiencePlatform.YouTube) === true &&
        tech.record?.profile.preferredPlatforms.includes(AudiencePlatform.Website) === true,
      detail: tech.record?.profile.preferredPlatforms.join(", ") ?? "none",
    };

    await analysisEngine.analyzeProduct(SAMPLE_FASHION);
    await analysisEngine.analyzeProduct(SAMPLE_BEAUTY);
    await understandingEngine.understandProduct({ productId: "step5d-kwizera-jacket" });
    await understandingEngine.understandProduct({ productId: "step5d-glow-serum" });

    const fashion = await engine.analyzeAudience({ productId: "step5d-kwizera-jacket" });
    const beauty = await engine.analyzeAudience({
      productId: "step5d-glow-serum",
      marketingGoal: ProductUnderstandingMarketingGoal.Awareness,
    });

    results.multiIndustry = {
      passed: fashion.success && beauty.success,
      detail: `Fashion ${fashion.record?.profile.audienceCategory}, Beauty ${beauty.record?.profile.audienceCategory}`,
    };

    results.audienceScores = {
      passed:
        (tech.record?.scores.audienceRelevanceScore ?? 0) >= 55 &&
        (tech.record?.scores.audienceConfidenceScore ?? 0) >= 50 &&
        (tech.record?.scores.marketingReadinessScore ?? 0) >= 40 &&
        (tech.record?.scores.communicationReadinessScore ?? 0) >= 45,
      detail: `Relevance ${tech.record?.scores.audienceRelevanceScore}, confidence ${tech.record?.scores.audienceConfidenceScore}, marketing ${tech.record?.scores.marketingReadinessScore}`,
    };

    results.relationshipDetection = {
      passed:
        (tech.record?.relationships.products.length ?? 0) >= 1 &&
        (tech.record?.relationships.brands.length ?? 0) >= 1 &&
        (tech.record?.relationships.knowledgeRecords.length ?? 0) >= 0,
      detail: `Products ${tech.record?.relationships.products.length}, brands ${tech.record?.relationships.brands.length}, segments ${tech.record?.relationships.customerSegments.length}`,
    };

    results.marketingPreparation = {
      passed: tech.record?.marketingPreparation.marketingStrategyReady === true,
      detail: "Audience intelligence prepared for downstream marketing modules",
    };

    const noUnderstanding = await engine.analyzeAudience({ productId: "step5d-nonexistent" });
    results.incompleteRejection = {
      passed: !noUnderstanding.success,
      detail: noUnderstanding.message ?? "Rejected without understanding",
    };

    const repaired = await engine.repairAudience("step5d-kwizera-jacket");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Audience repair pipeline verified" : "Repair failed",
    };

    const industrySearch = engine.searchAudiences({ industry: "technology" });
    results.searchByIndustry = {
      passed: industrySearch.length >= 1,
      detail: `${industrySearch.length} result(s) by industry`,
    };

    const platformSearch = engine.searchAudiences({ platform: AudiencePlatform.Instagram });
    results.searchByPlatform = {
      passed: platformSearch.length >= 1,
      detail: `${platformSearch.length} result(s) by platform`,
    };

    const needSearch = engine.searchAudiences({ customerNeed: "quality" });
    results.searchByNeed = {
      passed: needSearch.length >= 1,
      detail: `${needSearch.length} result(s) by customer need`,
    };

    const goalSearch = engine.searchAudiences({
      marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
    });
    results.searchByMarketingGoal = {
      passed: goalSearch.length >= 1,
      detail: `${goalSearch.length} result(s) by marketing goal`,
    };

    const typeSearch = engine.searchAudiences({ audienceType: AudienceCategory.D2CDirect });
    results.searchByAudienceType = {
      passed: typeSearch.length >= 1,
      detail: `${typeSearch.length} result(s) by audience type`,
    };

    const langSearch = engine.searchAudiences({ language: "en" });
    results.searchByLanguage = {
      passed: langSearch.length >= 1,
      detail: `${langSearch.length} result(s) by language`,
    };

    const productSearch = engine.searchAudiences({ productId: "step5d-kwizera-pro" });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const status = engine.buildStatusReport();
    results.performance = {
      passed: status.performance.averageAnalysisMs < 120000,
      detail: `avg analysis ${status.performance.averageAnalysisMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `audience-intelligence-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const registered = foundation.getRegistry().getModule("audience-intelligence");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}`,
    };

    results.recommendationReadiness = {
      passed:
        tech.record?.validated === true &&
        tech.record.marketingPreparation.creativeDirectionReady === true,
      detail: "Validated audience ready for marketing and creative planning",
    };

    await core.stop("step-5d-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Target-Audience-Report.md"),
      buildTargetAudienceReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Audience-Segmentation-Report.md"),
      buildSegmentationReport(tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Audience-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-5D-VALIDATION-REPORT.md"),
      buildTargetAudienceReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record),
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

function buildTargetAudienceReport(
  status: AudienceIntelligenceEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: AudienceIntelligenceRecord,
  fashion?: AudienceIntelligenceRecord,
  beauty?: AudienceIntelligenceRecord
): string {
  return [
    "# Target Audience Report — Step 5D",
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
    "## Audiences Analyzed",
    "",
    `- Technology: ${tech?.profile.audienceName ?? "n/a"} (${tech?.scores.audienceRelevanceScore ?? 0}/100)`,
    `- Fashion: ${fashion?.profile.audienceName ?? "n/a"} (${fashion?.scores.audienceRelevanceScore ?? 0}/100)`,
    `- Beauty: ${beauty?.profile.audienceName ?? "n/a"} (${beauty?.scores.audienceRelevanceScore ?? 0}/100)`,
    "",
    `Audiences analyzed: ${status.audiencesAnalyzed}`,
    "",
  ].join("\n");
}

function buildSegmentationReport(
  tech?: AudienceIntelligenceRecord,
  fashion?: AudienceIntelligenceRecord,
  beauty?: AudienceIntelligenceRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as AudienceIntelligenceRecord[];
  return [
    "# Audience Segmentation Report — Step 5D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Audience | Category | Industry | Product Type | Needs | Platforms |",
    "|----------|----------|----------|--------------|-------|-----------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.audienceName.slice(0, 30)} | ${r.profile.audienceCategory} | ${r.segmentation.industry} | ${r.segmentation.productType} | ${r.segmentation.customerNeeds.length} | ${r.profile.preferredPlatforms.join(", ")} |`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(
  status: AudienceIntelligenceEngineStatusReport,
  tech?: AudienceIntelligenceRecord,
  fashion?: AudienceIntelligenceRecord,
  beauty?: AudienceIntelligenceRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as AudienceIntelligenceRecord[];
  return [
    "# Audience Readiness Report — Step 5D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Audience | Relevance | Confidence | Marketing | Communication | Validated |",
    "|----------|-----------|------------|-----------|---------------|-----------|",
    ...rows.map(
      (r) =>
        `| ${r.productId} | ${r.scores.audienceRelevanceScore}/100 | ${r.scores.audienceConfidenceScore}/100 | ${r.scores.marketingReadinessScore}/100 | ${r.scores.communicationReadinessScore}/100 | ${r.validated ? "✅" : "❌"} |`
    ),
    "",
    "## Performance",
    "",
    `- Average analysis: ${status.performance.averageAnalysisMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    `- Average relationship detection: ${status.performance.averageRelationshipMs}ms`,
    "",
  ].join("\n");
}

void main();
