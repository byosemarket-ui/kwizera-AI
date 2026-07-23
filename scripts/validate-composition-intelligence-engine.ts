import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CompositionMarketingGoal,
  CompositionPlatform,
  CompositionType,
  createAiCore,
  ImageAnalysisType,
  ImageColorSpace,
  ImageCompressionType,
  ImageFileFormat,
  ImageUnderstandingMarketingGoal,
  ImageUnderstandingPlatform,
  type CompositionIntelligenceEngineStatusReport,
  type CompositionIntelligenceRecord,
} from "../ai/index.js";
import type { ImageAnalysisEngineInput } from "../ai/image-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-composition-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_PRODUCT: ImageAnalysisEngineInput = {
  imageId: "step6f-kwizera-pro-hero",
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
  imageId: "step6f-kwizera-lifestyle",
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
  visual: { brightness: 68, contrast: 72, sharpness: 80, dominantColors: ["#2d3436", "#636e72"] },
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
  imageId: "step6f-summer-banner",
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
  visual: { brightness: 75, contrast: 80, sharpness: 82, dominantColors: ["#ff6b6b", "#feca57"] },
  content: { background: "gradient-sunset", text: ["Summer Sale"], products: ["GlowLab Summer Kit"] },
  tags: ["banner", "validation"],
  keywords: ["summer", "campaign"],
};

