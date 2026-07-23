import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALL_AUDIO_RENDER_ASSET_TYPES, ALL_AUDIO_RENDER_PLATFORMS, ALL_AUDIO_RENDER_TIMELINE_CHECKS, ALL_AUDIO_RENDER_TRACK_CHECKS, ALL_AUDIO_RENDER_VALIDATION_STAGES, AudioMixingPlatform, AudioProductionPlatform, AudioRenderCodec, AudioRenderPlatform, createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-audio-render-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step10k-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI workstation requiring audio render preparation",
    features: ["audio rendering", "mixing"],
    price: 299.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "technology",
    businessType: ProductBusinessType.B2B,
    tags: ["software"],
    keywords: ["kwizera"],
};
const SAMPLE_HEALTH = {
    productId: "step10k-health-app",
    productName: "VitalCare Health App",
    category: ProductAnalysisCategory.Health,
    subcategory: "wellness",
    brand: "VitalCare",
    description: "Health app podcast render preparation",
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
    productId: "step10k-finance-app",
    productName: "PesaSmart Mobile Banking",
    category: ProductAnalysisCategory.Services,
    subcategory: "mobile-banking",
    brand: "PesaSmart",
    description: "Mobile banking audio render preparation",
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
    console.log("KWIZERA AI STUDIO — Step 10K Audio Rendering Preparation Engine Validation");
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
        await core.start("step-10k-validation");
        const initMs = Date.now() - initStart;
        const audioFoundation = core.getManager().audioGenerationFoundation;
        const productionEngine = audioFoundation.getAudioProductionEngine();
        const engine = audioFoundation.getAudioRenderingPreparationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete() ? `Rendering Preparation Engine ready in ${initMs}ms` : "Not initialized",
        };
        const registered = audioFoundation.getRegistry().getModule("audio-rendering-preparation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        const productionRegistered = audioFoundation.getRegistry().getModule("audio-production-engine");
        results.productionModuleRegistration = {
            passed: productionRegistered?.implemented === true && productionRegistered.status === "active",
            detail: `Production module ${productionRegistered?.status}, v${productionRegistered?.version}`,
        };
        await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
        await prepareFullPipeline(piFoundation, SAMPLE_HEALTH, MarketingObjective.BrandAwareness, CreativePlatform.Website);
        await prepareFullPipeline(piFoundation, SAMPLE_FINANCE, MarketingObjective.ProductPromotion, CreativePlatform.TikTok);
        const techSpeech = await audioFoundation.getTextToSpeechGenerationEngine().generateSpeechPlan({
            productId: "step10k-kwizera-pro",
            text: "KWIZERA Pro Studio introduction narration",
            brandName: "KWIZERA",
        });
        const techMusic = await audioFoundation.getMusicGenerationEngine().generateMusicPlan({
            productId: "step10k-kwizera-pro",
            musicPrompt: "Upbeat tech background music",
            brandName: "KWIZERA",
        });
        const techMix = await audioFoundation.getAudioMixingMasteringEngine().generateMixMasterPlan({
            productId: "step10k-kwizera-pro",
            mixPrompt: "Full mix voice music ambient for YouTube production",
            platform: AudioMixingPlatform.YouTube,
            sessionId: "step10k-tech-session",
            voiceTrackRefs: ["voice-tech"],
            musicTrackRefs: ["music-tech"],
        });
        const techProduction = await productionEngine.generateProductionPlan({
            productId: "step10k-kwizera-pro",
            mixingPlanId: techMix.record.mixingPlanId,
            masteringPlanId: techMix.record.masteringPlanId,
            audioPlanId: techMix.record.mixingPlanId,
            sessionId: "step10k-tech-session",
            voicePlanIds: techSpeech.record ? [techSpeech.record.speechPlanId] : [],
            musicPlanIds: techMusic.record ? [techMusic.record.musicPlanId] : [],
            voiceTrackRefs: ["voice-tech-main"],
            musicTrackRefs: ["music-tech-bed"],
            brandId: "KWIZERA",
            platform: AudioProductionPlatform.YouTube,
            prepareExports: true,
            preparePlatformRules: true,
        });
        const healthMix = await audioFoundation.getAudioMixingMasteringEngine().generateMixMasterPlan({
            productId: "step10k-health-app",
            mixPrompt: "Podcast voice and ambient mix",
            platform: AudioMixingPlatform.Podcast,
            sessionId: "step10k-health-session",
        });
        const healthProduction = await productionEngine.generateProductionPlan({
            productId: "step10k-health-app",
            mixingPlanId: healthMix.record.mixingPlanId,
            audioPlanId: healthMix.record.mixingPlanId,
            sessionId: "step10k-health-session",
            brandId: "VitalCare",
            platform: AudioProductionPlatform.Podcast,
            prepareExports: true,
        });
        const financeMix = await audioFoundation.getAudioMixingMasteringEngine().generateMixMasterPlan({
            productId: "step10k-finance-app",
            mixPrompt: "TikTok ad music and voice mix",
            platform: AudioMixingPlatform.TikTok,
            sessionId: "step10k-finance-session",
        });
        const financeProduction = await productionEngine.generateProductionPlan({
            productId: "step10k-finance-app",
            mixingPlanId: financeMix.record.mixingPlanId,
            audioPlanId: financeMix.record.mixingPlanId,
            brandId: "PesaSmart",
            platform: AudioProductionPlatform.TikTok,
            prepareExports: true,
        });
        results.upstreamPreparation = {
            passed: techProduction.success && healthProduction.success && financeProduction.success,
            detail: `Production Tech ${techProduction.success ? "✓" : "✗"}, Health ${healthProduction.success ? "✓" : "✗"}, Finance ${financeProduction.success ? "✓" : "✗"}`,
        };
        const tech = await engine.generateRenderPlan({
            productId: "step10k-kwizera-pro",
            productionId: techProduction.record.audioProductionId,
            audioId: techProduction.record.profile.audioPlanId,
            audioPlanId: techProduction.record.profile.audioPlanId,
            sessionId: "step10k-tech-session",
            brandId: "KWIZERA",
            platform: AudioRenderPlatform.YouTube,
            voicePlanIds: techSpeech.record ? [techSpeech.record.speechPlanId] : [],
            musicPlanIds: techMusic.record ? [techMusic.record.musicPlanId] : [],
            validateTracks: true,
            validateTimeline: true,
            validateAssets: true,
            planResources: true,
            prepareOutputProfiles: true,
            generateRenderJobs: true,
        });
        const health = await engine.generateRenderPlan({
            productId: "step10k-health-app",
            productionId: healthProduction.record.audioProductionId,
            platform: AudioRenderPlatform.Podcast,
            prepareOutputProfiles: true,
            generateRenderJobs: true,
        });
        const finance = await engine.generateRenderPlan({
            productId: "step10k-finance-app",
            productionId: financeProduction.record.audioProductionId,
            platform: AudioRenderPlatform.TikTok,
            prepareOutputProfiles: true,
            generateRenderJobs: true,
        });
        const film = await engine.generateRenderPlan({
            renderPrompt: "Cinema film audio render preparation with dialogue music and surround for KWIZERA",
            brandName: "KWIZERA",
            platform: AudioRenderPlatform.Film,
            prepareOutputProfiles: true,
            generateRenderJobs: true,
        });
        results.renderPlanGeneration = {
            passed: tech.success && health.success && finance.success && film.success,
            detail: `Tech ${tech.success ? "✓" : "✗"}, Health ${health.success ? "✓" : "✗"}, Finance ${finance.success ? "✓" : "✗"}, Film ${film.success ? "✓" : "✗"}`,
        };
        results.renderValidation = {
            passed: (tech.record?.renderValidation.length ?? 0) === ALL_AUDIO_RENDER_VALIDATION_STAGES.length &&
                tech.record?.renderValidation.every((v) => v.validated) === true,
            detail: `${tech.record?.renderValidation.filter((v) => v.validated).length}/${ALL_AUDIO_RENDER_VALIDATION_STAGES.length} render stages validated`,
        };
        results.trackValidation = {
            passed: (tech.record?.trackValidation.length ?? 0) === ALL_AUDIO_RENDER_TRACK_CHECKS.length &&
                tech.record?.trackValidation.every((t) => t.validated) === true,
            detail: `${tech.record?.trackValidation.filter((t) => t.validated).length}/${ALL_AUDIO_RENDER_TRACK_CHECKS.length} track checks passed`,
        };
        results.timelineValidation = {
            passed: (tech.record?.timelineValidation.length ?? 0) === ALL_AUDIO_RENDER_TIMELINE_CHECKS.length &&
                tech.record?.timelineValidation.every((t) => t.validated) === true,
            detail: `${tech.record?.timelineValidation.filter((t) => t.validated).length}/${ALL_AUDIO_RENDER_TIMELINE_CHECKS.length} timeline checks passed`,
        };
        results.assetValidation = {
            passed: (tech.record?.assetValidation.length ?? 0) === ALL_AUDIO_RENDER_ASSET_TYPES.length &&
                (tech.record?.assetValidation.filter((a) => a.validated).length ?? 0) >= 6,
            detail: `${tech.record?.assetValidation.filter((a) => a.validated).length}/${ALL_AUDIO_RENDER_ASSET_TYPES.length} assets validated`,
        };
        results.renderSettings = {
            passed: (tech.record?.renderSettings.sampleRate ?? 0) >= 44100 &&
                (tech.record?.renderSettings.bitDepth ?? 0) >= 16 &&
                Boolean(tech.record?.renderSettings.channelLayout) &&
                (tech.record?.renderSettings.instructions.length ?? 0) >= 2,
            detail: `${tech.record?.renderSettings.sampleRate}Hz, ${tech.record?.renderSettings.bitDepth}-bit, ${tech.record?.renderSettings.channelLayout}`,
        };
        results.outputProfiles = {
            passed: (tech.record?.outputProfiles.length ?? 0) >= ALL_AUDIO_RENDER_PLATFORMS.length,
            detail: `${tech.record?.outputProfiles.length} output profiles`,
        };
        results.resourcePlanning = {
            passed: Boolean(tech.record?.resourcePlanning.cpuAllocation) &&
                Boolean(tech.record?.resourcePlanning.gpuAllocation) &&
                (tech.record?.resourcePlanning.renderQueue.length ?? 0) >= 1,
            detail: `Queue ${tech.record?.resourcePlanning.renderQueue.length}, parallel ${tech.record?.resourcePlanning.parallelRenderingPreparation}`,
        };
        results.renderScores = {
            passed: (tech.record?.scores.renderReadinessScore ?? 0) >= 55 &&
                (tech.record?.scores.assetQualityScore ?? 0) >= 55 &&
                (tech.record?.scores.trackIntegrityScore ?? 0) >= 55 &&
                (tech.record?.scores.timelineIntegrityScore ?? 0) >= 55 &&
                (tech.record?.scores.platformCompatibilityScore ?? 0) >= 55 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Readiness ${tech.record?.scores.renderReadinessScore}, track ${tech.record?.scores.trackIntegrityScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (tech.record?.relationships.productionPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.renderPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.products.length ?? 0) >= 1,
            detail: `Production ${tech.record?.relationships.productionPlans.length}, render ${tech.record?.relationships.renderPlans.length}`,
        };
        results.renderReadiness = {
            passed: tech.record?.renderReady === true && tech.record?.validated === true,
            detail: `Render ready: ${tech.record?.renderReady}, validated: ${tech.record?.validated}`,
        };
        results.recoveryPlanning = {
            passed: (tech.record?.recoveryPlan.checkpoints.length ?? 0) >= 2 &&
                tech.record?.recoveryPlan.automaticRecovery === true,
            detail: `${tech.record?.recoveryPlan.checkpoints.length} checkpoints, auto-recovery enabled`,
        };
        const noContext = await engine.generateRenderPlan({ productId: "step10k-nonexistent" });
        results.incompleteRejection = {
            passed: !noContext.success,
            detail: noContext.message ?? "Rejected without context",
        };
        const promptOnly = await engine.generateRenderPlan({
            renderPrompt: "Audio render preparation for KWIZERA creative workspace",
            brandName: "KWIZERA",
            platform: AudioRenderPlatform.Website,
        });
        results.promptOnlyGeneration = {
            passed: promptOnly.success,
            detail: promptOnly.success ? "Prompt-only render plan generated" : "Failed",
        };
        const repaired = await engine.repairRenderPlan("step10k-kwizera-pro", AudioRenderPlatform.Mobile);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Render repair verified" : "Repair failed",
        };
        const platformSearch = engine.searchRenderPlans({ platform: AudioRenderPlatform.YouTube });
        results.searchByPlatform = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const codecSearch = engine.searchRenderPlans({ codec: AudioRenderCodec.Aac });
        results.searchByCodec = {
            passed: codecSearch.length >= 1,
            detail: `${codecSearch.length} result(s) by codec`,
        };
        const keywordSearch = engine.searchRenderPlans({ keywords: "kwizera" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const renderAsset = audioFoundation.getAssetRegistry().getAsset(tech.record.profile.audioRenderPlanId);
        results.generationAssetRegistration = {
            passed: renderAsset?.assetType === "render-profile",
            detail: `Render asset ${renderAsset?.assetId}`,
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
        const logFile = path.join(storageRoot, "logs", `audio-rendering-preparation-engine-${new Date().toISOString().slice(0, 10)}.jsonl`);
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
        await core.stop("step-10k-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Audio-Rendering-Preparation-Report.md"), buildMainReport(status, results, allPassed, tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Render-Profile-Report.md"), buildProfileReport(tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Track-Integrity-Report.md"), buildTrackReport(tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Timeline-Integrity-Report.md"), buildTimelineReport(tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Rendering-Readiness-Report.md"), buildReadinessReport(status, tech.record, health.record, finance.record, film.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-10K-VALIDATION-REPORT.md"), buildMainReport(status, results, allPassed, tech.record, health.record, finance.record, film.record), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Audio-Rendering-Preparation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Render-Profile-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Track-Integrity-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Timeline-Integrity-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Rendering-Readiness-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 10 Step 10K Audio Rendering Preparation Report",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
        `**Readiness:** ${status.readinessScore}/100`,
        `**Render Plans Generated:** ${status.renderPlansGenerated}`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅" : "❌"} — ${r.detail}`),
        "",
        "## Plans",
        `- Tech (YouTube): readiness ${tech?.scores.renderReadinessScore ?? 0}/100`,
        `- Health (Podcast): track ${health?.scores.trackIntegrityScore ?? 0}/100`,
        `- Finance (TikTok): assets ${finance?.scores.assetQualityScore ?? 0}/100`,
        `- Film (Cinema): timeline ${film?.scores.timelineIntegrityScore ?? 0}/100`,
        "",
    ].join("\n");
}
function buildProfileReport(...records) {
    const rows = records.filter(Boolean);
    return [
        "# Render Profile Report — Step 10K",
        "",
        "| Plan | Platform | Sample Rate | Bit Depth | Codec | Loudness |",
        "|------|----------|-------------|-----------|-------|----------|",
        ...rows.map((r) => `| ${r.profile.platform} | ${r.profile.platform} | ${r.renderSettings.sampleRate}Hz | ${r.renderSettings.bitDepth}-bit | ${r.renderSettings.codec} | ${r.renderSettings.loudnessTarget} LUFS |`),
    ].join("\n");
}
function buildTrackReport(...records) {
    const rows = records.filter(Boolean);
    return [
        "# Track Integrity Report — Step 10K",
        "",
        "| Plan | Tracks | Checks Passed | Track Score |",
        "|------|--------|---------------|-------------|",
        ...rows.map((r) => `| ${r.profile.platform} | ${r.trackStructure.length} | ${r.trackValidation.filter((t) => t.validated).length}/${r.trackValidation.length} | ${r.scores.trackIntegrityScore}/100 |`),
    ].join("\n");
}
function buildTimelineReport(...records) {
    const rows = records.filter(Boolean);
    return [
        "# Timeline Integrity Report — Step 10K",
        "",
        "| Plan | Cues | Checks Passed | Timeline Score |",
        "|------|------|---------------|----------------|",
        ...rows.map((r) => `| ${r.profile.platform} | ${r.timelineStructure.length} | ${r.timelineValidation.filter((t) => t.validated).length}/${r.timelineValidation.length} | ${r.scores.timelineIntegrityScore}/100 |`),
    ].join("\n");
}
function buildReadinessReport(status, ...records) {
    const rows = records.filter(Boolean);
    return [
        "# Rendering Readiness Report — Step 10K",
        "",
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Plan | Readiness | Assets | Tracks | Timeline | Platform | Confidence | Ready |",
        "|------|-----------|--------|--------|----------|----------|------------|-------|",
        ...rows.map((r) => `| ${r.profile.platform} | ${r.scores.renderReadinessScore} | ${r.scores.assetQualityScore} | ${r.scores.trackIntegrityScore} | ${r.scores.timelineIntegrityScore} | ${r.scores.platformCompatibilityScore} | ${r.scores.aiConfidenceScore} | ${r.renderReady ? "✅" : "❌"} |`),
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-audio-rendering-preparation-engine.js.map