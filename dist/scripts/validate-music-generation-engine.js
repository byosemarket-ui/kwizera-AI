import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, CreativePlatform, MarketingObjective, MusicGenre, MusicMood, MusicPlatform, SUPPORTED_MUSIC_GENRES, SUPPORTED_MUSIC_MOODS, SyncTarget, LoopType, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-music-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step10e-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI-powered creative workstation for marketing teams",
    features: ["AI audio generation", "music planning", "composition blueprints"],
    specifications: { license: "pro" },
    materials: ["digital-license"],
    price: 299.99,
    currency: "USD",
    availability: ProductAvailabilityStatus.InStock,
    industry: "technology",
    businessType: ProductBusinessType.B2B,
    tags: ["software", "validation"],
    keywords: ["AI studio", "kwizera"],
};
const SAMPLE_HEALTH = {
    productId: "step10e-health-app",
    productName: "VitalCare Health App",
    category: ProductAnalysisCategory.Health,
    subcategory: "wellness",
    brand: "VitalCare",
    description: "Application de santé pour le suivi du bien-être quotidien",
    features: ["suivi", "rappels", "conseils"],
    price: 9.99,
    currency: "EUR",
    availability: ProductAvailabilityStatus.InStock,
    industry: "health",
    businessType: ProductBusinessType.B2C,
    tags: ["health", "validation"],
    keywords: ["santé", "vitalcare"],
};
const SAMPLE_FINANCE = {
    productId: "step10e-finance-app",
    productName: "PesaSmart Mobile Banking",
    category: ProductAnalysisCategory.Services,
    subcategory: "mobile-banking",
    brand: "PesaSmart",
    description: "Huduma ya benki ya simu kwa wateja wa Afrika Mashariki",
    features: ["malipo", "akiba", "mikopo"],
    price: 0,
    currency: "KES",
    availability: ProductAvailabilityStatus.InStock,
    industry: "general",
    businessType: ProductBusinessType.B2C,
    tags: ["finance", "validation"],
    keywords: ["benki", "pesasmart"],
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
    console.log("KWIZERA AI STUDIO — Step 10E Music Generation Engine Validation");
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
        await core.start("step-10e-validation");
        const initMs = Date.now() - initStart;
        const audioFoundation = core.getManager().audioGenerationFoundation;
        const engine = audioFoundation.getMusicGenerationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete() ? `Music Engine ready in ${initMs}ms` : "Not initialized",
        };
        const registered = audioFoundation.getRegistry().getModule("music-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
        await prepareFullPipeline(piFoundation, SAMPLE_HEALTH, MarketingObjective.BrandAwareness, CreativePlatform.Website);
        await prepareFullPipeline(piFoundation, SAMPLE_FINANCE, MarketingObjective.ProductPromotion, CreativePlatform.TikTok);
        const tech = await engine.generateMusicPlan({
            productId: "step10e-kwizera-pro",
            musicPrompt: "Inspirational corporate technology soundtrack for product launch video",
            platform: MusicPlatform.YouTube,
            genre: MusicGenre.Corporate,
            mood: MusicMood.Inspirational,
            syncTarget: SyncTarget.Video,
            videoId: "step10e-tech-launch-video",
            durationSec: 90,
            loopType: LoopType.Background,
        });
        const health = await engine.generateMusicPlan({
            productId: "step10e-health-app",
            musicPrompt: "Calm ambient wellness music for health application",
            platform: MusicPlatform.Website,
            genre: MusicGenre.Ambient,
            mood: MusicMood.Calm,
            syncTarget: SyncTarget.Presentation,
            durationSec: 120,
            loopType: LoopType.Ambient,
        });
        const finance = await engine.generateMusicPlan({
            productId: "step10e-finance-app",
            musicPrompt: "Energetic afrobeat commercial music for mobile banking advertisement",
            platform: MusicPlatform.TikTok,
            genre: MusicGenre.Afrobeat,
            mood: MusicMood.Energetic,
            syncTarget: SyncTarget.Advertisement,
            durationSec: 30,
            loopType: LoopType.Intro,
        });
        const cinematic = await engine.generateMusicPlan({
            musicPrompt: "Epic cinematic orchestral score for KWIZERA brand film",
            brandName: "KWIZERA",
            platform: MusicPlatform.Television,
            genre: MusicGenre.Cinematic,
            mood: MusicMood.Epic,
            syncTarget: SyncTarget.Film,
            durationSec: 180,
        });
        results.musicPlanGeneration = {
            passed: tech.success && health.success && finance.success && cinematic.success,
            detail: `Tech ${tech.success ? "✓" : "✗"}, Health ${health.success ? "✓" : "✗"}, Finance ${finance.success ? "✓" : "✗"}, Cinematic ${cinematic.success ? "✓" : "✗"}`,
        };
        results.musicAnalysis = {
            passed: Boolean(tech.record?.musicAnalysis.genre &&
                tech.record?.musicAnalysis.tempo &&
                tech.record?.musicAnalysis.key &&
                tech.record?.musicAnalysis.durationSec > 0),
            detail: `${tech.record?.musicAnalysis.genre} @ ${tech.record?.musicAnalysis.tempo}, key ${tech.record?.musicAnalysis.key}`,
        };
        results.compositionPlanning = {
            passed: Boolean(tech.record?.compositionPlan.intro &&
                tech.record?.compositionPlan.chorus &&
                tech.record?.compositionPlan.chordProgression.length >= 2 &&
                (tech.record?.scores.compositionScore ?? 0) >= 55),
            detail: `Composition score ${tech.record?.scores.compositionScore}, ${tech.record?.compositionPlan.chordProgression.length} progressions`,
        };
        results.arrangementPlanning = {
            passed: Boolean(tech.record?.arrangementPlan.activeInstruments.length >= 2 &&
                (tech.record?.scores.harmonyScore ?? 0) >= 55),
            detail: `${tech.record?.arrangementPlan.activeInstruments.length} instruments, harmony ${tech.record?.scores.harmonyScore}`,
        };
        results.moodPlanning = {
            passed: Boolean(tech.record?.moodPlan.primaryMood &&
                tech.record?.moodPlan.emotionalArc.length >= 3 &&
                (tech.record?.scores.emotionalScore ?? 0) >= 50),
            detail: `Mood ${tech.record?.moodPlan.primaryMood}, emotional score ${tech.record?.scores.emotionalScore}`,
        };
        results.syncPreparation = {
            passed: Boolean(tech.record?.syncPreparation.hitPoints.length >= 3 &&
                tech.record?.syncPreparation.syncTarget &&
                tech.record?.loopPlan.loopType),
            detail: `Sync ${tech.record?.syncPreparation.syncTarget}, ${tech.record?.syncPreparation.hitPoints.length} hit points`,
        };
        results.musicScores = {
            passed: (tech.record?.scores.compositionScore ?? 0) >= 55 &&
                (tech.record?.scores.rhythmScore ?? 0) >= 55 &&
                (tech.record?.scores.emotionalScore ?? 0) >= 50 &&
                (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Composition ${tech.record?.scores.compositionScore}, production ${tech.record?.scores.productionReadinessScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.genreSupport = {
            passed: SUPPORTED_MUSIC_GENRES.length >= 14,
            detail: `${SUPPORTED_MUSIC_GENRES.length} genres supported`,
        };
        results.moodSupport = {
            passed: SUPPORTED_MUSIC_MOODS.length >= 10,
            detail: `${SUPPORTED_MUSIC_MOODS.length} moods supported`,
        };
        results.relationships = {
            passed: (tech.record?.relationships.musicPlans.length ?? 0) >= 1 &&
                (tech.record?.relationships.products.length ?? 0) >= 1 &&
                (tech.record?.relationships.videos.length ?? 0) >= 1,
            detail: `Plans ${tech.record?.relationships.musicPlans.length}, products ${tech.record?.relationships.products.length}, videos ${tech.record?.relationships.videos.length}`,
        };
        results.productionReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
        };
        results.brandConsistency = {
            passed: tech.record?.brandConsistent === true,
            detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
        };
        const noContext = await engine.generateMusicPlan({ productId: "step10e-nonexistent" });
        results.incompleteRejection = {
            passed: !noContext.success,
            detail: noContext.message ?? "Rejected without context",
        };
        const promptOnly = await engine.generateMusicPlan({
            musicPrompt: "Standalone lo-fi background music for KWIZERA creative workspace",
            brandName: "KWIZERA",
            platform: MusicPlatform.Website,
            genre: MusicGenre.LoFi,
            mood: MusicMood.Relaxing,
        });
        results.promptOnlyGeneration = {
            passed: promptOnly.success,
            detail: promptOnly.success ? "Prompt-only music plan generated" : promptOnly.message ?? "Failed",
        };
        const repaired = await engine.repairMusicPlan("step10e-health-app", MusicPlatform.Facebook);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Music plan repair pipeline verified" : "Repair failed",
        };
        const productSearch = engine.searchMusicPlans({ productId: "step10e-kwizera-pro" });
        results.searchByProduct = {
            passed: productSearch.length >= 1,
            detail: `${productSearch.length} result(s) by product`,
        };
        const genreSearch = engine.searchMusicPlans({ genre: MusicGenre.Afrobeat });
        results.searchByGenre = {
            passed: genreSearch.length >= 1,
            detail: `${genreSearch.length} result(s) by genre`,
        };
        const moodSearch = engine.searchMusicPlans({ mood: MusicMood.Calm });
        results.searchByMood = {
            passed: moodSearch.length >= 1,
            detail: `${moodSearch.length} result(s) by mood`,
        };
        const keywordSearch = engine.searchMusicPlans({ keywords: "kwizera" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const musicAsset = audioFoundation.getAssetRegistry().getAsset(tech.record.musicPlanId);
        const compositionAsset = audioFoundation.getAssetRegistry().getAsset(`composition-${tech.record.musicPlanId}`);
        results.generationAssetRegistration = {
            passed: musicAsset?.assetType === "music" && compositionAsset?.assetType === "template",
            detail: `Music ${musicAsset?.assetId}, Composition ${compositionAsset?.assetId}`,
        };
        const blueprint = audioFoundation.getBlueprintManager().getBlueprint(tech.record.blueprintId);
        results.blueprintLink = {
            passed: Boolean(blueprint?.blueprintId),
            detail: blueprint ? `Blueprint ${blueprint.blueprintId} linked` : "Blueprint not found",
        };
        const status = engine.buildStatusReport();
        results.performance = {
            passed: status.performance.averageGenerationMs < 120000,
            detail: `avg generation ${status.performance.averageGenerationMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `music-generation-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        results.multiIndustry = {
            passed: health.success && finance.success,
            detail: `Healthcare ${health.record?.musicAnalysis.mood}, Finance ${finance.record?.musicAnalysis.genre}`,
        };
        results.recommendations = {
            passed: (tech.record?.recommendations.length ?? 0) >= 1,
            detail: `${tech.record?.recommendations.length} recommendation(s)`,
        };
        await core.stop("step-10e-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Music-Generation-Report.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, health.record, finance.record, cinematic.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Composition-Planning-Report.md"), buildCompositionReport(tech.record, health.record, finance.record, cinematic.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Arrangement-Planning-Report.md"), buildArrangementReport(tech.record, health.record, finance.record, cinematic.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Mood-Planning-Report.md"), buildMoodReport(tech.record, health.record, finance.record, cinematic.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Music-Generation-Readiness-Report.md"), buildReadinessReport(status, tech.record, health.record, finance.record, cinematic.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-10E-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, health.record, finance.record, cinematic.record), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Music-Generation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Composition-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Arrangement-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Mood-Planning-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Music-Generation-Readiness-Report.md")}`);
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
function buildMainReport(status, results, storageRoot, allPassed, tech, health, finance, cinematic) {
    return [
        "# KWIZERA AI STUDIO — Phase 10 Step 10E Music Generation Report",
        "",
        `**Phase:** 10 — Audio Generation Engine`,
        `**Step:** 10E — AI Music Generation Engine`,
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
        `| **Music Plans Generated** | ${status.musicPlansGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Generated Music Plans",
        "",
        `- Technology (Corporate): ${tech?.profile.platform ?? "n/a"} (${tech?.scores.compositionScore ?? 0}/100)`,
        `- Healthcare (Ambient): ${health?.profile.mood ?? "n/a"} (${health?.scores.emotionalScore ?? 0}/100)`,
        `- Finance (Afrobeat): ${finance?.profile.genre ?? "n/a"} (${finance?.scores.rhythmScore ?? 0}/100)`,
        `- Cinematic (Epic): ${cinematic?.profile.genre ?? "n/a"} (${cinematic?.scores.productionReadinessScore ?? 0}/100)`,
        "",
    ].join("\n");
}
function buildCompositionReport(...records) {
    const rows = records.filter(Boolean);
    const lines = [
        "# Composition Planning Report — Step 10E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Plan | Genre | Key | Chord Progressions | Composition Score |",
        "|------|-------|-----|-------------------|-------------------|",
    ];
    for (const r of rows) {
        lines.push(`| ${r.musicPlanId.slice(0, 28)}... | ${r.musicAnalysis.genre} | ${r.musicAnalysis.key} | ${r.compositionPlan.chordProgression.length} | ${r.scores.compositionScore}/100 |`);
    }
    return lines.join("\n");
}
function buildArrangementReport(...records) {
    const rows = records.filter(Boolean);
    const lines = [
        "# Arrangement Planning Report — Step 10E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Plan | Active Instruments | Harmony Score | Rhythm Score |",
        "|------|-------------------|---------------|--------------|",
    ];
    for (const r of rows) {
        lines.push(`| ${r.profile.genre} | ${r.arrangementPlan.activeInstruments.join(", ")} | ${r.scores.harmonyScore}/100 | ${r.scores.rhythmScore}/100 |`);
    }
    return lines.join("\n");
}
function buildMoodReport(...records) {
    const rows = records.filter(Boolean);
    const lines = [
        "# Mood Planning Report — Step 10E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Plan | Primary Mood | Secondary | Emotional Score | Brand Alignment |",
        "|------|--------------|-----------|-----------------|-----------------|",
    ];
    for (const r of rows) {
        lines.push(`| ${r.profile.platform} | ${r.moodPlan.primaryMood} | ${r.moodPlan.secondaryMood ?? "n/a"} | ${r.scores.emotionalScore}/100 | ${r.moodPlan.brandMoodAlignment.slice(0, 40)}... |`);
    }
    return lines.join("\n");
}
function buildReadinessReport(status, ...records) {
    const rows = records.filter(Boolean);
    return [
        "# Music Generation Readiness Report — Step 10E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Plan | Composition | Harmony | Rhythm | Emotion | Brand | Production | Confidence | Ready |",
        "|------|-------------|---------|--------|---------|-------|------------|------------|-------|",
        ...rows.map((r) => `| ${r.profile.genre} | ${r.scores.compositionScore} | ${r.scores.harmonyScore} | ${r.scores.rhythmScore} | ${r.scores.emotionalScore} | ${r.scores.brandConsistencyScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`),
        "",
        "## Performance",
        "",
        `- Average generation: ${status.performance.averageGenerationMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        `- Sync preparation: ${status.syncPreparationStatus}`,
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-music-generation-engine.js.map