async function runFullPipeline(
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
  await foundation.getObjectDetectionIntelligenceEngine().detectObjects({ imageId: sample.imageId! });
  await foundation.getBackgroundIntelligenceEngine().analyzeBackground({ imageId: sample.imageId! });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 6F Composition Intelligence Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-6f-validation");

    const foundation = core.getManager().imageIntelligenceFoundation!;
    const engine = foundation.getCompositionIntelligenceEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Composition Intelligence Engine operational",
    };

    await runFullPipeline(foundation, SAMPLE_PRODUCT, {
      industry: "technology",
      marketingGoal: ImageUnderstandingMarketingGoal.Conversion,
      platform: ImageUnderstandingPlatform.Ecommerce,
    });

    const analyzeStart = Date.now();
    const product = await engine.analyzeComposition({
      imageId: "step6f-kwizera-pro-hero",
      industry: "technology",
      marketingGoal: CompositionMarketingGoal.Conversion,
      platform: CompositionPlatform.Ecommerce,
    });
    const analyzeMs = Date.now() - analyzeStart;

    results.compositionAnalysis = {
      passed:
        product.success &&
        Boolean(product.record) &&
        product.record!.compositionAnalysis.compositionType === CompositionType.Center,
      detail: `${product.record?.compositionAnalysis.compositionType} analyzed in ${analyzeMs}ms, quality ${product.record?.scores.compositionQualityScore}`,
    };

    results.visualHierarchy = {
      passed:
        (product.record?.visualHierarchy.mainSubjectVisibility ?? 0) >= 70 &&
        Boolean(product.record?.visualHierarchy.readingFlow),
      detail: `Main subject ${product.record?.visualHierarchy.mainSubjectVisibility}, flow ${product.record?.visualHierarchy.readingFlow}`,
    };

    results.productPlacement = {
      passed:
        Boolean(product.record?.productPlacement.productPosition) &&
        (product.record?.productPlacement.productVisibility ?? 0) >= 50,
      detail: `Position ${product.record?.productPlacement.productPosition}, visibility ${product.record?.productPlacement.productVisibility}`,
    };

    results.improvementPlanning = {
      passed: Boolean(product.record?.improvementPlan.cropStrategy),
      detail: product.record?.improvementPlan.framingStrategy?.slice(0, 55) ?? "n/a",
    };

    results.qualityScores = {
      passed:
        (product.record?.scores.compositionQualityScore ?? 0) >= 55 &&
        (product.record?.scores.aiConfidenceScore ?? 0) >= 55 &&
        (product.record?.scores.visualHierarchyScore ?? 0) >= 50,
      detail: `Quality ${product.record?.scores.compositionQualityScore}, hierarchy ${product.record?.scores.visualHierarchyScore}, confidence ${product.record?.scores.aiConfidenceScore}`,
    };

    results.recommendationReadiness = {
      passed: (product.record?.recommendations.length ?? 0) >= 1,
      detail: `${product.record?.recommendations.length} recommendation(s) generated`,
    };

    await runFullPipeline(foundation, SAMPLE_LIFESTYLE, { industry: "fashion" });
    await runFullPipeline(foundation, SAMPLE_BANNER, {
      industry: "beauty",
      marketingGoal: ImageUnderstandingMarketingGoal.Awareness,
    });

    const lifestyle = await engine.analyzeComposition({
      imageId: "step6f-kwizera-lifestyle",
      industry: "fashion",
    });
    const banner = await engine.analyzeComposition({
      imageId: "step6f-summer-banner",
      industry: "beauty",
      marketingGoal: CompositionMarketingGoal.Awareness,
    });

    results.multiImageAnalysis = {
      passed:
        lifestyle.success &&
        banner.success &&
        lifestyle.record?.compositionAnalysis.compositionType === CompositionType.Asymmetry,
      detail: `Lifestyle ${lifestyle.record?.compositionAnalysis.compositionType}, Banner ${banner.record?.compositionAnalysis.compositionType}`,
    };

    results.relationshipDetection = {
      passed: (lifestyle.record?.relationships.relatedImages.length ?? 0) >= 1,
      detail: `Lifestyle linked to ${lifestyle.record?.relationships.relatedImages.length} related image(s)`,
    };

    const noPipeline = await engine.analyzeComposition({ imageId: "step6f-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without upstream intelligence",
    };

    const repaired = await engine.repairComposition("step6f-kwizera-lifestyle");
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Composition intelligence repair pipeline verified" : "Repair failed",
    };

    const typeSearch = engine.searchCompositions({ compositionType: CompositionType.Center });
    results.search = {
      passed: typeSearch.length >= 1,
      detail: `${typeSearch.length} result(s) by composition type`,
    };

    const productSearch = engine.searchCompositions({ product: "KWIZERA" });
    results.productSearch = {
      passed: productSearch.length >= 2,
      detail: `${productSearch.length} result(s) by product`,
    };

    const styleSearch = engine.searchCompositions({ creativeStyle: "commercial" });
    results.creativeStyleSearch = {
      passed: styleSearch.length >= 1,
      detail: `${styleSearch.length} result(s) by creative style`,
    };

    const relationships = engine.detectRelationships("step6f-kwizera-pro-hero");
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
    const logFile = path.join(storageRoot, "logs", `composition-intelligence-${logDate}.jsonl`);
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

    const registered = foundation.getRegistry().getModule("composition-intelligence");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}`,
    };

    await core.stop("step-6f-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "Composition-Analysis-Report.md"),
      buildAnalysisReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Visual-Hierarchy-Report.md"),
      buildHierarchyReport(product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Composition-Quality-Report.md"),
      buildQualityReport(product.record, lifestyle.record, banner.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Composition-Readiness-Report.md"),
      buildReadinessReport(status, allPassed),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-6F-VALIDATION-REPORT.md"),
      buildAnalysisReport(status, results, storageRoot, allPassed, product.record, lifestyle.record, banner.record),
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

function buildAnalysisReport(
  status: CompositionIntelligenceEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  product?: CompositionIntelligenceRecord,
  lifestyle?: CompositionIntelligenceRecord,
  banner?: CompositionIntelligenceRecord
): string {
  return [
    "# Composition Analysis Report — Step 6F",
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
    `- Product: ${product?.compositionAnalysis.compositionType ?? "n/a"} — quality ${product?.scores.compositionQualityScore ?? 0}/100`,
    `- Lifestyle: ${lifestyle?.compositionAnalysis.compositionType ?? "n/a"} — quality ${lifestyle?.scores.compositionQualityScore ?? 0}/100`,
    `- Banner: ${banner?.compositionAnalysis.compositionType ?? "n/a"} — quality ${banner?.scores.compositionQualityScore ?? 0}/100`,
    "",
    `Images analyzed: ${status.imagesAnalyzed}`,
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 6F Composition Intelligence Engine validation complete. Awaiting user approval before Step 6G.",
    "",
  ].join("\n");
}

function buildHierarchyReport(
  product?: CompositionIntelligenceRecord,
  lifestyle?: CompositionIntelligenceRecord,
  banner?: CompositionIntelligenceRecord
): string {
  const rows = [product, lifestyle, banner].filter(Boolean) as CompositionIntelligenceRecord[];
  return [
    "# Visual Hierarchy Report — Step 6F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Image | Main Subject | Secondary | Product Priority | Brand | CTA | Reading Flow |",
    "|-------|--------------|-----------|------------------|-------|-----|--------------|",
    ...rows.map(
      (r) =>
        `| ${r.imageId} | ${r.visualHierarchy.mainSubjectVisibility} | ${r.visualHierarchy.secondarySubjectVisibility} | ${r.visualHierarchy.productPriority} | ${r.visualHierarchy.brandVisibility} | ${r.visualHierarchy.ctaVisibility} | ${r.visualHierarchy.readingFlow} |`
    ),
    "",
    "## Hierarchy Scores",
    "",
    ...rows.map((r) => `- ${r.imageId}: ${r.scores.visualHierarchyScore}/100`),
    "",
  ].join("\n");
}

function buildQualityReport(
  product?: CompositionIntelligenceRecord,
  lifestyle?: CompositionIntelligenceRecord,
  banner?: CompositionIntelligenceRecord
): string {
  const rows = [product, lifestyle, banner].filter(Boolean) as CompositionIntelligenceRecord[];
  return [
    "# Composition Quality Report — Step 6F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Image | Type | Balance | Symmetry | Negative Space | Framing | Product Visibility |",
    "|-------|------|---------|----------|----------------|---------|-------------------|",
    ...rows.map(
      (r) =>
        `| ${r.imageId} | ${r.compositionAnalysis.compositionType} | ${r.compositionAnalysis.balance} | ${r.compositionAnalysis.symmetry} | ${r.compositionAnalysis.negativeSpace} | ${r.compositionAnalysis.framing} | ${r.productPlacement.productVisibility} |`
    ),
    "",
    "## Quality Scores",
    "",
    ...rows.map(
      (r) =>
        `- ${r.imageId}: composition ${r.scores.compositionQualityScore}/100, balance ${r.scores.visualBalanceScore}/100, marketing ${r.scores.marketingReadinessScore}/100`
    ),
    "",
  ].join("\n");
}

function buildReadinessReport(status: CompositionIntelligenceEngineStatusReport, allPassed: boolean): string {
  return [
    "# Composition Readiness Report — Step 6F",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
    "",
    "## Readiness Scores",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Engine Readiness | ${status.readinessScore}/100 |`,
    `| Avg Quality Score | ${status.averageQualityScore}/100 |`,
    `| Avg Hierarchy Score | ${status.averageHierarchyScore}/100 |`,
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
