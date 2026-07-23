import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALL_AUDIO_PRODUCTION_ASSET_TYPES, ALL_AUDIO_PRODUCTION_DEPENDENCIES, ALL_AUDIO_PRODUCTION_EXPORT_FORMATS, ALL_AUDIO_PRODUCTION_WORKFLOW_STAGES, AudioMixingPlatform, AudioProductionPlatform, createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-audio-production-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step10j-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI workstation requiring audio production planning",
    features: ["audio production", "mixing"],
    price: 299.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "technology",
    businessType: ProductBusinessType.B2B,
    tags: ["software"],
    keywords: ["kwizera"],
};
const SAMPLE_HEALTH = {
    productId: "step10j-health-app",
    productName: "VitalCare Health App",
    category: ProductAnalysisCategory.Health,
    subcategory: "wellness",
    brand: "VitalCare",
    description: "Health app podcast production",
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
    productId: "step10j-finance-app",
    productName: "PesaSmart Mobile Banking",
    category: ProductAnalysisCategory.Services,
    subcategory: "mobile-banking",
    brand: "PesaSmart",
    description: "Mobile banking audio production",
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
    console.log("KWIZERA AI STUDIO — Step 10J Audio Production Engine Validation");
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
        await core.start("step-10j-validation");
        const initMs = Date.now() - initStart;
        const audioFoundation = core.getManager().audioGenerationFoundation;
        const engine = audioFoundation.getAudioProductionEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete() ? `Production Engine ready in ${initMs}ms` : "Not initialized",
        };
        const registered = audioFoundation.getRegistry().getModule("audio-production-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
        await prepareFullPipeline(piFoundation, SAMPLE_HEALTH, MarketingObjective.BrandAwareness, CreativePlatform.Website);
        await prepareFullPipeline(piFoundation, SAMPLE_FINANCE, MarketingObjective.ProductPromotion, CreativePlatform.TikTok);
        const techSpeech = await audioFoundation.getTextToSpeechGenerationEngine().generateSpeechPlan({
            productId: "step10j-kwizera-pro",
            text: "KWIZERA Pro Studio introduction narration",
            brandName: "KWIZERA",
        });
        const techMusic = await audioFoundation.getMusicGenerationEngine().generateMusicPlan({
            productId: "step10j-kwizera-pro",
            musicPrompt: "Upbeat tech background music",
            brandName: "KWIZERA",
        });
        const techMix = await audioFoundation.getAudioMixingMasteringEngine().generateMixMasterPlan({
            productId: "step10j-kwizera-pro",
            mixPrompt: "Full mix voice music ambient for YouTube production",
            platform: AudioMixingPlatform.YouTube,
            sessionId: "step10j-tech-session",
            voiceTrackRefs: ["voice-tech"],
            musicTrackRefs: ["music-tech"],
        });
        results.upstreamPreparation = {
            passed: techSpeech.success && techMusic.success && techMix.success,
            detail: `Speech ${techSpeech.success ? "✓" : "✗"}, Music ${techMusic.success ? "✓" : "✗"}, Mix ${techMix.success ? "✓" : "✗"}`,
        };
        const tech = await engine.generateProductionPlan({
            productId: "step10j-kwizera-pro",
            mixingPlanId: techMix.record.mixingPlanId,
            masteringPlanId: techMix.record.masteringPlanId,
            audioPlanId: techMix.record.mixingPlanId,
            sessionId: "step10j-tech-session",
            voicePlanIds: techSpeech.record ? [techSpeech.record.speechPlanId] : [],
            musicPlanIds: techMusic.record ? [techMusic.record.musicPlanId] : [],
            voiceTrackRefs: ["voice-tech-main"],
            musicTrackRefs: ["music-tech-bed"],
            brandId: "KWIZERA",
            platform: AudioProductionPlatform.YouTube,
            videoId: "step10j-tech-video",
            validateAllWorkflows: true,
            validateAllAssets: true,
            prepareExports: true,
            preparePlatformRules: true,
        });
        const healthMix = await audioFoundation.getAudioMixingMasteringEngine().generateMixMasterPlan({
            productId: "step10j-health-app",
            mixPrompt: "Podcast voice and ambient mix",
            platform: AudioMixingPlatform.Podcast,
            sessionId: "step10j-health-session",
        });
        const health = await engine.generateProductionPlan({
            productId: "step10j-health-app",
            mixingPlanId: healthMix.record.mixingPlanId,
            audioPlanId: healthMix.record.mixingPlanId,
            sessionId: "step10j-health-session",
            brandId: "VitalCare",
            platform: AudioProductionPlatform.Podcast,
            prepareExports: true,
        });
        const financeMix = await audioFoundation.getAudioMixingMasteringEngine().generateMixMasterPlan({
            productId: "step10j-finance-app",
            mixPrompt: "TikTok ad music and voice mix",
            platform: AudioMixingPlatform.TikTok,
            sessionId: "step10j-finance-session",
        });
        const finance = await engine.generateProductionPlan({
            productId: "step10j-finance-app",
            mixingPlanId: financeMix.record.mixingPlanId,
            audioPlanId: financeMix.record.mixingPlanId,
            brandId: "PesaSmart",
            platform: AudioProductionPlatform.TikTok,
            prepareExports: true,
        });
        const film = await engine.generateProductionPlan({
            productionPrompt: "Cinema film audio production with dialogue music and surround for KWIZERA",
            brandName: "KWIZERA",
            platform: AudioProductionPlatform.Film,
            sessionId: "step10j-film-session",
            prepareExports: true,
            preparePlatformRules: true,
        });
        results.productionPlanGeneration = {
            passed: tech.success && health.success && finance.success && film.success,
            detail: `Tech ${tech.success ? "✓" : "✗"}, Health ${health.success ? "✓" : "✗"}, Finance ${finance.success ? "✓" : "✗"}, Film ${film.success ? "✓" : "✗"}`,
        };
        results.workflowValidation = {
            passed: (tech.record?.workflowValidation.length ?? 0) === ALL_AUDIO_PRODUCTION_WORKFLOW_STAGES.length &&
                tech.record?.workflowValidation.every((w) => w.validated) === true,
            detail: `${tech.record?.workflowValidation.filter((w) => w.validated).length}/${ALL_AUDIO_PRODUCTION_WORKFLOW_STAGES.length} workflows validated`,
        };
        results.assetValidation = {
            passed: (tech.record?.assetValidation.length ?? 0) === ALL_AUDIO_PRODUCTION_ASSET_TYPES.length &&
                (tech.record?.assetValidation.filter((a) => a.validated).length ?? 0) >= 6,
            detail: `${tech.record?.assetValidation.filter((a) => a.validated).length}/${ALL_AUDIO_PRODUCTION_ASSET_TYPES.length} assets validated`,
        };
        results.dependencyValidation = {
            passed: (tech.record?.dependencyValidation.length ?? 0) === ALL_AUDIO_PRODUCTION_DEPENDENCIES.length &&
                tech.record?.dependencyValidation.every((d) => d.available) === true,
            detail: `${tech.record?.dependencyValidation.filter((d) => d.available).length}/${ALL_AUDIO_PRODUCTION_DEPENDENCIES.length} dependencies available`,
        };
        results.trackValidation = {
            passed: (tech.record?.productionStructure.trackStructure.length ?? 0) >= 5 &&
                (tech.record?.trackValidation.filter((t) => t.validated).length ?? 0) >= 3,
            detail: `${tech.record?.productionStructure.trackStructure.length} tracks, ${tech.record?.trackValidation.filter((t) => t.validated).length} validated`,
        };
        results.renderPreparation = {
            passed: Boolean(tech.record?.renderPreparation.sampleRate) &&
                (tech.record?.renderPreparation.bitDepth ?? 0) >= 16 &&
                tech.record?.renderPreparation.instructions.length >= 2,
            detail: `${tech.record?.renderPreparation.sampleRate}Hz, ${tech.record?.renderPreparation.channelLayout}`,
        };
        results.exportPreparation = {
            passed: (tech.record?.exportPreparation.exports.length ?? 0) >= ALL_AUDIO_PRODUCTION_EXPORT_FORMATS.length &&
                tech.record?.exportPreparation.extensibleFormats.length >= 1,
            detail: `${tech.record?.exportPreparation.exports.length} export formats`,
        };
        results.productionScores = {
            passed: (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
                (tech.record?.scores.workflowScore ?? 0) >= 55 &&
                (tech.record?.scores.dependencyScore ?? 0) >= 55 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Readiness ${tech.record?.scores.productionReadinessScore}, workflow ${tech.record?.scores.workflowScore}`,
        };
        results.relationships = {
            passed: (tech.record?.relationships.productionPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.products.length ?? 0) >= 1 &&
                (tech.record?.relationships.mixingPlans.length ?? 0) >= 1,
            detail: `Production ${tech.record?.relationships.productionPlans.length}, products ${tech.record?.relationships.products.length}`,
        };
        results.productionReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: `Ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
        };
        results.brandConsistency = {
            passed: tech.record?.brandConsistent === true,
            detail: `Brand consistent: ${tech.record?.brandConsistent}, score via workflow ${tech.record?.scores.workflowScore}`,
        };
        const noContext = await engine.generateProductionPlan({ productId: "step10j-nonexistent" });
        results.incompleteRejection = {
            passed: !noContext.success,
            detail: noContext.message ?? "Rejected",
        };
        const promptOnly = await engine.generateProductionPlan({
            productionPrompt: "Voice and music production for KWIZERA creative workspace",
            brandName: "KWIZERA",
            platform: AudioProductionPlatform.Website,
        });
        results.promptOnlyGeneration = {
            passed: promptOnly.success,
            detail: promptOnly.success ? "Prompt-only plan generated" : "Failed",
        };
        const repaired = await engine.repairProductionPlan("step10j-health-app", AudioProductionPlatform.Radio);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Repair verified" : "Failed",
        };
        results.searchByProduct = {
            passed: engine.searchProductionPlans({ productId: "step10j-kwizera-pro" }).length >= 1,
            detail: `${engine.searchProductionPlans({ productId: "step10j-kwizera-pro" }).length} by product`,
        };
        results.searchByPlatform = {
            passed: engine.searchProductionPlans({ platform: AudioProductionPlatform.Film }).length >= 1,
            detail: `${engine.searchProductionPlans({ platform: AudioProductionPlatform.Film }).length} by platform`,
        };
        results.searchByTrack = {
            passed: engine.searchProductionPlans({ track: "voice" }).length >= 1,
            detail: `${engine.searchProductionPlans({ track: "voice" }).length} by track`,
        };
        results.searchByKeywords = {
            passed: engine.searchProductionPlans({ keywords: "kwizera" }).length >= 1,
            detail: `${engine.searchProductionPlans({ keywords: "kwizera" }).length} by keywords`,
        };
        const prodAsset = audioFoundation.getAssetRegistry().getAsset(tech.record.audioProductionId);
        const templateAsset = audioFoundation.getAssetRegistry().getAsset(`production-template-${tech.record.audioProductionId}`);
        results.generationAssetRegistration = {
            passed: prodAsset?.assetType === "render-profile" && templateAsset?.assetType === "template",
            detail: `Production ${prodAsset?.assetId}, Template ${templateAsset?.assetId}`,
        };
        const blueprint = audioFoundation.getBlueprintManager().getBlueprint(tech.record.blueprintId);
        results.blueprintLink = {
            passed: Boolean(blueprint?.blueprintId),
            detail: blueprint ? `Blueprint ${blueprint.blueprintId}` : "Not found",
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageGenerationMs < 120000,
            detail: `avg ${status.performance.averageGenerationMs}ms`,
        };
        const logFile = path.join(storageRoot, "logs", `audio-production-engine-${new Date().toISOString().slice(0, 10)}.jsonl`);
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
        await core.stop("step-10j-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Audio-Production-Report.md"), buildMainReport(status, results, allPassed, tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Production-Workflow-Report.md"), buildWorkflowReport(tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Asset-Validation-Report.md"), buildAssetReport(tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Track-Validation-Report.md"), buildTrackReport(tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Production-Readiness-Report.md"), buildReadinessReport(status, tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-10J-VALIDATION-REPORT.md"), buildMainReport(status, results, allPassed, tech.record, health.record, finance.record, film.record), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Audio-Production-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Production-Workflow-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Asset-Validation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Track-Validation-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 10 Step 10J Audio Production Report",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
        `**Readiness:** ${status.readinessScore}/100`,
        `**Plans Generated:** ${status.productionPlansGenerated}`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅" : "❌"} — ${r.detail}`),
        "",
        "## Plans",
        `- Tech (YouTube): readiness ${tech?.scores.productionReadinessScore ?? 0}/100`,
        `- Health (Podcast): workflow ${health?.scores.workflowScore ?? 0}/100`,
        `- Finance (TikTok): assets ${finance?.scores.assetReadinessScore ?? 0}/100`,
        `- Film (Cinema): dependencies ${film?.scores.dependencyScore ?? 0}/100`,
        "",
    ].join("\n");
}
function buildWorkflowReport(...records) {
    const rows = records.filter(Boolean);
    return [
        "# Production Workflow Report — Step 10J",
        "",
        "| Plan | Platform | Workflows Validated | Workflow Score |",
        "|------|----------|----------------------|----------------|",
        ...rows.map((r) => `| ${r.profile.audioPlanId.slice(0, 25)}... | ${r.profile.platform} | ${r.workflowValidation.filter((w) => w.validated).length}/${r.workflowValidation.length} | ${r.scores.workflowScore}/100 |`),
    ].join("\n");
}
function buildAssetReport(...records) {
    const rows = records.filter(Boolean);
    return [
        "# Asset Validation Report — Step 10J",
        "",
        "| Plan | Platform | Assets Validated | Asset Score |",
        "|------|----------|------------------|-------------|",
        ...rows.map((r) => `| ${r.profile.platform} | ${r.profile.platform} | ${r.assetValidation.filter((a) => a.validated).length}/${r.assetValidation.length} | ${r.scores.assetReadinessScore}/100 |`),
    ].join("\n");
}
function buildTrackReport(...records) {
    const rows = records.filter(Boolean);
    return [
        "# Track Validation Report — Step 10J",
        "",
        "| Plan | Tracks | Buses | Timeline Cues | Track Score |",
        "|------|--------|-------|---------------|-------------|",
        ...rows.map((r) => `| ${r.profile.platform} | ${r.productionStructure.trackStructure.length} | ${r.productionStructure.busStructure.length} | ${r.productionStructure.timelineStructure.length} | ${r.scores.trackIntegrityScore}/100 |`),
    ].join("\n");
}
function buildReadinessReport(status, ...records) {
    const rows = records.filter(Boolean);
    return [
        "# Production Readiness Report — Step 10J",
        "",
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Plan | Production | Assets | Workflow | Tracks | Dependencies | Confidence | Ready |",
        "|------|------------|--------|----------|--------|--------------|------------|-------|",
        ...rows.map((r) => `| ${r.profile.platform} | ${r.scores.productionReadinessScore} | ${r.scores.assetReadinessScore} | ${r.scores.workflowScore} | ${r.scores.trackIntegrityScore} | ${r.scores.dependencyScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`),
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-audio-production-engine.js.map