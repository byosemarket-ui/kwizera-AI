import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, VideoAnalysisType, VideoCodec, AudioCodec, VideoContainer, VideoFileFormat, FrameRateMode, VideoColorSpace, TimelineVariant, TrackType, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-timeline-intelligence-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_COMMERCIAL = {
    videoId: "step7e-kwizera-commercial",
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
    creationDate: "2026-01-20T10:00:00.000Z",
    lastModifiedDate: "2026-03-15T14:30:00.000Z",
    videoType: VideoAnalysisType.Commercial,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    category: "marketing",
    language: "en",
    sceneCount: 4,
    shotCount: 8,
    visual: { sharpness: 88, visualStability: 85, motionDensity: 58 },
    frame: { frameConsistencyScore: 92, missingFrames: 0, sceneChangeCandidates: 4 },
    tags: ["commercial", "validation"],
    keywords: ["commercial", "kwizera"],
    campaign: "pro-launch-2026",
};
const SAMPLE_SOCIAL = {
    videoId: "step7e-kwizera-social-reel",
    videoName: "KWIZERA Social Reel",
    filePath: "uploads/kwizera-social-reel.mp4",
    fileFormat: VideoFileFormat.MP4,
    container: VideoContainer.MP4,
    videoCodec: VideoCodec.H264,
    audioCodec: AudioCodec.AAC,
    fileSizeBytes: 8_200_000,
    durationMs: 15_000,
    width: 1080,
    height: 1920,
    fps: 30,
    bitrateKbps: 4500,
    colorSpace: VideoColorSpace.SRGB,
    metadata: { platform: "instagram-reels" },
    creationDate: "2026-02-10T09:00:00.000Z",
    lastModifiedDate: "2026-02-10T09:00:00.000Z",
    videoType: VideoAnalysisType.SocialMedia,
    product: "KWIZERA Urban Collection",
    brand: "KWIZERA",
    language: "en",
    sceneCount: 3,
    shotCount: 6,
    visual: { sharpness: 80, motionDensity: 72, visualStability: 78 },
    frame: { frameConsistencyScore: 88, sceneChangeCandidates: 3 },
    tags: ["social", "validation"],
    keywords: ["reel", "social"],
};
const SAMPLE_TUTORIAL = {
    videoId: "step7e-kwizera-tutorial",
    videoName: "KWIZERA Studio Tutorial",
    filePath: "uploads/kwizera-studio-tutorial.mp4",
    fileFormat: VideoFileFormat.MP4,
    container: VideoContainer.MP4,
    videoCodec: VideoCodec.H265,
    audioCodec: AudioCodec.AAC,
    fileSizeBytes: 125_000_000,
    durationMs: 600_000,
    width: 1920,
    height: 1080,
    fps: 24,
    bitrateKbps: 16_000,
    colorSpace: VideoColorSpace.Rec709,
    metadata: { instructor: "KWIZERA Academy" },
    creationDate: "2026-03-01T08:00:00.000Z",
    lastModifiedDate: "2026-04-01T12:00:00.000Z",
    videoType: VideoAnalysisType.Tutorial,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    language: "en",
    sceneCount: 12,
    shotCount: 24,
    visual: { sharpness: 82, visualStability: 88 },
    frame: { frameConsistencyScore: 90, sceneChangeCandidates: 12 },
    tags: ["tutorial", "validation"],
    keywords: ["tutorial", "kwizera"],
};
async function runPipeline(foundation, input) {
    await foundation.getVideoAnalysisEngine().analyzeVideo(input);
    await foundation.getVideoUnderstandingEngine().understandVideo({ videoId: input.videoId });
    await foundation.getSceneDetectionEngine().detectScenes({ videoId: input.videoId });
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 7E Timeline Intelligence Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("Project state:", projectStateDir);
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
        await core.start("step-7e-validation");
        const foundation = core.getManager().videoIntelligenceFoundation;
        const engine = foundation.getTimelineIntelligenceEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Timeline Intelligence Engine operational",
        };
        await runPipeline(foundation, SAMPLE_COMMERCIAL);
        const analyzeStart = Date.now();
        const commercial = await engine.analyzeTimeline({
            videoId: "step7e-kwizera-commercial",
            platform: "youtube",
            relatedAudioPlans: ["audio-plan-commercial"],
            relatedProductionPlans: ["production-plan-commercial"],
        });
        const analyzeMs = Date.now() - analyzeStart;
        results.timelineCreation = {
            passed: commercial.success && Boolean(commercial.record?.timelineId),
            detail: `Timeline ${commercial.record?.timelineId} created in ${analyzeMs}ms, quality ${commercial.record?.scores.timelineQualityScore}`,
        };
        results.timelineStructure = {
            passed: (commercial.record?.sections.length ?? 0) >= 3 &&
                Boolean(commercial.record?.hierarchy.rootTimelineId) &&
                (commercial.record?.dependencies.length ?? 0) >= 2,
            detail: `${commercial.record?.sections.length} sections, ${commercial.record?.dependencies.length} dependencies`,
        };
        results.sceneSequencing = {
            passed: (commercial.record?.sceneSequence.length ?? 0) >= 3 &&
                commercial.record?.sceneSequence.every((s) => s.order > 0) === true,
            detail: `${commercial.record?.sceneSequence.length} scenes sequenced`,
        };
        results.shotSequencing = {
            passed: (commercial.record?.shotSequence.length ?? 0) >= 4,
            detail: `${commercial.record?.shotSequence.length} shots in ${commercial.record?.shotSequence[0]?.shotGroup ?? "groups"}`,
        };
        results.synchronization = {
            passed: (commercial.record?.synchronization.overallSyncScore ?? 0) >= 50,
            detail: `Overall sync ${commercial.record?.synchronization.overallSyncScore}, audio ${commercial.record?.synchronization.audioSyncScore}`,
        };
        results.trackManagement = {
            passed: (commercial.record?.tracks.length ?? 0) >= 8 &&
                commercial.record?.tracks.some((t) => t.trackType === TrackType.Video) === true &&
                commercial.record?.tracks.some((t) => t.trackType === TrackType.Audio) === true,
            detail: `${commercial.record?.tracks.length} tracks (${commercial.record?.tracks.map((t) => t.trackType).join(", ")})`,
        };
        results.multiTimelineSupport = {
            passed: (commercial.record?.variants.length ?? 0) >= 4 &&
                commercial.record?.variants.some((v) => v.variant === TimelineVariant.Main) === true &&
                commercial.record?.variants.some((v) => v.variant === TimelineVariant.SocialMedia) === true,
            detail: `${commercial.record?.variants.length} variants: ${commercial.record?.variants.map((v) => v.variant).join(", ")}`,
        };
        results.timelineIndexing = {
            passed: (commercial.record?.indexes.timelineIndexIds.length ?? 0) >= 2 &&
                (commercial.record?.indexes.sceneIndexIds.length ?? 0) >= 3,
            detail: `Timelines ${commercial.record?.indexes.timelineIndexIds.length}, scenes ${commercial.record?.indexes.sceneIndexIds.length}, tracks ${commercial.record?.indexes.trackIndexIds.length}`,
        };
        results.productionReadiness = {
            passed: (commercial.record?.editingReadiness ?? 0) >= 60 &&
                (commercial.record?.renderingReadiness ?? 0) >= 60 &&
                (commercial.record?.scores.productionReadinessScore ?? 0) >= 55,
            detail: `Editing ${commercial.record?.editingReadiness}, rendering ${commercial.record?.renderingReadiness}`,
        };
        results.recommendationQuality = {
            passed: Array.isArray(commercial.record?.recommendations),
            detail: `${commercial.record?.recommendations.length ?? 0} recommendation(s)`,
        };
        await runPipeline(foundation, SAMPLE_SOCIAL);
        await runPipeline(foundation, SAMPLE_TUTORIAL);
        const social = await engine.analyzeTimeline({
            videoId: "step7e-kwizera-social-reel",
            platform: "instagram",
            variants: [TimelineVariant.Main, TimelineVariant.SocialMedia, TimelineVariant.PlatformSpecific],
        });
        const tutorial = await engine.analyzeTimeline({ videoId: "step7e-kwizera-tutorial" });
        results.multiProjectTimelines = {
            passed: social.success && tutorial.success,
            detail: `Social ${social.record?.variants.length} variants, Tutorial ${tutorial.record?.timelineLengthMs}ms`,
        };
        results.relationshipDetection = {
            passed: (commercial.record?.relationships.relatedScenes.length ?? 0) >= 3,
            detail: `${commercial.record?.relationships.relatedScenes.length} scenes, ${commercial.record?.relationships.relatedShots.length} shots linked`,
        };
        const noScene = await engine.analyzeTimeline({ videoId: "step7e-nonexistent" });
        results.incompleteRejection = {
            passed: !noScene.success,
            detail: noScene.message ?? "Rejected without prerequisites",
        };
        const repaired = await engine.repairTimeline("step7e-kwizera-social-reel");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Timeline repair verified" : "Repair failed",
        };
        const brandSearch = engine.searchTimelines({ brand: "KWIZERA" });
        results.search = {
            passed: brandSearch.length >= 2,
            detail: `${brandSearch.length} timeline(s) by brand`,
        };
        const variantSearch = engine.searchTimelines({ variant: TimelineVariant.SocialMedia });
        results.variantSearch = {
            passed: variantSearch.length >= 1,
            detail: `${variantSearch.length} timeline(s) with social-media variant`,
        };
        const status = engine.buildStatusReport();
        results.knowledgeBridge = {
            passed: status.knowledgeBridgeStatus === "connected",
            detail: status.knowledgeBridgeStatus,
        };
        results.memoryBridge = {
            passed: status.memoryBridgeStatus === "connected",
            detail: status.memoryBridgeStatus,
        };
        results.productIntelligenceBridge = {
            passed: status.productIntelligenceBridgeStatus === "connected",
            detail: status.productIntelligenceBridgeStatus,
        };
        results.imageIntelligenceBridge = {
            passed: status.imageIntelligenceBridgeStatus === "connected",
            detail: status.imageIntelligenceBridgeStatus,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `timeline-intelligence-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.performance = {
            passed: status.performance.averageAnalysisMs < 120000,
            detail: `avg analysis ${status.performance.averageAnalysisMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("timeline-intelligence");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.moduleName}, v${registered?.version}`,
        };
        await core.stop("step-7e-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Timeline-Intelligence-Report.md"), buildIntelligenceReport(status, results, storageRoot, allPassed), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Timeline-Synchronization-Report.md"), buildSyncReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Track-Management-Report.md"), buildTrackReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Timeline-Optimization-Report.md"), buildOptimizationReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Timeline-Readiness-Report.md"), buildReadinessReport(status, commercial.record, social.record, tutorial.record, allPassed), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-7E-VALIDATION-REPORT.md"), buildIntelligenceReport(status, results, storageRoot, allPassed), "utf8");
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
function buildIntelligenceReport(status, results, storageRoot, allPassed) {
    return [
        "# Timeline Intelligence Report — Step 7E",
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
        "## Engine Status",
        "",
        `- Timelines processed: ${status.timelinesProcessed}`,
        `- Total variants: ${status.totalVariants}`,
        `- Avg quality: ${status.averageTimelineQualityScore}`,
        `- Avg sync: ${status.averageSynchronizationScore}`,
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 7E Timeline Intelligence Engine validation complete. Awaiting user approval before Step 7F.",
        "",
    ].join("\n");
}
function buildSyncReport(commercial, social, tutorial) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Timeline Synchronization Report — Step 7E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Overall | Audio | Subtitle | Voice | Transition | Animation | Effect |",
        "|-------|---------|-------|----------|-------|------------|-----------|--------|",
        ...rows.map((r) => `| ${r.videoId} | ${r.synchronization.overallSyncScore} | ${r.synchronization.audioSyncScore} | ${r.synchronization.subtitleSyncScore} | ${r.synchronization.voiceSyncScore} | ${r.synchronization.transitionSyncScore} | ${r.synchronization.animationSyncScore} | ${r.synchronization.effectSyncScore} |`),
        "",
    ].join("\n");
}
function buildTrackReport(commercial, social, tutorial) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Track Management Report — Step 7E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Tracks | Track Types | Track Indexes |",
        "|-------|--------|-------------|---------------|",
        ...rows.map((r) => `| ${r.videoId} | ${r.tracks.length} | ${[...new Set(r.tracks.map((t) => t.trackType))].join(", ")} | ${r.indexes.trackIndexIds.length} |`),
        "",
    ].join("\n");
}
function buildOptimizationReport(commercial, social, tutorial) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Timeline Optimization Report — Step 7E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Flow | Story | Continuity | Alignment | Resources | Rendering |",
        "|-------|------|-------|------------|-----------|-----------|-----------|",
        ...rows.map((r) => `| ${r.videoId} | ${r.optimization.timelineFlowScore} | ${r.optimization.storyFlowScore} | ${r.optimization.sceneContinuityScore} | ${r.optimization.trackAlignmentScore} | ${r.optimization.resourceUsageScore} | ${r.optimization.renderingEfficiencyScore} |`),
        "",
    ].join("\n");
}
function buildReadinessReport(status, commercial, social, tutorial, allPassed) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Timeline Readiness Report — Step 7E",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "## Timeline Scores",
        "",
        "| Video | Quality | Sync | Story Flow | Production | Performance | Confidence | Editing | Rendering |",
        "|-------|---------|------|------------|------------|-------------|------------|---------|-----------|",
        ...rows.map((r) => `| ${r.videoId} | ${r.scores.timelineQualityScore} | ${r.scores.synchronizationScore} | ${r.scores.storyFlowScore} | ${r.scores.productionReadinessScore} | ${r.scores.performanceScore} | ${r.scores.aiConfidenceScore} | ${r.editingReadiness} | ${r.renderingReadiness} |`),
        "",
        "## Multi-Timeline Variants",
        "",
        ...rows.map((r) => `- **${r.videoId}:** ${r.variants.map((v) => `${v.variant} (${(v.lengthMs / 1000).toFixed(1)}s)`).join(", ")}`),
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-timeline-intelligence-engine.js.map