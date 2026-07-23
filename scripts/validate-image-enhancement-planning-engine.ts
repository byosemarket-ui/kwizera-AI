import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  EnhancementPlatform,
  EnhancementPlanType,
  ImageAnalysisType,
  ImageColorSpace,
  ImageCompressionType,
  ImageFileFormat,
  ImageUnderstandingMarketingGoal,
  ImageUnderstandingPlatform,
  type ImageEnhancementPlanningEngineStatusReport,
  type ImageEnhancementPlanningRecord,
} from "../ai/index.js";
import type { ImageAnalysisEngineInput } from "../ai/image-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-enhancement-planning-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_PRODUCT: ImageAnalysisEngineInput = {
  imageId: "step6i-kwizera-pro-hero",
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
  imageType: ImageAnalysisType.ProductImage,
  product: "KWIZERA Pro Studio",
  brand: "KWIZERA",
  category: "commerce",
  creativeStyle: "commercial",
  tags: ["validation"],
  keywords: ["kwizera", "hero"],
  creationDate: "2026-01-15T10:00:00.000Z",
  lastModifiedDate: "2026-03-20T14:30:00.000Z",
};

const SAMPLE_LIFESTYLE: ImageAnalysisEngineInput = {
  imageId: "step6i-kwizera-lifestyle",
  imageName: "KWIZERA Urban Lifestyle",
  filePath: "uploads/kwizera-lifestyle.jpg",
  fileFormat: ImageFileFormat.JPEG,
  fileSizeBytes: 890_000,
  width: 1920,
  height: 1280,
  colorSpace: ImageColorSpace.SRGB,
  bitDepth: 8,
  compressionType: ImageCompressionType.Lossy,
  visual: {
    brightness: 68,
    contrast: 72,
    saturation: 58,
    sharpness: 80,
    noiseLevel: 18,
    whiteBalance: 55,
    exposure: 65,
    dominantColors: ["#2d3436", "#636e72"],
  },
  content: {
    products: ["KWIZERA Urban Jacket"],
    background: "urban-street",
    foreground: "model-with-jacket",
    logos: ["KWIZERA"],
    objects: ["person", "clothing"],
  },
  imageType: ImageAnalysisType.LifestyleImage,
  product: "KWIZERA Urban Jacket",
  brand: "KWIZERA",
  category: "lifestyle",
  creativeStyle: "editorial",
  tags: ["validation"],
  keywords: ["urban", "kwizera"],
  creationDate: "2026-02-10T09:00:00.000Z",
  lastModifiedDate: "2026-02-10T09:00:00.000Z",
};

const SAMPLE_BANNER: ImageAnalysisEngineInput = {
  imageId: "step6i-glowlab-banner",
  imageName: "GlowLab Summer Banner",
  filePath: "uploads/glowlab-banner.webp",
  fileFormat: ImageFileFormat.WebP,
  fileSizeBytes: 420_000,
  width: 1920,
  height: 600,
  bitDepth: 8,
  compressionType: ImageCompressionType.Lossy,
  visual: {
    brightness: 75,
    contrast: 80,
    sharpness: 82,
    noiseLevel: 12,
    whiteBalance: 72,
    exposure: 70,
    saturation: 72,
    dominantColors: ["#ff6b6b", "#feca57"],
  },
  content: {
    background: "gradient-sunset",
    text: ["Summer Sale"],
    products: ["GlowLab Summer Kit"],
    logos: ["GlowLab"],
  },
  imageType: ImageAnalysisType.Banner,
  brand: "GlowLab",
  campaign: "summer-2026",
  category: "marketing",
  creativeStyle: "promotional",
  tags: ["validation"],
  keywords: ["summer", "glowlab"],
  creationDate: "2026-05-01T12:00:00.000Z",
  lastModifiedDate: "2026-05-01T12:00:00.000Z",
};

