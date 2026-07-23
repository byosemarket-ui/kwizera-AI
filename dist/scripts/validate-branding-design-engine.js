import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALL_BRAND_DESIGN_CONSISTENCY_ELEMENTS, ALL_BRAND_DESIGN_GEN_PLATFORMS, ALL_BRAND_DESIGN_LOGO_VARIANTS, ALL_BRAND_DESIGN_MATERIALS, ALL_BRAND_DESIGN_PRINT_FORMATS, ALL_BRAND_DESIGN_SOCIAL_FORMATS, ALL_BRAND_DESIGN_TYPES, BrandDesignGenPlatform, BrandDesignType, createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductImageGenPlatform, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-branding-design-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step9h-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI workstation requiring branding and graphic design",
    features: ["branding", "presentation graphics"],
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
    productId: "step9h-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    subcategory: "outerwear",
    brand: "KWIZERA",
    description: "Premium jacket for fashion social media branding",
    features: ["social media", "brand style"],
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
    productId: "step9h-artisan-coffee",
    productName: "Artisan Cold Brew",
    category: ProductAnalysisCategory.Food,
    subcategory: "beverages",
    brand: "BrewCraft",
    description: "Premium cold brew coffee for packaging design branding",
    features: ["packaging", "label design"],
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
    console.log("KWIZERA AI STUDIO — Step 9H Branding & Graphic Design Engine Validation");
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
        await core.start("step-9h-validation");
        const initMs = Date.now() - initStart;
        const imgFoundation = core.getManager().imageGenerationFoundation;
        const productEngine = imgFoundation.getProductImageGenerationEngine();
        const engine = imgFoundation.getBrandingDesignEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete() ? `Branding Engine ready in ${initMs}ms` : "Not initialized",
        };
        const registered = imgFoundation.getRegistry().getModule("branding-design-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.Website);
        await prepareFullPipeline(piFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels);
        await prepareFullPipeline(piFoundation, SAMPLE_FOOD, MarketingObjective.BrandAwareness, CreativePlatform.TikTok);
        const techProduct = await productEngine.generateProductImagePlan({
            productId: "step9h-kwizera-pro",
            platform: ProductImageGenPlatform.Ecommerce,
        });
        const fashionProduct = await productEngine.generateProductImagePlan({
            productId: "step9h-kwizera-jacket",
            platform: ProductImageGenPlatform.Instagram,
        });
        const foodProduct = await productEngine.generateProductImagePlan({
            productId: "step9h-artisan-coffee",
            platform: ProductImageGenPlatform.Ecommerce,
        });
        results.upstreamPreparation = {
            passed: techProduct.success && fashionProduct.success && foodProduct.success,
            detail: "Product image plans prepared for all industries",
        };
        const tech = await engine.generateBrandingPlan({
            productId: "step9h-kwizera-pro",
            productImagePlanId: techProduct.record.productImagePlanId,
            brandId: "KWIZERA",
            brandGuidelines: "KWIZERA brand: blue #0066CC, clean sans-serif, professional tone",
            platform: BrandDesignGenPlatform.Website,
            designType: BrandDesignType.PresentationGraphic,
            designPrompt: "Professional branding presentation for KWIZERA Pro Studio launch",
            colorPalette: ["#0066CC", "#FFFFFF", "#333333"],
            logoIds: ["logo-kwizera-primary"],
            templateIds: ["template-presentation-hero"],
            generatePlatformOptimizations: true,
        });
        const fashion = await engine.generateBrandingPlan({
            productId: "step9h-kwizera-jacket",
            productImagePlanId: fashionProduct.record.productImagePlanId,
            brandId: "KWIZERA",
            platform: BrandDesignGenPlatform.Instagram,
            designType: BrandDesignType.SocialMediaGraphic,
            generateSocialMediaDesign: true,
            generatePlatformOptimizations: true,
        });
        const food = await engine.generateBrandingPlan({
            productId: "step9h-artisan-coffee",
            productImagePlanId: foodProduct.record.productImagePlanId,
            brandId: "BrewCraft",
            platform: BrandDesignGenPlatform.Print,
            designType: BrandDesignType.PackagingLayout,
            generatePrintDesign: true,
            generateMarketingMaterials: true,
            generatePlatformOptimizations: true,
        });
        results.brandingPlanGeneration = {
            passed: tech.success && fashion.success && food.success,
            detail: `Tech ${tech.success ? "✓" : "✗"}, Fashion ${fashion.success ? "✓" : "✗"}, Food ${food.success ? "✓" : "✗"}`,
        };
        results.layoutPlanning = {
            passed: Boolean(tech.record?.designPlanning.layoutStructure &&
                tech.record?.designPlanning.gridSystem &&
                tech.record?.designPlanning.visualHierarchy &&
                tech.record?.designPlanning.whiteSpacePlanning),
            detail: `Grid: ${tech.record?.designPlanning.gridSystem.slice(0, 30)}...`,
        };
        results.typography = {
            passed: (tech.record?.designPlanning.typographyPlanning.length ?? 0) >= 3,
            detail: `${tech.record?.designPlanning.typographyPlanning.length} typography rules, score ${tech.record?.scores.typographyScore}`,
        };
        results.logoPlanning = {
            passed: (tech.record?.logoPlanning.variants.length ?? 0) === ALL_BRAND_DESIGN_LOGO_VARIANTS.length &&
                (tech.record?.logoPlanning.usageGuidelines.length ?? 0) >= 2,
            detail: `${tech.record?.logoPlanning.variants.length}/${ALL_BRAND_DESIGN_LOGO_VARIANTS.length} logo variants planned`,
        };
        results.graphicDesign = {
            passed: (tech.record?.marketingMaterials.materials.length ?? 0) >= 4 &&
                (tech.record?.designPlanning.iconPlanning.length ?? 0) >= 1,
            detail: `Score ${tech.record?.scores.graphicDesignScore}, ${tech.record?.marketingMaterials.materials.length} materials`,
        };
        results.socialMediaDesign = {
            passed: (fashion.record?.socialMediaDesign.formats.length ?? 0) === ALL_BRAND_DESIGN_SOCIAL_FORMATS.length,
            detail: `${fashion.record?.socialMediaDesign.formats.length}/${ALL_BRAND_DESIGN_SOCIAL_FORMATS.length} social formats`,
        };
        results.printDesign = {
            passed: (food.record?.printDesign.formats.length ?? 0) === ALL_BRAND_DESIGN_PRINT_FORMATS.length &&
                food.record?.printReady === true,
            detail: `${food.record?.printDesign.formats.length}/${ALL_BRAND_DESIGN_PRINT_FORMATS.length} print formats`,
        };
        results.brandConsistency = {
            passed: (tech.record?.brandConsistency.elements.length ?? 0) === ALL_BRAND_DESIGN_CONSISTENCY_ELEMENTS.length &&
                tech.record?.brandConsistent === true,
            detail: `${tech.record?.brandConsistency.elements.length}/${ALL_BRAND_DESIGN_CONSISTENCY_ELEMENTS.length} elements, score ${tech.record?.scores.brandConsistencyScore}`,
        };
        results.colorManagement = {
            passed: (tech.record?.colorManagement.rgbPalette.length ?? 0) >= 2 &&
                (tech.record?.colorManagement.cmykPalette.length ?? 0) >= 2 &&
                Boolean(tech.record?.colorManagement.contrastValidation),
            detail: "RGB, CMYK, Pantone, ICC, and contrast validation planned",
        };
        results.platformOptimization = {
            passed: (tech.record?.platformOptimizations.length ?? 0) === ALL_BRAND_DESIGN_GEN_PLATFORMS.length,
            detail: `${tech.record?.platformOptimizations.length}/${ALL_BRAND_DESIGN_GEN_PLATFORMS.length} platform profiles`,
        };
        results.brandingScores = {
            passed: (tech.record?.scores.brandingScore ?? 0) >= 55 &&
                (tech.record?.scores.graphicDesignScore ?? 0) >= 55 &&
                (tech.record?.scores.layoutScore ?? 0) >= 55 &&
                (tech.record?.scores.typographyScore ?? 0) >= 55 &&
                (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
                (tech.record?.scores.printReadinessScore ?? 0) >= 55 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Branding ${tech.record?.scores.brandingScore}, design ${tech.record?.scores.graphicDesignScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (tech.record?.relationships.products.length ?? 0) >= 1 &&
                (tech.record?.relationships.brands.length ?? 0) >= 1 &&
                (tech.record?.relationships.productImagePlans.length ?? 0) >= 1,
            detail: `Products ${tech.record?.relationships.products.length}, brands ${tech.record?.relationships.brands.length}, templates ${tech.record?.relationships.templates.length}`,
        };
        results.productionReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: `Production ready: ${tech.record?.productionReady}, print ready: ${tech.record?.printReady}`,
        };
        const noContext = await engine.generateBrandingPlan({ productId: "step9h-nonexistent" });
        results.incompleteRejection = {
            passed: !noContext.success,
            detail: noContext.message ?? "Rejected without context",
        };
        const repaired = await engine.repairBrandingPlan("step9h-kwizera-pro", BrandDesignGenPlatform.Mobile);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Branding repair verified" : "Repair failed",
        };
        const brandSearch = engine.searchBrandingPlans({ brandId: "KWIZERA" });
        results.searchByBrand = {
            passed: brandSearch.length >= 1,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const typeSearch = engine.searchBrandingPlans({ designType: BrandDesignType.PresentationGraphic });
        results.searchByDesignType = {
            passed: typeSearch.length >= 1,
            detail: `${typeSearch.length} result(s) by design type`,
        };
        const keywordSearch = engine.searchBrandingPlans({ keywords: "branding" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const templateAsset = imgFoundation.getAssetRegistry().getAsset(tech.record.brandDesignId);
        results.generationAssetRegistration = {
            passed: templateAsset?.assetType === "template",
            detail: `Branding template ${templateAsset?.assetId}`,
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
        const logFile = path.join(storageRoot, "logs", `branding-design-engine-${logDate}.jsonl`);
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
            detail: `Fashion ${fashion.record?.profile.designType}, Food ${food.record?.profile.designType}`,
        };
        results.recommendations = {
            passed: (tech.record?.recommendations.length ?? 0) >= 1,
            detail: `${tech.record?.recommendations.length} recommendation(s)`,
        };
        results.designTypesSupported = {
            passed: ALL_BRAND_DESIGN_TYPES.length >= 11 && ALL_BRAND_DESIGN_MATERIALS.length >= 12,
            detail: `${ALL_BRAND_DESIGN_TYPES.length} design types, ${ALL_BRAND_DESIGN_MATERIALS.length} marketing materials`,
        };
        await core.stop("step-9h-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Branding-Graphic-Design-Report.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Logo-Planning-Report.md"), buildLogoReport(tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Graphic-Design-Report.md"), buildGraphicReport(tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Print-Design-Report.md"), buildPrintReport(tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Branding-Readiness-Report.md"), buildReadinessReport(status, tech.record, fashion.record, food.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-9H-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, fashion.record, food.record), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Branding-Graphic-Design-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Logo-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Graphic-Design-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Print-Design-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Branding-Readiness-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 9 Step 9H Branding & Graphic Design Report",
        "",
        `**Phase:** 9 — Image Generation Engine`,
        `**Step:** 9H — AI Branding & Graphic Design Engine`,
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
        `| **Branding Plans** | ${status.brandingPlansGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Generated Branding Plans",
        "",
        `- Technology: ${tech?.profile.designType ?? "n/a"} (${tech?.scores.brandingScore ?? 0}/100)`,
        `- Fashion: ${fashion?.profile.designType ?? "n/a"} (${fashion?.scores.brandingScore ?? 0}/100)`,
        `- Food: ${food?.profile.designType ?? "n/a"} (${food?.scores.brandingScore ?? 0}/100)`,
        "",
    ].join("\n");
}
function buildLogoReport(tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    const lines = [
        "# Logo Planning Report — Step 9H",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Variants | Primary | Usage Guidelines | Branding Score |",
        "|---------|----------|---------|------------------|----------------|",
    ];
    for (const record of rows) {
        lines.push(`| ${record.profile.productId} | ${record.logoPlanning.variants.length} | ${record.logoPlanning.primaryLogoNotes.slice(0, 25)}... | ${record.logoPlanning.usageGuidelines.length} rules | ${record.scores.brandingScore}/100 |`);
    }
    return lines.join("\n");
}
function buildGraphicReport(tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    const lines = ["# Graphic Design Report — Step 9H", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const record of rows) {
        lines.push(`## ${record.profile.productId}`, "");
        lines.push(`- **Layout:** ${record.designPlanning.layoutStructure.slice(0, 60)}...`);
        lines.push(`- **Hierarchy:** ${record.designPlanning.visualHierarchy.slice(0, 60)}...`);
        lines.push(`- **Materials:** ${record.marketingMaterials.materials.length}`);
        lines.push(`- **Graphic Design Score:** ${record.scores.graphicDesignScore}/100`);
        lines.push("");
    }
    return lines.join("\n");
}
function buildPrintReport(tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    const lines = [
        "# Print Design Report — Step 9H",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Product | Print Formats | CMYK | DPI Planning | Print Ready | Score |",
        "|---------|---------------|------|--------------|-------------|-------|",
    ];
    for (const record of rows) {
        lines.push(`| ${record.profile.productId} | ${record.printDesign.formats.length} | ${record.colorManagement.cmykPalette.length} colors | ${record.printDesign.printNotes[0]?.slice(0, 20) ?? "n/a"}... | ${record.printReady ? "✅" : "❌"} | ${record.scores.printReadinessScore}/100 |`);
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, food) {
    const rows = [tech, fashion, food].filter(Boolean);
    return [
        "# Branding Readiness Report — Step 9H",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Product | Branding | Design | Layout | Typography | Brand | Print | Confidence | Ready |",
        "|---------|----------|--------|--------|------------|-------|-------|------------|-------|",
        ...rows.map((r) => `| ${r.profile.productId} | ${r.scores.brandingScore} | ${r.scores.graphicDesignScore} | ${r.scores.layoutScore} | ${r.scores.typographyScore} | ${r.scores.brandConsistencyScore} | ${r.scores.printReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`),
        "",
        "## Performance",
        "",
        `- Average generation: ${status.performance.averageGenerationMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        `- ${status.logoPlanningStatus}`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-branding-design-engine.js.map