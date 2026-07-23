import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALL_BACKGROUND_GEN_PLATFORMS, ALL_BACKGROUND_GEN_TYPES, ALL_SUBJECT_PRESERVATION_TARGETS, BackgroundGenPlatform, BackgroundGenType, BackgroundMarketingPreset, createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductImageGenPlatform, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-background-gen-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step9e-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI workstation requiring background generation for marketing",
    features: ["background replacement", "brand consistency"],
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
    productId: "step9e-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    subcategory: "outerwear",
    brand: "KWIZERA",
    description: "Premium jacket for fashion background replacement workflows",
    features: ["water-resistant"],
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
    productId: "step9e-artisan-coffee",
    productName: "Artisan Cold Brew",
    category: ProductAnalysisCategory.Food,
    subcategory: "beverages",
    brand: "BrewCraft",
    description: "Premium cold brew coffee for food photography background generation",
    features: ["organic", "cold-brew"],
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
    console.log("KWIZERA AI STUDIO — Step 9E Background Generation & Replacement Engine Validation");
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
        await core.start("step-9e-validation");
        const initMs = Date.now() - initStart;
        const imgFoundation = core.getManager().imageGenerationFoundation;
        const productEngine = imgFoundation.getProductImageGenerationEngine();
        const engine = imgFoundation.getBackgroundGenerationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete()
                ? `Background Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = imgFoundation.getRegistry().getModule("background-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.Website);
        await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
        await prepareFullPipeline(piFoundation, SAMPLE_FOOD, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);
        const techProduct = await productEngine.generateProductImagePlan({
            productId: "step9e-kwizera-pro",
            platform: ProductImageGenPlatform.Ecommerce,
        });
        const fashionProduct = await productEngine.generateProductImagePlan({
            productId: "step9e-kwizera-jacket",
            platform: ProductImageGenPlatform.Instagram,
        });
        const foodProduct = await productEngine.generateProductImagePlan({
            productId: "step9e-artisan-coffee",
            platform: ProductImageGenPlatform.Ecommerce,
        });
        results.productImagePreparation = {
            passed: techProduct.success && fashionProduct.success && foodProduct.success,
            detail: `Product plans: Tech ${techProduct.success ? "✓" : "✗"}, Fashion ${fashionProduct.success ? "✓" : "✗"}, Food ${foodProduct.success ? "✓" : "✗"}`,
        };
        const tech = await engine.generateBackgroundPlan({
            productId: "step9e-kwizera-pro",
            productImagePlanId: techProduct.record.productImagePlanId,
            sourceImageId: techProduct.record.productImagePlanId,
            platform: BackgroundGenPlatform.AmazonStyle,
            targetBackground: BackgroundGenType.WhiteBackground,
            marketingPreset: BackgroundMarketingPreset.Electronics,
            backgroundPrompt: "Replace with pure white e-commerce background preserving product edges",
            subjectMaskId: "mask-step9e-tech-subject",
            generateReplacements: true,
            generatePlatformOptimizations: true,
        });
        const fashion = await engine.generateBackgroundPlan({
            productId: "step9e-kwizera-jacket",
            productImagePlanId: fashionProduct.record.productImagePlanId,
            platform: BackgroundGenPlatform.Instagram,
            targetBackground: BackgroundGenType.StudioBackground,
            marketingPreset: BackgroundMarketingPreset.Fashion,
            generateReplacements: true,
        });
        const food = await engine.generateBackgroundPlan({
            productId: "step9e-artisan-coffee",
            productImagePlanId: foodProduct.record.productImagePlanId,
            platform: BackgroundGenPlatform.Catalogue,
            targetBackground: BackgroundGenType.Restaurant,
            marketingPreset: BackgroundMarketingPreset.Food,
            generateReplacements: true,
        });
        results.backgroundPlanGeneration = {
            passed: tech.success && fashion.success && food.success,
            detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Food ${food.success ? "✓" : "✗"}`,
        };
        results.backgroundAnalysis = {
            passed: Boolean(tech.record?.backgroundAnalysis.backgroundType &&
                tech.record?.backgroundAnalysis.lightingDirection &&
                tech.record?.backgroundAnalysis.shadowDirection &&
                tech.record?.backgroundAnalysis.horizonLine),
            detail: `Type: ${tech.record?.backgroundAnalysis.backgroundType}, env: ${tech.record?.backgroundAnalysis.sceneEnvironment.slice(0, 30)}...`,
        };
        results.subjectPreservation = {
            passed: (tech.record?.subjectPreservation.targets.length ?? 0) === ALL_SUBJECT_PRESERVATION_TARGETS.length &&
                tech.record?.subjectPreservation.identityLock === true &&
                tech.record?.subjectPreservation.productLock === true,
            detail: `${tech.record?.subjectPreservation.targets.length}/${ALL_SUBJECT_PRESERVATION_TARGETS.length} targets, locks enabled`,
        };
        results.lightingMatching = {
            passed: Boolean(tech.record?.lightingMatching.lightDirection &&
                tech.record?.lightingMatching.colorTemperature &&
                tech.record?.lightingMatching.reflectionMatching),
            detail: `Score ${tech.record?.scores.lightingConsistencyScore}, direction matched`,
        };
        results.depthPlanning = {
            passed: Boolean(tech.record?.depthPlanning.foreground &&
                tech.record?.depthPlanning.midground &&
                tech.record?.depthPlanning.background &&
                tech.record?.depthPlanning.focusSeparation),
            detail: "Foreground, midground, background, and focus separation planned",
        };
        results.backgroundQuality = {
            passed: (tech.record?.qualityImprovement.edgeQuality.length ?? 0) >= 10,
            detail: `Background score ${tech.record?.scores.backgroundQualityScore}, edge quality planned`,
        };
        results.replacementVariations = {
            passed: (tech.record?.replacementPlan.variations.length ?? 0) >= 4,
            detail: `${tech.record?.replacementPlan.variations.length} replacement variations`,
        };
        results.platformOptimization = {
            passed: (tech.record?.platformOptimizations.length ?? 0) === ALL_BACKGROUND_GEN_PLATFORMS.length,
            detail: `${tech.record?.platformOptimizations.length}/${ALL_BACKGROUND_GEN_PLATFORMS.length} platform profiles`,
        };
        results.backgroundScores = {
            passed: (tech.record?.scores.backgroundQualityScore ?? 0) >= 55 &&
                (tech.record?.scores.subjectPreservationScore ?? 0) >= 55 &&
                (tech.record?.scores.lightingConsistencyScore ?? 0) >= 55 &&
                (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
                (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `BG ${tech.record?.scores.backgroundQualityScore}, preservation ${tech.record?.scores.subjectPreservationScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (tech.record?.relationships.sourceImages.length ?? 0) >= 1 &&
                (tech.record?.relationships.productImagePlans.length ?? 0) >= 1,
            detail: `Sources ${tech.record?.relationships.sourceImages.length}, product plans ${tech.record?.relationships.productImagePlans.length}`,
        };
        results.productionReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
        };
        results.brandConsistency = {
            passed: tech.record?.brandConsistent === true,
            detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
        };
        const noContext = await engine.generateBackgroundPlan({ productId: "step9e-nonexistent" });
        results.incompleteRejection = {
            passed: !noContext.success,
            detail: noContext.message ?? "Rejected without context",
        };
        const repaired = await engine.repairBackgroundPlan(techProduct.record.productImagePlanId, BackgroundGenPlatform.Website);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Background repair verified" : "Repair failed",
        };
        const productSearch = engine.searchBackgroundPlans({ productId: "step9e-kwizera-pro" });
        results.searchByProduct = {
            passed: productSearch.length >= 1,
            detail: `${productSearch.length} result(s) by product`,
        };
        const bgSearch = engine.searchBackgroundPlans({ targetBackground: BackgroundGenType.WhiteBackground });
        results.searchByBackground = {
            passed: bgSearch.length >= 1,
            detail: `${bgSearch.length} result(s) by background type`,
        };
        const presetSearch = engine.searchBackgroundPlans({ marketingPreset: BackgroundMarketingPreset.Food });
        results.searchByPreset = {
            passed: presetSearch.length >= 1,
            detail: `${presetSearch.length} result(s) by marketing preset`,
        };
        const keywordSearch = engine.searchBackgroundPlans({ keywords: "background" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const bgAsset = imgFoundation.getAssetRegistry().getAsset(tech.record.profile.generatedBackgroundId);
        results.generationAssetRegistration = {
            passed: bgAsset?.assetType === "background",
            detail: `Background asset ${bgAsset?.assetId}`,
        };
        const blueprint = imgFoundation.getBlueprintManager().getBlueprint(tech.record.blueprintId);
        results.blueprintLink = {
            passed: Boolean(blueprint?.blueprintId),
            detail: blueprint ? `Blueprint ${blueprint.blueprintId}` : "Not found",
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageGenerationMs < 120000,
            detail: `avg generation ${status.performance.averageGenerationMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `background-generation-engine-${logDate}.jsonl`);
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
            detail: `Fashion ${fashion.record?.profile.marketingPreset}, Food ${food.record?.profile.marketingPreset}`,
        };
        results.recommendations = {
            passed: (tech.record?.recommendations.length ?? 0) >= 1,
            detail: `${tech.record?.recommendations.length} recommendation(s)`,
        };
        results.backgroundTypesSupported = {
            passed: ALL_BACKGROUND_GEN_TYPES.length >= 12,
            detail: `${ALL_BACKGROUND_GEN_TYPES.length} background types supported`,
        };
        await core.stop("step-9e-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Background-Generation-Report.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Background-Analysis-Report.md"), buildAnalysisReport(tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Lighting-Matching-Report.md"), buildLightingReport(tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Depth-Planning-Report.md"), buildDepthReport(tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Background-Readiness-Report.md"), buildReadinessReport(status, tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-9E-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Background-Generation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Background-Analysis-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Lighting-Matching-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Depth-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Background-Readiness-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 9 Step 9E Background Generation & Replacement Report",
        "",
        `**Phase:** 9 — Image Generation Engine`,
        `**Step:** 9E — AI Background Generation & Replacement Engine`,
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
        `| **Background Plans** | ${status.backgroundPlansGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Generated Background Plans",
        "",
        `- Technology: ${tech?.profile.targetBackground ?? "n/a"} (${tech?.scores.backgroundQualityScore ?? 0}/100)`,
        `- Fashion: ${fashion?.profile.targetBackground ?? "n/a"} (${fashion?.scores.backgroundQualityScore ?? 0}/100)`,
        `- Food: ${food?.profile.targetBackground ?? "n/a"} (${food?.scores.backgroundQualityScore ?? 0}/100)`,
        "",
    ].join("\n");
}
function buildAnalysisReport(tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    const lines = [
        "# Background Analysis Report — Step 9E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Type | Environment | Lighting | Shadows | Preservation |",
        "|---------|------|-------------|----------|---------|--------------|",
    ];
    for (const record of rows) {
        lines.push(`| ${record.profile.productId} | ${record.backgroundAnalysis.backgroundType} | ${record.backgroundAnalysis.sceneEnvironment.slice(0, 25)}... | ${record.backgroundAnalysis.lightingDirection.slice(0, 20)}... | ${record.backgroundAnalysis.shadowDirection.slice(0, 20)}... | ${record.scores.subjectPreservationScore}/100 |`);
    }
    return lines.join("\n");
}
function buildLightingReport(tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    const lines = ["# Lighting Matching Report — Step 9E", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const record of rows) {
        lines.push(`## ${record.profile.productId}`, "");
        lines.push("| Property | Value |", "|----------|-------|");
        lines.push(`| Direction | ${record.lightingMatching.lightDirection.slice(0, 50)}... |`);
        lines.push(`| Intensity | ${record.lightingMatching.lightIntensity.slice(0, 50)}... |`);
        lines.push(`| Temperature | ${record.lightingMatching.colorTemperature} |`);
        lines.push(`| Shadows | ${record.lightingMatching.shadowConsistency.slice(0, 50)}... |`);
        lines.push(`| Reflections | ${record.lightingMatching.reflectionMatching.slice(0, 50)}... |`);
        lines.push(`| Score | ${record.scores.lightingConsistencyScore}/100 |`);
        lines.push("");
    }
    return lines.join("\n");
}
function buildDepthReport(tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    const lines = ["# Depth Planning Report — Step 9E", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const record of rows) {
        lines.push(`## ${record.profile.productId}`, "");
        lines.push(`- **Foreground:** ${record.depthPlanning.foreground.slice(0, 60)}...`);
        lines.push(`- **Midground:** ${record.depthPlanning.midground.slice(0, 60)}...`);
        lines.push(`- **Background:** ${record.depthPlanning.background.slice(0, 60)}...`);
        lines.push(`- **Blur:** ${record.depthPlanning.blurPlanning}`);
        lines.push(`- **DoF:** ${record.depthPlanning.depthOfField}`);
        lines.push("");
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    return [
        "# Background Readiness Report — Step 9E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Product | BG Quality | Preservation | Lighting | Brand | Production | Confidence | Ready |",
        "|---------|------------|--------------|----------|-------|------------|------------|-------|",
        ...rows.map((r) => `| ${r.profile.productId} | ${r.scores.backgroundQualityScore} | ${r.scores.subjectPreservationScore} | ${r.scores.lightingConsistencyScore} | ${r.scores.brandConsistencyScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`),
        "",
        "## Performance",
        "",
        `- Average generation: ${status.performance.averageGenerationMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        `- ${status.lightingMatchingStatus}`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-background-generation-engine.js.map