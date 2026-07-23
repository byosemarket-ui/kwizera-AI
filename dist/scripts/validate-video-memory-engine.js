import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, ProjectType, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-video-memory-"));
}
const sampleScenes = [
    {
        sceneOrder: 1,
        sceneDuration: 5,
        scenePurpose: "hook",
        productFocus: "product-hero",
        background: "dark-gradient",
        cameraMovement: "zoom-in",
        animationStyle: "kinetic-text",
        visualEffects: "glow",
        transitionType: "fade",
        textPlacement: "center",
        subtitleStyle: "bold",
    },
    {
        sceneOrder: 2,
        sceneDuration: 10,
        scenePurpose: "product-demo",
        productFocus: "product-hero",
        background: "studio",
        cameraMovement: "orbit",
        animationStyle: "3d-rotate",
        visualEffects: "particles",
        transitionType: "wipe",
        textPlacement: "lower-third",
        subtitleStyle: "clean",
    },
    {
        sceneOrder: 3,
        sceneDuration: 5,
        scenePurpose: "cta",
        productFocus: "brand-logo",
        background: "brand-color",
        cameraMovement: "static",
        animationStyle: "pulse",
        visualEffects: "none",
        transitionType: "fade",
        textPlacement: "center",
        subtitleStyle: "bold",
    },
];
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 3G Video Memory Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-3g-validation");
        const foundation = core.getManager().memoryFoundation;
        const projects = foundation.getProjectMemoryEngine();
        const videos = foundation.getVideoMemoryEngine();
        const indexEngine = foundation.getIndexEngine();
        const learning = foundation.getLearningMemoryEngine();
        results.initialization = {
            passed: videos.isInitialized() && videos.isStartupComplete(),
            detail: "Video Memory Engine operational",
        };
        const videoDir = path.join(storageRoot, "memory", "videos");
        results.videoDirectories = {
            passed: fs.existsSync(videoDir),
            detail: videoDir,
        };
        await projects.createProject({
            projectId: "step3g-project",
            projectName: "Step 3G Video Validation",
            projectType: ProjectType.Promotional,
            description: "Validates video memory engine",
            tags: ["validation", "kwizera"],
        });
        const createStart = Date.now();
        const createResult = await videos.createVideo({
            videoId: "step3g-video",
            projectId: "step3g-project",
            videoName: "KWIZERA Promo Validation",
            productType: "software",
            brand: "KWIZERA",
            category: "promotional",
            targetAudience: "Creative professionals",
            marketingGoal: "Brand launch awareness",
            language: "en",
            duration: 30,
            resolution: "1920x1080",
            aspectRatio: "16:9",
            exportFormat: "mp4",
            scenes: sampleScenes,
            audio: {
                backgroundMusic: "cinematic-upbeat",
                voiceStyle: "professional",
                voiceLanguage: "en",
                narration: "Welcome to KWIZERA AI STUDIO",
                soundEffects: ["whoosh"],
                audioTiming: "scene-synced",
                audioQuality: "high",
            },
            marketing: {
                hook: "The future of creative AI is here",
                callToAction: "Start creating now",
                sellingPoints: ["Local-first", "AI-powered", "Fast workflow"],
                emotionalStrategy: "inspiration",
                brandingStyle: "modern-bold",
                productPresentationStyle: "hero-product",
                marketingStructure: "hook-demo-cta",
            },
            visual: {
                productPosition: "center-stage",
                lightingStyle: "studio-professional",
                colorPalette: ["#1a1a2e", "#e94560"],
                typography: "geometric-sans",
                iconStyle: "flat-minimal",
                motionStyle: "dynamic-smooth",
                introStyle: "logo-reveal",
                outroStyle: "brand-tagline",
                logoAnimation: "scale-glow",
            },
            tags: ["validation", "promo-style", "kwizera"],
        });
        const createMs = Date.now() - createStart;
        results.videoStorage = {
            passed: createResult.success,
            detail: `Created in ${createMs}ms`,
        };
        const video = await videos.getVideo("step3g-video");
        results.sceneMemory = {
            passed: (video?.scenes.length ?? 0) === 3,
            detail: `${video?.scenes.length} scene(s) stored`,
        };
        results.audioMemory = {
            passed: Boolean(video?.audio.backgroundMusic && video?.audio.narration),
            detail: video?.audio.backgroundMusic ?? "none",
        };
        results.marketingMemory = {
            passed: Boolean(video?.marketing.hook && video?.marketing.callToAction),
            detail: `CTA: ${video?.marketing.callToAction}`,
        };
        results.visualMemory = {
            passed: (video?.visual.colorPalette.length ?? 0) >= 2,
            detail: `${video?.visual.colorPalette.length} colors`,
        };
        const updateResult = await videos.updateVideo("step3g-video", {
            scenes: sampleScenes,
            exportRecord: {
                exportId: "exp-3g-001",
                format: "mp4",
                resolution: "1920x1080",
                timestamp: new Date().toISOString(),
            },
        });
        results.patternDetection = {
            passed: updateResult.patternsDetected > 0 && videos.getDetectedPatterns().length > 0,
            detail: `${videos.getDetectedPatterns().length} pattern(s), ${videos.getReusablePatterns().length} reusable`,
        };
        const relationships = videos.getVideoRelationships("step3g-video");
        results.relationshipDetection = {
            passed: relationships !== null,
            detail: `${relationships?.relatedMemories.length ?? 0} related memory(s)`,
        };
        const searchStart = Date.now();
        const searchResults = videos.searchVideos({
            brand: "KWIZERA",
            animation: "kinetic",
            transition: "fade",
            music: "cinematic",
        });
        const searchMs = Date.now() - searchStart;
        results.search = {
            passed: searchResults.length >= 1 && searchMs < 5000,
            detail: `${searchResults.length} result(s) in ${searchMs}ms`,
        };
        const learnResult = await videos.completeVideo("step3g-video", 92);
        results.learning = {
            passed: learnResult.success && learnResult.strengths.length > 0,
            detail: `Learning ID: ${learnResult.learningId}, ${learnResult.patternsStored} pattern(s)`,
        };
        const learningHistory = learning.getLearningHistory();
        results.learningIntegration = {
            passed: learningHistory.some((h) => h.relatedProject === "step3g-project"),
            detail: `${learningHistory.length} learning record(s)`,
        };
        const indexed = indexEngine.lookup({ project: "step3g-project" });
        results.indexIntegration = {
            passed: indexed.memoryIds.includes("step3g-video"),
            detail: `${indexed.memoryIds.length} indexed record(s)`,
        };
        const historyFile = path.join(videoDir, "video-history.jsonl");
        const patternsFile = path.join(videoDir, "video-patterns.jsonl");
        results.storageIntegrity = {
            passed: fs.existsSync(historyFile) && fs.existsSync(patternsFile),
            detail: "History and patterns persisted",
        };
        const logDir = path.join(storageRoot, "logs");
        const logFiles = fs.existsSync(logDir)
            ? fs.readdirSync(logDir).filter((f) => f.startsWith("video-memory-engine"))
            : [];
        results.logging = {
            passed: logFiles.length > 0,
            detail: logDir,
        };
        const report = videos.buildStatusReport();
        results.performance = {
            passed: createMs < 5000,
            detail: `create ${createMs}ms, avg search ${report.searchPerformance.averageSearchMs}ms`,
        };
        results.readiness = {
            passed: report.readinessScore >= 85,
            detail: `Readiness ${report.readinessScore}/100`,
        };
        await core.stop("validation complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-3G-VALIDATION-REPORT.md");
        fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed, createMs, searchMs), "utf8");
        console.log(buildReport(report, results, storageRoot, allPassed, createMs, searchMs));
        console.log("---");
        console.log(`Report written to: ${reportPath}`);
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
function buildReport(status, results, storageRoot, allPassed, createMs, searchMs) {
    return [
        "# KWIZERA AI STUDIO — Phase 3 Step 3G Validation Report",
        "",
        "**Phase:** 3 — Persistent Memory",
        "**Step:** 3G — Video Memory Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Video Memory Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        "",
        "## Pattern Detection Status",
        "",
        `- ${status.patternDetectionStatus}`,
        "",
        "## Relationship Status",
        "",
        `- ${status.relationshipStatus}`,
        "",
        "## Search Performance",
        "",
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Last Search | ${searchMs}ms |`,
        `| Average Search | ${status.searchPerformance.averageSearchMs}ms |`,
        "",
        "## Storage Integrity",
        "",
        `- ${status.storageIntegrity}`,
        `- Total Videos: ${status.totalVideos}`,
        `- Total Patterns: ${status.totalPatterns}`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Performance",
        "",
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Video Creation | ${createMs}ms |`,
        `| Average Save | ${status.performance.averageSaveMs}ms |`,
        `| Average Load | ${status.performance.averageLoadMs}ms |`,
        `| Total Versions | ${status.performance.totalVersions} |`,
        "",
        "## Known Issues",
        "",
        ...(status.knownIssues.length > 0
            ? status.knownIssues.map((i) => `- ${i}`)
            : ["- None"]),
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 3G Video Memory Engine validation complete. Awaiting user approval before Step 3H.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-video-memory-engine.js.map