async function runIntelligencePipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["imageIntelligenceFoundation"]>,
  sample: ImageAnalysisEngineInput,
  opts?: { industry?: string; marketingGoal?: ImageUnderstandingMarketingGoal; platform?: ImageUnderstandingPlatform }
): Promise<void> {
  const imageId = sample.imageId!;
  await foundation.getImageAnalysisEngine().analyzeImage(sample);
  await foundation.getImageUnderstandingEngine().understandImage({
    imageId,
    industry: opts?.industry,
    marketingGoal: opts?.marketingGoal,
    platform: opts?.platform,
  });
  await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId });
  await foundation.getBackgroundIntelligenceEngine().analyzeBackground({ imageId });
  await foundation.getCompositionIntelligenceEngine().analyzeComposition({ imageId });
  await foundation.getLightingColorIntelligenceEngine().analyzeLightingColor({ imageId });
  await foundation.getBrandVisualIntelligenceEngine().analyzeBrandVisual({
    imageId,
    brandName: sample.brand,
    industry: opts?.industry,
  });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 6I Image Enhancement Planning Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-6i-validation");

    const foundation = core.getManager().imageIntelligenceFoundation!;
    const engine = foundation.getImageEnhancementPlanningEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Image Enhancement Planning Engine operational",
    };

    await runIntelligencePipeline(foundation, SAMPLE_PRODUCT, {
      industry: "technology",
      marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
      platform: ImageUnderstandingPlatform.Ecommerce,
    });

    const planStart = Date.now();
    const product = await engine.planEnhancement({
      imageId: "step6i-kwizera-pro-hero",
      projectId: "step6i-validation",
      platform: EnhancementPlatform.Website,
      enhancementTypes: [EnhancementPlanType.Quality, EnhancementPlanType.Optimization],
    });
    const planMs = Date.now() - planStart;

    results.enhancementPlanning = {
      passed: product.success && Boolean(product.record?.profile.enhancementPlanId),
      detail: `Plan ${product.record?.profile.enhancementPlanId} in ${planMs}ms, readiness ${product.record?.scores.enhancementReadinessScore}`,
    };

    results.qualityAnalysis = {
      passed:
        (product.record?.qualityAnalysis.sharpness ?? 0) >= 50 &&
        (product.record?.qualityAnalysis.visualClarity ?? 0) >= 50,
      detail: `Sharpness ${product.record?.qualityAnalysis.sharpness}, clarity ${product.record?.qualityAnalysis.visualClarity}, resolution ${product.record?.qualityAnalysis.resolutionQuality}`,
    };

    results.restorationPlanning = {
      passed: Boolean(product.record?.restorationPlan.qualityRecovery),
      detail: product.record?.restorationPlan.artifactReduction?.slice(0, 50) ?? "n/a",
    };

    results.backgroundPlanning = {
      passed: Boolean(product.record?.backgroundPlan.backgroundIsolationPreparation),
      detail: product.record?.backgroundPlan.backgroundHarmonization?.slice(0, 50) ?? "n/a",
    };

    results.nonDestructive = {
      passed: product.record?.nonDestructive === true,
      detail: "Plan marked non-destructive — original preserved",
    };

    results.qualityScores = {
      passed:
        (product.record?.scores.enhancementReadinessScore ?? 0) >= 55 &&
        (product.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Readiness ${product.record?.scores.enhancementReadinessScore}, quality ${product.record?.scores.imageQualityScore}, confidence ${product.record?.scores.aiConfidenceScore}`,
    };

    results.recommendationReadiness = {
      passed: (product.record?.recommendations.length ?? 0) >= 2,
      detail: `${product.record?.recommendations.length} recommendation(s) generated`,
    };

    await runIntelligencePipeline(foundation, SAMPLE_LIFESTYLE, { industry: "fashion" });
    await runIntelligencePipeline(foundation, SAMPLE_BANNER, {
      industry: "beauty",
      marketingGoal: ImageUnderstandingMarketingGoal.Awareness,
    });

    const lifestyle = await engine.planEnhancement({
      imageId: "step6i-kwizera-lifestyle",
      platform: EnhancementPlatform.Instagram,
    });
    const banner = await engine.planEnhancement({
      imageId: "step6i-glowlab-banner",
      platform: EnhancementPlatform.TikTok,
    });

    results.multiImagePlanning = {
      passed: lifestyle.success && banner.success,
      detail: `Lifestyle Instagram ${lifestyle.record?.scores.platformReadinessScore}, Banner TikTok ${banner.record?.scores.platformReadinessScore}`,
    };

    results.relationshipDetection = {
      passed: (lifestyle.record?.relationships.relatedImages.length ?? 0) >= 1,
      detail: `Lifestyle linked to ${lifestyle.record?.relationships.relatedImages.length} related image(s)`,
    };

    const noPipeline = await engine.planEnhancement({ imageId: "step6i-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without upstream intelligence",
    };

    const repaired = await engine.repairEnhancementPlan("step6i-kwizera-lifestyle");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Enhancement plan repair pipeline verified" : "Repair failed",
    };

    const productSearch = engine.searchEnhancementPlans({ product: "KWIZERA" });
    results.search = {
      passed: productSearch.length >= 2,
      detail: `${productSearch.length} result(s) by product`,
    };

    const platformSearch = engine.searchEnhancementPlans({ platform: EnhancementPlatform.Website });
    results.platformSearch = {
      passed: platformSearch.length >= 1,
      detail: `${platformSearch.length} result(s) by platform`,
    };

    const qualitySearch = engine.searchEnhancementPlans({ minQualityScore: 70 });
    results.qualityScoreSearch = {
      passed: qualitySearch.length >= 2,
      detail: `${qualitySearch.length} result(s) with quality >= 70`,
    };

    const relationships = engine.detectRelationships("step6i-kwizera-pro-hero");
    results.relationshipUpdate = {
      passed: Boolean(relationships?.relatedLightingIntelligence.length),
      detail: `${relationships?.relatedLightingIntelligence.length ?? 0} lighting intelligence link(s)`,
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
    const logFile = path.join(storageRoot, "logs", `image-enhancement-planning-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };
    results.performance = {
      passed: status.performance.averagePlanningMs < 120000,
      detail: `avg planning ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
    };
    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const registered = foundation.getRegistry().getModule("image-enhancement-planning");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}`,
    };

    await core.stop("step-6i-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Image-Enhancement-Report.md"),
      buildEnhancementReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Image-Restoration-Report.md"),
      buildRestorationReport(product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Image-Quality-Improvement-Report.md"),
      buildQualityReport(product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Enhancement-Readiness-Report.md"),
      buildReadinessReport(status, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-6I-VALIDATION-REPORT.md"),
      buildEnhancementReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record),
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

function buildEnhancementReport(
  status: ImageEnhancementPlanningEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  product?: ImageEnhancementPlanningRecord,
  lifestyle?: ImageEnhancementPlanningRecord,
  banner?: ImageEnhancementPlanningRecord
): string {
  return [
    "# Image Enhancement Report — Step 6I",
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
    "## Enhancement Plans",
    "",
    `- Product: ${product?.profile.platform ?? "n/a"} — readiness ${product?.scores.enhancementReadinessScore ?? 0}/100`,
    `- Lifestyle: ${lifestyle?.profile.platform ?? "n/a"} — readiness ${lifestyle?.scores.enhancementReadinessScore ?? 0}/100`,
    `- Banner: ${banner?.profile.platform ?? "n/a"} — readiness ${banner?.scores.enhancementReadinessScore ?? 0}/100`,
    "",
    `Plans created: ${status.plansCreated}`,
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 6I Image Enhancement Planning Engine validation complete. Awaiting user approval before Step 6J.",
    "",
  ].join("\n");
}

function buildRestorationReport(
  product?: ImageEnhancementPlanningRecord,
  lifestyle?: ImageEnhancementPlanningRecord,
  banner?: ImageEnhancementPlanningRecord
): string {
  const rows = [product, lifestyle, banner].filter(Boolean) as ImageEnhancementPlanningRecord[];
  return [
    "# Image Restoration Report — Step 6I",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Image | Scratch | Dust | Artifacts | Blur | Quality Recovery | Restoration Score |",
    "|-------|---------|------|-----------|------|------------------|-------------------|",
    ...rows.map(
      (r) =>
        `| ${r.imageId} | ${r.restorationPlan.scratchRemoval.slice(0, 25)}... | ${r.restorationPlan.dustRemoval.slice(0, 20)}... | ${r.restorationPlan.artifactReduction.slice(0, 25)}... | ${r.restorationPlan.blurReduction.slice(0, 20)}... | ${r.restorationPlan.qualityRecovery.slice(0, 30)}... | ${r.scores.restorationScore} |`
    ),
    "",
  ].join("\n");
}

function buildQualityReport(
  product?: ImageEnhancementPlanningRecord,
  lifestyle?: ImageEnhancementPlanningRecord,
  banner?: ImageEnhancementPlanningRecord
): string {
  const rows = [product, lifestyle, banner].filter(Boolean) as ImageEnhancementPlanningRecord[];
  return [
    "# Image Quality Improvement Report — Step 6I",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Image | Resolution | Sharpness | Noise | Clarity | Exposure | Quality Score |",
    "|-------|------------|-----------|-------|---------|----------|---------------|",
    ...rows.map(
      (r) =>
        `| ${r.imageId} | ${r.qualityAnalysis.resolutionQuality} | ${r.qualityAnalysis.sharpness} | ${r.qualityAnalysis.noise} | ${r.qualityAnalysis.visualClarity} | ${r.qualityAnalysis.exposure} | ${r.scores.imageQualityScore} |`
    ),
    "",
    "## Planned Improvements",
    "",
    ...rows.map(
      (r) =>
        `- ${r.imageId}: ${r.enhancementPlan.sharpening.slice(0, 60)}...`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(status: ImageEnhancementPlanningEngineStatusReport, allPassed: boolean): string {
  return [
    "# Enhancement Readiness Report — Step 6I",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
    "",
    "## Readiness Scores",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Engine Readiness | ${status.readinessScore}/100 |`,
    `| Avg Enhancement Readiness | ${status.averageReadinessScore}/100 |`,
    `| Avg Quality Score | ${status.averageQualityScore}/100 |`,
    `| Plans Created | ${status.plansCreated} |`,
    `| Knowledge Bridge | ${status.knowledgeBridgeStatus} |`,
    `| Memory Bridge | ${status.memoryBridgeStatus} |`,
    `| Product Intelligence Bridge | ${status.productIntelligenceBridgeStatus} |`,
    "",
    "## Performance",
    "",
    `| Avg Planning | ${status.performance.averagePlanningMs}ms |`,
    `| Avg Search | ${status.performance.averageSearchMs}ms |`,
    `| Avg Relationship | ${status.performance.averageRelationshipMs}ms |`,
    "",
  ].join("\n");
}

void main();
