import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  ImageAnalysisType,
  ImageColorSpace,
  ImageCompressionType,
  ImageFileFormat,
  ImageUnderstandingMarketingGoal,
  ImageUnderstandingPlatform,
  LightingColorMarketingGoal,
  LightingType,
  type LightingColorIntelligenceEngineStatusReport,
  type LightingColorIntelligenceRecord,
} from "../ai/index.js";
import type { ImageAnalysisEngineInput } from "../ai/image-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-lighting-color-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_PRODUCT: ImageAnalysisEngineInput = {
  imageId: "step6g-kwizera-pro-hero",
  imageName: "KWIZERA Pro Studio Hero",
  filePath: "uploads/kwizera-pro-hero.png",
  fileFormat: ImageFileFormat.PNG,
  fileSizeBytes: 1_245_000,
  width: 2400,
  height: 1600,
  colorSpace: ImageColorSpace.SRGB,
  bitDepth: 8,
  compressionType: ImageCompressionType.Lossless,
  hasTransparency: true,
  metadata: { camera: "studio-rig" },
  creationDate: "2026-01-15T10:00:00.000Z",
  lastModifiedDate: "2026-03-20T14:30:00.000Z",
  imageType: ImageAnalysisType.ProductImage,
  product: "KWIZERA Pro Studio",
  brand: "KWIZERA",
  category: "commerce",
  creativeStyle: "commercial",
  visual: {
    brightness: 72,
    contrast: 78,
    saturation: 65,
    sharpness: 88,
    noiseLevel: 8,
    whiteBalance: 68,
    exposure: 72,
    dominantColors: ["#1a1a2e", "#e94560", "#ffffff"],
  },
  content: {
    products: ["KWIZERA Pro Studio"],
    background: "studio-white",
    foreground: "KWIZERA Pro Studio",
    logos: ["KWIZERA"],
  },
  tags: ["product", "kwizera", "validation"],
  keywords: ["hero", "studio", "kwizera"],
};

const SAMPLE_LIFESTYLE: ImageAnalysisEngineInput = {
  imageId: "step6g-kwizera-lifestyle",
  imageName: "KWIZERA Urban Lifestyle",
  filePath: "uploads/kwizera-lifestyle.jpg",
  fileFormat: ImageFileFormat.JPEG,
  fileSizeBytes: 890_000,
  width: 1920,
  height: 1280,
  colorSpace: ImageColorSpace.SRGB,
  bitDepth: 8,
  compressionType: ImageCompressionType.Lossy,
  metadata: { location: "urban" },
  creationDate: "2026-02-10T09:00:00.000Z",
  lastModifiedDate: "2026-02-10T09:00:00.000Z",
  imageType: ImageAnalysisType.LifestyleImage,
  product: "KWIZERA Urban Jacket",
  brand: "KWIZERA",
  category: "lifestyle",
  creativeStyle: "editorial",
  visual: {
    brightness: 68,
    contrast: 72,
    saturation: 58,
    sharpness: 80,
    whiteBalance: 55,
    exposure: 65,
    dominantColors: ["#2d3436", "#636e72"],
  },
  content: {
    products: ["KWIZERA Urban Jacket"],
    background: "urban-street",
    foreground: "model-with-jacket",
    objects: ["person", "clothing"],
  },
  tags: ["lifestyle", "validation"],
  keywords: ["urban", "kwizera"],
};

