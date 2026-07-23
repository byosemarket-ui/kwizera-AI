import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, VideoAnalysisType, VideoCodec, AudioCodec, VideoContainer, VideoFileFormat, FrameRateMode, VideoColorSpace, VideoEnhancementPlatform, EnhancementType, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-enhancement-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_COMMERCIAL = {
    videoId: "step7i-kwizera-commercial",
    videoName: "KWIZERA Pro Studio Commercial",
    filePath: "uploads/kwizera-pro-commercial.mp4",
    fileFormat: VideoFileFormat.MP4,
    container: VideoContainer.MP4,
    videoCodec: VideoCodec.H264,
    audioCodec: AudioCodec.AAC,
    fileSizeBytes: 48_500_000,
    durationMs: 30_000,
    width: 1920,
    height: 1080,
    fps: 30,
    frameRateMode: FrameRateMode.Constant,
    bitrateKbps: 12_000,
    colorSpace: VideoColorSpace.Rec709,
    metadata: { campaign: "pro-launch-2026" },
    videoType: VideoAnalysisType.Commercial,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    sceneCount: 4,
    shotCount: 8,
    visual: { sharpness: 82, visualStability: 85, saturation: 72, contrast: 78, noise: 25, brightness: 72, exposure: 75, whiteBalance: 80 },
    frame: { frameConsistencyScore: 92, motionDensity: 58, visualComplexity: 55 },
    campaign: "pro-launch-2026",
    creativeStyle: "premium modern",
    category: "technology",
    keywords: ["commercial"],
};
const SAMPLE_SOCIAL = {
    videoId: "step7i-kwizera-social-reel",
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
    visual: { sharpness: 78, visualStability: 78, saturation: 80 },
    frame: { frameConsistencyScore: 88, motionDensity: 72 },
    keywords: ["reel"],
};
const SAMPLE_TUTORIAL = {
    videoId: "step7i-kwizera-tutorial",
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
    visual: { sharpness: 80, visualStability: 88, saturation: 55 },
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
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 7I Video Enhancement Planning Engine Validation");
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
        await core.start("step-7i-validation");
        const foundation = core.getManager().videoIntelligenceFoundation;
        const engine = foundation.getVideoEnhancementPlanningEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Video Enhancement Planning Engine operational",
        };
        await runFullPipeline(foundation, SAMPLE_COMMERCIAL);
        const start = Date.now();
        const commercial = await engine.planEnhancement({ videoId: "step7i-kwizera-commercial" });
        const ms = Date.now() - start;
        results.enhancementPlanning = {
            passed: commercial.success && Boolean(commercial.record?.profile.enhancementPlanId),
            detail: `${commercial.record?.profile.enhancementPlanId} in ${ms}ms, readiness ${commercial.record?.scores.enhancementReadinessScore}`,
        };
        results.qualityAnalysis = {
            passed: (commercial.record?.qualityAnalysis.visualClarity ?? 0) > 0 &&
                (commercial.record?.qualityAnalysis.audioQuality ?? 0) > 0,
            detail: `Visual ${commercial.record?.qualityAnalysis.visualClarity}, audio ${commercial.record?.qualityAnalysis.audioQuality}, stab ${commercial.record?.qualityAnalysis.stabilization}`,
        };
        results.visualEnhancement = {
            passed: Boolean(commercial.record?.visualPlan.colorGradingPlanning),
            detail: commercial.record?.visualPlan.sharpnessEnhancement.slice(0, 50),
        };
        results.audioEnhancement = {
            passed: Boolean(commercial.record?.audioPlan.loudnessNormalization),
            detail: commercial.record?.audioPlan.voiceEnhancement.slice(0, 50),
        };
        results.motionEnhancement = {
            passed: Boolean(commercial.record?.motionPlan.motionContinuity),
            detail: commercial.record?.motionPlan.cameraStabilization.slice(0, 50),
        };
        results.platformOptimization = {
            passed: (commercial.record?.platformOptimizations.length ?? 0) >= 8,
            detail: `${commercial.record?.platformOptimizations.length} platforms, primary ${commercial.record?.profile.platform}`,
        };
        results.nonDestructive = {
            passed: commercial.record?.nonDestructive.preserveOriginal === true &&
                commercial.record?.nonDestructive.supportsUndo === true,
            detail: `Original preserved, ${commercial.record?.versionHistory.length} version(s)`,
        };
        results.productionReadiness = {
            passed: (commercial.record?.scores.productionReadinessScore ?? 0) >= 55,
            detail: `Production ${commercial.record?.scores.productionReadinessScore}, confidence ${commercial.record?.scores.aiConfidenceScore}`,
        };
        results.recommendationQuality = {
            passed: (commercial.record?.recommendations.length ?? 0) >= 3,
            detail: `${commercial.record?.recommendations.length} recommendation(s)`,
        };
        results.relationshipDetection = {
            passed: (commercial.record?.relationships.relatedStylePlans.length ?? 0) >= 1 &&
                (commercial.record?.relationships.relatedScenes.length ?? 0) >= 3,
            detail: `${commercial.record?.relationships.relatedStylePlans.length} style plans, ${commercial.record?.relationships.relatedMotionPlans.length} motion plans`,
        };
        await runFullPipeline(foundation, SAMPLE_SOCIAL);
        await runFullPipeline(foundation, SAMPLE_TUTORIAL);
        const social = await engine.planEnhancement({ videoId: "step7i-kwizera-social-reel" });
        const tutorial = await engine.planEnhancement({ videoId: "step7i-kwizera-tutorial" });
        results.multiVideoAnalysis = {
            passed: social.success && tutorial.success,
            detail: `Social ${social.record?.profile.platform}, Tutorial ${tutorial.record?.profile.platform}`,
        };
        const noPipeline = await engine.planEnhancement({ videoId: "step7i-nonexistent" });
        results.incompleteRejection = {
            passed: !noPipeline.success,
            detail: noPipeline.message ?? "Rejected",
        };
        const repaired = await engine.repairEnhancementPlan("step7i-kwizera-social-reel");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Enhancement plan repair verified" : "Repair failed",
        };
        const brandSearch = engine.searchEnhancementPlans({ brand: "KWIZERA" });
        const platformSearch = engine.searchEnhancementPlans({ platform: VideoEnhancementPlatform.Instagram });
        const typeSearch = engine.searchEnhancementPlans({ enhancementType: EnhancementType.Color });
        results.search = {
            passed: brandSearch.length >= 2 && typeSearch.length >= 1,
            detail: `${brandSearch.length} by brand, ${platformSearch.length} instagram, ${typeSearch.length} color`,
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
        const logFile = path.join(storageRoot, "logs", `video-enhancement-planning-engine-${new Date().toISOString().slice(0, 10)}.jsonl`);
        results.logging = { passed: fs.existsSync(logFile), detail: logFile };
        results.performance = {
            passed: status.performance.averagePlanningMs < 120000,
            detail: `avg ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("video-enhancement-planning");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.moduleName}, v${registered?.version}`,
        };
        await core.stop("step-7i-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Video-Enhancement-Report.md"), buildMainReport(status, results, storageRoot, allPassed), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Visual-Enhancement-Report.md"), buildVisualReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Audio-Enhancement-Report.md"), buildAudioReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Motion-Enhancement-Report.md"), buildMotionReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Enhancement-Readiness-Report.md"), buildReadinessReport(status, commercial.record, social.record, tutorial.record, allPassed), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-7I-VALIDATION-REPORT.md"), buildMainReport(status, results, storageRoot, allPassed), "utf8");
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
        "# Video Enhancement Report — Step 7I",
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
        `- Plans generated: ${status.plansGenerated}`,
        `- Avg enhancement readiness: ${status.averageEnhancementReadinessScore}`,
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 7I validation complete. Awaiting approval before Step 7J.",
        "",
    ].join("\n");
}
function buildVisualReport(a, b, c) {
    const rows = [a, b, c].filter(Boolean);
    return [
        "# Visual Enhancement Report — Step 7I",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Resolution | Noise | Stabilization | Color Grade | Sharpness |",
        "|-------|------------|-------|---------------|-------------|-----------|",
        ...rows.map((r) => `| ${r.videoId} | ${r.visualPlan.resolutionEnhancement.slice(0, 30)} | ${r.visualPlan.noiseReduction.slice(0, 25)} | ${r.visualPlan.stabilizationPlanning.slice(0, 25)} | ${r.visualPlan.colorGradingPlanning.slice(0, 30)} | ${r.visualPlan.sharpnessEnhancement.slice(0, 25)} |`),
        "",
    ].join("\n");
}
function buildAudioReport(a, b, c) {
    const rows = [a, b, c].filter(Boolean);
    return [
        "# Audio Enhancement Report — Step 7I",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Voice | Music | Loudness | Sync | Clarity |",
        "|-------|-------|-------|----------|------|---------|",
        ...rows.map((r) => `| ${r.videoId} | ${r.audioPlan.voiceEnhancement.slice(0, 25)} | ${r.audioPlan.musicOptimization.slice(0, 25)} | ${r.audioPlan.loudnessNormalization.slice(0, 20)} | ${r.audioPlan.audioSynchronization.slice(0, 25)} | ${r.audioPlan.audioClarity.slice(0, 25)} |`),
        "",
    ].join("\n");
}
function buildMotionReport(a, b, c) {
    const rows = [a, b, c].filter(Boolean);
    return [
        "# Motion Enhancement Report — Step 7I",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Smoothing | Stabilization | Continuity | Interpolation |",
        "|-------|-----------|---------------|------------|---------------|",
        ...rows.map((r) => `| ${r.videoId} | ${r.motionPlan.motionSmoothing.slice(0, 30)} | ${r.motionPlan.cameraStabilization.slice(0, 30)} | ${r.motionPlan.motionContinuity.slice(0, 30)} | ${r.motionPlan.frameInterpolationPrep.slice(0, 30)} |`),
        "",
    ].join("\n");
}
function buildReadinessReport(status, a, b, c, allPassed) {
    const rows = [a, b, c].filter(Boolean);
    return [
        "# Enhancement Readiness Report — Step 7I",
        "",
        `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "| Video | Readiness | Visual | Audio | Motion | Production | Confidence |",
        "|-------|-----------|--------|-------|--------|------------|------------|",
        ...rows.map((r) => `| ${r.videoId} | ${r.scores.enhancementReadinessScore} | ${r.scores.visualQualityScore} | ${r.scores.audioQualityScore} | ${r.scores.motionQualityScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} |`),
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-video-enhancement-planning-engine.js.map