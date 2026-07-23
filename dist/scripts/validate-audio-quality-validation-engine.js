import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALL_AUDIO_BRAND_VALIDATION_CHECKS, ALL_AUDIO_QUALITY_CHECKS, ALL_AUDIO_QUALITY_TIMELINE_CHECKS, ALL_AUDIO_QUALITY_TRACK_CHECKS, ALL_AUDIO_QUALITY_VALIDATION_PLATFORMS, ALL_AUDIO_SYNC_CHECKS, ALL_AUDIO_TECHNICAL_VALIDATION_CHECKS, AudioMixingPlatform, AudioProductionPlatform, AudioQualityValidationPlatform, AudioRenderPlatform, createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-audio-quality-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step10l-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI workstation requiring audio quality validation",
    features: ["audio quality", "mixing"],
    price: 299.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "technology",
    businessType: ProductBusinessType.B2B,
    tags: ["software"],
    keywords: ["kwizera"],
};
const SAMPLE_HEALTH = {
    productId: "step10l-health-app",
    productName: "VitalCare Health App",
    category: ProductAnalysisCategory.Health,
    subcategory: "wellness",
    brand: "VitalCare",
    description: "Health app podcast quality validation",
    features: ["podcast"],
    price: 9.99,
    currency: "EUR",
    availability: ProductAvailabilityStatus.InStock,
    industry: "health",
    businessType: ProductBusinessType.B2C,
    tags: ["health"],
    keywords: ["vitalcare"],
};
const SAMPLE_FINANCE = {
    productId: "step10l-finance-app",
    productName: "PesaSmart Mobile Banking",
    category: ProductAnalysisCategory.Services,
    subcategory: "mobile-banking",
    brand: "PesaSmart",
    description: "Mobile banking audio quality validation",
    features: ["malipo"],
    price: 0,
    currency: "KES",
    availability: ProductAvailabilityStatus.InStock,
    industry: "general",
    businessType: ProductBusinessType.B2C,
    tags: ["finance"],
    keywords: ["pesasmart"],
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
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 10L Audio Quality Validation Engine Validation");
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
        await core.start("step-10l-validation");
        const initMs = Date.now() - initStart;
        const audioFoundation = core.getManager().audioGenerationFoundation;
        const productionEngine = audioFoundation.getAudioProductionEngine();
        const renderEngine = audioFoundation.getAudioRenderingPreparationEngine();
        const engine = audioFoundation.getAudioQualityValidationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete() ? `Quality Validation Engine ready in ${initMs}ms` : "Not initialized",
        };
        const registered = audioFoundation.getRegistry().getModule("audio-quality-validation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
        await prepareFullPipeline(piFoundation, SAMPLE_HEALTH, MarketingObjective.BrandAwareness, CreativePlatform.Website);
        await prepareFullPipeline(piFoundation, SAMPLE_FINANCE, MarketingObjective.ProductPromotion, CreativePlatform.TikTok);
        const techMix = await audioFoundation.getAudioMixingMasteringEngine().generateMixMasterPlan({
            productId: "step10l-kwizera-pro",
            mixPrompt: "Full mix for quality validation",
            platform: AudioMixingPlatform.YouTube,
            sessionId: "step10l-tech-session",
            voiceTrackRefs: ["voice-tech"],
            musicTrackRefs: ["music-tech"],
        });
        const techSpeech = await audioFoundation.getTextToSpeechGenerationEngine().generateSpeechPlan({
            productId: "step10l-kwizera-pro",
            text: "KWIZERA quality validation narration",
            brandName: "KWIZERA",
        });
        const techMusic = await audioFoundation.getMusicGenerationEngine().generateMusicPlan({
            productId: "step10l-kwizera-pro",
            musicPrompt: "Tech background music",
            brandName: "KWIZERA",
        });
        const techProduction = await productionEngine.generateProductionPlan({
            productId: "step10l-kwizera-pro",
            mixingPlanId: techMix.record.mixingPlanId,
            audioPlanId: techMix.record.mixingPlanId,
            sessionId: "step10l-tech-session",
            voicePlanIds: techSpeech.record ? [techSpeech.record.speechPlanId] : [],
            musicPlanIds: techMusic.record ? [techMusic.record.musicPlanId] : [],
            brandId: "KWIZERA",
            platform: AudioProductionPlatform.YouTube,
            prepareExports: true,
        });
        const healthMix = await audioFoundation.getAudioMixingMasteringEngine().generateMixMasterPlan({
            productId: "step10l-health-app",
            mixPrompt: "Podcast mix",
            platform: AudioMixingPlatform.Podcast,
            sessionId: "step10l-health-session",
        });
        const healthProduction = await productionEngine.generateProductionPlan({
            productId: "step10l-health-app",
            mixingPlanId: healthMix.record.mixingPlanId,
            audioPlanId: healthMix.record.mixingPlanId,
            brandId: "VitalCare",
            platform: AudioProductionPlatform.Podcast,
            prepareExports: true,
        });
        const financeMix = await audioFoundation.getAudioMixingMasteringEngine().generateMixMasterPlan({
            productId: "step10l-finance-app",
            mixPrompt: "TikTok mix",
            platform: AudioMixingPlatform.TikTok,
            sessionId: "step10l-finance-session",
        });
        const financeProduction = await productionEngine.generateProductionPlan({
            productId: "step10l-finance-app",
            mixingPlanId: financeMix.record.mixingPlanId,
            audioPlanId: financeMix.record.mixingPlanId,
            brandId: "PesaSmart",
            platform: AudioProductionPlatform.TikTok,
            prepareExports: true,
        });
        const techRender = await renderEngine.generateRenderPlan({
            productId: "step10l-kwizera-pro",
            productionId: techProduction.record.audioProductionId,
            platform: AudioRenderPlatform.YouTube,
            voicePlanIds: techSpeech.record ? [techSpeech.record.speechPlanId] : [],
            musicPlanIds: techMusic.record ? [techMusic.record.musicPlanId] : [],
            prepareOutputProfiles: true,
            generateRenderJobs: true,
        });
        const healthRender = await renderEngine.generateRenderPlan({
            productId: "step10l-health-app",
            productionId: healthProduction.record.audioProductionId,
            platform: AudioRenderPlatform.Podcast,
            prepareOutputProfiles: true,
        });
        const financeRender = await renderEngine.generateRenderPlan({
            productId: "step10l-finance-app",
            productionId: financeProduction.record.audioProductionId,
            platform: AudioRenderPlatform.TikTok,
            prepareOutputProfiles: true,
        });
        results.upstreamPreparation = {
            passed: techRender.success && healthRender.success && financeRender.success,
            detail: `Render Tech ${techRender.success ? "✓" : "✗"}, Health ${healthRender.success ? "✓" : "✗"}, Finance ${financeRender.success ? "✓" : "✗"}`,
        };
        const tech = await engine.validateAudioQuality({
            productId: "step10l-kwizera-pro",
            renderPlanId: techRender.record.audioRenderPlanId,
            productionId: techProduction.record.audioProductionId,
            brandId: "KWIZERA",
            platform: AudioQualityValidationPlatform.YouTube,
            voicePlanIds: techSpeech.record ? [techSpeech.record.speechPlanId] : [],
            musicPlanIds: techMusic.record ? [techMusic.record.musicPlanId] : [],
            autoRepair: true,
            validatePlatform: true,
        });
        const health = await engine.validateAudioQuality({
            productId: "step10l-health-app",
            renderPlanId: healthRender.record.audioRenderPlanId,
            productionId: healthProduction.record.audioProductionId,
            platform: AudioQualityValidationPlatform.Podcast,
            autoRepair: true,
        });
        const finance = await engine.validateAudioQuality({
            productId: "step10l-finance-app",
            renderPlanId: financeRender.record.audioRenderPlanId,
            productionId: financeProduction.record.audioProductionId,
            platform: AudioQualityValidationPlatform.TikTok,
            autoRepair: true,
        });
        const film = await engine.validateAudioQuality({
            validationPrompt: "Cinema film audio quality validation for KWIZERA surround production",
            brandName: "KWIZERA",
            platform: AudioQualityValidationPlatform.Film,
            autoRepair: true,
        });
        results.qualityValidation = {
            passed: tech.success && health.success && finance.success && film.success,
            detail: `Tech ${tech.success ? "✓" : "✗"}, Health ${health.success ? "✓" : "✗"}, Finance ${finance.success ? "✓" : "✗"}, Film ${film.success ? "✓" : "✗"}`,
        };
        results.audioQualityChecks = {
            passed: (tech.record?.audioQuality.length ?? 0) === ALL_AUDIO_QUALITY_CHECKS.length &&
                (tech.record?.audioQuality.filter((e) => e.validated).length ?? 0) >= 8,
            detail: `${tech.record?.audioQuality.filter((e) => e.validated).length}/${ALL_AUDIO_QUALITY_CHECKS.length} audio quality checks passed`,
        };
        results.trackValidation = {
            passed: (tech.record?.trackValidation.length ?? 0) === ALL_AUDIO_QUALITY_TRACK_CHECKS.length &&
                tech.record?.trackValidation.every((t) => t.validated) === true,
            detail: `${tech.record?.trackValidation.filter((t) => t.validated).length}/${ALL_AUDIO_QUALITY_TRACK_CHECKS.length} track checks passed`,
        };
        results.timelineValidation = {
            passed: (tech.record?.timelineValidation.length ?? 0) === ALL_AUDIO_QUALITY_TIMELINE_CHECKS.length &&
                tech.record?.timelineValidation.every((t) => t.validated) === true,
            detail: `${tech.record?.timelineValidation.filter((t) => t.validated).length}/${ALL_AUDIO_QUALITY_TIMELINE_CHECKS.length} timeline checks passed`,
        };
        results.syncValidation = {
            passed: (tech.record?.syncValidation.length ?? 0) === ALL_AUDIO_SYNC_CHECKS.length &&
                tech.record?.syncValidation.every((s) => s.validated) === true,
            detail: `${tech.record?.syncValidation.filter((s) => s.validated).length}/${ALL_AUDIO_SYNC_CHECKS.length} sync checks passed`,
        };
        results.brandValidation = {
            passed: (tech.record?.brandValidation.length ?? 0) === ALL_AUDIO_BRAND_VALIDATION_CHECKS.length &&
                tech.record?.brandValidation.every((b) => b.validated) === true,
            detail: `${tech.record?.brandValidation.filter((b) => b.validated).length}/${ALL_AUDIO_BRAND_VALIDATION_CHECKS.length} brand checks passed`,
        };
        results.technicalValidation = {
            passed: (tech.record?.technicalValidation.length ?? 0) === ALL_AUDIO_TECHNICAL_VALIDATION_CHECKS.length &&
                (tech.record?.technicalValidation.filter((t) => t.validated).length ?? 0) >= 5,
            detail: `${tech.record?.technicalValidation.filter((t) => t.validated).length}/${ALL_AUDIO_TECHNICAL_VALIDATION_CHECKS.length} technical checks passed`,
        };
        results.platformValidation = {
            passed: (tech.record?.platformValidation.length ?? 0) >= ALL_AUDIO_QUALITY_VALIDATION_PLATFORMS.length,
            detail: `${tech.record?.platformValidation.length} platform profiles validated`,
        };
        results.qualityScores = {
            passed: (tech.record?.scores.overallAudioQualityScore ?? 0) >= 55 &&
                (tech.record?.scores.loudnessScore ?? 0) >= 55 &&
                (tech.record?.scores.synchronizationScore ?? 0) >= 55 &&
                (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Overall ${tech.record?.scores.overallAudioQualityScore}, loudness ${tech.record?.scores.loudnessScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.issueDetection = {
            passed: Array.isArray(tech.record?.issues),
            detail: `${tech.record?.issues.length} issue(s), ${tech.record?.issues.filter((i) => i.repaired).length} repaired`,
        };
        results.relationships = {
            passed: (tech.record?.relationships.productionPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.renderPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.products.length ?? 0) >= 1,
            detail: `Production ${tech.record?.relationships.productionPlans.length}, render ${tech.record?.relationships.renderPlans.length}`,
        };
        results.approval = {
            passed: tech.record?.approved === true && tech.record?.validated === true,
            detail: `Approved: ${tech.record?.approved}, validated: ${tech.record?.validated}`,
        };
        results.renderReadiness = {
            passed: tech.record?.renderReady === true,
            detail: `Render ready: ${tech.record?.renderReady}, production ready: ${tech.record?.productionReady}`,
        };
        const noContext = await engine.validateAudioQuality({ productId: "step10l-nonexistent" });
        results.incompleteRejection = {
            passed: !noContext.success,
            detail: noContext.message ?? "Rejected without context",
        };
        const repaired = await engine.repairAndRevalidate("step10l-kwizera-pro", AudioQualityValidationPlatform.Mobile);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? `Repair verified, ${repaired.record?.repairsApplied.length} repair(s)` : "Repair failed",
        };
        const scoreSearch = engine.searchValidations({ minQualityScore: 55 });
        results.searchByQualityScore = {
            passed: scoreSearch.length >= 1,
            detail: `${scoreSearch.length} result(s) by quality score`,
        };
        const platformSearch = engine.searchValidations({ platform: AudioQualityValidationPlatform.YouTube });
        results.searchByPlatform = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const keywordSearch = engine.searchValidations({ keywords: "kwizera" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const assetSearch = engine.searchValidations({ audioPlanId: tech.record.profile.audioPlanId });
        results.searchByAudioAsset = {
            passed: assetSearch.length >= 1,
            detail: `${assetSearch.length} result(s) by audio asset`,
        };
        const validationAsset = audioFoundation.getAssetRegistry().getAsset(tech.record.audioQualityValidationId);
        results.generationAssetRegistration = {
            passed: validationAsset?.assetType === "render-profile",
            detail: `Validation asset ${validationAsset?.assetId}`,
        };
        const blueprint = audioFoundation.getBlueprintManager().getBlueprint(tech.record.blueprintId);
        results.blueprintLink = {
            passed: Boolean(blueprint?.blueprintId),
            detail: blueprint ? `Blueprint ${blueprint.blueprintId}` : "Not found",
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageValidationMs < 120000,
            detail: `avg ${status.performance.averageValidationMs}ms`,
        };
        const logFile = path.join(storageRoot, "logs", `audio-quality-validation-engine-${new Date().toISOString().slice(0, 10)}.jsonl`);
        results.logging = { passed: fs.existsSync(logFile), detail: logFile };
        results.readiness = { passed: status.readinessScore >= 85, detail: `Readiness ${status.readinessScore}/100` };
        results.multiIndustry = {
            passed: health.success && finance.success,
            detail: `Health ${health.record?.profile.platform}, Finance ${finance.record?.profile.platform}`,
        };
        results.recommendations = {
            passed: (tech.record?.recommendations.length ?? 0) >= 1,
            detail: `${tech.record?.recommendations.length} recommendation(s)`,
        };
        await core.stop("step-10l-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Audio-Quality-Validation-Report.md"), buildMainReport(status, results, allPassed, tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Audio-Quality-Report.md"), buildAudioQualityReport(tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Synchronization-Validation-Report.md"), buildSyncReport(tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Brand-Validation-Report.md"), buildBrandReport(tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Production-Readiness-Report.md"), buildReadinessReport(status, tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-10L-VALIDATION-REPORT.md"), buildMainReport(status, results, allPassed, tech.record, health.record, finance.record, film.record), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Audio-Quality-Validation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Audio-Quality-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Synchronization-Validation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Brand-Validation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Production-Readiness-Report.md")}`);
        if (useTemp && fs.existsSync(storageRoot))
            fs.rmSync(storageRoot, { recursive: true, force: true });
        process.exit(allPassed ? 0 : 1);
    }
    catch (error) {
        console.error("Validation failed:", error);
        process.exit(1);
    }
}
function buildMainReport(status, results, allPassed, tech, health, finance, film) {
    return [
        "# KWIZERA AI STUDIO — Phase 10 Step 10L Audio Quality Validation Report",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
        `**Readiness:** ${status.readinessScore}/100`,
        `**Validations Performed:** ${status.validationsPerformed}`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅" : "❌"} — ${r.detail}`),
        "",
        "## Validations",
        `- Tech (YouTube): overall ${tech?.scores.overallAudioQualityScore ?? 0}/100`,
        `- Health (Podcast): sync ${health?.scores.synchronizationScore ?? 0}/100`,
        `- Finance (TikTok): brand ${finance?.scores.brandConsistencyScore ?? 0}/100`,
        `- Film (Cinema): loudness ${film?.scores.loudnessScore ?? 0}/100`,
        "",
    ].join("\n");
}
function buildAudioQualityReport(...records) {
    const rows = records.filter(Boolean);
    return [
        "# Audio Quality Report — Step 10L",
        "",
        "| Plan | Platform | Checks Passed | Loudness | Frequency | Overall |",
        "|------|----------|---------------|----------|-----------|---------|",
        ...rows.map((r) => `| ${r.profile.platform} | ${r.profile.platform} | ${r.audioQuality.filter((e) => e.validated).length}/${r.audioQuality.length} | ${r.scores.loudnessScore} | ${r.scores.frequencyBalanceScore} | ${r.scores.overallAudioQualityScore}/100 |`),
    ].join("\n");
}
function buildSyncReport(...records) {
    const rows = records.filter(Boolean);
    return [
        "# Synchronization Validation Report — Step 10L",
        "",
        "| Plan | Sync Checks | Sync Score | Issues |",
        "|------|-------------|------------|--------|",
        ...rows.map((r) => `| ${r.profile.platform} | ${r.syncValidation.filter((s) => s.validated).length}/${r.syncValidation.length} | ${r.scores.synchronizationScore}/100 | ${r.issues.filter((i) => i.category === "sync-problem").length} |`),
    ].join("\n");
}
function buildBrandReport(...records) {
    const rows = records.filter(Boolean);
    return [
        "# Brand Validation Report — Step 10L",
        "",
        "| Plan | Brand Checks | Brand Score | Approved |",
        "|------|--------------|-------------|----------|",
        ...rows.map((r) => `| ${r.profile.platform} | ${r.brandValidation.filter((b) => b.validated).length}/${r.brandValidation.length} | ${r.scores.brandConsistencyScore}/100 | ${r.approved ? "✅" : "❌"} |`),
    ].join("\n");
}
function buildReadinessReport(status, ...records) {
    const rows = records.filter(Boolean);
    return [
        "# Production Readiness Report — Step 10L",
        "",
        `**Engine Readiness:** ${status.readinessScore}/100`,
        `**Average Approval Rate:** ${status.averageApprovalRate}%`,
        "",
        "| Plan | Overall | Production | Platform | Confidence | Approved | Render Ready |",
        "|------|---------|------------|----------|------------|----------|--------------|",
        ...rows.map((r) => `| ${r.profile.platform} | ${r.scores.overallAudioQualityScore} | ${r.scores.productionReadinessScore} | ${r.scores.platformCompatibilityScore} | ${r.scores.aiConfidenceScore} | ${r.approved ? "✅" : "❌"} | ${r.renderReady ? "✅" : "❌"} |`),
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-audio-quality-validation-engine.js.map