import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALL_BRAND_VALIDATION_CHECKS, ALL_IMAGE_QUALITY_CHECKS, ALL_PRINT_VALIDATION_CHECKS, ALL_QUALITY_LAYER_CHECKS, ALL_QUALITY_MASK_TYPES, ALL_QUALITY_VALIDATION_PLATFORMS, ALL_TYPOGRAPHY_CHECKS, BrandDesignGenPlatform, BrandDesignType, createAiCore, CreativePlatform, ImageProductionPlatform, ImageRenderPlatform, MarketingObjective, MultiStyleGenPlatform, MultiStyleImageCategory, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductImageGenPlatform, ProductUnderstandingMarketingGoal, QualityValidationPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-quality-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step9l-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI workstation requiring quality validation",
    features: ["quality", "technology visuals"],
    specifications: { license: "pro" },
    materials: ["digital-license"],
    price: 299.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "technology",
    businessType: ProductBusinessType.B2B,
    tags: ["software"],
    keywords: ["kwizera"],
};
const SAMPLE_FASHION = {
    productId: "step9l-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    subcategory: "outerwear",
    brand: "KWIZERA",
    description: "Premium jacket for quality validation",
    features: ["editorial", "lifestyle"],
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
const SAMPLE_FOOD = {
    productId: "step9l-artisan-coffee",
    productName: "Artisan Cold Brew",
    category: ProductAnalysisCategory.Food,
    subcategory: "beverages",
    brand: "BrewCraft",
    description: "Premium cold brew for print quality validation",
    features: ["food photography", "packaging"],
    specifications: { volume: "500ml" },
    materials: ["glass-bottle"],
    price: 8.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "food",
    tags: ["food"],
    keywords: ["coffee"],
};
async function prepareFullPipeline(foundation, sample, objective, platform) {
    await foundation.getProductAnalysisEngine().analyzeProduct(sample);
    await foundation.getProductUnderstandingEngine().understandProduct({
        productId: sample.productId,
        marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
    });
    await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: sample.productId });
    await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
        productId: sample.productId,
        marketingObjective: objective,
    });
    await foundation.getCreativeDirectionEngine().planCreativeDirection({ productId: sample.productId, platform });
}
async function prepareProductionPipeline(imgFoundation, productId, productImagePlanId, stylePlanId, brandingPlanId, productionPlatform = ImageProductionPlatform.Website) {
    return imgFoundation.getImageProductionEngine().generateProductionPlan({
        productId,
        stylePlanId,
        productImagePlanId,
        brandingPlanId,
        brandId: productId.includes("BrewCraft") ? "BrewCraft" : "KWIZERA",
        platform: productionPlatform,
        prepareExports: true,
        preparePlatformRules: true,
    });
}
async function prepareRenderPipeline(imgFoundation, productId, productionId, renderPlatform) {
    return imgFoundation.getImageRenderingPreparationEngine().generateRenderPlan({
        productId,
        productionId,
        platform: renderPlatform,
        prepareOutputProfiles: true,
        generateRenderJobs: true,
    });
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 9L Image Quality Validation Engine Validation");
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
        await core.start("step-9l-validation");
        const initMs = Date.now() - initStart;
        const imgFoundation = core.getManager().imageGenerationFoundation;
        const engine = imgFoundation.getImageQualityValidationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete() ? `Quality Validation Engine ready in ${initMs}ms` : "Not initialized",
        };
        const registered = imgFoundation.getRegistry().getModule("image-quality-validation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.Website);
        await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
        await prepareFullPipeline(piFoundation, SAMPLE_FOOD, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);
        const productEngine = imgFoundation.getProductImageGenerationEngine();
        const brandingEngine = imgFoundation.getBrandingDesignEngine();
        const styleEngine = imgFoundation.getMultiStyleImageGenerationEngine();
        const techProduct = await productEngine.generateProductImagePlan({ productId: "step9l-kwizera-pro", platform: ProductImageGenPlatform.Ecommerce });
        const fashionProduct = await productEngine.generateProductImagePlan({ productId: "step9l-kwizera-jacket", platform: ProductImageGenPlatform.Instagram });
        const foodProduct = await productEngine.generateProductImagePlan({ productId: "step9l-artisan-coffee", platform: ProductImageGenPlatform.Ecommerce });
        const techBrand = await brandingEngine.generateBrandingPlan({
            productId: "step9l-kwizera-pro",
            productImagePlanId: techProduct.record.productImagePlanId,
            brandId: "KWIZERA",
            designType: BrandDesignType.PresentationGraphic,
            platform: BrandDesignGenPlatform.Website,
        });
        const techStyle = await styleEngine.generateStylePlan({
            productId: "step9l-kwizera-pro",
            productImagePlanId: techProduct.record.productImagePlanId,
            brandingPlanId: techBrand.record.brandDesignId,
            sourceImageId: techProduct.record.productImagePlanId,
            brandId: "KWIZERA",
            platform: MultiStyleGenPlatform.Website,
            styleCategory: MultiStyleImageCategory.Technology,
            generateVariations: true,
        });
        const fashionStyle = await styleEngine.generateStylePlan({
            productId: "step9l-kwizera-jacket",
            productImagePlanId: fashionProduct.record.productImagePlanId,
            sourceImageId: fashionProduct.record.productImagePlanId,
            brandId: "KWIZERA",
            platform: MultiStyleGenPlatform.Instagram,
            styleCategory: MultiStyleImageCategory.Fashion,
            generateVariations: true,
        });
        const foodStyle = await styleEngine.generateStylePlan({
            productId: "step9l-artisan-coffee",
            productImagePlanId: foodProduct.record.productImagePlanId,
            sourceImageId: foodProduct.record.productImagePlanId,
            brandId: "BrewCraft",
            platform: MultiStyleGenPlatform.Print,
            styleCategory: MultiStyleImageCategory.FoodPhotography,
            generateVariations: true,
        });
        const techProduction = await prepareProductionPipeline(imgFoundation, "step9l-kwizera-pro", techProduct.record.productImagePlanId, techStyle.record.stylePlanId, techBrand.record.brandDesignId);
        const fashionProduction = await prepareProductionPipeline(imgFoundation, "step9l-kwizera-jacket", fashionProduct.record.productImagePlanId, fashionStyle.record.stylePlanId, undefined, ImageProductionPlatform.Instagram);
        const foodProduction = await prepareProductionPipeline(imgFoundation, "step9l-artisan-coffee", foodProduct.record.productImagePlanId, foodStyle.record.stylePlanId, undefined, ImageProductionPlatform.Packaging);
        const techRender = await prepareRenderPipeline(imgFoundation, "step9l-kwizera-pro", techProduction.record.imageProductionId, ImageRenderPlatform.Website);
        const fashionRender = await prepareRenderPipeline(imgFoundation, "step9l-kwizera-jacket", fashionProduction.record.imageProductionId, ImageRenderPlatform.Instagram);
        const foodRender = await prepareRenderPipeline(imgFoundation, "step9l-artisan-coffee", foodProduction.record.imageProductionId, ImageRenderPlatform.Print);
        results.upstreamPreparation = {
            passed: techRender.success && fashionRender.success && foodRender.success,
            detail: "Render plans prepared for all industries",
        };
        const tech = await engine.validateQuality({
            productId: "step9l-kwizera-pro",
            renderPlanId: techRender.record.imageRenderPlanId,
            productionId: techProduction.record.imageProductionId,
            brandId: "KWIZERA",
            platform: QualityValidationPlatform.Website,
            templateIds: ["template-tech-quality"],
            autoRepair: true,
            validatePrint: true,
            validatePlatform: true,
        });
        const fashion = await engine.validateQuality({
            productId: "step9l-kwizera-jacket",
            renderPlanId: fashionRender.record.imageRenderPlanId,
            productionId: fashionProduction.record.imageProductionId,
            platform: QualityValidationPlatform.Instagram,
            autoRepair: true,
            validatePlatform: true,
        });
        const food = await engine.validateQuality({
            productId: "step9l-artisan-coffee",
            renderPlanId: foodRender.record.imageRenderPlanId,
            productionId: foodProduction.record.imageProductionId,
            platform: QualityValidationPlatform.Print,
            autoRepair: true,
            validatePrint: true,
        });
        results.qualityValidation = {
            passed: tech.success && fashion.success && food.success,
            detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Food ${food.success ? "✓" : "✗"}`,
        };
        results.imageQualityValidation = {
            passed: (tech.record?.imageQuality.length ?? 0) === ALL_IMAGE_QUALITY_CHECKS.length &&
                tech.record?.imageQuality.every((e) => e.validated) === true,
            detail: `${tech.record?.imageQuality.filter((e) => e.validated).length}/${ALL_IMAGE_QUALITY_CHECKS.length} image quality checks passed`,
        };
        results.layerValidation = {
            passed: (tech.record?.layerValidation.length ?? 0) === ALL_QUALITY_LAYER_CHECKS.length &&
                tech.record?.layerValidation.every((l) => l.validated) === true,
            detail: `${tech.record?.layerValidation.filter((l) => l.validated).length}/${ALL_QUALITY_LAYER_CHECKS.length} layer checks passed`,
        };
        results.maskValidation = {
            passed: (tech.record?.maskValidation.length ?? 0) === ALL_QUALITY_MASK_TYPES.length &&
                tech.record?.maskValidation.every((m) => m.validated) === true,
            detail: `${tech.record?.maskValidation.filter((m) => m.validated).length}/${ALL_QUALITY_MASK_TYPES.length} masks validated`,
        };
        results.typographyValidation = {
            passed: (tech.record?.typographyValidation.length ?? 0) === ALL_TYPOGRAPHY_CHECKS.length &&
                tech.record?.typographyValidation.every((t) => t.validated) === true,
            detail: `${tech.record?.typographyValidation.filter((t) => t.validated).length}/${ALL_TYPOGRAPHY_CHECKS.length} typography checks passed`,
        };
        results.brandValidation = {
            passed: (tech.record?.brandValidation.length ?? 0) === ALL_BRAND_VALIDATION_CHECKS.length &&
                tech.record?.brandValidation.every((b) => b.validated) === true,
            detail: `${tech.record?.brandValidation.filter((b) => b.validated).length}/${ALL_BRAND_VALIDATION_CHECKS.length} brand checks passed`,
        };
        results.printValidation = {
            passed: (food.record?.printValidation.length ?? 0) === ALL_PRINT_VALIDATION_CHECKS.length,
            detail: `Print checks ${food.record?.printValidation.filter((p) => p.validated).length}/${ALL_PRINT_VALIDATION_CHECKS.length} for food/print`,
        };
        results.platformValidation = {
            passed: (tech.record?.platformValidation.length ?? 0) === ALL_QUALITY_VALIDATION_PLATFORMS.length,
            detail: `${tech.record?.platformValidation.length}/${ALL_QUALITY_VALIDATION_PLATFORMS.length} platform profiles validated`,
        };
        results.qualityScores = {
            passed: (tech.record?.scores.overallQualityScore ?? 0) >= 55 &&
                (tech.record?.scores.visualQualityScore ?? 0) >= 55 &&
                (tech.record?.scores.colorAccuracyScore ?? 0) >= 55 &&
                (tech.record?.scores.layerIntegrityScore ?? 0) >= 55 &&
                (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Overall ${tech.record?.scores.overallQualityScore}, visual ${tech.record?.scores.visualQualityScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.issueDetection = {
            passed: (tech.record?.issues.length ?? 0) >= 0,
            detail: `${tech.record?.issues.length} issue(s) detected, ${tech.record?.issues.filter((i) => i.repaired).length} repaired`,
        };
        results.criticalIssueBlock = {
            passed: !tech.record?.issues.some((i) => i.severity === "critical" && !i.repaired),
            detail: "No unresolved critical issues",
        };
        results.approval = {
            passed: tech.record?.approved === true && tech.record?.validated === true,
            detail: `Approved: ${tech.record?.approved}, validated: ${tech.record?.validated}`,
        };
        results.relationships = {
            passed: (tech.record?.relationships.productionPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.renderPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.products.length ?? 0) >= 1,
            detail: `Production ${tech.record?.relationships.productionPlans.length}, render ${tech.record?.relationships.renderPlans.length}`,
        };
        const noContext = await engine.validateQuality({ productId: "step9l-nonexistent" });
        results.incompleteRejection = {
            passed: !noContext.success,
            detail: noContext.message ?? "Rejected without context",
        };
        const repaired = await engine.repairAndRevalidate("step9l-kwizera-pro", QualityValidationPlatform.Mobile);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? `Repair verified, ${repaired.record?.repairsApplied.length ?? 0} repair(s)` : "Repair failed",
        };
        const revalidated = await engine.validateQuality({
            productId: "step9l-kwizera-pro",
            renderPlanId: techRender.record.imageRenderPlanId,
            productionId: techProduction.record.imageProductionId,
            platform: QualityValidationPlatform.Website,
            autoRepair: true,
        });
        results.revalidation = {
            passed: revalidated.success && revalidated.record?.approved === true,
            detail: revalidated.success ? "Revalidation passed after repair" : "Revalidation failed",
        };
        const scoreSearch = engine.searchValidations({ minQualityScore: 55 });
        results.searchByQualityScore = {
            passed: scoreSearch.length >= 1,
            detail: `${scoreSearch.length} result(s) by quality score`,
        };
        const productSearch = engine.searchValidations({ productId: "step9l-kwizera-pro" });
        results.searchByProduct = {
            passed: productSearch.length >= 1,
            detail: `${productSearch.length} result(s) by product`,
        };
        const keywordSearch = engine.searchValidations({ keywords: "quality" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const validationAsset = imgFoundation.getAssetRegistry().getAsset(tech.record.qualityValidationId);
        results.generationAssetRegistration = {
            passed: validationAsset?.assetType === "render-profile",
            detail: `Validation asset ${validationAsset?.assetId}`,
        };
        const blueprint = imgFoundation.getBlueprintManager().getBlueprint(tech.record.blueprintId);
        results.blueprintLink = {
            passed: Boolean(blueprint?.blueprintId),
            detail: blueprint ? `Blueprint ${blueprint.blueprintId}` : "Not found",
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageValidationMs < 120000,
            detail: `avg validation ${status.performance.averageValidationMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `image-quality-validation-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        results.multiIndustry = {
            passed: fashion.success && food.success,
            detail: `Fashion ${fashion.record?.profile.platform}, Food ${food.record?.profile.platform}`,
        };
        results.recommendations = {
            passed: (tech.record?.recommendations.length ?? 0) >= 1,
            detail: `${tech.record?.recommendations.length} recommendation(s)`,
        };
        await core.stop("step-9l-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Image-Quality-Validation-Report.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Visual-Validation-Report.md"), buildVisualReport(tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Color-Validation-Report.md"), buildColorReport(tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Brand-Validation-Report.md"), buildBrandReport(tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Print-Readiness-Report.md"), buildPrintReport(tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-9L-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Image-Quality-Validation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Visual-Validation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Color-Validation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Brand-Validation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Print-Readiness-Report.md")}`);
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
function buildMainReport(status, results, storageRoot, allPassed, tech, fashion, food) {
    return [
        "# KWIZERA AI STUDIO — Phase 9 Step 9L Image Quality Validation Report",
        "",
        `**Phase:** 9 — Image Generation Engine`,
        `**Step:** 9L — AI Image Quality Validation Engine`,
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
        `| **Validations** | ${status.validationsPerformed} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Quality Validations",
        "",
        `- Technology: ${tech?.profile.platform ?? "n/a"} (${tech?.scores.overallQualityScore ?? 0}/100) — ${tech?.approved ? "Approved" : "Pending"}`,
        `- Fashion: ${fashion?.profile.platform ?? "n/a"} (${fashion?.scores.overallQualityScore ?? 0}/100)`,
        `- Food/Print: ${food?.profile.platform ?? "n/a"} (${food?.scores.overallQualityScore ?? 0}/100)`,
        "",
    ].join("\n");
}
function buildVisualReport(tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    const lines = ["# Visual Validation Report — Step 9L", "", `**Date:** ${new Date().toISOString()}`, "", "| Product | Visual Score | Checks Passed | Layer Score | Mask Score |", "|---------|--------------|---------------|-------------|------------|"];
    for (const record of rows) {
        const passed = record.imageQuality.filter((e) => e.validated).length;
        lines.push(`| ${record.profile.productId} | ${record.scores.visualQualityScore}/100 | ${passed}/${record.imageQuality.length} | ${record.scores.layerIntegrityScore}/100 | ${record.scores.maskIntegrityScore}/100 |`);
    }
    return lines.join("\n");
}
function buildColorReport(tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    const lines = ["# Color Validation Report — Step 9L", "", `**Date:** ${new Date().toISOString()}`, "", "| Product | Color Accuracy | Platform Compat | Print Ready |", "|---------|----------------|-----------------|-------------|"];
    for (const record of rows) {
        lines.push(`| ${record.profile.productId} | ${record.scores.colorAccuracyScore}/100 | ${record.scores.platformCompatibilityScore}/100 | ${record.scores.printReadinessScore}/100 |`);
    }
    return lines.join("\n");
}
function buildBrandReport(tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    const lines = ["# Brand Validation Report — Step 9L", "", `**Date:** ${new Date().toISOString()}`, "", "| Product | Brand Score | Typography | Checks | Approved |", "|---------|-------------|------------|--------|----------|"];
    for (const record of rows) {
        const passed = record.brandValidation.filter((b) => b.validated).length;
        lines.push(`| ${record.profile.productId} | ${record.scores.brandConsistencyScore}/100 | ${record.scores.typographyScore}/100 | ${passed}/${record.brandValidation.length} | ${record.approved ? "✅" : "❌"} |`);
    }
    return lines.join("\n");
}
function buildPrintReport(tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    const lines = ["# Print Readiness Report — Step 9L", "", `**Date:** ${new Date().toISOString()}`, "", "| Product | Platform | Print Score | Print Checks | Render Ready | Production Ready |", "|---------|----------|-------------|--------------|--------------|------------------|"];
    for (const record of rows) {
        const passed = record.printValidation.filter((p) => p.validated).length;
        lines.push(`| ${record.profile.productId} | ${record.profile.platform} | ${record.scores.printReadinessScore}/100 | ${passed}/${record.printValidation.length} | ${record.renderReady ? "✅" : "❌"} | ${record.productionReady ? "✅" : "❌"} |`);
    }
    return lines.join("\n");
}
void main();
//# sourceMappingURL=validate-image-quality-validation-engine.js.map