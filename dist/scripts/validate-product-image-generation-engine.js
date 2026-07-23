import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALL_PRODUCT_CONSISTENCY_RULES, ALL_PRODUCT_IMAGE_GEN_PLATFORMS, ALL_PRODUCT_MARKETING_VARIATIONS, ALL_PRODUCT_PRESENTATION_VIEWS, createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductImageBackgroundType, ProductImageGenPlatform, ProductPhotographyMode, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-product-image-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step9d-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI-powered creative workstation for e-commerce and marketing product imagery",
    features: ["AI product images", "marketplace export", "brand consistency"],
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
    productId: "step9d-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    subcategory: "outerwear",
    brand: "KWIZERA",
    description: "Premium urban jacket for catalogue and e-commerce product photography",
    features: ["water-resistant", "breathable"],
    specifications: { fabric: "cotton-blend" },
    materials: ["cotton", "polyester"],
    price: 129.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "fashion",
    businessType: ProductBusinessType.D2C,
    tags: ["fashion"],
    keywords: ["jacket"],
};
const SAMPLE_BEAUTY = {
    productId: "step9d-glow-serum",
    productName: "Radiance Vitamin C Serum",
    category: ProductAnalysisCategory.Beauty,
    subcategory: "skincare",
    brand: "GlowLab",
    description: "Clinical-grade vitamin C serum for luxury product image generation",
    features: ["vitamin-c", "anti-aging"],
    specifications: { volume: "30ml" },
    materials: ["glass-bottle"],
    packaging: "Premium glass bottle with dropper",
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
    console.log("KWIZERA AI STUDIO — Step 9D Product Image Generation Engine Validation");
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
        await core.start("step-9d-validation");
        const initMs = Date.now() - initStart;
        const imgFoundation = core.getManager().imageGenerationFoundation;
        const engine = imgFoundation.getProductImageGenerationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete()
                ? `Product Image Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = imgFoundation.getRegistry().getModule("product-image-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.Website);
        await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
        await prepareFullPipeline(piFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);
        const tech = await engine.generateProductImagePlan({
            productId: "step9d-kwizera-pro",
            platform: ProductImageGenPlatform.Ecommerce,
            backgroundType: ProductImageBackgroundType.OfficeEnvironment,
            photographyMode: ProductPhotographyMode.CommercialPhotography,
            generateMarketingVariations: true,
            generatePlatformOptimizations: true,
        });
        const fashion = await engine.generateProductImagePlan({
            productId: "step9d-kwizera-jacket",
            platform: ProductImageGenPlatform.Instagram,
            backgroundType: ProductImageBackgroundType.PremiumEnvironment,
            photographyMode: ProductPhotographyMode.LifestylePhotography,
            generateMarketingVariations: true,
        });
        const beauty = await engine.generateProductImagePlan({
            productId: "step9d-glow-serum",
            platform: ProductImageGenPlatform.Ecommerce,
            backgroundType: ProductImageBackgroundType.WhiteBackground,
            photographyMode: ProductPhotographyMode.LuxuryPhotography,
            generateMarketingVariations: true,
        });
        results.productImagePlanGeneration = {
            passed: tech.success && fashion.success && beauty.success,
            detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Beauty ${beauty.success ? "✓" : "✗"}`,
        };
        results.productPresentation = {
            passed: (tech.record?.presentationPlan.views.length ?? 0) === ALL_PRODUCT_PRESENTATION_VIEWS.length,
            detail: `${tech.record?.presentationPlan.views.length}/${ALL_PRODUCT_PRESENTATION_VIEWS.length} presentation views`,
        };
        results.photographyPlanning = {
            passed: (tech.record?.photographyPlan.modes.length ?? 0) >= 5,
            detail: `Primary: ${tech.record?.photographyPlan.primaryMode}, modes: ${tech.record?.photographyPlan.modes.length}`,
        };
        results.lightingPlanning = {
            passed: Boolean(tech.record?.lightingPlan.studioLighting &&
                tech.record?.lightingPlan.rimLighting &&
                tech.record?.lightingPlan.shadowPlanning),
            detail: "Studio, rim, and shadow lighting prepared",
        };
        results.backgroundPlanning = {
            passed: Boolean(tech.record?.backgroundPlan.backgroundDescription &&
                beauty.record?.backgroundPlan.primaryBackground === ProductImageBackgroundType.WhiteBackground),
            detail: `Tech: ${tech.record?.backgroundPlan.primaryBackground}, Beauty: ${beauty.record?.backgroundPlan.primaryBackground}`,
        };
        results.productConsistency = {
            passed: (tech.record?.consistencyPlan.rules.length ?? 0) === ALL_PRODUCT_CONSISTENCY_RULES.length &&
                tech.record?.consistencyPlan.shapeLock === true &&
                tech.record?.consistencyPlan.colorLock === true,
            detail: `${tech.record?.consistencyPlan.rules.length}/${ALL_PRODUCT_CONSISTENCY_RULES.length} rules, shape+color locked`,
        };
        results.marketingVariations = {
            passed: (tech.record?.marketingVariations.length ?? 0) === ALL_PRODUCT_MARKETING_VARIATIONS.length,
            detail: `${tech.record?.marketingVariations.length}/${ALL_PRODUCT_MARKETING_VARIATIONS.length} marketing variations`,
        };
        results.platformOptimization = {
            passed: (tech.record?.platformOptimizations.length ?? 0) === ALL_PRODUCT_IMAGE_GEN_PLATFORMS.length,
            detail: `${tech.record?.platformOptimizations.length}/${ALL_PRODUCT_IMAGE_GEN_PLATFORMS.length} platform profiles`,
        };
        results.productImageScores = {
            passed: (tech.record?.scores.productPresentationScore ?? 0) >= 55 &&
                (tech.record?.scores.photographyScore ?? 0) >= 55 &&
                (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
                (tech.record?.scores.marketplaceReadinessScore ?? 0) >= 55 &&
                (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Presentation ${tech.record?.scores.productPresentationScore}, marketplace ${tech.record?.scores.marketplaceReadinessScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (tech.record?.relationships.products.length ?? 0) >= 1 &&
                (tech.record?.relationships.generatedImages.length ?? 0) >= 1,
            detail: `Products ${tech.record?.relationships.products.length}, generated ${tech.record?.relationships.generatedImages.length}`,
        };
        results.productionReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
        };
        results.marketplaceReadiness = {
            passed: tech.record?.marketplaceReady === true,
            detail: `Marketplace ready: ${tech.record?.marketplaceReady}, score ${tech.record?.scores.marketplaceReadinessScore}`,
        };
        results.brandConsistency = {
            passed: tech.record?.brandConsistent === true,
            detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
        };
        const noPipeline = await engine.generateProductImagePlan({ productId: "step9d-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without product pipeline",
        };
        const repaired = await engine.repairProductImagePlan("step9d-kwizera-jacket", ProductImageGenPlatform.Facebook);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Product image plan repair verified" : "Repair failed",
        };
        const productSearch = engine.searchProductImagePlans({ productId: "step9d-kwizera-pro" });
        results.searchByProduct = {
            passed: productSearch.length >= 1,
            detail: `${productSearch.length} result(s) by product`,
        };
        const categorySearch = engine.searchProductImagePlans({ productCategory: "software" });
        results.searchByCategory = {
            passed: categorySearch.length >= 1,
            detail: `${categorySearch.length} result(s) by category`,
        };
        const platformSearch = engine.searchProductImagePlans({ platform: ProductImageGenPlatform.Ecommerce });
        results.searchByPlatform = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const photoSearch = engine.searchProductImagePlans({ photographyMode: ProductPhotographyMode.LuxuryPhotography });
        results.searchByStyle = {
            passed: photoSearch.length >= 1,
            detail: `${photoSearch.length} result(s) by photography mode`,
        };
        const keywordSearch = engine.searchProductImagePlans({ keywords: "product" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const productAsset = imgFoundation.getAssetRegistry().getAsset(tech.record.productImagePlanId);
        results.generationAssetRegistration = {
            passed: productAsset?.assetType === "product-image",
            detail: `Product image asset ${productAsset?.assetId}`,
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
        const logFile = path.join(storageRoot, "logs", `product-image-generation-engine-${logDate}.jsonl`);
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
            detail: `Fashion ${fashion.record?.profile.productCategory}, Beauty ${beauty.record?.profile.productCategory}`,
        };
        results.recommendations = {
            passed: (tech.record?.recommendations.length ?? 0) >= 1,
            detail: `${tech.record?.recommendations.length} recommendation(s)`,
        };
        await core.stop("step-9d-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Product-Image-Generation-Report.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Product-Photography-Report.md"), buildPhotographyReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Lighting-Planning-Report.md"), buildLightingReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Background-Planning-Report.md"), buildBackgroundReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Product-Readiness-Report.md"), buildReadinessReport(status, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-9D-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Product-Image-Generation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Product-Photography-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Lighting-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Background-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Product-Readiness-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 9 Step 9D Product Image Generation Report",
        "",
        `**Phase:** 9 — Image Generation Engine`,
        `**Step:** 9D — AI Product Image Generation Engine`,
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
        `| **Product Image Plans** | ${status.productImagePlansGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Generated Product Image Plans",
        "",
        `- Technology: ${tech?.profile.productCategory ?? "n/a"} (${tech?.scores.productPresentationScore ?? 0}/100)`,
        `- Fashion: ${fashion?.profile.productCategory ?? "n/a"} (${fashion?.scores.productPresentationScore ?? 0}/100)`,
        `- Beauty: ${beauty?.profile.productCategory ?? "n/a"} (${beauty?.scores.productPresentationScore ?? 0}/100)`,
        "",
    ].join("\n");
}
function buildPhotographyReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Product Photography Report — Step 9D",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Primary Mode | Modes | Photography Score |",
        "|---------|--------------|-------|-------------------|",
    ];
    for (const record of rows) {
        lines.push(`| ${record.profile.productId} | ${record.photographyPlan.primaryMode} | ${record.photographyPlan.modes.length} | ${record.scores.photographyScore}/100 |`);
    }
    lines.push("", "## Studio Setup (Technology)", "");
    if (tech) {
        lines.push(`- ${tech.photographyPlan.studioSetup}`, `- ${tech.photographyPlan.commercialStyle}`);
    }
    return lines.join("\n");
}
function buildLightingReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Lighting Planning Report — Step 9D",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        lines.push(`## ${record.profile.productId}`, "");
        lines.push("| Type | Plan |", "|------|------|");
        lines.push(`| Studio | ${record.lightingPlan.studioLighting.slice(0, 55)}... |`);
        lines.push(`| Natural | ${record.lightingPlan.naturalLighting.slice(0, 55)}... |`);
        lines.push(`| Softbox | ${record.lightingPlan.softboxLighting.slice(0, 55)}... |`);
        lines.push(`| Rim | ${record.lightingPlan.rimLighting.slice(0, 55)}... |`);
        lines.push(`| Highlight | ${record.lightingPlan.productHighlight.slice(0, 55)}... |`);
        lines.push(`| Reflection | ${record.lightingPlan.reflectionControl.slice(0, 55)}... |`);
        lines.push(`| Shadow | ${record.lightingPlan.shadowPlanning} |`);
        lines.push("");
    }
    return lines.join("\n");
}
function buildBackgroundReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Background Planning Report — Step 9D",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Background | Description | Strategy |",
        "|---------|------------|-------------|----------|",
    ];
    for (const record of rows) {
        lines.push(`| ${record.profile.productId} | ${record.backgroundPlan.primaryBackground} | ${record.backgroundPlan.backgroundDescription.slice(0, 35)}... | ${record.backgroundPlan.replacementStrategy.slice(0, 30)}... |`);
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Product Readiness Report — Step 9D",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Product | Presentation | Photography | Brand | Marketplace | Production | Confidence | Ready |",
        "|---------|--------------|-------------|-------|-------------|------------|------------|-------|",
        ...rows.map((r) => `| ${r.profile.productId} | ${r.scores.productPresentationScore} | ${r.scores.photographyScore} | ${r.scores.brandConsistencyScore} | ${r.scores.marketplaceReadinessScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady && r.marketplaceReady ? "✅" : "❌"} |`),
        "",
        "## Performance",
        "",
        `- Average generation: ${status.performance.averageGenerationMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        `- Marketplace optimization: ${status.marketplaceOptimizationStatus}`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-product-image-generation-engine.js.map