import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALL_TEXT_TO_IMAGE_PLATFORMS,
  createAiCore,
  CreativePlatform,
  ImageArtisticStyle,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductImageType,
  ProductUnderstandingMarketingGoal,
  TextToImagePlatform,
  type TextToImageGenerationEngineStatusReport,
  type TextToImageGenerationRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-text-to-image-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step9b-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description:
    "Professional AI-powered creative workstation empowering marketing teams to produce brand-consistent content at scale",
  features: ["AI image generation", "brand consistency", "multi-platform export"],
  specifications: { license: "pro", deployment: "cloud" },
  materials: ["digital-license"],
  price: 299.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "technology" as ProductAnalysisEngineInput["industry"],
  useCase: "creative-production",
  targetCustomer: "creative professionals and marketing teams",
  businessType: ProductBusinessType.B2B,
  tags: ["software", "validation"],
  keywords: ["AI studio", "kwizera"],
};

const SAMPLE_FASHION: ProductAnalysisEngineInput = {
  productId: "step9b-kwizera-jacket",
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
  industry: "fashion" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.D2C,
  tags: ["fashion", "validation"],
  keywords: ["jacket", "kwizera"],
};

const SAMPLE_BEAUTY: ProductAnalysisEngineInput = {
  productId: "step9b-glow-serum",
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
  industry: "beauty" as ProductAnalysisEngineInput["industry"],
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
  });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 9B Text-to-Image Generation Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("Project state:", projectStateDir);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({
      storageRootOverride: storageRoot,
      skipPlanningEngine: true,
      skipWorkflowEngine: true,
      skipTaskManager: true,
    });
    const initStart = Date.now();
    await core.start("step-9b-validation");
    const initMs = Date.now() - initStart;

    const imgFoundation = core.getManager().imageGenerationFoundation!;
    const engine = imgFoundation.getTextToImageGenerationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete()
        ? `Text-to-Image Engine ready in ${initMs}ms`
        : "Not initialized",
    };

    const registered = imgFoundation.getRegistry().getModule("text-to-image-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
    await prepareFullPipeline(piFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);

    const tech = await engine.generateImagePlan({
      productId: "step9b-kwizera-pro",
      platform: TextToImagePlatform.Website,
      productImageType: ProductImageType.HeroImage,
      textPrompt: "Professional hero image showcasing KWIZERA Pro Studio creative workstation",
      generatePlatformOptimizations: true,
      generateVariations: true,
    });

    const fashion = await engine.generateImagePlan({
      productId: "step9b-kwizera-jacket",
      platform: TextToImagePlatform.Instagram,
      productImageType: ProductImageType.LifestyleImage,
      style: ImageArtisticStyle.Fashion,
      generateVariations: true,
    });

    const beauty = await engine.generateImagePlan({
      productId: "step9b-glow-serum",
      platform: TextToImagePlatform.TikTok,
      productImageType: ProductImageType.ProductShowcase,
      style: ImageArtisticStyle.Luxury,
      generateVariations: true,
    });

    results.imagePlanGeneration = {
      passed: tech.success && fashion.success && beauty.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Beauty ${beauty.success ? "✓" : "✗"}`,
    };

    results.promptAnalysis = {
      passed: Boolean(
        tech.record?.promptAnalysis.subject &&
          tech.record?.promptAnalysis.environment &&
          tech.record?.promptAnalysis.mood &&
          tech.record?.promptAnalysis.artisticStyle
      ),
      detail: `Subject: ${tech.record?.promptAnalysis.subject.slice(0, 40)}...`,
    };

    results.compositionPlanning = {
      passed: Boolean(
        tech.record?.compositionPlan.composition &&
          tech.record?.compositionPlan.subjectPlacement &&
          tech.record?.compositionPlan.cameraAngle &&
          tech.record?.compositionPlan.perspective
      ),
      detail: `Composition score ${tech.record?.scores.compositionScore}`,
    };

    results.lightingPlanning = {
      passed: Boolean(
        tech.record?.lightingPlan.studioLighting &&
          tech.record?.lightingPlan.naturalLighting &&
          tech.record?.lightingPlan.hdrPreparation
      ),
      detail: "Natural, studio, and HDR lighting prepared",
    };

    results.stylePlanning = {
      passed: Boolean(
        tech.record?.stylePlan.style &&
          tech.record?.stylePlan.styleNotes &&
          tech.record?.stylePlan.brandAlignment
      ),
      detail: `Style ${tech.record?.stylePlan.style}, score ${tech.record?.scores.styleScore}`,
    };

    results.colorPlanning = {
      passed: Boolean(
        (tech.record?.colorPlan.primaryColors.length ?? 0) >= 2 &&
          tech.record?.colorPlan.brandColors.length >= 1
      ),
      detail: `${tech.record?.colorPlan.primaryColors.length} primary colors defined`,
    };

    results.platformOptimization = {
      passed: (tech.record?.platformOptimizations.length ?? 0) === ALL_TEXT_TO_IMAGE_PLATFORMS.length,
      detail: `${tech.record?.platformOptimizations.length}/${ALL_TEXT_TO_IMAGE_PLATFORMS.length} platform profiles`,
    };

    results.variations = {
      passed: (tech.record?.variations.length ?? 0) >= 3,
      detail: `${tech.record?.variations.length} variations (A, B, C)`,
    };

    results.imagePlanScores = {
      passed:
        (tech.record?.scores.promptQualityScore ?? 0) >= 55 &&
        (tech.record?.scores.compositionScore ?? 0) >= 55 &&
        (tech.record?.scores.styleScore ?? 0) >= 50 &&
        (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Prompt ${tech.record?.scores.promptQualityScore}, production ${tech.record?.scores.productionReadinessScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.products.length ?? 0) >= 1 &&
        (tech.record?.relationships.prompts.length ?? 0) >= 1,
      detail: `Products ${tech.record?.relationships.products.length}, prompts ${tech.record?.relationships.prompts.length}`,
    };

    results.productionReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
    };

    results.brandConsistency = {
      passed: tech.record?.brandConsistent === true,
      detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
    };

    const noPipeline = await engine.generateImagePlan({ productId: "step9b-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without upstream pipeline",
    };

    const promptOnly = await engine.generateImagePlan({
      textPrompt: "Minimal luxury product photography with soft studio lighting and brand accent colors",
      brandName: "KWIZERA",
      platform: TextToImagePlatform.Website,
      generatePlatformOptimizations: false,
    });
    results.textPromptGeneration = {
      passed: promptOnly.success,
      detail: promptOnly.success ? "Text prompt image plan generated" : promptOnly.message ?? "Failed",
    };

    const repaired = await engine.repairImagePlan("step9b-kwizera-jacket", TextToImagePlatform.Facebook);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Image plan repair pipeline verified" : "Repair failed",
    };

    const productSearch = engine.searchImagePlans({ productId: "step9b-kwizera-pro" });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const platformSearch = engine.searchImagePlans({ platform: TextToImagePlatform.TikTok });
    results.searchByPlatform = {
      passed: platformSearch.length >= 1,
      detail: `${platformSearch.length} result(s) by platform`,
    };

    const styleSearch = engine.searchImagePlans({ style: ImageArtisticStyle.Luxury });
    results.searchByStyle = {
      passed: styleSearch.length >= 1,
      detail: `${styleSearch.length} result(s) by style`,
    };

    const keywordSearch = engine.searchImagePlans({ keywords: "product" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const promptAsset = imgFoundation.getAssetRegistry().getAsset(tech.record!.profile.promptId);
    const imageAsset = imgFoundation.getAssetRegistry().getAsset(tech.record!.imagePlanId);
    results.generationAssetRegistration = {
      passed: promptAsset?.assetType === "prompt" && imageAsset?.assetType === "image",
      detail: `Prompt ${promptAsset?.assetId}, Image ${imageAsset?.assetId}`,
    };

    const blueprint = imgFoundation.getBlueprintManager().getBlueprint(tech.record!.blueprintId!);
    results.blueprintLink = {
      passed: Boolean(blueprint?.blueprintId),
      detail: blueprint ? `Blueprint ${blueprint.blueprintId} linked` : "Blueprint not found",
    };

    const status = engine.buildStatusReport();
    results.performance = {
      passed: status.performance.averageGenerationMs < 120000,
      detail: `avg generation ${status.performance.averageGenerationMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `text-to-image-generation-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    results.multiIndustry = {
      passed: fashion.success && beauty.success,
      detail: `Fashion ${fashion.record?.profile.style}, Beauty ${beauty.record?.profile.style}`,
    };

    results.recommendations = {
      passed: (tech.record?.recommendations.length ?? 0) >= 1,
      detail: `${tech.record?.recommendations.length} recommendation(s)`,
    };

    await core.stop("step-9b-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Text-to-Image-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Prompt-Analysis-Report.md"),
      buildPromptAnalysisReport(tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Composition-Planning-Report.md"),
      buildCompositionReport(tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Style-Planning-Report.md"),
      buildStyleReport(tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Text-to-Image-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, fashion.record, beauty.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-9B-VALIDATION-REPORT.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record),
      "utf8"
    );

    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);
    console.log("Reports written:");
    console.log(`  ${path.join(projectStateDir, "AI-Text-to-Image-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Prompt-Analysis-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Composition-Planning-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Style-Planning-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Text-to-Image-Readiness-Report.md")}`);

    if (useTemp && fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildMainReport(
  status: TextToImageGenerationEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: TextToImageGenerationRecord,
  fashion?: TextToImageGenerationRecord,
  beauty?: TextToImageGenerationRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 9 Step 9B Text-to-Image Generation Report",
    "",
    `**Phase:** 9 — Image Generation Engine`,
    `**Step:** 9B — AI Text-to-Image Generation Engine`,
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    `**Permanent storage:** \`${DEFAULT_STORAGE_ROOT}\``,
    "",
    "## Engine Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    `| **Image Plans Generated** | ${status.imagePlansGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Generated Image Plans",
    "",
    `- Technology: ${tech?.profile.style ?? "n/a"} (${tech?.scores.promptQualityScore ?? 0}/100)`,
    `- Fashion: ${fashion?.profile.style ?? "n/a"} (${fashion?.scores.promptQualityScore ?? 0}/100)`,
    `- Beauty: ${beauty?.profile.style ?? "n/a"} (${beauty?.scores.promptQualityScore ?? 0}/100)`,
    "",
  ].join("\n");
}

function buildPromptAnalysisReport(
  tech?: TextToImageGenerationRecord,
  fashion?: TextToImageGenerationRecord,
  beauty?: TextToImageGenerationRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as TextToImageGenerationRecord[];
  const lines = [
    "# Prompt Analysis Report — Step 9B",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Subject | Environment | Mood | Style | Prompt Score |",
    "|---------|---------|-------------|------|-------|--------------|",
  ];

  for (const record of rows) {
    lines.push(
      `| ${record.profile.productId} | ${record.promptAnalysis.subject.slice(0, 30)}... | ${record.promptAnalysis.environment.slice(0, 25)}... | ${record.promptAnalysis.mood} | ${record.promptAnalysis.artisticStyle} | ${record.scores.promptQualityScore}/100 |`
    );
  }

  lines.push("", "## Detailed Analysis (Technology)", "");
  if (tech) {
    lines.push(
      `- **Subject:** ${tech.promptAnalysis.subject}`,
      `- **Objects:** ${tech.promptAnalysis.objects.join(", ")}`,
      `- **Emotion:** ${tech.promptAnalysis.emotion}`,
      `- **Camera:** ${tech.promptAnalysis.cameraPerspective}`,
      `- **Color Palette:** ${tech.promptAnalysis.colorPalette.join(", ")}`
    );
  }

  return lines.join("\n");
}

function buildCompositionReport(
  tech?: TextToImageGenerationRecord,
  fashion?: TextToImageGenerationRecord,
  beauty?: TextToImageGenerationRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as TextToImageGenerationRecord[];
  const lines = [
    "# Composition Planning Report — Step 9B",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
  ];

  for (const record of rows) {
    lines.push(`## ${record.profile.productId}`, "");
    lines.push("| Element | Plan |", "|---------|------|");
    lines.push(`| Composition | ${record.compositionPlan.composition.slice(0, 60)}... |`);
    lines.push(`| Background | ${record.compositionPlan.background.slice(0, 60)}... |`);
    lines.push(`| Subject Placement | ${record.compositionPlan.subjectPlacement} |`);
    lines.push(`| Camera Angle | ${record.compositionPlan.cameraAngle} |`);
    lines.push(`| Camera Distance | ${record.compositionPlan.cameraDistance} |`);
    lines.push(`| Composition Score | ${record.scores.compositionScore}/100 |`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildStyleReport(
  tech?: TextToImageGenerationRecord,
  fashion?: TextToImageGenerationRecord,
  beauty?: TextToImageGenerationRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as TextToImageGenerationRecord[];
  const lines = [
    "# Style Planning Report — Step 9B",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Product | Style | Brand Alignment | Style Score | Brand Score |",
    "|---------|-------|-----------------|-------------|-------------|",
  ];

  for (const record of rows) {
    lines.push(
      `| ${record.profile.productId} | ${record.stylePlan.style} | ${record.stylePlan.brandAlignment.slice(0, 35)}... | ${record.scores.styleScore}/100 | ${record.scores.brandConsistencyScore}/100 |`
    );
  }

  lines.push("", "## Lighting Plans", "");
  if (tech) {
    lines.push(
      `- Studio: ${tech.lightingPlan.studioLighting.slice(0, 70)}...`,
      `- Natural: ${tech.lightingPlan.naturalLighting.slice(0, 70)}...`,
      `- HDR: ${tech.lightingPlan.hdrPreparation}`
    );
  }

  return lines.join("\n");
}

function buildReadinessReport(
  status: TextToImageGenerationEngineStatusReport,
  tech?: TextToImageGenerationRecord,
  fashion?: TextToImageGenerationRecord,
  beauty?: TextToImageGenerationRecord
): string {
  const rows = [tech, fashion, beauty].filter(Boolean) as TextToImageGenerationRecord[];
  return [
    "# Text-to-Image Readiness Report — Step 9B",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Product | Prompt | Composition | Style | Brand | Production | Confidence | Ready |",
    "|---------|--------|-------------|-------|-------|------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.productId} | ${r.scores.promptQualityScore} | ${r.scores.compositionScore} | ${r.scores.styleScore} | ${r.scores.brandConsistencyScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`
    ),
    "",
    "## Performance",
    "",
    `- Average generation: ${status.performance.averageGenerationMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    `- Platform optimization: ${status.platformOptimizationStatus}`,
    "",
  ].join("\n");
}

void main();
