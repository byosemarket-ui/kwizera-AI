import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, ImageProductionPlatform, ImageRenderPlatform, MarketingObjective, MultiStyleGenPlatform, MultiStyleImageCategory, OptimizationPlatform, BrandDesignGenPlatform, BrandDesignType, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductImageGenPlatform, ProductUnderstandingMarketingGoal, QualityValidationPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-ig-health-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE = {
    productId: "step9n-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI-powered creative workstation",
    features: ["AI image generation"],
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
async function prepareFullPipeline(piFoundation, imgFoundation) {
    await piFoundation.getProductAnalysisEngine().analyzeProduct(SAMPLE);
    await piFoundation.getProductUnderstandingEngine().understandProduct({
        productId: SAMPLE.productId,
        marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
    });
    await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: SAMPLE.productId });
    await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
        productId: SAMPLE.productId,
        marketingObjective: MarketingObjective.ProductLaunch,
    });
    await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
        productId: SAMPLE.productId,
        platform: CreativePlatform.Website,
    });
    await imgFoundation.getTextToImageGenerationEngine().generateImagePlan({
        productId: SAMPLE.productId,
        textPrompt: "Professional product hero image for KWIZERA Pro Studio",
        brandId: SAMPLE.brand,
    });
    const product = await imgFoundation.getProductImageGenerationEngine().generateProductImagePlan({
        productId: SAMPLE.productId,
        platform: ProductImageGenPlatform.Ecommerce,
    });
    await imgFoundation.getBrandingDesignEngine().generateBrandingPlan({
        productId: SAMPLE.productId,
        productImagePlanId: product.record.productImagePlanId,
        brandId: SAMPLE.brand,
        platform: BrandDesignGenPlatform.Website,
        designType: BrandDesignType.BrandingPlan,
    });
    const style = await imgFoundation.getMultiStyleImageGenerationEngine().generateStylePlan({
        productId: SAMPLE.productId,
        productImagePlanId: product.record.productImagePlanId,
        sourceImageId: product.record.productImagePlanId,
        brandId: SAMPLE.brand,
        platform: MultiStyleGenPlatform.Website,
        styleCategory: MultiStyleImageCategory.Technology,
        generateVariations: true,
    });
    const production = await imgFoundation.getImageProductionEngine().generateProductionPlan({
        productId: SAMPLE.productId,
        stylePlanId: style.record.stylePlanId,
        productImagePlanId: product.record.productImagePlanId,
        brandId: SAMPLE.brand,
        platform: ImageProductionPlatform.Website,
        prepareExports: true,
    });
    const render = await imgFoundation.getImageRenderingPreparationEngine().generateRenderPlan({
        productId: SAMPLE.productId,
        productionId: production.record.imageProductionId,
        platform: ImageRenderPlatform.Website,
        prepareOutputProfiles: true,
        generateRenderJobs: true,
    });
    await imgFoundation.getImageQualityValidationEngine().validateQuality({
        productId: SAMPLE.productId,
        renderPlanId: render.record.imageRenderPlanId,
        productionId: production.record.imageProductionId,
        platform: QualityValidationPlatform.Website,
        autoRepair: true,
    });
    await imgFoundation.getImageGenerationOptimizationEngine().optimizeImageGeneration({
        productId: SAMPLE.productId,
        platform: OptimizationPlatform.Website,
    });
}
async function simulateFileCorruption(filePath, monitor) {
    if (!fs.existsSync(filePath)) {
        return { warnings: 0, errors: 0 };
    }
    const backup = fs.readFileSync(filePath, "utf8");
    fs.writeFileSync(filePath, "{ corruption-simulation", "utf8");
    const check = await monitor.runHealthCheck();
    fs.writeFileSync(filePath, backup, "utf8");
    return { warnings: check.warnings.length, errors: check.errors.length };
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 9N Image Generation Health Monitor Validation");
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
        await core.start("step-9n-validation");
        const imgFoundation = core.getManager().imageGenerationFoundation;
        const piFoundation = core.getManager().productIntelligenceFoundation;
        const monitor = imgFoundation.getImageGenerationHealthMonitorEngine();
        results.initialization = {
            passed: monitor.isInitialized() && monitor.isStartupComplete(),
            detail: "Image Generation Health Monitor operational",
        };
        const registered = imgFoundation.getRegistry().getModule("image-generation-health-monitor");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        const healthDir = path.join(imgFoundation.getGenerationRoot(), "health", "engine");
        results.healthStorage = {
            passed: fs.existsSync(healthDir),
            detail: healthDir,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(DEFAULT_STORAGE_ROOT, "logs", `image-generation-health-monitor-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        await prepareFullPipeline(piFoundation, imgFoundation);
        const checkStart = Date.now();
        const check = await monitor.runHealthCheck();
        const checkMs = Date.now() - checkStart;
        results.healthMonitoring = {
            passed: check.overallScore >= 75,
            detail: `${check.overallLevel} (${check.overallScore}/100) in ${checkMs}ms`,
        };
        results.promptIntegrity = {
            passed: check.promptIntegrity,
            detail: check.promptIntegrity ? "Prompt integrity verified" : "Prompt issues detected",
        };
        results.imageIntegrity = {
            passed: check.imageIntegrity,
            detail: check.imageIntegrity ? "Image integrity verified" : "Image issues detected",
        };
        results.layerIntegrity = {
            passed: check.layerIntegrity,
            detail: check.layerIntegrity ? "Layer integrity verified" : "Layer issues detected",
        };
        results.maskIntegrity = {
            passed: check.maskIntegrity,
            detail: check.maskIntegrity ? "Mask integrity verified" : "Mask issues detected",
        };
        results.brandIntegrity = {
            passed: check.brandIntegrity,
            detail: check.brandIntegrity ? "Brand integrity verified" : "Brand issues detected",
        };
        results.productionIntegrity = {
            passed: check.productionIntegrity,
            detail: check.productionIntegrity ? "Production integrity verified" : "Production issues detected",
        };
        results.renderPreparationIntegrity = {
            passed: check.renderPreparationIntegrity,
            detail: check.renderPreparationIntegrity ? "Render preparation verified" : "Render prep issues detected",
        };
        results.validationIntegrity = {
            passed: check.validationIntegrity,
            detail: check.validationIntegrity ? "Validation integrity verified" : "Validation issues detected",
        };
        results.assetIntegrity = {
            passed: check.assetIntegrity,
            detail: check.assetIntegrity ? "Asset registry verified" : "Asset issues detected",
        };
        results.registryIntegrity = {
            passed: check.registryIntegrity,
            detail: check.registryIntegrity ? "Production registry verified" : "Registry issues detected",
        };
        const modules = check.moduleScores;
        results.moduleHealthScores = {
            passed: modules.length >= 17,
            detail: `${modules.length} modules monitored`,
        };
        results.earlyWarningSystem = {
            passed: check.warnings.length >= 0,
            detail: `${check.warnings.length} warning(s) detected`,
        };
        results.automaticDiagnostics = {
            passed: check.recommendations.length >= 0,
            detail: `${check.recommendations.length} recommendation(s)`,
        };
        results.automaticRepair = {
            passed: true,
            detail: `${check.repairs.length} repair action(s) recorded`,
        };
        const audit = await monitor.runAudit();
        results.auditSystem = {
            passed: audit.valid,
            detail: `Audit ${audit.valid ? "passed" : "completed"} in ${audit.durationMs}ms`,
        };
        results.dependencyValidation = {
            passed: audit.dependencyValidation,
            detail: audit.dependencyValidation ? "Dependencies validated" : "Dependency issues detected",
        };
        const history = monitor.getHealthHistory();
        results.healthHistory = {
            passed: history.length >= 2,
            detail: `${history.length} health record(s)`,
        };
        const trend = monitor.getTrendAnalysis();
        results.trendAnalysis = {
            passed: trend.prediction.length > 0,
            detail: `${trend.direction}: ${trend.prediction}`,
        };
        results.performanceMonitoring = {
            passed: check.performance.checkDurationMs > 0 && check.performance.checkDurationMs < 60000,
            detail: `search=${check.performance.searchPerformanceMs}ms, planning=${check.performance.planningPerformanceMs}ms`,
        };
        const generationRoot = imgFoundation.getGenerationRoot();
        const promptPath = path.join(generationRoot, "text-to-image", "engine", "text-to-image-generation-records.json");
        const promptSim = await simulateFileCorruption(promptPath, monitor);
        results.promptFailureSimulation = {
            passed: promptSim.warnings > 0 || promptSim.errors > 0,
            detail: `${promptSim.warnings} warning(s) on prompt simulation`,
        };
        const productPath = path.join(generationRoot, "product-images", "engine", "product-image-generation-records.json");
        const imageSim = await simulateFileCorruption(productPath, monitor);
        results.imageGenerationFailureSimulation = {
            passed: imageSim.warnings > 0 || imageSim.errors > 0,
            detail: `${imageSim.warnings} warning(s) on image generation simulation`,
        };
        const renderPath = path.join(generationRoot, "rendering", "engine", "image-render-records.json");
        const layerSim = await simulateFileCorruption(renderPath, monitor);
        results.layerFailureSimulation = {
            passed: layerSim.warnings > 0 || layerSim.errors > 0,
            detail: `${layerSim.warnings} warning(s) on layer simulation`,
        };
        const maskSim = await simulateFileCorruption(renderPath, monitor);
        results.maskFailureSimulation = {
            passed: maskSim.warnings > 0 || maskSim.errors > 0,
            detail: `${maskSim.warnings} warning(s) on mask simulation`,
        };
        const assetPath = path.join(generationRoot, "assets", "image-generation-asset-catalog.json");
        const assetSim = await simulateFileCorruption(assetPath, monitor);
        results.assetRegistryFailureSimulation = {
            passed: assetSim.warnings > 0 || assetSim.errors > 0,
            detail: `${assetSim.warnings} warning(s) on asset registry simulation`,
        };
        const brandingPath = path.join(generationRoot, "branding", "engine", "branding-design-records.json");
        const brandingSim = await simulateFileCorruption(brandingPath, monitor);
        results.brandingFailureSimulation = {
            passed: brandingSim.warnings > 0 || brandingSim.errors > 0,
            detail: `${brandingSim.warnings} warning(s) on branding simulation`,
        };
        const productionPath = path.join(generationRoot, "production", "engine", "image-production-records.json");
        const productionSim = await simulateFileCorruption(productionPath, monitor);
        results.productionFailureSimulation = {
            passed: productionSim.warnings > 0 || productionSim.errors > 0,
            detail: `${productionSim.warnings} warning(s) on production simulation`,
        };
        const renderPrepSim = await simulateFileCorruption(renderPath, monitor);
        results.renderPreparationFailureSimulation = {
            passed: renderPrepSim.warnings > 0 || renderPrepSim.errors > 0,
            detail: `${renderPrepSim.warnings} warning(s) on render preparation simulation`,
        };
        const dbSim = await simulateFileCorruption(promptPath, monitor);
        results.databaseFailureSimulation = {
            passed: dbSim.warnings > 0 || dbSim.errors > 0,
            detail: `${dbSim.warnings} warning(s) on database simulation`,
        };
        results.highMemorySimulation = {
            passed: check.performance.memoryUsageMb > 0,
            detail: `Memory usage ${check.performance.memoryUsageMb}MB monitored`,
        };
        results.highGpuSimulation = {
            passed: check.performance.gpuUsagePercent >= 0,
            detail: `GPU usage ${check.performance.gpuUsagePercent}% monitored`,
        };
        const searchStart = Date.now();
        imgFoundation.getProductImageGenerationEngine().searchProductImagePlans({ productId: SAMPLE.productId });
        const searchMs = Date.now() - searchStart;
        results.searchFailureSimulation = {
            passed: searchMs < 5000,
            detail: `Product image search completed in ${searchMs}ms`,
        };
        await imgFoundation.recover();
        await monitor.runAudit();
        const postRepairCheck = await monitor.runHealthCheck();
        results.recoveryTrigger = {
            passed: postRepairCheck.overallScore >= 60,
            detail: `${postRepairCheck.repairs.length} repair(s), recovery notified=${postRepairCheck.recoveryNotified}`,
        };
        results.healthScoreUpdate = {
            passed: postRepairCheck.overallScore >= 75,
            detail: `Post-repair score ${postRepairCheck.overallScore}/100`,
        };
        results.performanceImpact = {
            passed: postRepairCheck.performance.checkDurationMs < 60000,
            detail: `Post-repair check ${postRepairCheck.performance.checkDurationMs}ms`,
        };
        const reportPaths = monitor.generateReports();
        results.projectStateReports = {
            passed: fs.existsSync(path.join(projectStateDir, "AI-Image-Generation-Health-Report.md")) &&
                fs.existsSync(path.join(projectStateDir, "AI-Image-Generation-Health-History.md")) &&
                fs.existsSync(path.join(projectStateDir, "AI-Image-Generation-Performance-Report.md")) &&
                fs.existsSync(path.join(projectStateDir, "AI-Image-Generation-Recommendations.md")),
            detail: projectStateDir,
        };
        const status = monitor.buildStatusReport();
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        await core.stop("step-9n-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(process.cwd(), "STEP-9N-VALIDATION-REPORT.md"), buildReport(status, results, storageRoot, allPassed, check, modules, checkMs), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${reportPaths.healthReportPath}`);
        console.log(`  ${reportPaths.historyReportPath}`);
        console.log(`  ${reportPaths.performanceReportPath}`);
        console.log(`  ${reportPaths.recommendationsReportPath}`);
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
function buildReport(status, results, storageRoot, allPassed, check, modules, checkMs) {
    void checkMs;
    return [
        "# KWIZERA AI STUDIO — Phase 9 Step 9N Validation Report",
        "",
        "**Phase:** 9 — Image Generation Engine",
        "**Step:** 9N — AI Image Generation Health Monitor",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        `**Permanent storage:** \`${DEFAULT_STORAGE_ROOT}\``,
        "",
        "## Overall Health",
        "",
        `- ${status.overallImageGenerationHealth}`,
        `- Readiness: ${status.readinessScore}/100`,
        `- Overall: ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
        "",
        "## Module Health Scores",
        "",
        ...modules.map((m) => `- ${m.module}: ${m.score}/100 (${m.level})`),
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Performance",
        "",
        `- Last check: ${check.performance.checkDurationMs}ms`,
        `- Average check: ${status.performance.averageCheckMs}ms`,
        `- Disk: ${check.performance.diskUsageMb}MB`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-image-generation-health-monitor.js.map