const SAMPLE_BANNER: ImageAnalysisEngineInput = {
  imageId: "step6g-summer-banner",
  imageName: "Summer Campaign Banner",
  filePath: "uploads/summer-banner.webp",
  fileFormat: ImageFileFormat.WebP,
  fileSizeBytes: 420_000,
  width: 1920,
  height: 600,
  bitDepth: 8,
  compressionType: ImageCompressionType.Lossy,
  metadata: { campaign: "summer-2026" },
  creationDate: "2026-05-01T12:00:00.000Z",
  lastModifiedDate: "2026-05-01T12:00:00.000Z",
  imageType: ImageAnalysisType.Banner,
  brand: "GlowLab",
  campaign: "summer-2026",
  category: "marketing",
  creativeStyle: "promotional",
  visual: {
    brightness: 75,
    contrast: 80,
    saturation: 72,
    sharpness: 82,
    whiteBalance: 72,
    exposure: 70,
    dominantColors: ["#ff6b6b", "#feca57"],
  },
  content: { background: "gradient-sunset", text: ["Summer Sale"], products: ["GlowLab Summer Kit"] },
  tags: ["banner", "validation"],
  keywords: ["summer", "campaign"],
};

async function runBasePipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageIntelligenceFoundation"]>,
  sample: ImageAnalysisEngineInput,
  opts?: { industry?: string; marketingGoal?: ImageUnderstandingMarketingGoal; platform?: ImageUnderstandingPlatform }
): Promise<void> {
  await foundation.getImageAnalysisEngine().analyzeImage(sample);
  await foundation.getImageUnderstandingEngine().understandImage({
    imageId: sample.imageId!,
    industry: opts?.industry,
    marketingGoal: opts?.marketingGoal,
    platform: opts?.platform,
  });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 6G Lighting & Color Intelligence Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-6g-validation");

    const foundation = core.getManager().imageIntelligenceFoundation!;
    const engine = foundation.getLightingColorIntelligenceEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Lighting & Color Intelligence Engine operational",
    };

    await runBasePipeline(foundation, SAMPLE_PRODUCT, {
      industry: "technology",
      marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
      platform: ImageUnderstandingPlatform.Ecommerce,
    });

    const analyzeStart = Date.now();
    const product = await engine.analyzeLightingColor({
      imageId: "step6g-kwizera-pro-hero",
      industry: "technology",
      marketingGoal: LightingColorMarketingGoal.Conversion,
    });
    const analyzeMs = Date.now() - analyzeStart;

    results.lightingAnalysis = {
      passed:
        product.success &&
        Boolean(product.record) &&
        (product.record!.lighting.lightingType === LightingType.Studio ||
          product.record!.lighting.lightingType === LightingType.HighKey),
      detail: `${product.record?.lighting.lightingType} lighting analyzed in ${analyzeMs}ms, quality ${product.record?.scores.lightingQualityScore}`,
    };

    results.colorAnalysis = {
      passed:
        (product.record?.color.dominantColors.length ?? 0) >= 2 &&
        (product.record?.color.colorHarmony ?? 0) >= 50,
      detail: `Palette ${product.record?.color.dominantColors.join(", ")}, harmony ${product.record?.color.colorHarmony}`,
    };

    results.brandColorMatching = {
      passed: (product.record?.color.brandColorMatching ?? 0) >= 50,
      detail: `Brand match ${product.record?.color.brandColorMatching}%, temperature ${product.record?.color.colorTemperature}`,
    };

    results.improvementPlanning = {
      passed:
        Boolean(product.record?.lightingPlan.exposureStrategy) &&
        Boolean(product.record?.colorPlan.colorGradingPreparation),
      detail: product.record?.colorPlan.brandColorStrategy?.slice(0, 55) ?? "n/a",
    };

    results.qualityScores = {
      passed:
        (product.record?.scores.lightingQualityScore ?? 0) >= 55 &&
        (product.record?.scores.colorQualityScore ?? 0) >= 55 &&
        (product.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Lighting ${product.record?.scores.lightingQualityScore}, color ${product.record?.scores.colorQualityScore}, confidence ${product.record?.scores.aiConfidenceScore}`,
    };

    results.recommendationReadiness = {
      passed: (product.record?.recommendations.length ?? 0) >= 1,
      detail: `${product.record?.recommendations.length} recommendation(s) generated`,
    };

    await runBasePipeline(foundation, SAMPLE_LIFESTYLE, { industry: "fashion" });
    await runBasePipeline(foundation, SAMPLE_BANNER, {
      industry: "beauty",
      marketingGoal: ImageUnderstandingMarketingGoal.Awareness,
    });

    const lifestyle = await engine.analyzeLightingColor({
      imageId: "step6g-kwizera-lifestyle",
      industry: "fashion",
    });
    const banner = await engine.analyzeLightingColor({
      imageId: "step6g-summer-banner",
      industry: "beauty",
      marketingGoal: LightingColorMarketingGoal.Awareness,
    });

    results.multiImageAnalysis = {
      passed:
        lifestyle.success &&
        banner.success &&
        lifestyle.record?.lighting.lightingType === LightingType.Natural,
      detail: `Lifestyle ${lifestyle.record?.lighting.lightingType}, Banner ${banner.record?.lighting.lightingType}`,
    };

    results.relationshipDetection = {
      passed: (lifestyle.record?.relationships.relatedImages.length ?? 0) >= 1,
      detail: `Lifestyle linked to ${lifestyle.record?.relationships.relatedImages.length} related image(s)`,
    };

    const noPipeline = await engine.analyzeLightingColor({ imageId: "step6g-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without upstream intelligence",
    };

    const repaired = await engine.repairLightingColor("step6g-kwizera-lifestyle");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Lighting & color repair pipeline verified" : "Repair failed",
    };

    const lightingSearch = engine.searchLightingColor({ lightingType: LightingType.HighKey });
    results.search = {
      passed: lightingSearch.length >= 1,
      detail: `${lightingSearch.length} result(s) by lighting type`,
    };

    const paletteSearch = engine.searchLightingColor({ colorPalette: "#e94560" });
    results.colorPaletteSearch = {
      passed: paletteSearch.length >= 1,
      detail: `${paletteSearch.length} result(s) by color palette`,
    };

    const productSearch = engine.searchLightingColor({ product: "KWIZERA" });
    results.productSearch = {
      passed: productSearch.length >= 2,
      detail: `${productSearch.length} result(s) by product`,
    };

    const relationships = engine.detectRelationships("step6g-kwizera-pro-hero");
    results.relationshipUpdate = {
      passed: Boolean(relationships?.relatedStoryboards.length),
      detail: `${relationships?.relatedStoryboards.length ?? 0} storyboard relationship(s)`,
    };

    const status = engine.buildStatusReport();
    results.knowledgeBridge = {
      passed: status.knowledgeBridgeStatus === "connected",
      detail: status.knowledgeBridgeStatus,
    };

    results.memoryBridge = {
      passed: status.memoryBridgeStatus === "connected",
      detail: status.memoryBridgeStatus,
    };

    results.productIntelligenceBridge = {
      passed: status.productIntelligenceBridgeStatus === "connected",
      detail: status.productIntelligenceBridgeStatus,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `lighting-color-intelligence-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.performance = {
      passed: status.performance.averageAnalysisMs < 120000,
      detail: `avg analysis ${status.performance.averageAnalysisMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const registered = foundation.getRegistry().getModule("lighting-color-intelligence");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}`,
    };

    await core.stop("step-6g-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Lighting-Analysis-Report.md"),
      buildLightingReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Color-Analysis-Report.md"),
      buildColorReport(product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Lighting-Quality-Report.md"),
      buildLightingQualityReport(product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Color-Readiness-Report.md"),
      buildReadinessReport(status, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-6G-VALIDATION-REPORT.md"),
      buildLightingReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record),
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

function buildLightingReport(
  status: LightingColorIntelligenceEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  product?: LightingColorIntelligenceRecord,
  lifestyle?: LightingColorIntelligenceRecord,
  banner?: LightingColorIntelligenceRecord
): string {
  return [
    "# Lighting Analysis Report — Step 6G",
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
    "## Images Analyzed",
    "",
    `- Product: ${product?.lighting.lightingType ?? "n/a"} — lighting ${product?.scores.lightingQualityScore ?? 0}/100`,
    `- Lifestyle: ${lifestyle?.lighting.lightingType ?? "n/a"} — lighting ${lifestyle?.scores.lightingQualityScore ?? 0}/100`,
    `- Banner: ${banner?.lighting.lightingType ?? "n/a"} — lighting ${banner?.scores.lightingQualityScore ?? 0}/100`,
    "",
    `Images analyzed: ${status.imagesAnalyzed}`,
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 6G Lighting & Color Intelligence Engine validation complete. Awaiting user approval before Step 6H.",
    "",
  ].join("\n");
}

function buildColorReport(
  product?: LightingColorIntelligenceRecord,
  lifestyle?: LightingColorIntelligenceRecord,
  banner?: LightingColorIntelligenceRecord
): string {
  const rows = [product, lifestyle, banner].filter(Boolean) as LightingColorIntelligenceRecord[];
  return [
    "# Color Analysis Report — Step 6G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Image | Palette | Temperature | Harmony | Contrast | Saturation | Brand Match |",
    "|-------|---------|-------------|---------|----------|------------|-------------|",
    ...rows.map(
      (r) =>
        `| ${r.imageId} | ${r.color.dominantColors.join(", ")} | ${r.color.colorTemperature} | ${r.color.colorHarmony} | ${r.color.colorContrast} | ${r.color.saturation} | ${r.color.brandColorMatching} |`
    ),
    "",
    "## Color Scores",
    "",
    ...rows.map((r) => `- ${r.imageId}: ${r.scores.colorQualityScore}/100, brand ${r.scores.brandColorScore}/100`),
    "",
  ].join("\n");
}

function buildLightingQualityReport(
  product?: LightingColorIntelligenceRecord,
  lifestyle?: LightingColorIntelligenceRecord,
  banner?: LightingColorIntelligenceRecord
): string {
  const rows = [product, lifestyle, banner].filter(Boolean) as LightingColorIntelligenceRecord[];
  return [
    "# Lighting Quality Report — Step 6G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Image | Type | Direction | Intensity | Uniformity | Exposure | Shadows | Highlights |",
    "|-------|------|-----------|-----------|------------|----------|---------|------------|",
    ...rows.map(
      (r) =>
        `| ${r.imageId} | ${r.lighting.lightingType} | ${r.lighting.lightingDirection} | ${r.lighting.lightingIntensity} | ${r.lighting.lightingUniformity} | ${r.lighting.exposure} | ${r.lighting.shadows} | ${r.lighting.highlights} |`
    ),
    "",
    "## Lighting Suitability",
    "",
    "| Image | Product Photo | Advertisement | Social | Video |",
    "|-------|---------------|---------------|--------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.imageId} | ${r.lightingSuitability.productPhotography} | ${r.lightingSuitability.advertisement} | ${r.lightingSuitability.socialMedia} | ${r.lightingSuitability.videoProduction} |`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(status: LightingColorIntelligenceEngineStatusReport, allPassed: boolean): string {
  return [
    "# Color Readiness Report — Step 6G",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
    "",
    "## Readiness Scores",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Engine Readiness | ${status.readinessScore}/100 |`,
    `| Avg Lighting Score | ${status.averageLightingScore}/100 |`,
    `| Avg Color Score | ${status.averageColorScore}/100 |`,
    `| Images Analyzed | ${status.imagesAnalyzed} |`,
    `| Knowledge Bridge | ${status.knowledgeBridgeStatus} |`,
    `| Memory Bridge | ${status.memoryBridgeStatus} |`,
    `| Product Intelligence Bridge | ${status.productIntelligenceBridgeStatus} |`,
    "",
    "## Performance",
    "",
    `| Avg Analysis | ${status.performance.averageAnalysisMs}ms |`,
    `| Avg Search | ${status.performance.averageSearchMs}ms |`,
    `| Avg Relationship | ${status.performance.averageRelationshipMs}ms |`,
    "",
  ].join("\n");
}

void main();
