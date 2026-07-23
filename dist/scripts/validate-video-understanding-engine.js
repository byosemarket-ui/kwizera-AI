import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, VideoAnalysisType, VideoCodec, AudioCodec, VideoContainer, VideoFileFormat, FrameRateMode, VideoColorSpace, VideoSceneRole, VideoStoryType, VideoUnderstandingMarketingGoal, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-video-understanding-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
const SAMPLE_COMMERCIAL = {
    videoId: "step7c-kwizera-commercial",
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
    metadata: { camera: "cinema-rig", campaign: "pro-launch-2026" },
    creationDate: "2026-01-20T10:00:00.000Z",
    lastModifiedDate: "2026-03-15T14:30:00.000Z",
    videoType: VideoAnalysisType.Commercial,
    product: "KWIZERA Pro Studio",
    brand: "KWIZERA",
    category: "marketing",
    creativeStyle: "commercial",
    language: "en",
    sceneCount: 4,
    shotCount: 8,
    visual: {
        brightness: 72,
        contrast: 78,
        saturation: 65,
        sharpness: 88,
        dominantColors: ["#1a1a2e", "#e94560", "#ffffff"],
        visualStability: 85,
    },
    frame: { frameConsistencyScore: 92, missingFrames: 0, corruptedFrames: 0 },
    tags: ["commercial", "kwizera", "validation"],
    keywords: ["commercial", "studio", "kwizera"],
    campaign: "pro-launch-2026",
};
const SAMPLE_SOCIAL = {
    videoId: "step7c-kwizera-social-reel",
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
    category: "social",
    creativeStyle: "engaging",
    language: "en",
    sceneCount: 3,
    shotCount: 6,
    visual: { sharpness: 80, dominantColors: ["#2d3436", "#636e72"], visualStability: 78 },
    tags: ["social", "reel", "validation"],
    keywords: ["reel", "social", "kwizera"],
};
const SAMPLE_TUTORIAL = {
    videoId: "step7c-kwizera-tutorial",
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
    category: "education",
    creativeStyle: "instructional",
    language: "en",
    sceneCount: 12,
    shotCount: 24,
    visual: { sharpness: 82, visualStability: 88 },
    tags: ["tutorial", "education", "validation"],
    keywords: ["tutorial", "studio", "kwizera"],
};
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 7C Video Understanding Engine Validation");
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
        await core.start("step-7c-validation");
        const foundation = core.getManager().videoIntelligenceFoundation;
        const analysisEngine = foundation.getVideoAnalysisEngine();
        const engine = foundation.getVideoUnderstandingEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: "Video Understanding Engine operational",
        };
        await analysisEngine.analyzeVideo(SAMPLE_COMMERCIAL);
        const understandStart = Date.now();
        const commercial = await engine.understandVideo({
            videoId: "step7c-kwizera-commercial",
            marketingGoal: VideoUnderstandingMarketingGoal.Conversion,
            storyType: VideoStoryType.Promotional,
            industry: "technology",
        });
        const understandMs = Date.now() - understandStart;
        results.videoUnderstanding = {
            passed: commercial.success && Boolean(commercial.record),
            detail: `Commercial understood in ${understandMs}ms, score ${commercial.record?.scores.videoUnderstandingScore}`,
        };
        results.sceneUnderstanding = {
            passed: (commercial.record?.scenes.length ?? 0) >= 3 &&
                commercial.record?.scenes.some((s) => s.role === VideoSceneRole.Opening) === true &&
                commercial.record?.scenes.some((s) => s.role === VideoSceneRole.Hook) === true,
            detail: `${commercial.record?.scenes.length} scenes — roles: ${commercial.record?.scenes.map((s) => s.role).join(", ")}`,
        };
        results.storyUnderstanding = {
            passed: Boolean(commercial.record?.story.narrativeStructure) &&
                Boolean(commercial.record?.story.emotionalJourney) &&
                (commercial.record?.scores.storytellingScore ?? 0) >= 50,
            detail: `${commercial.record?.story.storyType} — ${commercial.record?.story.narrativeStructure}`,
        };
        results.productUnderstanding = {
            passed: commercial.record?.product.mainProduct === "KWIZERA Pro Studio" &&
                (commercial.record?.product.productVisibility ?? 0) >= 55,
            detail: `${commercial.record?.product.mainProduct} — visibility ${commercial.record?.product.productVisibility}`,
        };
        results.brandUnderstanding = {
            passed: commercial.record?.brand.brandIdentity === "KWIZERA" &&
                (commercial.record?.brand.brandConsistency ?? 0) >= 50,
            detail: `${commercial.record?.brand.brandIdentity} — consistency ${commercial.record?.brand.brandConsistency}`,
        };
        results.marketingUnderstanding = {
            passed: Boolean(commercial.record?.marketing.campaignGoal) &&
                (commercial.record?.marketing.marketingStrength ?? 0) >= 55,
            detail: commercial.record?.marketing.campaignGoal ?? "n/a",
        };
        results.audienceUnderstanding = {
            passed: Boolean(commercial.record?.audience.targetAudience) &&
                Boolean(commercial.record?.audience.conversionOpportunity),
            detail: commercial.record?.audience.targetAudience ?? "n/a",
        };
        results.understandingScores = {
            passed: (commercial.record?.scores.videoUnderstandingScore ?? 0) >= 55 &&
                (commercial.record?.scores.marketingScore ?? 0) >= 50 &&
                (commercial.record?.scores.aiConfidenceScore ?? 0) >= 55,
            detail: `Understanding ${commercial.record?.scores.videoUnderstandingScore}, marketing ${commercial.record?.scores.marketingScore}, confidence ${commercial.record?.scores.aiConfidenceScore}`,
        };
        results.knowledgeGraph = {
            passed: (commercial.record?.knowledgeGraph.nodes.length ?? 0) >= 5 &&
                (commercial.record?.knowledgeGraph.edges.length ?? 0) >= 4,
            detail: `${commercial.record?.knowledgeGraph.nodes.length} nodes, ${commercial.record?.knowledgeGraph.edges.length} edges`,
        };
        results.recommendationQuality = {
            passed: (commercial.record?.recommendations.length ?? 0) >= 1,
            detail: `${commercial.record?.recommendations.length} recommendation(s) generated`,
        };
        await analysisEngine.analyzeVideo(SAMPLE_SOCIAL);
        await analysisEngine.analyzeVideo(SAMPLE_TUTORIAL);
        const social = await engine.understandVideo({
            videoId: "step7c-kwizera-social-reel",
            industry: "fashion",
            storyType: VideoStoryType.Lifestyle,
        });
        const tutorial = await engine.understandVideo({
            videoId: "step7c-kwizera-tutorial",
            marketingGoal: VideoUnderstandingMarketingGoal.Education,
            storyType: VideoStoryType.Tutorial,
            industry: "education",
        });
        results.multiTypeUnderstanding = {
            passed: social.success && tutorial.success,
            detail: `Social ${social.record?.story.storyType}, Tutorial ${tutorial.record?.story.storyType}`,
        };
        results.relationshipDetection = {
            passed: (social.record?.relationships.relatedBrands.length ?? 0) >= 1,
            detail: `Social linked brands: ${social.record?.relationships.relatedBrands.join(", ")}`,
        };
        const noAnalysis = await engine.understandVideo({ videoId: "step7c-nonexistent" });
        results.incompleteRejection = {
            passed: !noAnalysis.success,
            detail: noAnalysis.message ?? "Rejected without analysis",
        };
        const repaired = await engine.repairUnderstanding("step7c-kwizera-social-reel");
        results.automaticRepair = {
            passed: Boolean(repaired?.success),
            detail: repaired?.success ? "Understanding repair pipeline verified" : "Repair failed",
        };
        const purposeSearch = engine.searchUnderstanding({ videoPurpose: "Promote" });
        results.search = {
            passed: purposeSearch.length >= 1,
            detail: `${purposeSearch.length} result(s) by video purpose`,
        };
        const brandSearch = engine.searchUnderstanding({ brand: "KWIZERA" });
        results.brandSearch = {
            passed: brandSearch.length >= 2,
            detail: `${brandSearch.length} result(s) by brand`,
        };
        const storySearch = engine.searchUnderstanding({ storyType: VideoStoryType.Tutorial });
        results.storySearch = {
            passed: storySearch.length >= 1,
            detail: `${storySearch.length} result(s) by story type`,
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
        const logFile = path.join(storageRoot, "logs", `video-understanding-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        results.performance = {
            passed: status.performance.averageUnderstandingMs < 120000,
            detail: `avg understanding ${status.performance.averageUnderstandingMs}ms, search ${status.performance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: status.readinessScore >= 85,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        const registered = foundation.getRegistry().getModule("video-understanding-engine");
        results.moduleRegistration = {
            passed: registered?.implemented === true && registered.status === "active",
            detail: `Module ${registered?.status}, v${registered?.version}`,
        };
        await core.stop("step-7c-validation");
        const allPassed = Object.values(results).every((r) => r.passed);
        fs.writeFileSync(path.join(projectStateDir, "Video-Understanding-Report.md"), buildUnderstandingReport(status, results, storageRoot, allPassed), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Story-Understanding-Report.md"), buildStoryReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Audience-Understanding-Report.md"), buildAudienceReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Marketing-Understanding-Report.md"), buildMarketingReport(commercial.record, social.record, tutorial.record), "utf8");
        fs.writeFileSync(path.join(projectStateDir, "Video-Readiness-Report.md"), buildReadinessReport(status, commercial.record, social.record, tutorial.record, allPassed), "utf8");
        fs.writeFileSync(path.join(process.cwd(), "STEP-7C-VALIDATION-REPORT.md"), buildUnderstandingReport(status, results, storageRoot, allPassed), "utf8");
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
function buildUnderstandingReport(status, results, storageRoot, allPassed) {
    return [
        "# Video Understanding Report — Step 7C",
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
        `- Videos understood: ${status.videosUnderstood}`,
        `- Avg understanding score: ${status.averageUnderstandingScore}`,
        `- Avg marketing score: ${status.averageMarketingScore}`,
        `- Knowledge graph: ${status.knowledgeGraphStatus}`,
        `- Knowledge bridge: ${status.knowledgeBridgeStatus}`,
        `- Memory bridge: ${status.memoryBridgeStatus}`,
        `- Product Intelligence bridge: ${status.productIntelligenceBridgeStatus}`,
        `- Image Intelligence bridge: ${status.imageIntelligenceBridgeStatus}`,
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 7C Video Understanding Engine validation complete. Awaiting user approval before Step 7D.",
        "",
    ].join("\n");
}
function buildStoryReport(commercial, social, tutorial) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Story Understanding Report — Step 7C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Story Type | Narrative | Emotional Journey | Storytelling Score |",
        "|-------|------------|-----------|-------------------|--------------------|",
        ...rows.map((r) => `| ${r.identity.videoName} | ${r.story.storyType} | ${r.story.narrativeStructure} | ${r.story.emotionalJourney} | ${r.scores.storytellingScore} |`),
        "",
        "## Scene Roles (Commercial)",
        "",
        commercial
            ? commercial.scenes.map((s) => `- **${s.label}** (${s.role}): ${s.description}`).join("\n")
            : "N/A",
        "",
    ].join("\n");
}
function buildAudienceReport(commercial, social, tutorial) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Audience Understanding Report — Step 7C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Target Audience | Engagement | Retention | Conversion | Alignment Score |",
        "|-------|-----------------|------------|-----------|------------|-----------------|",
        ...rows.map((r) => `| ${r.identity.videoName} | ${r.audience.targetAudience} | ${r.audience.engagementOpportunity.slice(0, 40)}... | ${r.audience.viewerRetentionOpportunity.slice(0, 40)}... | ${r.audience.conversionOpportunity.slice(0, 40)}... | ${r.scores.audienceAlignmentScore} |`),
        "",
    ].join("\n");
}
function buildMarketingReport(commercial, social, tutorial) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Marketing Understanding Report — Step 7C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        "",
        "| Video | Campaign Goal | Marketing Strength | CTA Opportunity | Marketing Score |",
        "|-------|---------------|--------------------|-----------------|-----------------|",
        ...rows.map((r) => `| ${r.identity.videoName} | ${r.marketing.campaignGoal} | ${r.marketing.marketingStrength} | ${r.marketing.ctaOpportunity.slice(0, 50)}... | ${r.scores.marketingScore} |`),
        "",
    ].join("\n");
}
function buildReadinessReport(status, commercial, social, tutorial, allPassed) {
    const rows = [commercial, social, tutorial].filter(Boolean);
    return [
        "# Video Readiness Report — Step 7C",
        "",
        `**Date:** ${new Date().toISOString()}`,
        `**Overall:** ${allPassed ? "✅ APPROVED" : "❌ NOT APPROVED"}`,
        `**Engine Readiness:** ${status.readinessScore}/100`,
        "",
        "## Per-Video Understanding Scores",
        "",
        "| Video | Understanding | Storytelling | Marketing | Brand | Production | Confidence |",
        "|-------|---------------|--------------|-----------|-------|------------|------------|",
        ...rows.map((r) => `| ${r.identity.videoName} | ${r.scores.videoUnderstandingScore} | ${r.scores.storytellingScore} | ${r.scores.marketingScore} | ${r.scores.brandConsistencyScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} |`),
        "",
        "## Knowledge Graph Summary",
        "",
        ...rows.map((r) => `- **${r.identity.videoName}:** ${r.knowledgeGraph.nodes.length} nodes, ${r.knowledgeGraph.edges.length} edges`),
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-video-understanding-engine.js.map