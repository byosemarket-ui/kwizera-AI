import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, VideoAnalysisType, VideoCodec, AudioCodec, VideoContainer, VideoFileFormat, VideoQualityPredictionPlatform, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-video-quality-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_COMMERCIAL = {
    videoId: "step7l-kwizera-commercial",
    videoName: "KWIZERA Pro Studio Commercial",
    filePath: "uploads/kwizera-pro-commercial.mp4",
    fileFormat: VideoFileFormat.MP4,
    container: VideoContainer.MP4,
    videoCodec: VideoCodec.H264,
    audioCodec: AudioCodec.AAC,
    durationMs: 30_000,
    width: 1920,
    height: 1080,
    fps: 30,
    videoType: VideoAnalysisType.Commercial,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    sceneCount: 4,
    shotCount: 8,
    visual: { sharpness: 88, visualStability: 85, saturation: 72, contrast: 78, noise: 20 },
    frame: { frameConsistencyScore: 92, motionDensity: 58 },
    campaign: "pro-launch-2026",
    creativeStyle: "premium modern",
    category: "technology",
    keywords: ["commercial"],
};
const SAMPLE_SOCIAL = {
    videoId: "step7l-kwizera-social-reel",
    videoName: "KWIZERA Social Reel",
    filePath: "uploads/kwizera-social-reel.mp4",
    fileFormat: VideoFileFormat.MP4,
    container: VideoContainer.MP4,
    videoCodec: VideoCodec.H264,
    audioCodec: AudioCodec.AAC,
    durationMs: 15_000,
    width: 1080,
    height: 1920,
    fps: 30,
    metadata: { platform: "instagram-reels" },
    videoType: VideoAnalysisType.SocialMedia,
    product: "KWIZERA Urban Collection",
    brand: "KWIZERA",
    sceneCount: 3,
    shotCount: 6,
    visual: { sharpness: 80, visualStability: 78 },
    frame: { frameConsistencyScore: 88, motionDensity: 72 },
    keywords: ["reel"],
};
const SAMPLE_TUTORIAL = {
    videoId: "step7l-kwizera-tutorial",
    videoName: "KWIZERA Studio Tutorial",
    filePath: "uploads/kwizera-studio-tutorial.mp4",
    fileFormat: VideoFileFormat.MP4,
    container: VideoContainer.MP4,
    videoCodec: VideoCodec.H265,
    audioCodec: AudioCodec.AAC,
    durationMs: 600_000,
    width: 1920,
    height: 1080,
    fps: 24,
    metadata: { instructor: "KWIZERA Academy" },
    videoType: VideoAnalysisType.Tutorial,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    sceneCount: 12,
    shotCount: 24,
    visual: { sharpness: 82, visualStability: 88 },
    frame: { frameConsistencyScore: 90, motionDensity: 35 },
    category: "education",
    keywords: ["tutorial"],
};
async function runFullPipeline(foundation, input) {
    const id = input.videoId;
    await foundation.getVideoAnalysisEngine().analyzeVideo(input);
    await foundation.getVideoUnderstandingEngine().understandVideo({ videoId: id });
    await foundation.getSceneDetectionEngine().detectScenes({ videoId: id });
    await foundation.getTimelineIntelligenceEngine().analyzeTimeline({ videoId: id });
    await foundation.getCameraMovementEngine().analyzeCamera({ videoId: id });
    await foundation.getMotionIntelligenceEngine().analyzeMotion({ videoId: id });
    await foundation.getVideoStyleIntelligenceEngine().analyzeStyle({ videoId: id });
    await foundation.getVideoEnhancementPlanningEngine().planEnhancement({ videoId: id });
    await foundation.getCreativeVideoIntelligenceEngine().planCreativeVideo({ videoId: id });
    await foundation.getProductionVideoPlanningEngine().planProductionVideo({ videoId: id });
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 7L Video Quality Prediction Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({
            storageRootOverride: storageRoot,
            skipReasoningEngine: true,
            skipDecisionEngine: true,
            skipPlanningEngine: true,
            skipWorkflowEngine: true,
            skipTaskManager: true,
        });
        await core.start("step-7l-validation");
        const foundation = core.getManager().videoIntelligenceFoundation;
        const engine = foundation.getVideoQualityPredictionEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Video Quality Prediction Engine operational",
        };
        await runFullPipeline(foundation, SAMPLE_COMMERCIAL);
        const start = Date.now();
        const commercial = await engine.predictVideoQuality({ videoId: "step7l-kwizera-commercial" });
        const ms = Date.now() - start;
        results.qualityAnalysis = {
            passed: Boolean(commercial.record?.analysisSummary.videoAnalysis) &&
                Boolean(commercial.record?.analysisSummary.productionPlanning),
            detail: `10-module analysis, overall ${commercial.record?.scores.overallVideoQualityScore} in ${ms}ms`,
        };
        results.predictionAccuracy = {
            passed: (commercial.record?.predictions.productionSuccessProbability ?? 0) >= 50 &&
                (commercial.record?.predictions.viewerEngagement ?? 0) > 0 &&
                (commercial.record?.predictions.viewerRetention ?? 0) > 0,
            detail: `Success ${commercial.record?.predictions.productionSuccessProbability}%, engagement ${commercial.record?.predictions.viewerEngagement}%, retention ${commercial.record?.predictions.viewerRetention}%`,
        };
        results.riskDetection = {
            passed: Array.isArray(commercial.record?.risks) &&
                Boolean(commercial.record?.highestRiskLevel) &&
                commercial.record.highestRiskLevel !== "critical",
            detail: `${commercial.record?.risks.length} risk(s), highest: ${commercial.record?.highestRiskLevel}`,
        };
        results.recommendationGeneration = {
            passed: (commercial.record?.recommendations.length ?? 0) >= 5,
            detail: `${commercial.record?.recommendations.length} recommendation(s)`,
        };
        results.qualityScores = {
            passed: (commercial.record?.scores.visualQualityScore ?? 0) > 0 &&
                (commercial.record?.scores.storytellingScore ?? 0) > 0 &&
                (commercial.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Visual ${commercial.record?.scores.visualQualityScore}, storytelling ${commercial.record?.scores.storytellingScore}, confidence ${commercial.record?.scores.aiConfidenceScore}`,
        };
        results.qualityValidation = {
            passed: commercial.record?.checks.dependencyValidation === true &&
                commercial.record?.checks.assetCompleteness === true,
            detail: `9 checks, dependency ${commercial.record?.checks.dependencyValidation ? "passed" : "failed"}`,
        };
        results.readinessScoring = {
            passed: commercial.record?.productionReady === true &&
                (commercial.record?.scores.productionReadinessScore ?? 0) >= 55,
            detail: `Production ready: ${commercial.record?.productionReady}, readiness ${commercial.record?.scores.productionReadinessScore}`,
        };
        results.platformQuality = {
            passed: (commercial.record?.platformQuality.length ?? 0) === 8,
            detail: `8 platforms evaluated, primary ${commercial.record?.profile.platform}`,
        };
        results.relationshipDetection = {
            passed: (commercial.record?.relationships.relatedStoryboards.length ?? 0) >= 1 &&
                (commercial.record?.relationships.relatedProductionPlans.length ?? 0) >= 1,
            detail: `${commercial.record?.relationships.relatedStoryboards.length} storyboards, ${commercial.record?.relationships.relatedProductionPlans.length} production plans`,
        };
        await runFullPipeline(foundation, SAMPLE_SOCIAL);
        await runFullPipeline(foundation, SAMPLE_TUTORIAL);
        const social = await engine.predictVideoQuality({ videoId: "step7l-kwizera-social-reel" });
        const tutorial = await engine.predictVideoQuality({ videoId: "step7l-kwizera-tutorial" });
        results.multiVideoPrediction = {
            passed: social.success && tutorial.success,
            detail: `Social ${social.record?.profile.platform} (${social.record?.scores.overallVideoQualityScore}), Tutorial ${tutorial.record?.profile.platform} (${tutorial.record?.scores.overallVideoQualityScore})`,
        };
        const noPipeline = await engine.predictVideoQuality({ videoId: "step7l-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected",
        };
        const repaired = await engine.repairQualityPrediction("step7l-kwizera-social-reel");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Quality prediction repair verified" : "Repair failed",
        };
        const brandSearch = engine.searchQualityPredictions({ brand: "KWIZERA" });
        const platformSearch = engine.searchQualityPredictions({ platform: VideoQualityPredictionPlatform.Website });
        const scoreSearch = engine.searchQualityPredictions({ minQualityScore: 50 });
        const riskSearch = engine.searchQualityPredictions({ riskLevel: "low" });
        results.search = {
            passed: brandSearch.length >= 2 && platformSearch.length >= 1 && scoreSearch.length >= 2,
            detail: `${brandSearch.length} brand, ${platformSearch.length} website, ${scoreSearch.length} quality, ${riskSearch.length} risk`,
        };
        const status = engine.buildStatusReport();
        results.knowledgeBridge = { passed: status.knowledgeBridgeStatus === "connected", detail: status.knowledgeBridgeStatus };
        results.memoryBridge = { passed: status.memoryBridgeStatus === "connected", detail: status.memoryBridgeStatus };
        results.productIntelligenceBridge = {
            passed: status.productIntelligenceBridgeStatus === "connected",
            detail: status.productIntelligenceBridgeStatus,
        };
        results.imageIntelligenceBridge = {
            passed: status.imageIntelligenceBridgeStatus === "connected",
            detail: status.imageIntelligenceBridgeStatus,
        };
        const logFile = path.join(storageRoot, "logs", `video-quality-prediction-engine-${new Date().toISOString().slice(0, 10)}.jsonl`);
        results.logging = { passed: fs.existsSync(logFile), detail: logFile };
        results.performance = {
            passed: status.performance.averagePredictionMs < 120000,
            detail: `avg ${status.performance.averagePredictionMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("video-quality-prediction");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.moduleName}, v${registered?.version}`,
        };
        await core.stop("step-7l-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Video-Quality-Prediction-Report.md"), buildMainReport(status, results, storageRoot, allPassed), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Video-Risk-Analysis-Report.md"), buildRiskReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Video-Production-Quality-Report.md"), buildProductionQualityReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Video-Recommendations.md"), buildRecommendationsReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-7L-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed), "utf8");
        console.log("Reports written:", projectStateDir);
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        if (useTemp && fs.existsSync(storageRoot))
            fs.rmSync(storageRoot, { recursive: true, force: true });
        process.exit(allPassed ? 0 : 1);
    }
    catch (error) {
        console.error("Validation failed:", error);
        process.exit(1);
    }
}
function buildMainReport(status, results, storageRoot, allPassed) {
    return [
        "# Video Quality Prediction Report — Step 7L",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage:** \`${storageRoot}\``,
        `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
        `**Readiness:** ${status.readinessScore}/100`,
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([k, r]) => `| ${k} | ${r.passed ? "✅" : "❌"} | ${r.detail} |`),
        "",
        `- Predictions created: ${status.predictionsCreated}`,
        `- Avg overall quality: ${status.averageOverallQualityScore}`,
        `- Avg production readiness: ${status.averageProductionReadinessScore}`,
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 7L validation complete. Awaiting approval before Step 7M.",
        "",
    ].join("\n");
}
function buildRiskReport(a, b, c) {
    const rows = [a, b, c].filter(Boolean);
    return [
        "# Video Risk Analysis Report — Step 7L",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Highest Risk | Risk Count | Critical | High | Medium | Low |",
        "|-------|--------------|------------|----------|------|--------|-----|",
        ...rows.map((r) => {
            const counts = { critical: 0, high: 0, medium: 0, low: 0 };
            for (const risk of r.risks)
                counts[risk.severity]++;
            return `| ${r.videoId} | ${r.highestRiskLevel} | ${r.risks.length} | ${counts.critical} | ${counts.high} | ${counts.medium} | ${counts.low} |`;
        }),
        "",
        "## Risk Details",
        "",
        ...rows.flatMap((r) => [
            `### ${r.videoId}`,
            ...r.risks.map((risk) => `- **${risk.severity}** [${risk.category}]: ${risk.description}`),
            "",
        ]),
    ].join("\n");
}
function buildProductionQualityReport(a, b, c) {
    const rows = [a, b, c].filter(Boolean);
    return [
        "# Video Production Quality Report — Step 7L",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Overall | Visual | Audio | Story | Motion | Camera | Style | Brand | Marketing | Platform | Production | Confidence | Ready |",
        "|-------|---------|--------|-------|-------|--------|--------|-------|-------|-----------|----------|------------|------------|-------|",
        ...rows.map((r) => `| ${r.videoId} | ${r.scores.overallVideoQualityScore} | ${r.scores.visualQualityScore} | ${r.scores.audioQualityScore} | ${r.scores.storytellingScore} | ${r.scores.motionScore} | ${r.scores.cameraScore} | ${r.scores.styleScore} | ${r.scores.brandConsistencyScore} | ${r.scores.marketingEffectivenessScore} | ${r.scores.platformReadinessScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`),
        "",
        "## Predictions",
        "",
        "| Video | Success % | Engagement | Retention | Marketing | Conversion | Complexity |",
        "|-------|-----------|------------|-----------|-----------|------------|------------|",
        ...rows.map((r) => `| ${r.videoId} | ${r.predictions.productionSuccessProbability} | ${r.predictions.viewerEngagement} | ${r.predictions.viewerRetention} | ${r.predictions.marketingImpact} | ${r.predictions.conversionPotential} | ${r.predictions.renderingComplexity} |`),
        "",
    ].join("\n");
}
function buildRecommendationsReport(a, b, c) {
    const rows = [a, b, c].filter(Boolean);
    return [
        "# Video Recommendations — Step 7L",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        ...rows.flatMap((r) => [
            `## ${r.videoId}`,
            "",
            "| Category | Priority | Suggestion | Reason |",
            "|----------|----------|------------|--------|",
            ...r.recommendations.map((rec) => `| ${rec.category} | ${rec.priority} | ${rec.suggestion} | ${rec.reason} |`),
            "",
            "### Improvement Opportunities",
            ...r.predictions.improvementOpportunities.map((o) => `- ${o}`),
            "",
        ]),
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-video-quality-prediction-engine.js.map