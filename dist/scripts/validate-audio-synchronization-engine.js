import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, AudioSyncPlanType, AUDIO_SYNC_PLATFORM_TARGETS, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, StoryboardGenerationPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-audio-sync-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step8h-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI-powered creative workstation",
    features: ["AI video generation"],
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
    productId: "step8h-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    subcategory: "outerwear",
    brand: "KWIZERA",
    description: "Premium urban jacket",
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
const SAMPLE_BEAUTY = {
    productId: "step8h-glow-serum",
    productName: "Radiance Vitamin C Serum",
    category: ProductAnalysisCategory.Beauty,
    subcategory: "skincare",
    brand: "GlowLab",
    description: "Clinical-grade vitamin C serum",
    features: ["vitamin-c"],
    specifications: { volume: "30ml" },
    materials: ["glass-bottle"],
    price: 45.0,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "beauty",
    tags: ["beauty"],
    keywords: ["serum"],
};
async function prepareFullPipeline(piFoundation, genFoundation, sample, objective, platform, genPlatform) {
    await piFoundation.getProductAnalysisEngine().analyzeProduct(sample);
    await piFoundation.getProductUnderstandingEngine().understandProduct({
        productId: sample.productId,
        marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
    });
    await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: sample.productId });
    await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
        productId: sample.productId,
        marketingObjective: objective,
    });
    await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
        productId: sample.productId,
        platform,
    });
    await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({
        productId: sample.productId,
        includeSocialProof: true,
    });
    const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
        productId: sample.productId,
        platform: genPlatform,
    });
    if (!story.record)
        return undefined;
    const scenes = await genFoundation.getSceneGenerationEngine().generateScenes({
        storyboardId: story.record.storyboardId,
    });
    if (!scenes.success)
        return undefined;
    const camera = await genFoundation.getCameraDirectorEngine().planCamera({
        storyboardId: story.record.storyboardId,
    });
    if (!camera.success)
        return undefined;
    const motion = await genFoundation.getMotionGenerationEngine().generateMotionPlans({
        storyboardId: story.record.storyboardId,
    });
    if (!motion.success)
        return undefined;
    const animation = await genFoundation.getAnimationGenerationEngine().generateAnimationPlans({
        storyboardId: story.record.storyboardId,
    });
    if (!animation.success)
        return undefined;
    const vfx = await genFoundation.getVisualEffectsGenerationEngine().generateVisualEffectPlans({
        storyboardId: story.record.storyboardId,
    });
    if (!vfx.success)
        return undefined;
    return story.record.storyboardId;
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 8H Audio Synchronization Engine Validation");
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
        await core.start("step-8h-validation");
        const initMs = Date.now() - initStart;
        const genFoundation = core.getManager().videoGenerationFoundation;
        const audioEngine = genFoundation.getAudioSynchronizationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: audioEngine.isInitialized() && audioEngine.isStartupComplete(),
            detail: audioEngine.isStartupComplete()
                ? `Audio Synchronization Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = genFoundation.getRegistry().getModule("audio-sync-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        const techStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube, StoryboardGenerationPlatform.YouTubeLongForm);
        const fashionStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion, CreativePlatform.InstagramReels, StoryboardGenerationPlatform.InstagramReels);
        const beautyStoryboardId = await prepareFullPipeline(piFoundation, genFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness, CreativePlatform.TikTok, StoryboardGenerationPlatform.TikTok);
        results.visualEffectsUpstream = {
            passed: Boolean(techStoryboardId && fashionStoryboardId && beautyStoryboardId),
            detail: "Visual effect plans prepared for audio synchronization",
        };
        const techAudio = await audioEngine.generateAudioSyncPlans({ storyboardId: techStoryboardId });
        const fashionAudio = await audioEngine.generateAudioSyncPlans({ storyboardId: fashionStoryboardId });
        const beautyAudio = await audioEngine.generateAudioSyncPlans({ storyboardId: beautyStoryboardId });
        results.audioSynchronizationPlanning = {
            passed: techAudio.success && fashionAudio.success && beautyAudio.success,
            detail: `Tech ${techAudio.plans?.length ?? 0}, Fashion ${fashionAudio.plans?.length ?? 0}, Beauty ${beautyAudio.plans?.length ?? 0} plans`,
        };
        const firstPlan = techAudio.plans?.[0];
        results.voiceSynchronization = {
            passed: Boolean(firstPlan?.voiceSynchronization.voiceTiming &&
                firstPlan?.voiceSynchronization.speechAlignment &&
                firstPlan?.voiceSynchronization.lipSyncBlueprint &&
                firstPlan?.voiceSynchronization.dialogueTiming),
            detail: `Voice: ${firstPlan?.voiceSynchronization.voiceTiming.slice(0, 40)}...`,
        };
        results.musicSynchronization = {
            passed: Boolean(firstPlan?.musicSynchronization.musicPlacement &&
                firstPlan?.musicSynchronization.beatDetection &&
                firstPlan?.musicSynchronization.rhythmAlignment),
            detail: `Music: ${firstPlan?.musicSynchronization.musicTiming.slice(0, 40)}...`,
        };
        results.soundEffectSynchronization = {
            passed: Boolean(firstPlan?.soundEffectSynchronization.effectTiming &&
                firstPlan?.soundEffectSynchronization.transitionSounds),
            detail: `SFX: ${firstPlan?.soundEffectSynchronization.ambientSounds.slice(0, 40)}...`,
        };
        results.subtitleSynchronization = {
            passed: Boolean(firstPlan?.subtitleSynchronization.subtitleTiming &&
                firstPlan?.subtitleSynchronization.captionTiming &&
                firstPlan?.subtitleSynchronization.readingSpeedValidation),
            detail: `Subtitles: ${firstPlan?.subtitleSynchronization.subtitleTiming.slice(0, 40)}...`,
        };
        results.lipSyncBlueprint = {
            passed: Boolean(firstPlan?.voiceSynchronization.lipSyncBlueprint && firstPlan.voiceSynchronization.lipSyncBlueprint !== "N/A"),
            detail: firstPlan?.voiceSynchronization.lipSyncBlueprint.slice(0, 50) ?? "Missing",
        };
        results.audioMixingPlan = {
            passed: Boolean(firstPlan?.audioMixing.voiceLevel &&
                firstPlan?.audioMixing.musicLevel &&
                firstPlan?.audioMixing.loudnessNormalization &&
                firstPlan?.audioMixing.stereoPlanning),
            detail: `Loudness: ${firstPlan?.audioMixing.loudnessNormalization}`,
        };
        results.sceneSynchronization = {
            passed: (firstPlan?.sceneSynchronization.motionSync.length ?? 0) >= 1 &&
                (firstPlan?.sceneSynchronization.voiceSync.length ?? 0) >= 1 &&
                (firstPlan?.sceneSynchronization.animationSync.length ?? 0) >= 1 &&
                (firstPlan?.sceneSynchronization.visualEffectsSync.length ?? 0) >= 1,
            detail: `Motion ${firstPlan?.sceneSynchronization.motionSync.length}, VFX ${firstPlan?.sceneSynchronization.visualEffectsSync.length} sync`,
        };
        results.audioContinuity = {
            passed: techAudio.plans?.every((p) => p.audioContinuityMaintained) ?? false,
            detail: "Complete audio continuity maintained",
        };
        results.audioScores = {
            passed: (firstPlan?.scores.audioSynchronizationScore ?? 0) >= 55 &&
                (firstPlan?.scores.lipSyncScore ?? 0) >= 50 &&
                (firstPlan?.scores.musicAlignmentScore ?? 0) >= 50 &&
                (firstPlan?.scores.subtitleQualityScore ?? 0) >= 50 &&
                (firstPlan?.scores.productionReadinessScore ?? 0) >= 55 &&
                (firstPlan?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Audio ${firstPlan?.scores.audioSynchronizationScore}, lip sync ${firstPlan?.scores.lipSyncScore}, confidence ${firstPlan?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (firstPlan?.relationships.scenes.length ?? 0) >= 1 &&
                (firstPlan?.relationships.visualEffectPlans.length ?? 0) >= 1 &&
                (firstPlan?.relationships.animationPlans.length ?? 0) >= 1,
            detail: `Scenes ${firstPlan?.relationships.scenes.length}, VFX ${firstPlan?.relationships.visualEffectPlans.length}`,
        };
        results.productionReadiness = {
            passed: techAudio.plans?.every((p) => p.productionReady && p.validated) ?? false,
            detail: "All audio sync plans production-ready and validated",
        };
        results.brandConsistency = {
            passed: techAudio.plans?.every((p) => p.brandConsistent) ?? false,
            detail: "Brand consistency verified across audio sync plans",
        };
        const noUpstream = await audioEngine.generateAudioSyncPlans({ storyboardId: "step8h-nonexistent" });
        results.incompleteRejection = {
            passed: !noUpstream.success,
            detail: noUpstream.message ?? "Rejected without visual effect plans and upstream assets",
        };
        const repaired = await audioEngine.repairAudioSyncPlans(techStoryboardId);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Audio sync plan repair verified" : "Repair failed",
        };
        const typeSearch = audioEngine.searchAudioSyncPlans({ planType: AudioSyncPlanType.Combined });
        results.searchByPlanType = {
            passed: typeSearch.length >= 1,
            detail: `${typeSearch.length} result(s) by plan type`,
        };
        const storyboardSearch = audioEngine.searchAudioSyncPlans({ storyboardId: techStoryboardId });
        results.searchByStoryboard = {
            passed: storyboardSearch.length >= (techAudio.plans?.length ?? 1),
            detail: `${storyboardSearch.length} result(s) by storyboard`,
        };
        const voiceSearch = audioEngine.searchAudioSyncPlans({ voice: "voice" });
        results.searchByVoice = {
            passed: voiceSearch.length >= 1,
            detail: `${voiceSearch.length} result(s) by voice`,
        };
        const keywordSearch = audioEngine.searchAudioSyncPlans({ keywords: "music" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const assetRegistered = genFoundation.getAssetRegistry().getAsset(firstPlan.audioSynchronizationId);
        results.generationAssetRegistration = {
            passed: assetRegistered?.assetType === "audio",
            detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Not found",
        };
        results.platformOptimization = {
            passed: (firstPlan?.platformOptimizations.length ?? 0) === AUDIO_SYNC_PLATFORM_TARGETS.length,
            detail: `${firstPlan?.platformOptimizations.length}/${AUDIO_SYNC_PLATFORM_TARGETS.length} platform optimizations`,
        };
        const status = audioEngine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageSyncMs < 120000,
            detail: `avg sync ${status.performance.averageSyncMs}ms, lip sync ${status.performance.averageLipSyncPlanningMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `audio-synchronization-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        results.multiIndustry = {
            passed: fashionAudio.success && beautyAudio.success,
            detail: `Fashion ${fashionAudio.plans?.length} plans, Beauty ${beautyAudio.plans?.length} plans`,
        };
        await core.stop("step-8h-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Audio-Synchronization-Report.md"), buildMainReport(status, results, storageRoot, allPassed, techAudio.plans, fashionAudio.plans, beautyAudio.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Voice-Synchronization-Report.md"), buildVoiceReport(techAudio.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Music-Synchronization-Report.md"), buildMusicReport(techAudio.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Subtitle-Synchronization-Report.md"), buildSubtitleReport(techAudio.plans), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Audio-Readiness-Report.md"), buildReadinessReport(status, techAudio.plans, fashionAudio.plans, beautyAudio.plans), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-8H-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, techAudio.plans, fashionAudio.plans, beautyAudio.plans), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Audio-Synchronization-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Voice-Synchronization-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Music-Synchronization-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Subtitle-Synchronization-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Audio-Readiness-Report.md")}`);
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
        "# KWIZERA AI STUDIO — Phase 8 Step 8H Audio Synchronization Report",
        "",
        `**Phase:** 8 — Video Generation Engine`,
        `**Step:** 8H — AI Audio Synchronization Engine`,
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
        `| **Audio Sync Plans Generated** | ${status.audioPlansGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Audio Sync Plans",
        "",
        `- Technology: ${tech?.length ?? 0} audio sync plans`,
        `- Fashion: ${fashion?.length ?? 0} audio sync plans`,
        `- Beauty: ${beauty?.length ?? 0} audio sync plans`,
        "",
    ].join("\n");
}
function buildVoiceReport(plans) {
    const lines = ["# Voice Synchronization Report — Step 8H", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans?.slice(0, 6) ?? []) {
        const v = plan.voiceSynchronization;
        lines.push(`## ${plan.profile.sceneId}`, "", `- Voice timing: ${v.voiceTiming}`, `- Speech alignment: ${v.speechAlignment}`, `- Emotion timing: ${v.emotionTiming}`, `- Lip sync: ${v.lipSyncBlueprint}`, "");
    }
    return lines.join("\n");
}
function buildMusicReport(plans) {
    const lines = ["# Music Synchronization Report — Step 8H", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans?.slice(0, 6) ?? []) {
        const m = plan.musicSynchronization;
        lines.push(`## ${plan.profile.sceneId}`, "", `- Placement: ${m.musicPlacement}`, `- Timing: ${m.musicTiming}`, `- Beat detection: ${m.beatDetection}`, `- Fade in/out: ${m.musicFadeIn} / ${m.musicFadeOut}`, "");
    }
    return lines.join("\n");
}
function buildSubtitleReport(plans) {
    const lines = ["# Subtitle Synchronization Report — Step 8H", "", `**Date:** ${new Date().toISOString()}`, ""];
    for (const plan of plans?.slice(0, 6) ?? []) {
        const s = plan.subtitleSynchronization;
        lines.push(`## ${plan.profile.sceneId}`, "", `- Subtitle timing: ${s.subtitleTiming}`, `- Caption timing: ${s.captionTiming}`, `- Reading speed: ${s.readingSpeedValidation}`, `- Position: ${s.subtitlePosition}`, "");
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const all = [...(tech ?? []), ...(fashion ?? []), ...(beauty ?? [])];
    return [
        "# Audio Readiness Report — Step 8H",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        `**Avg Audio Sync Score:** ${status.averageAudioSynchronizationScore}/100`,
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Audio sync plans | ${status.audioPlansGenerated} |`,
        `| Production-ready | ${all.filter((p) => p.productionReady).length}/${all.length} |`,
        `| Validated | ${all.filter((p) => p.validated).length}/${all.length} |`,
        `| Brand consistent | ${all.filter((p) => p.brandConsistent).length}/${all.length} |`,
        `| Audio continuity | ${all.filter((p) => p.audioContinuityMaintained).length}/${all.length} |`,
        "",
        "## Performance",
        "",
        `- Average sync: ${status.performance.averageSyncMs}ms`,
        `- Average lip sync planning: ${status.performance.averageLipSyncPlanningMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-audio-synchronization-engine.js.map