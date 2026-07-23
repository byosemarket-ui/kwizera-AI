import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALL_S2S_PLATFORMS, AccentType, createAiCore, CreativePlatform, EmotionType, MarketingObjective, ProductAnalysisCategory, ProductAvailabilityStatus, ProductBusinessType, ProductUnderstandingMarketingGoal, S2sLanguage, S2sOutputUseCase, S2sPlatform, SUPPORTED_S2S_LANGUAGES, VoiceType, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-speech-to-speech-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_TECH = {
    productId: "step10c-kwizera-pro",
    productName: "KWIZERA Pro Studio",
    category: ProductAnalysisCategory.Software,
    subcategory: "creative-workstation",
    brand: "KWIZERA",
    description: "Professional AI-powered creative workstation for marketing teams",
    features: ["AI audio generation", "speech transformation", "multi-language S2S"],
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
    productId: "step10c-health-app",
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
    productId: "step10c-finance-app",
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
    console.log("KWIZERA AI STUDIO — Step 10C Speech-to-Speech Generation Engine Validation");
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
        await core.start("step-10c-validation");
        const initMs = Date.now() - initStart;
        const audioFoundation = core.getManager().audioGenerationFoundation;
        const engine = audioFoundation.getSpeechToSpeechGenerationEngine();
        const piFoundation = core.getManager().productIntelligenceFoundation;
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete()
                ? `Speech-to-Speech Engine ready in ${initMs}ms`
                : "Not initialized",
        };
        const registered = audioFoundation.getRegistry().getModule("speech-to-speech-generation-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
        };
        await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
        await prepareFullPipeline(piFoundation, SAMPLE_HEALTH, MarketingObjective.BrandAwareness, CreativePlatform.Website);
        await prepareFullPipeline(piFoundation, SAMPLE_FINANCE, MarketingObjective.ProductPromotion, CreativePlatform.TikTok);
        const tech = await engine.generateTransformationPlan({
            productId: "step10c-kwizera-pro",
            sourceAudioId: "step10c-source-tech-narration",
            platform: S2sPlatform.YouTube,
            language: S2sLanguage.English,
            outputUseCase: S2sOutputUseCase.VideoNarration,
            transcriptHint: "Introducing KWIZERA Pro Studio. Our AI-powered creative workstation empowers marketing teams worldwide.",
            sourceVoiceType: VoiceType.Male,
            targetVoiceType: VoiceType.Professional,
            sourceAccent: AccentType.American,
            sourceEmotion: EmotionType.Inspirational,
            durationMs: 52000,
            generatePlatformOptimizations: true,
        });
        const health = await engine.generateTransformationPlan({
            productId: "step10c-health-app",
            sourceAudioId: "step10c-source-health-narration",
            platform: S2sPlatform.Website,
            language: S2sLanguage.French,
            outputUseCase: S2sOutputUseCase.Elearning,
            transcriptHint: "Bienvenue sur VitalCare. Nous vous accompagnons chaque jour pour votre bien-être.",
            sourceVoiceType: VoiceType.Female,
            targetVoiceType: VoiceType.Neutral,
            sourceAccent: AccentType.French,
            sourceEmotion: EmotionType.Calm,
            durationMs: 38000,
            generatePlatformOptimizations: true,
        });
        const finance = await engine.generateTransformationPlan({
            productId: "step10c-finance-app",
            sourceAudioId: "step10c-source-finance-narration",
            platform: S2sPlatform.TikTok,
            language: S2sLanguage.Swahili,
            outputUseCase: S2sOutputUseCase.Advertisement,
            transcriptHint: "Karibu PesaSmart! Huduma ya benki ya simu inayokupa udhibiti wa fedha zako.",
            sourceVoiceType: VoiceType.Male,
            targetVoiceType: VoiceType.Friendly,
            sourceAccent: AccentType.African,
            sourceEmotion: EmotionType.Friendly,
            durationMs: 28000,
            generatePlatformOptimizations: true,
        });
        const kinyarwanda = await engine.generateTransformationPlan({
            sourceAudioId: "step10c-source-rw-narration",
            transcriptHint: "Murakoze guhitamo KWIZERA. Dufite ibikorwa byiza byo gufasha abakora mu bucuruzi.",
            brandName: "KWIZERA",
            language: S2sLanguage.Kinyarwanda,
            platform: S2sPlatform.MobileApp,
            outputUseCase: S2sOutputUseCase.Podcast,
            sourceVoiceType: VoiceType.Narrator,
            targetVoiceType: VoiceType.Professional,
            sourceAccent: AccentType.African,
            sourceEmotion: EmotionType.Professional,
            durationMs: 35000,
            generatePlatformOptimizations: false,
        });
        results.transformationPlanGeneration = {
            passed: tech.success && health.success && finance.success && kinyarwanda.success,
            detail: `Tech ${tech.success ? "✓" : "✗"}, Health ${health.success ? "✓" : "✗"}, Finance ${finance.success ? "✓" : "✗"}, RW ${kinyarwanda.success ? "✓" : "✗"}`,
        };
        results.speechAnalysis = {
            passed: Boolean(tech.record?.speechAnalysis.language &&
                tech.record?.speechAnalysis.speakerSegments.length >= 1 &&
                tech.record?.speechAnalysis.detectedEmotion &&
                tech.record?.speechAnalysis.audioQualityScore >= 70),
            detail: `${tech.record?.speechAnalysis.speakerSegments.length} segments, lang ${tech.record?.speechAnalysis.language}, quality ${tech.record?.speechAnalysis.audioQualityScore}`,
        };
        results.voiceTransformation = {
            passed: Boolean(tech.record?.voiceTransformation.voiceMapping &&
                tech.record?.voiceTransformation.accentAdaptation &&
                tech.record?.voiceTransformation.pitchAdaptation &&
                (tech.record?.scores.transformationQualityScore ?? 0) >= 55),
            detail: `${tech.record?.voiceTransformation.sourceVoiceType} → ${tech.record?.voiceTransformation.targetVoiceType}, score ${tech.record?.scores.transformationQualityScore}`,
        };
        results.emotionPreservation = {
            passed: Boolean(tech.record?.emotionPreservation.sourceEmotion &&
                tech.record?.emotionPreservation.emotionalArc.length >= 1 &&
                (tech.record?.scores.emotionPreservationScore ?? 0) >= 50),
            detail: `Preservation ${tech.record?.emotionPreservation.preservationScore}, score ${tech.record?.scores.emotionPreservationScore}`,
        };
        results.timingPreservation = {
            passed: Boolean(tech.record?.timingPreservation.segmentTiming.length >= 1 &&
                tech.record?.timingPreservation.naturalPauses.length >= 3 &&
                (tech.record?.scores.timingPreservationScore ?? 0) >= 55),
            detail: `Timing score ${tech.record?.scores.timingPreservationScore}, ${tech.record?.timingPreservation.segmentTiming.length} segments`,
        };
        results.pronunciationAdaptation = {
            passed: Boolean(tech.record?.pronunciationAdaptation.numberReadingRules.length >= 2 &&
                Object.keys(tech.record?.pronunciationAdaptation.pronunciationDictionary ?? {}).length >= 1 &&
                (tech.record?.scores.pronunciationScore ?? 0) >= 55),
            detail: `Pronunciation score ${tech.record?.scores.pronunciationScore}`,
        };
        results.multiLanguageSupport = {
            passed: tech.record?.profile.language === S2sLanguage.English &&
                health.record?.profile.language === S2sLanguage.French &&
                finance.record?.profile.language === S2sLanguage.Swahili &&
                kinyarwanda.record?.profile.language === S2sLanguage.Kinyarwanda &&
                SUPPORTED_S2S_LANGUAGES.length >= 4,
            detail: `${SUPPORTED_S2S_LANGUAGES.length} languages supported (en, fr, sw, rw verified)`,
        };
        results.platformOptimization = {
            passed: (tech.record?.platformOptimizations.length ?? 0) === ALL_S2S_PLATFORMS.length,
            detail: `${tech.record?.platformOptimizations.length}/${ALL_S2S_PLATFORMS.length} platform profiles`,
        };
        results.transformationScores = {
            passed: (tech.record?.scores.transformationQualityScore ?? 0) >= 55 &&
                (tech.record?.scores.pronunciationScore ?? 0) >= 55 &&
                (tech.record?.scores.emotionPreservationScore ?? 0) >= 50 &&
                (tech.record?.scores.timingPreservationScore ?? 0) >= 55 &&
                (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
                (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Transform ${tech.record?.scores.transformationQualityScore}, production ${tech.record?.scores.productionReadinessScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
        };
        results.relationships = {
            passed: (tech.record?.relationships.sourceAudio.length ?? 0) >= 1 &&
                (tech.record?.relationships.targetVoices.length ?? 0) >= 1 &&
                (tech.record?.relationships.products.length ?? 0) >= 1,
            detail: `Source audio ${tech.record?.relationships.sourceAudio.length}, target voices ${tech.record?.relationships.targetVoices.length}, products ${tech.record?.relationships.products.length}`,
        };
        results.productionReadiness = {
            passed: tech.record?.productionReady === true && tech.record?.validated === true,
            detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
        };
        results.brandConsistency = {
            passed: tech.record?.brandConsistent === true,
            detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
        };
        const noPipeline = await engine.generateTransformationPlan({ productId: "step10c-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected without upstream pipeline",
        };
        const audioOnly = await engine.generateTransformationPlan({
            sourceAudioId: "step10c-standalone-source",
            transcriptHint: "Standalone source narration for brand announcement with clear pronunciation and professional delivery",
            brandName: "KWIZERA",
            platform: S2sPlatform.Website,
            generatePlatformOptimizations: false,
        });
        results.sourceAudioGeneration = {
            passed: audioOnly.success,
            detail: audioOnly.success ? "Source audio transformation plan generated" : audioOnly.message ?? "Failed",
        };
        const repaired = await engine.repairTransformationPlan("step10c-health-app", S2sPlatform.Facebook);
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Transformation plan repair pipeline verified" : "Repair failed",
        };
        const productSearch = engine.searchTransformationPlans({ productId: "step10c-kwizera-pro" });
        results.searchByProduct = {
            passed: productSearch.length >= 1,
            detail: `${productSearch.length} result(s) by product`,
        };
        const languageSearch = engine.searchTransformationPlans({ language: S2sLanguage.French });
        results.searchByLanguage = {
            passed: languageSearch.length >= 1,
            detail: `${languageSearch.length} result(s) by language`,
        };
        const sourceAudioSearch = engine.searchTransformationPlans({ sourceAudioId: "step10c-source-tech-narration" });
        results.searchBySourceAudio = {
            passed: sourceAudioSearch.length >= 1,
            detail: `${sourceAudioSearch.length} result(s) by source audio`,
        };
        const keywordSearch = engine.searchTransformationPlans({ keywords: "kwizera" });
        results.searchByKeywords = {
            passed: keywordSearch.length >= 1,
            detail: `${keywordSearch.length} result(s) by keywords`,
        };
        const sourceAsset = audioFoundation.getAssetRegistry().getAsset(tech.record.profile.sourceAudioId);
        const targetVoiceAsset = audioFoundation.getAssetRegistry().getAsset(tech.record.profile.targetVoiceId);
        results.generationAssetRegistration = {
            passed: sourceAsset?.assetType === "audio-track" && targetVoiceAsset?.assetType === "voice",
            detail: `Source ${sourceAsset?.assetId}, Target voice ${targetVoiceAsset?.assetId}`,
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
        const logFile = path.join(storageRoot, "logs", `speech-to-speech-generation-engine-${logDate}.jsonl`);
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
            detail: `Healthcare ${health.record?.emotionPreservation.sourceEmotion}, Finance ${finance.record?.emotionPreservation.sourceEmotion}`,
        };
        results.recommendations = {
            passed: (tech.record?.recommendations.length ?? 0) >= 1,
            detail: `${tech.record?.recommendations.length} recommendation(s)`,
        };
        await core.stop("step-10c-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "AI-Speech-to-Speech-Report.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, health.record, finance.record, kinyarwanda.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Speech-Analysis-Report.md"), buildSpeechAnalysisReport(tech.record, health.record, finance.record, kinyarwanda.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Voice-Transformation-Report.md"), buildVoiceTransformationReport(tech.record, health.record, finance.record, kinyarwanda.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Emotion-Preservation-Report.md"), buildEmotionReport(tech.record, health.record, finance.record, kinyarwanda.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Speech-to-Speech-Readiness-Report.md"), buildReadinessReport(status, tech.record, health.record, finance.record, kinyarwanda.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-10C-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed, tech.record, health.record, finance.record, kinyarwanda.record), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Reports written:");
        console.log(`  ${path.join(projectStateDir, "AI-Speech-to-Speech-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Speech-Analysis-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Voice-Transformation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Emotion-Preservation-Report.md")}`);
        console.log(`  ${path.join(projectStateDir, "Speech-to-Speech-Readiness-Report.md")}`);
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
function buildMainReport(status, results, storageRoot, allPassed, tech, health, finance, rw) {
    return [
        "# KWIZERA AI STUDIO — Phase 10 Step 10C Speech-to-Speech Generation Report",
        "",
        `**Phase:** 10 — Audio Generation Engine`,
        `**Step:** 10C — AI Speech-to-Speech Generation Engine`,
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
        `| **Transformations Generated** | ${status.transformationsGenerated} |`,
        "",
        "## Validation Results",
        "",
        ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
        "",
        "## Generated Transformation Plans",
        "",
        `- Technology (EN): ${tech?.profile.platform ?? "n/a"} (${tech?.scores.transformationQualityScore ?? 0}/100)`,
        `- Healthcare (FR): ${health?.profile.language ?? "n/a"} (${health?.scores.emotionPreservationScore ?? 0}/100)`,
        `- Finance (SW): ${finance?.profile.language ?? "n/a"} (${finance?.scores.timingPreservationScore ?? 0}/100)`,
        `- Kinyarwanda (RW): ${rw?.profile.language ?? "n/a"} (${rw?.scores.productionReadinessScore ?? 0}/100)`,
        "",
    ].join("\n");
}
function buildSpeechAnalysisReport(...records) {
    const rows = records.filter(Boolean);
    const lines = [
        "# Speech Analysis Report — Step 10C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Plan | Language | Accent | Segments | Emotion | Audio Quality |",
        "|------|----------|--------|----------|---------|---------------|",
    ];
    for (const r of rows) {
        lines.push(`| ${r.transformationId.slice(0, 30)}... | ${r.speechAnalysis.language} | ${r.speechAnalysis.accent} | ${r.speechAnalysis.speakerSegments.length} | ${r.speechAnalysis.detectedEmotion} | ${r.speechAnalysis.audioQualityScore}/100 |`);
    }
    return lines.join("\n");
}
function buildVoiceTransformationReport(...records) {
    const rows = records.filter(Boolean);
    const lines = [
        "# Voice Transformation Report — Step 10C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Plan | Source Voice | Target Voice | Accent Adaptation | Transform Score |",
        "|------|--------------|--------------|-------------------|-----------------|",
    ];
    for (const r of rows) {
        lines.push(`| ${r.profile.productId ?? r.transformationId.slice(0, 20)} | ${r.voiceTransformation.sourceVoiceType} | ${r.voiceTransformation.targetVoiceType} | ${r.voiceTransformation.accentAdaptation.slice(0, 35)}... | ${r.scores.transformationQualityScore}/100 |`);
    }
    return lines.join("\n");
}
function buildEmotionReport(...records) {
    const rows = records.filter(Boolean);
    const lines = [
        "# Emotion Preservation Report — Step 10C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Plan | Source | Target | Preservation | Emotion Score |",
        "|------|--------|--------|--------------|---------------|",
    ];
    for (const r of rows) {
        lines.push(`| ${r.profile.productId ?? r.transformationId.slice(0, 20)} | ${r.emotionPreservation.sourceEmotion} | ${r.emotionPreservation.targetEmotion} | ${r.emotionPreservation.preservationScore} | ${r.scores.emotionPreservationScore}/100 |`);
    }
    return lines.join("\n");
}
function buildReadinessReport(status, ...records) {
    const rows = records.filter(Boolean);
    return [
        "# Speech-to-Speech Readiness Report — Step 10C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Plan | Transform | Pronunciation | Emotion | Timing | Brand | Production | Confidence | Ready |",
        "|------|-----------|---------------|---------|--------|-------|------------|------------|-------|",
        ...rows.map((r) => `| ${r.profile.language} | ${r.scores.transformationQualityScore} | ${r.scores.pronunciationScore} | ${r.scores.emotionPreservationScore} | ${r.scores.timingPreservationScore} | ${r.scores.brandConsistencyScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`),
        "",
        "## Performance",
        "",
        `- Average generation: ${status.performance.averageGenerationMs}ms`,
        `- Average search: ${status.performance.averageSearchMs}ms`,
        `- Platform optimization: ${status.platformOptimizationStatus}`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-speech-to-speech-generation-engine.js.map