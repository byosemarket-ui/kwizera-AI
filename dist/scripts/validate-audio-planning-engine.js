import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, ProductAnalysisCategory, ProductAnalysisIndustry, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-audio-planning-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step5j-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI-powered creative workstation empowering marketing teams to produce brand-consistent content at scale",
    features: ["AI video generation", "brand consistency", "multi-platform export"],
    specifications: { license: "pro", deployment: "cloud" },
    materials: ["digital-license"],
    price: 299.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Technology,
    useCase: "creative-production",
    targetCustomer: "creative professionals and marketing teams",
    businessType: ProductBusinessType.B2B,
    tags: ["software", "validation"],
    keywords: ["AI studio", "kwizera"],
};
const SAMPLE_FASHION = {
    productId: "step5j-kwizera-jacket",
    productName: "KWIZERA Urban Jacket",
    category: ProductAnalysisCategory.Fashion,
    subcategory: "outerwear",
    brand: "KWIZERA",
    description: "Premium urban jacket for creators who need weather-resistant style on the move",
    features: ["water-resistant", "breathable", "minimal branding"],
    specifications: { fabric: "cotton-blend" },
    materials: ["cotton", "polyester"],
    price: 129.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Fashion,
    businessType: ProductBusinessType.D2C,
    tags: ["fashion", "validation"],
    keywords: ["jacket", "kwizera"],
};
const SAMPLE_BEAUTY = {
    productId: "step5j-glow-serum",
    productName: "Radiance Vitamin C Serum",
    category: ProductAnalysisCategory.Beauty,
    subcategory: "skincare",
    brand: "GlowLab",
    description: "Clinical-grade vitamin C serum delivering radiant skin and anti-aging benefits",
    features: ["vitamin-c", "anti-aging", "hydrating"],
    specifications: { volume: "30ml" },
    materials: ["glass-bottle"],
    price: 45.0,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: ProductAnalysisIndustry.Beauty,
    tags: ["beauty", "validation"],
    keywords: ["serum", "glowlab"],
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
        campaignGoal: objective,
    });
    await foundation.getStoryboardIntelligenceEngine().createStoryboard({
        productId: sample.productId,
    });
    await foundation.getScriptPlanningEngine().createScriptPlan({
        productId: sample.productId,
    });
    await foundation.getVisualPlanningEngine().createVisualPlan({
        productId: sample.productId,
    });
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 5J Audio Planning Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-5j-validation");
        const foundation = core.getManager().productIntelligenceFoundation;
        const engine = foundation.getAudioPlanningEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Audio Planning Engine operational",
        };
        await prepareFullPipeline(foundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
        const planStart = Date.now();
        const tech = await engine.createAudioPlan({ productId: "step5j-kwizera-pro" });
        const planMs = Date.now() - planStart;
        results.audioPlanCreation = {
            passed: tech.success && Boolean(tech.record),
            detail: `Technology audio plan created in ${planMs}ms, score ${tech.record?.scores.audioPlanningScore}`,
        };
        const storyboard = foundation
            .getStoryboardIntelligenceEngine()
            .getStoryboardsByProduct("step5j-kwizera-pro")[0];
        const scriptPlan = foundation
            .getScriptPlanningEngine()
            .getScriptPlansByProduct("step5j-kwizera-pro")[0];
        const visualPlan = foundation
            .getVisualPlanningEngine()
            .getVisualPlansByProduct("step5j-kwizera-pro")[0];
        results.audioProfile = {
            passed: Boolean(tech.record?.profile.audioPlanId) &&
                Boolean(tech.record?.profile.storyboardId) &&
                Boolean(tech.record?.profile.scriptPlanId) &&
                Boolean(tech.record?.profile.visualPlanId),
            detail: `Plan ${tech.record?.profile.audioPlanId}, v${tech.record?.profile.audioVersion}`,
        };
        results.sceneAudioPlanning = {
            passed: (tech.record?.sceneAudioPlans.length ?? 0) >= 5 &&
                tech.record?.sceneAudioPlans.length === storyboard?.scenes.length &&
                tech.record?.sceneAudioPlans.every((s) => s.plannedVoiceOver.startsWith("Plan voice-over")) === true,
            detail: `${tech.record?.sceneAudioPlans.length} scene audio plans aligned with upstream plans`,
        };
        results.voicePlanning = {
            passed: Boolean(tech.record?.voicePlanning.voiceStyle) &&
                Boolean(tech.record?.voicePlanning.speakingSpeed) &&
                (tech.record?.voicePlanning.emphasisPoints.length ?? 0) >= 2 &&
                Object.keys(tech.record?.voicePlanning.readingDuration ?? {}).length >= 5,
            detail: `Voice: ${tech.record?.voicePlanning.voiceStyle}, speed ${tech.record?.voicePlanning.speakingSpeed}`,
        };
        results.musicPlanning = {
            passed: Boolean(tech.record?.musicPlanning.introMusic) &&
                Boolean(tech.record?.musicPlanning.backgroundMusic) &&
                Boolean(tech.record?.musicPlanning.endingMusic) &&
                Boolean(tech.record?.musicPlanning.volumeStrategy),
            detail: `Music mood ${tech.record?.musicPlanning.musicMood}, energy ${tech.record?.musicPlanning.musicEnergy}`,
        };
        results.soundEffectPlanning = {
            passed: (tech.record?.soundEffectPlanning.transitionSounds.length ?? 0) >= 2 &&
                (tech.record?.soundEffectPlanning.whooshSounds.length ?? 0) >= 1 &&
                Object.keys(tech.record?.soundEffectPlanning.sceneEffects ?? {}).length >= 5,
            detail: `${Object.keys(tech.record?.soundEffectPlanning.sceneEffects ?? {}).length} scenes with planned sfx`,
        };
        results.synchronization = {
            passed: Object.keys(tech.record?.synchronization.voiceTiming ?? {}).length >= 5 &&
                Object.keys(tech.record?.synchronization.subtitleTiming ?? {}).length >= 5 &&
                Boolean(tech.record?.synchronization.ctaTiming),
            detail: `Voice, subtitle and CTA timing synchronized across ${Object.keys(tech.record?.synchronization.sceneTiming ?? {}).length} scenes`,
        };
        results.emotionalFlow = {
            passed: Boolean(tech.record?.emotionalFlow.excitement) &&
                Boolean(tech.record?.emotionalFlow.trust) &&
                Boolean(tech.record?.emotionalFlow.urgency),
            detail: "Emotional pacing planned across excitement, trust, and urgency",
        };
        results.platformAdaptation = {
            passed: Boolean(tech.record?.platformRules.platform) &&
                Boolean(tech.record?.platformRules.pacingGuidance) &&
                Boolean(tech.record?.platformRules.musicVolumeGuidance),
            detail: `${tech.record?.platformRules.platform} — voice max ${tech.record?.platformRules.maxVoiceDuration}`,
        };
        results.upstreamAlignment = {
            passed: tech.record?.storyboardId === storyboard?.storyboardId &&
                tech.record?.scriptPlanId === scriptPlan?.scriptPlanId &&
                tech.record?.visualPlanId === visualPlan?.visualPlanId,
            detail: "Storyboard, script and visual plan IDs aligned",
        };
        await prepareFullPipeline(foundation, SAMPLE_FASHION, MarketingObjective.BrandAwareness, CreativePlatform.InstagramReels);
        await prepareFullPipeline(foundation, SAMPLE_BEAUTY, MarketingObjective.SalesGrowth, CreativePlatform.TikTok);
        const fashion = await engine.createAudioPlan({ productId: "step5j-kwizera-jacket" });
        const beauty = await engine.createAudioPlan({ productId: "step5j-glow-serum" });
        results.multiIndustry = {
            passed: fashion.success && beauty.success,
            detail: `Fashion ${fashion.record?.sceneAudioPlans.length} scenes, Beauty ${beauty.record?.sceneAudioPlans.length} scenes`,
        };
        results.audioScores = {
            passed: (tech.record?.scores.audioPlanningScore ?? 0) >= 55 &&
                (tech.record?.scores.voicePlanningScore ?? 0) >= 50 &&
                (tech.record?.scores.musicPlanningScore ?? 0) >= 50 &&
                (tech.record?.scores.synchronizationScore ?? 0) >= 50 &&
                (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Planning ${tech.record?.scores.audioPlanningScore}, sync ${tech.record?.scores.synchronizationScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.relationshipDetection = {
            passed: (tech.record?.relationships.storyboards.length ?? 0) >= 1 &&
                (tech.record?.relationships.scriptPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.visualPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.creativeDirections.length ?? 0) >= 1,
            detail: `Production plans ${tech.record?.relationships.productionPlans.length}, knowledge ${tech.record?.relationships.knowledgeRecords.length}`,
        };
        const noPipeline = await engine.createAudioPlan({ productId: "step5j-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without upstream pipeline",
        };
        const repaired = await engine.repairAudioPlan("step5j-kwizera-jacket", CreativePlatform.Facebook);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Audio plan repair pipeline verified" : "Repair failed",
        };
        const audioSearch = engine.searchAudioPlans({ audioPlanId: tech.record?.audioPlanId });
        results.searchByAudioPlan = {
            passed: audioSearch.length >= 1,
            detail: `${audioSearch.length} result(s) by audio plan`,
        };
        const brandSearch = engine.searchAudioPlans({ brand: "KWIZERA" });
        results.searchByBrand = {
            passed: brandSearch.length >= 1,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const languageSearch = engine.searchAudioPlans({ language: "en" });
        results.searchByLanguage = {
            passed: languageSearch.length >= 1,
            detail: `${languageSearch.length} result(s) by language`,
        };
        const platformSearch = engine.searchAudioPlans({ platform: CreativePlatform.YouTube });
        results.searchByPlatform = {
            passed: platformSearch.length >= 1,
            detail: `${platformSearch.length} result(s) by platform`,
        };
        const campaignSearch = engine.searchAudioPlans({ campaignGoal: MarketingObjective.ProductLaunch });
        results.searchByCampaign = {
            passed: campaignSearch.length >= 1,
            detail: `${campaignSearch.length} result(s) by campaign`,
        };
        const voiceSearch = engine.searchAudioPlans({ voiceStyle: tech.record?.voicePlanning.voiceStyle?.split(" ")[0] });
        results.searchByVoiceStyle = {
            passed: voiceSearch.length >= 1,
            detail: `${voiceSearch.length} result(s) by voice style`,
        };
        const musicSearch = engine.searchAudioPlans({
            musicStyle: tech.record?.musicPlanning.musicStyle.split(" ")[0] ?? "emotional",
        });
        results.searchByMusicStyle = {
            passed: musicSearch.length >= 1,
            detail: `${musicSearch.length} result(s) by music style`,
        };
        const moodSearch = engine.searchAudioPlans({ mood: tech.record?.musicPlanning.musicMood });
        results.searchByMood = {
            passed: moodSearch.length >= 1,
            detail: `${moodSearch.length} result(s) by mood`,
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averagePlanningMs < 120000,
            detail: `avg planning ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `audio-planning-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("audio-planning");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        results.recommendationReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: "Production-ready audio plan validated for voice/music generation modules",
        };
        await core.stop("step-5j-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Audio-Planning-Report.md"), buildAudioPlanningReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Voice-Planning-Report.md"), buildVoicePlanningReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Music-Planning-Report.md"), buildMusicPlanningReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Synchronization-Report.md"), buildSynchronizationReport(tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Audio-Readiness-Report.md"), buildReadinessReport(status, tech.record, fashion.record, beauty.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-5J-VALIDATION-REPORT.md"), buildAudioPlanningReport(status, results, storageRoot, allPassed, tech.record, fashion.record, beauty.record), "utf8");
        console.log("Reports written:", projectStateDir);
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
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
function buildAudioPlanningReport(status, results, storageRoot, allPassed, tech, fashion, beauty) {
    return [
        "# Audio Planning Report — Step 5J",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage:** \`${storageRoot}\``,
        `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
        `**Readiness:** ${status.readinessScore}/100`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([k, r]) => `| ${k} | ${r.passed ? "✅" : "❌"} | ${r.detail} |`),
        "",
        "## Audio Plans Prepared",
        "",
        `- Technology: ${tech?.sceneAudioPlans.length ?? 0} scene plans on ${tech?.profile.platform ?? "n/a"} (${tech?.scores.audioPlanningScore ?? 0}/100)`,
        `- Fashion: ${fashion?.sceneAudioPlans.length ?? 0} scene plans (${fashion?.scores.audioPlanningScore ?? 0}/100)`,
        `- Beauty: ${beauty?.sceneAudioPlans.length ?? 0} scene plans (${beauty?.scores.audioPlanningScore ?? 0}/100)`,
        "",
        `Audio plans prepared: ${status.audioPlansPrepared}`,
        "",
    ].join("\n");
}
function buildVoicePlanningReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Voice Planning Report — Step 5J",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        const v = record.voicePlanning;
        lines.push(`## ${record.productId} — ${record.profile.platform}`, "", `- **Voice Style:** ${v.voiceStyle}`, `- **Gender Preference:** ${v.voiceGenderPreference}`, `- **Age Style:** ${v.voiceAgeStyle}`, `- **Speaking Speed:** ${v.speakingSpeed}`, `- **Speaking Tone:** ${v.speakingTone}`, `- **Emotional Tone:** ${v.emotionalTone}`, `- **Emphasis Points:** ${v.emphasisPoints.join("; ")}`, "", "| # | Purpose | Planned Voice-Over | Reading Duration |", "|---|---------|-------------------|------------------|");
        for (const scene of record.sceneAudioPlans) {
            lines.push(`| ${scene.sceneNumber} | ${scene.scenePurpose} | ${scene.plannedVoiceOver.slice(0, 50)}... | ${v.readingDuration[scene.sceneNumber] ?? scene.plannedNarrationTiming} |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildMusicPlanningReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Music Planning Report — Step 5J",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        const m = record.musicPlanning;
        lines.push(`## ${record.productId}`, "", `- **Style:** ${m.musicStyle}`, `- **Mood:** ${m.musicMood}`, `- **Energy:** ${m.musicEnergy}`, `- **Intro:** ${m.introMusic}`, `- **Background:** ${m.backgroundMusic}`, `- **Ending:** ${m.endingMusic}`, `- **Fade In:** ${m.fadeIn}`, `- **Fade Out:** ${m.fadeOut}`, `- **Volume Strategy:** ${m.volumeStrategy}`, "");
    }
    return lines.join("\n");
}
function buildSynchronizationReport(tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    const lines = [
        "# Synchronization Report — Step 5J",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
    ];
    for (const record of rows) {
        const s = record.synchronization;
        lines.push(`## ${record.productId}`, "", `- **CTA Timing:** ${s.ctaTiming}`, "", "| # | Voice Timing | Music Timing | Subtitle Timing | Transition |", "|---|--------------|--------------|-----------------|------------|");
        for (const scene of record.sceneAudioPlans) {
            lines.push(`| ${scene.sceneNumber} | ${(s.voiceTiming[scene.sceneNumber] ?? "").slice(0, 30)}... | ${(s.musicTiming[scene.sceneNumber] ?? "").slice(0, 25)}... | ${(s.subtitleTiming[scene.sceneNumber] ?? "").slice(0, 25)}... | ${(s.transitionTiming[scene.sceneNumber] ?? "").slice(0, 25)}... |`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
function buildReadinessReport(status, tech, fashion, beauty) {
    const rows = [tech, fashion, beauty].filter(Boolean);
    return [
        "# Audio Readiness Report — Step 5J",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Product | Planning | Voice | Music | Sync | Brand | Production Ready | Validated |",
        "|---------|----------|-------|-------|------|-------|------------------|-----------|",
        ...rows.map((r) => `| ${r.productId} | ${r.scores.audioPlanningScore}/100 | ${r.scores.voicePlanningScore}/100 | ${r.scores.musicPlanningScore}/100 | ${r.scores.synchronizationScore}/100 | ${r.scores.brandConsistencyScore}/100 | ${r.productionReady ? "✅" : "❌"} | ${r.validated ? "✅" : "❌"} |`),
        "",
        "## Performance",
        "",
        `- Average planning: ${status.performance.averagePlanningMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        `- Average relationship detection: ${status.performance.averageRelationshipMs}ms`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-audio-planning-engine.js.map