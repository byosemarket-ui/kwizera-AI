import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALL_IMAGE_TO_IMAGE_PLATFORMS, ALL_PRESERVATION_RULES, ImageTransformationBackgroundType, createAiCore, CreativePlatform, ImageToImagePlatform, ImageTransformationStyle, MarketingObjective, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductImageType, ProductUnderstandingMarketingGoal, SourceImageCategory, TextToImagePlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-image-to-image-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step9c-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI-powered creative workstation for brand-consistent image transformation",
    features: ["AI image transformation", "identity preservation", "multi-platform export"],
    specifications: { license: "pro" },
    materials: ["digital-license"],
    price: 299.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "technology",
    businessType: ProductBusinessType.B2B,
    tags: ["software", "validation"],
    keywords: ["AI studio", "kwizera"],
};
const SAMPLE_FASHION = {
    productId: "step9c-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    subcategory: "outerwear",
    brand: "KWIZERA",
    description: "Premium urban jacket for style transformation workflows",
    features: ["water-resistant", "breathable"],
    specifications: { fabric: "cotton-blend" },
    materials: ["cotton"],
    price: 129.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "fashion",
    businessType: ProductBusinessType.D2C,
    tags: ["fashion"],
    keywords: ["jacket"],
};
const SAMPLE_BEAUTY = {
    productId: "step9c-glow-serum",
    productName: "Radiance Vitamin C Serum",
    category: ProductAnalysisCategory.Beauty,
    subcategory: "skincare",
    brand: "GlowLab",
    description: "Clinical-grade vitamin C serum for product image transformation",
    features: ["vitamin-c", "anti-aging"],
    specifications: { volume: "30ml" },
    materials: ["glass-bottle"],
    price: 45.0,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "beauty",
    tags: ["beauty"],
    keywords: ["serum"],
};
async function prepareFullPipeline(foundation, sample, objective, platform) {
    await foundation.getProductAnalysisEngine().analyzeProduct(sample);
    await foundation.getProductUnderstandingEngine().understandProduct({
        productId: sample.productId,
        marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
    });
    await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
        productId: sample.productId,
    });
    await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
        productId: sample.productId,
        marketingObjective: objective,
    });
    await foundation.getCreativeDirectionEngine().planCreativeDirection({
        productId: sample.productId,
        platform,
    });
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 9C Image-to-Image Generation Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("Project state:", projectStateDir);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({
            storageRootOverride: storageRoot,
            skipPlanningEngine: true,
            skipWorkflowEngine: true,
            skipTaskManager: true,
        });
        const initStart = Date.now();
        await core.start("step-9c-validation");
        const initMs = Date.now() - initStart;
        const imgFoundation = core.getManager().imageGenerationFoundation;
        const ttiEngine = imgFoundation.getTextToImageGenerationEngine();
        const engine = imgFoundation.getImageToImageGenerationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete()
                ? `Image-to-Image Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = imgFoundation.getRegistry().getModule("image-to-image-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.Website);
        await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
        await prepareFullPipeline(piFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);
        const techSource = await ttiEngine.generateImagePlan({
            productId: "step9c-kwizera-pro",
            platform: TextToImagePlatform.Website,
            productImageType: ProductImageType.HeroImage,
            textPrompt: "Hero product image for transformation testing",
        });
        const fashionSource = await ttiEngine.generateImagePlan({
            productId: "step9c-kwizera-jacket",
            platform: TextToImagePlatform.Instagram,
            productImageType: ProductImageType.LifestyleImage,
        });
        const beautySource = await ttiEngine.generateImagePlan({
            productId: "step9c-glow-serum",
            platform: TextToImagePlatform.TikTok,
            productImageType: ProductImageType.ProductShowcase,
        });
        results.sourceImagePreparation = {
            passed: techSource.success && fashionSource.success && beautySource.success,
            detail: `Source plans: Tech ${techSource.success ? "✓" : "✗"}, Fashion ${fashionSource.success ? "✓" : "✗"}, Beauty ${beautySource.success ? "✓" : "✗"}`,
        };
        const tech = await engine.generateTransformationPlan({
            sourceImageId: techSource.record.imagePlanId,
            textToImagePlanId: techSource.record.imagePlanId,
            productId: "step9c-kwizera-pro",
            platform: ImageToImagePlatform.Website,
            targetStyle: ImageTransformationStyle.Corporate,
            targetBackground: ImageTransformationBackgroundType.Studio,
            transformationPrompt: "Transform to corporate style with studio background while preserving product identity",
            generatePlatformOptimizations: true,
            generateVariations: true,
        });
        const fashion = await engine.generateTransformationPlan({
            sourceImageId: fashionSource.record.imagePlanId,
            productId: "step9c-kwizera-jacket",
            platform: ImageToImagePlatform.Instagram,
            targetStyle: ImageTransformationStyle.Fashion,
            targetBackground: ImageTransformationBackgroundType.Lifestyle,
            transformationPrompt: "Apply fashion style transfer with lifestyle background replacement",
            generateVariations: true,
        });
        const beauty = await engine.generateTransformationPlan({
            sourceImageId: beautySource.record.imagePlanId,
            productId: "step9c-glow-serum",
            platform: ImageToImagePlatform.Packaging,
            targetStyle: ImageTransformationStyle.Luxury,
            targetBackground: ImageTransformationBackgroundType.White,
            transformationPrompt: "Luxury product transformation with white background for packaging",
            generateVariations: true,
        });
        results.transformationGeneration = {
            passed: tech.success && fashion.success && beauty.success,
            detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Beauty ${beauty.success ? "✓" : "✗"}`,
        };
        results.sourceImageAnalysis = {
            passed: Boolean(tech.record?.sourceAnalysis.subject &&
                tech.record?.sourceAnalysis.background &&
                tech.record?.sourceAnalysis.composition &&
                tech.record?.sourceAnalysis.resolution),
            detail: `Subject: ${tech.record?.sourceAnalysis.subject.slice(0, 40)}..., quality: ${tech.record?.sourceAnalysis.imageQuality}`,
        };
        results.transformationPlanning = {
            passed: (tech.record?.transformationPlan.steps.length ?? 0) >= 2,
            detail: `${tech.record?.transformationPlan.steps.length} transformation steps planned`,
        };
        results.preservationRules = {
            passed: (tech.record?.preservationPlan.rules.length ?? 0) === ALL_PRESERVATION_RULES.length,
            detail: `${tech.record?.preservationPlan.rules.length}/${ALL_PRESERVATION_RULES.length} preservation rules, identityLock: ${tech.record?.preservationPlan.identityLock}`,
        };
        results.maskPlanning = {
            passed: (tech.record?.maskPlan.masks.length ?? 0) >= 5 &&
                Boolean(tech.record?.maskPlan.foregroundMaskId) &&
                Boolean(tech.record?.maskPlan.backgroundMaskId),
            detail: `${tech.record?.maskPlan.masks.length} masks, protected: ${tech.record?.maskPlan.protectedRegions.length}`,
        };
        results.backgroundPlanning = {
            passed: Boolean(tech.record?.backgroundPlan.description &&
                tech.record?.backgroundPlan.replacementStrategy &&
                beauty.record?.backgroundPlan.backgroundType === ImageTransformationBackgroundType.White),
            detail: `Tech: ${tech.record?.backgroundPlan.backgroundType}, Beauty: ${beauty.record?.backgroundPlan.backgroundType}`,
        };
        results.platformOptimization = {
            passed: (tech.record?.platformOptimizations.length ?? 0) === ALL_IMAGE_TO_IMAGE_PLATFORMS.length,
            detail: `${tech.record?.platformOptimizations.length}/${ALL_IMAGE_TO_IMAGE_PLATFORMS.length} platform profiles`,
        };
        results.variations = {
            passed: (tech.record?.variations.length ?? 0) >= 3,
            detail: `${tech.record?.variations.length} output variations`,
        };
        results.transformationScores = {
            passed: (tech.record?.scores.transformationQualityScore ?? 0) >= 55 &&
                (tech.record?.scores.identityPreservationScore ?? 0) >= 55 &&
                (tech.record?.scores.styleConsistencyScore ?? 0) >= 50 &&
                (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
                (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Transform ${tech.record?.scores.transformationQualityScore}, identity ${tech.record?.scores.identityPreservationScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.identityPreservation = {
            passed: (tech.record?.scores.identityPreservationScore ?? 0) >= 55 && tech.record?.preservationPlan.identityLock === true,
            detail: `Identity score ${tech.record?.scores.identityPreservationScore}, lock enabled`,
        };
        results.relationships = {
            passed: (tech.record?.relationships.sourceImages.length ?? 0) >= 1 &&
                (tech.record?.relationships.generatedImages.length ?? 0) >= 1 &&
                (tech.record?.relationships.textToImagePlans.length ?? 0) >= 1,
            detail: `Sources ${tech.record?.relationships.sourceImages.length}, generated ${tech.record?.relationships.generatedImages.length}, TTI plans ${tech.record?.relationships.textToImagePlans.length}`,
        };
        results.productionReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
        };
        results.brandConsistency = {
            passed: tech.record?.brandConsistent === true,
            detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
        };
        const metadataOnly = await engine.generateTransformationPlan({
            sourceImageMetadata: {
                imageId: "step9c-metadata-source",
                category: SourceImageCategory.Portrait,
                subject: "Professional portrait for style transfer validation",
                resolution: "1080x1080",
                width: 1080,
                height: 1080,
                format: "blueprint",
                qualityScore: 82,
            },
            transformationPrompt: "Apply watercolor style transfer preserving facial identity",
            targetStyle: ImageTransformationStyle.Watercolor,
            platform: ImageToImagePlatform.Instagram,
        });
        results.metadataSourceGeneration = {
            passed: metadataOnly.success,
            detail: metadataOnly.success ? "Metadata-only source transformation generated" : metadataOnly.message ?? "Failed",
        };
        const noSource = await engine.generateTransformationPlan({ productId: "step9c-nonexistent" });
        results.incompleteRejection = {
            passed: !noSource.success,
            detail: noSource.message ?? "Rejected without source image",
        };
        const repaired = await engine.repairTransformationPlan(techSource.record.imagePlanId, ImageToImagePlatform.Facebook);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Transformation repair pipeline verified" : "Repair failed",
        };
        const sourceSearch = engine.searchTransformationPlans({ sourceImageId: techSource.record.imagePlanId });
        results.searchBySourceImage = {
            passed: sourceSearch.length >= 1,
            detail: `${sourceSearch.length} result(s) by source image`,
        };
        const generatedSearch = engine.searchTransformationPlans({ generatedImageId: tech.record.profile.generatedImageId });
        results.searchByGeneratedImage = {
            passed: generatedSearch.length >= 1,
            detail: `${generatedSearch.length} result(s) by generated image`,
        };
        const platformSearch = engine.searchTransformationPlans({ platform: ImageToImagePlatform.Packaging });
        results.searchByPlatform = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const styleSearch = engine.searchTransformationPlans({ style: ImageTransformationStyle.Luxury });
        results.searchByStyle = {
            passed: styleSearch.length >= 1,
            detail: `${styleSearch.length} result(s) by style`,
        };
        const keywordSearch = engine.searchTransformationPlans({ keywords: "product" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const maskAsset = imgFoundation.getAssetRegistry().getAsset(tech.record.maskPlan.foregroundMaskId);
        results.generationAssetRegistration = {
            passed: maskAsset?.assetType === "mask",
            detail: `Mask asset ${maskAsset?.assetId}, generated ${tech.record.profile.generatedImageId}`,
        };
        const blueprint = imgFoundation.getBlueprintManager().getBlueprint(tech.record.blueprintId);
        results.blueprintLink = {
            passed: Boolean(blueprint?.blueprintId),
            detail: blueprint ? `Blueprint ${blueprint.blueprintId} linked` : "Not found",
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageGenerationMs < 120000,
            detail: `avg generation ${status.performance.averageGenerationMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `image-to-image-generation-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        results.multiCategory = {
            passed: fashion.success && beauty.success,
            detail: `Fashion ${fashion.record?.profile.targetStyle}, Beauty ${beauty.record?.profile.targetStyle}`,
        };
        results.recommendations = {
            passed: (tech.record?.recommendations.length ?? 0) >= 1,
            detail: `${tech.record?.recommendations.length} recommendation(s)`,
        };
        await core.stop("step-9c-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Image-to-Image-Report.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Source-Image-Analysis-Report.md"), buildSourceAnalysisReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Transformation-Planning-Report.md"), buildTransformationReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Mask-Planning-Report.md"), buildMaskReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Image-to-Image-Readiness-Report.md"), buildReadinessReport(status, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-9C-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Image-to-Image-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Source-Image-Analysis-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Transformation-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Mask-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Image-to-Image-Readiness-Report.md")}`);
        if (useTemp && fs.existsSync(storageRoot)) {
            fs.rmSync(storageRoot, { recursive: true, force: true });
        }
        process.exit(allPassed ? 0 : 1);
    }
    catch (error) {
        console.error("Validation failed:", error);
        process.exit(1);
    }
}
function buildMainReport(status, results, storageRoot, allPassed, tech, fashion, beauty) {
    return [
        "# KWIZERA AI STUDIO — Phase 9 Step 9C Image-to-Image Generation Report",
        "",
        `**Phase:** 9 — Image Generation Engine`,
        `**Step:** 9C — AI Image-to-Image Generation Engine`,
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
        `| **Transformation Plans** | ${status.transformationPlansGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Generated Transformation Plans",
        "",
        `- Technology: ${tech?.profile.targetStyle ?? "n/a"} (${tech?.scores.transformationQualityScore ?? 0}/100)`,
        `- Fashion: ${fashion?.profile.targetStyle ?? "n/a"} (${fashion?.scores.transformationQualityScore ?? 0}/100)`,
        `- Beauty: ${beauty?.profile.targetStyle ?? "n/a"} (${beauty?.scores.transformationQualityScore ?? 0}/100)`,
        "",
    ].join("\n");
}
function buildSourceAnalysisReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Source Image Analysis Report — Step 9C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Subject | Background | Quality | Resolution | Identity Score |",
        "|---------|---------|------------|---------|------------|----------------|",
    ];
    for (const record of rows) {
        lines.push(`| ${record.profile.productId} | ${record.sourceAnalysis.subject.slice(0, 25)}... | ${record.sourceAnalysis.background.slice(0, 20)}... | ${record.sourceAnalysis.imageQuality} | ${record.sourceAnalysis.resolution} | ${record.scores.identityPreservationScore}/100 |`);
    }
    return lines.join("\n");
}
function buildTransformationReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Transformation Planning Report — Step 9C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        lines.push(`## ${record.profile.productId} — ${record.transformationPlan.steps.length} steps`, "");
        lines.push("| Priority | Type | Description |", "|----------|------|-------------|");
        for (const step of record.transformationPlan.steps) {
            lines.push(`| ${step.priority} | ${step.type} | ${step.description.slice(0, 50)}... |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildMaskReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Mask Planning Report — Step 9C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        lines.push(`## ${record.profile.productId} — ${record.maskPlan.masks.length} masks`, "");
        lines.push("| Mask | Type | Editable | Protected | Region |", "|------|------|----------|-----------|--------|");
        for (const mask of record.maskPlan.masks) {
            lines.push(`| ${mask.maskId.slice(-12)} | ${mask.maskType} | ${mask.editable ? "✅" : "❌"} | ${mask.protected ? "✅" : "❌"} | ${mask.region.slice(0, 30)}... |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Image-to-Image Readiness Report — Step 9C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Product | Transform | Identity | Style | Brand | Production | Confidence | Ready |",
        "|---------|-----------|----------|-------|-------|------------|------------|-------|",
        ...rows.map((r) => `| ${r.profile.productId} | ${r.scores.transformationQualityScore} | ${r.scores.identityPreservationScore} | ${r.scores.styleConsistencyScore} | ${r.scores.brandConsistencyScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`),
        "",
        "## Performance",
        "",
        `- Average generation: ${status.performance.averageGenerationMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        `- Preservation: ${status.preservationStatus}`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-image-to-image-generation-engine.js.map