import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, VideoAnalysisType, VideoCodec, AudioCodec, VideoContainer, VideoFileFormat, FrameRateMode, VideoColorSpace, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-video-analysis-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_COMMERCIAL = {
    videoId: "step7b-kwizera-commercial",
    videoName: "KWIZERA Pro Studio Commercial",
    filePath: "uploads/kwizera-pro-commercial.mp4",
    fileFormat: VideoFileFormat.MP4,
    container: VideoContainer.MP4,
    videoCodec: VideoCodec.H264,
    videoCodecProfile: "high",
    audioCodec: AudioCodec.AAC,
    fileSizeBytes: 48_500_000,
    durationMs: 30_000,
    width: 1920,
    height: 1080,
    fps: 30,
    frameRateMode: FrameRateMode.Constant,
    bitrateKbps: 12_000,
    hdrSupported: false,
    colorSpace: VideoColorSpace.Rec709,
    metadata: { camera: "cinema-rig", software: "KWIZERA Capture", campaign: "pro-launch-2026" },
    creationDate: "2026-01-20T10:00:00.000Z",
    lastModifiedDate: "2026-03-15T14:30:00.000Z",
    videoType: VideoAnalysisType.Commercial,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    category: "marketing",
    subcategory: "commercial",
    creativeStyle: "commercial",
    language: "en",
    sceneCount: 4,
    shotCount: 8,
    visual: {
        brightness: 72,
        contrast: 78,
        saturation: 65,
        sharpness: 88,
        noise: 8,
        whiteBalance: 80,
        exposure: 75,
        dynamicRange: 82,
        dominantColors: ["#1a1a2e", "#e94560", "#ffffff"],
        visualStability: 85,
    },
    frame: {
        frameConsistencyScore: 92,
        missingFrames: 0,
        corruptedFrames: 0,
        motionDensity: 58,
        visualComplexity: 68,
    },
    tags: ["commercial", "kwizera", "validation"],
    keywords: ["commercial", "studio", "kwizera", "product"],
    campaign: "pro-launch-2026",
};
const SAMPLE_SOCIAL = {
    videoId: "step7b-kwizera-social-reel",
    videoName: "KWIZERA Social Reel",
    filePath: "uploads/kwizera-social-reel.mp4",
    fileFormat: VideoFileFormat.MP4,
    container: VideoContainer.MP4,
    videoCodec: VideoCodec.H264,
    videoCodecProfile: "main",
    audioCodec: AudioCodec.AAC,
    fileSizeBytes: 8_200_000,
    durationMs: 15_000,
    width: 1080,
    height: 1920,
    fps: 30,
    frameRateMode: FrameRateMode.Constant,
    bitrateKbps: 4500,
    hdrSupported: false,
    colorSpace: VideoColorSpace.SRGB,
    metadata: { platform: "instagram-reels", aspect: "9:16" },
    creationDate: "2026-02-10T09:00:00.000Z",
    lastModifiedDate: "2026-02-10T09:00:00.000Z",
    videoType: VideoAnalysisType.SocialMedia,
    product: "KWIZERA Urban Collection",
    brand: "KWIZERA",
    category: "social",
    creativeStyle: "engaging",
    language: "en",
    sceneCount: 3,
    shotCount: 6,
    visual: {
        brightness: 68,
        contrast: 72,
        saturation: 70,
        sharpness: 80,
        dominantColors: ["#2d3436", "#636e72", "#dfe6e9"],
        visualStability: 78,
    },
    tags: ["social", "reel", "validation"],
    keywords: ["reel", "social", "kwizera"],
};
const SAMPLE_TUTORIAL = {
    videoId: "step7b-kwizera-tutorial",
    videoName: "KWIZERA Studio Tutorial",
    filePath: "uploads/kwizera-studio-tutorial.mp4",
    fileFormat: VideoFileFormat.MP4,
    container: VideoContainer.MP4,
    videoCodec: VideoCodec.H265,
    videoCodecProfile: "main10",
    audioCodec: AudioCodec.AAC,
    fileSizeBytes: 125_000_000,
    durationMs: 600_000,
    width: 1920,
    height: 1080,
    fps: 24,
    frameRateMode: FrameRateMode.Constant,
    bitrateKbps: 16_000,
    hdrSupported: false,
    colorSpace: VideoColorSpace.Rec709,
    metadata: { instructor: "KWIZERA Academy", module: "studio-basics" },
    creationDate: "2026-03-01T08:00:00.000Z",
    lastModifiedDate: "2026-04-01T12:00:00.000Z",
    videoType: VideoAnalysisType.Tutorial,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    category: "education",
    creativeStyle: "instructional",
    language: "en",
    sceneCount: 12,
    shotCount: 24,
    visual: {
        brightness: 70,
        contrast: 75,
        saturation: 60,
        sharpness: 82,
        visualStability: 88,
    },
    tags: ["tutorial", "education", "validation"],
    keywords: ["tutorial", "studio", "kwizera", "training"],
};
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 7B Video Analysis Engine Validation");
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
        await core.start("step-7b-validation");
        const engine = core.getManager().videoIntelligenceFoundation.getVideoAnalysisEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Video Analysis Engine operational",
        };
        const analysisStart = Date.now();
        const commercial = await engine.analyzeVideo(SAMPLE_COMMERCIAL);
        const analysisMs = Date.now() - analysisStart;
        results.videoAnalysis = {
            passed: commercial.success && Boolean(commercial.record),
            detail: `Commercial analyzed in ${analysisMs}ms, completeness ${commercial.record?.scores.videoCompletenessScore}`,
        };
        results.technicalAnalysis = {
            passed: commercial.record?.technical.width === 1920 &&
                commercial.record?.technical.height === 1080 &&
                commercial.record?.technical.aspectRatio === "16:9",
            detail: `${commercial.record?.technical.resolution} ${commercial.record?.technical.orientation} ${commercial.record?.technical.fileFormat}`,
        };
        results.classification = {
            passed: commercial.record?.classification.videoType === VideoAnalysisType.Commercial,
            detail: `${commercial.record?.classification.videoType}/${commercial.record?.classification.category}/${commercial.record?.classification.subcategory}`,
        };
        results.completenessScoring = {
            passed: (commercial.record?.scores.videoCompletenessScore ?? 0) >= 55,
            detail: `Completeness ${commercial.record?.scores.videoCompletenessScore}, technical ${commercial.record?.scores.technicalQualityScore}`,
        };
        results.qualityScores = {
            passed: (commercial.record?.scores.visualQualityScore ?? 0) >= 50 &&
                (commercial.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Visual ${commercial.record?.scores.visualQualityScore}, confidence ${commercial.record?.scores.aiConfidenceScore}`,
        };
        const social = await engine.analyzeVideo(SAMPLE_SOCIAL);
        const tutorial = await engine.analyzeVideo(SAMPLE_TUTORIAL);
        results.multiTypeAnalysis = {
            passed: social.success && tutorial.success,
            detail: `Social ${social.record?.classification.videoType}, Tutorial ${tutorial.record?.classification.videoType}`,
        };
        results.timelineAnalysis = {
            passed: (commercial.record?.timeline.sceneCount ?? 0) >= 3 &&
                (commercial.record?.timeline.segments.length ?? 0) >= 4,
            detail: `${commercial.record?.timeline.sceneCount} scenes, ${commercial.record?.timeline.shotCount} shots, ${commercial.record?.timeline.segments.length} segments`,
        };
        results.frameAnalysis = {
            passed: (commercial.record?.frame.totalFrames ?? 0) > 0 &&
                (commercial.record?.frame.keyFrames ?? 0) > 0,
            detail: `${commercial.record?.frame.totalFrames} frames, ${commercial.record?.frame.keyFrames} keyframes, consistency ${commercial.record?.frame.frameConsistencyScore}`,
        };
        results.audioAnalysis = {
            passed: (commercial.record?.audio.tracks.length ?? 0) >= 1 &&
                (commercial.record?.audio.overallAudioQualityScore ?? 0) >= 50,
            detail: `${commercial.record?.audio.tracks.length} track(s), sync ${commercial.record?.audio.synchronizationScore}`,
        };
        results.indexCreation = {
            passed: (commercial.record?.indexes.keyframeIndexIds.length ?? 0) > 0 &&
                (commercial.record?.indexes.timelineIndexIds.length ?? 0) > 0,
            detail: `Keyframes ${commercial.record?.indexes.keyframeIndexIds.length}, scenes ${commercial.record?.indexes.sceneIndexIds.length}, timeline ${commercial.record?.indexes.timelineIndexIds.length}`,
        };
        results.productionReadiness = {
            passed: (commercial.record?.productionReadiness.productionReadiness ?? 0) >= 60,
            detail: `Production ${commercial.record?.productionReadiness.productionReadiness}, export ${commercial.record?.productionReadiness.exportReadiness}`,
        };
        results.recommendationQuality = {
            passed: Array.isArray(commercial.record?.recommendations),
            detail: `${commercial.record?.recommendations.length ?? 0} recommendation(s) generated`,
        };
        results.relationshipDetection = {
            passed: (social.record?.relationships.relatedBrands.length ?? 0) >= 1,
            detail: `Social linked brands: ${social.record?.relationships.relatedBrands.join(", ")}`,
        };
        const incomplete = await engine.analyzeVideo({ videoId: "step7b-incomplete", videoName: "Incomplete" });
        results.incompleteRejection = {
            passed: !incomplete.success,
            detail: incomplete.message ?? incomplete.diagnostics.join("; "),
        };
        const repaired = await engine.repairVideo("step7b-kwizera-social-reel");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Repair pipeline re-validated existing video" : "Repair failed",
        };
        const searchResults = engine.searchVideos({ brand: "KWIZERA", limit: 10 });
        results.search = {
            passed: searchResults.length >= 2,
            detail: `${searchResults.length} video(s) found by brand`,
        };
        const resolutionSearch = engine.searchVideos({ resolution: "1920x1080" });
        results.resolutionSearch = {
            passed: resolutionSearch.length >= 2,
            detail: `Resolution search returned ${resolutionSearch.length} result(s)`,
        };
        const fpsSearch = engine.searchVideos({ fps: 30 });
        results.fpsSearch = {
            passed: fpsSearch.length >= 2,
            detail: `${fpsSearch.length} video(s) at 30fps`,
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
        const logFile = path.join(storageRoot, "logs", `video-analysis-engine-${logDate}.jsonl`);
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
        const registered = core
            .getManager()
            .videoIntelligenceFoundation.getRegistry()
            .getModule("video-analysis-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        await core.stop("step-7b-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Video-Analysis-Report.md"), buildVideoAnalysisReport(status, results, storageRoot, allPassed), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Timeline-Analysis-Report.md"), buildTimelineReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Frame-Analysis-Report.md"), buildFrameReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Audio-Analysis-Report.md"), buildAudioReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Production-Readiness-Report.md"), buildProductionReadinessReport(status, commercial.record, social.record, tutorial.record, allPassed), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-7B-VALIDATION-REPORT.md"), buildVideoAnalysisReport(status, results, storageRoot, allPassed), "utf8");
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
function buildVideoAnalysisReport(status, results, storageRoot, allPassed) {
    return [
        "# Video Analysis Report — Step 7B",
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
        `- Videos analyzed: ${status.videosAnalyzed}`,
        `- Avg completeness: ${status.averageCompletenessScore}`,
        `- Avg confidence: ${status.averageConfidenceScore}`,
        `- Knowledge bridge: ${status.knowledgeBridgeStatus}`,
        `- Memory bridge: ${status.memoryBridgeStatus}`,
        `- Product Intelligence bridge: ${status.productIntelligenceBridgeStatus}`,
        `- Image Intelligence bridge: ${status.imageIntelligenceBridgeStatus}`,
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 7B Video Analysis Engine validation complete. Awaiting user approval before Step 7C.",
        "",
    ].join("\n");
}
function buildTimelineReport(commercial, social, tutorial) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Timeline Analysis Report — Step 7B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Duration | Scenes | Shots | Segments | Timeline Index |",
        "|-------|----------|--------|-------|----------|----------------|",
        ...rows.map((r) => `| ${r.technical.videoName} | ${(r.timeline.timelineLengthMs / 1000).toFixed(1)}s | ${r.timeline.sceneCount} | ${r.timeline.shotCount} | ${r.timeline.segments.length} | ${r.indexes.timelineIndexIds.length} |`),
        "",
        "## Scene Distribution (Commercial)",
        "",
        commercial
            ? Object.entries(commercial.timeline.sceneDistribution)
                .map(([k, v]) => `- ${k}: ${v}%`)
                .join("\n")
            : "N/A",
        "",
    ].join("\n");
}
function buildFrameReport(commercial, social, tutorial) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Frame Analysis Report — Step 7B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Total Frames | Keyframes | Consistency | Missing | Motion | Complexity |",
        "|-------|--------------|-----------|-------------|---------|--------|------------|",
        ...rows.map((r) => `| ${r.technical.videoName} | ${r.frame.totalFrames} | ${r.frame.keyFrames} | ${r.frame.frameConsistencyScore} | ${r.frame.missingFrames} | ${r.frame.motionDensity} | ${r.frame.visualComplexity} |`),
        "",
        "## Index Summary",
        "",
        ...rows.map((r) => `- **${r.technical.videoName}:** ${r.indexes.keyframeIndexIds.length} keyframe indexes, ${r.indexes.frameIndexIds.length} frame indexes`),
        "",
    ].join("\n");
}
function buildAudioReport(commercial, social, tutorial) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Audio Analysis Report — Step 7B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Tracks | Language | Sync Score | Quality | Audio Indexes |",
        "|-------|--------|----------|------------|---------|---------------|",
        ...rows.map((r) => `| ${r.technical.videoName} | ${r.audio.tracks.length} | ${r.audio.primaryLanguage} | ${r.audio.synchronizationScore} | ${r.audio.overallAudioQualityScore} | ${r.indexes.audioIndexIds.length} |`),
        "",
    ].join("\n");
}
function buildProductionReadinessReport(status, commercial, social, tutorial, allPassed) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Production Readiness Report — Step 7B",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "## Per-Video Production Readiness",
        "",
        "| Video | Editing | AI Gen | Marketing | Production | Rendering | Export | Score |",
        "|-------|---------|--------|-----------|------------|-----------|--------|-------|",
        ...rows.map((r) => `| ${r.technical.videoName} | ${r.productionReadiness.editingReadiness} | ${r.productionReadiness.aiGenerationReadiness} | ${r.productionReadiness.marketingReadiness} | ${r.productionReadiness.productionReadiness} | ${r.productionReadiness.renderingReadiness} | ${r.productionReadiness.exportReadiness} | ${r.scores.productionReadinessScore} |`),
        "",
        "## Quality Scores",
        "",
        "| Video | Completeness | Technical | Frame | Audio | Visual | Confidence |",
        "|-------|--------------|-----------|-------|-------|--------|------------|",
        ...rows.map((r) => `| ${r.technical.videoName} | ${r.scores.videoCompletenessScore} | ${r.scores.technicalQualityScore} | ${r.scores.frameQualityScore} | ${r.scores.audioQualityScore} | ${r.scores.visualQualityScore} | ${r.scores.aiConfidenceScore} |`),
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-video-analysis-engine.js.map