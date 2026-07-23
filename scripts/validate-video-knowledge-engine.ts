import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  EditingStyle,
  VideoType,
  type VideoKnowledgeStatusReport,
} from "../ai/index.js";
import type { VideoAnalysisInput } from "../ai/video-knowledge-engine/types.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-video-knowledge-"));
}

const SAMPLE_PROMOTIONAL: VideoAnalysisInput = {
  videoId: "step4f-promo-kwizera",
  videoPath: "D:\\KWIZERA-AI-STUDIO\\samples\\videos\\kwizera-promo.mp4",
  videoName: "KWIZERA AI STUDIO Promotional Video",
  videoType: VideoType.Promotional,
  duration: 30,
  resolution: "1920x1080",
  aspectRatio: "16:9",
  product: "KWIZERA Pro Studio",
  brandName: "KWIZERA",
  marketingGoal: "conversion",
  language: "en",
  editing: {
    editingStyle: EditingStyle.Commercial,
    motionConsistency: 88,
    visualContinuity: 90,
    transitionTechniques: ["cross-dissolve", "fade"],
  },
  audio: {
    backgroundMusic: "upbeat-corporate",
    beatSynchronization: 85,
    audioQuality: 88,
    audioBalance: 82,
  },
  marketing: {
    hookTiming: 3,
    productIntroduction: 6,
    customerAttention: 90,
    callToActionPlacement: "final-scene-center",
    marketingGoal: "conversion",
  },
  visual: {
    brandingConsistency: 92,
    colorGrading: "warm-commercial",
    logoAnimation: "scale-reveal",
  },
  tags: ["promotional", "kwizera", "validation", "campaign-launch"],
  keywords: ["video", "promo", "studio"],
};

const SAMPLE_BASIC: VideoAnalysisInput = {
  videoId: "step4f-basic-promo",
  videoPath: "D:\\KWIZERA-AI-STUDIO\\samples\\videos\\basic-promo.mp4",
  videoName: "KWIZERA Basic Promo",
  videoType: VideoType.Commercial,
  duration: 20,
  product: "KWIZERA Lite",
  brandName: "KWIZERA",
  marketingGoal: "awareness",
  editing: {
    editingStyle: EditingStyle.Commercial,
    motionConsistency: 65,
    visualContinuity: 60,
  },
  audio: {
    backgroundMusic: "upbeat-corporate",
    beatSynchronization: 55,
    audioQuality: 60,
  },
  marketing: {
    hookTiming: 8,
    customerAttention: 55,
    marketingGoal: "awareness",
  },
  visual: { brandingConsistency: 62 },
  tags: ["commercial", "kwizera", "validation"],
};

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 4F Video Knowledge Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-4f-validation");

    const engine = core.getManager().knowledgeFoundation!.getVideoKnowledgeEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: "Video Knowledge Engine operational",
    };

    const analysisStart = Date.now();
    const promo = await engine.analyzeVideo(SAMPLE_PROMOTIONAL);
    const analysisMs = Date.now() - analysisStart;

    results.videoAnalysis = {
      passed: promo.success && Boolean(promo.record),
      detail: `Promo analyzed in ${analysisMs}ms, storytelling ${promo.record?.scores.storytellingScore}`,
    };

    results.sceneAnalysis = {
      passed: (promo.record?.structure.sceneSequence.length ?? 0) >= 3,
      detail: `${promo.record?.structure.sceneSequence.length} scene(s) analyzed`,
    };

    results.cameraAnalysis = {
      passed: (promo.record?.camera.primaryShots.length ?? 0) >= 2,
      detail: `Shots: ${promo.record?.camera.primaryShots.join(", ")}`,
    };

    results.editingAnalysis = {
      passed: (promo.record?.scores.editingScore ?? 0) >= 70,
      detail: `Editing score ${promo.record?.scores.editingScore}, style ${promo.record?.editing.editingStyle}`,
    };

    results.marketingAnalysis = {
      passed: (promo.record?.scores.marketingScore ?? 0) >= 70,
      detail: `Marketing score ${promo.record?.scores.marketingScore}, hook ${promo.record?.marketing.hookTiming}s`,
    };

    const basic = await engine.analyzeVideo(SAMPLE_BASIC);

    results.qualityScoring = {
      passed:
        (promo.record?.scores.storytellingScore ?? 0) >= (basic.record?.scores.storytellingScore ?? 0) &&
        (promo.record?.scores.aiConfidenceScore ?? 0) >= 70,
      detail: `Promo ${promo.record?.scores.aiConfidenceScore} vs basic ${basic.record?.scores.aiConfidenceScore}`,
    };

    const rels = engine.detectRelationships("step4f-promo-kwizera");
    results.relationshipDetection = {
      passed: Boolean(rels),
      detail: `Similar videos ${rels?.similarVideos.length ?? 0}, music ${rels?.similarMusic.length ?? 0}`,
    };

    if (basic.success) {
      const rels2 = engine.detectRelationships("step4f-basic-promo");
      results.relationshipAfterSecond = {
        passed: (rels2?.similarMusic.length ?? 0) >= 1 || (rels2?.similarVideos.length ?? 0) >= 1,
        detail: `Similar music ${rels2?.similarMusic.length ?? 0}, videos ${rels2?.similarVideos.length ?? 0}`,
      };
    } else {
      results.relationshipAfterSecond = { passed: false, detail: "basic analysis failed" };
    }

    results.knowledgeStorage = {
      passed:
        Boolean(promo.record?.knowledgeId) &&
        core.getManager().knowledgeFoundation!.getStorageEngine().findIndexEntry(promo.record!.knowledgeId) !==
          undefined,
      detail: promo.record?.knowledgeId ?? "none",
    };

    const recs = engine.getRecommendations("step4f-basic-promo");
    results.recommendations = {
      passed: recs.length >= 1,
      detail: `${recs.length} recommendation(s), top: ${recs[0]?.category ?? "none"}`,
    };

    const searchStart = Date.now();
    const search = await engine.searchVideos({ brand: "KWIZERA", minStorytelling: 60 });
    const searchMs = Date.now() - searchStart;

    results.search = {
      passed: search.length >= 1,
      detail: `${search.length} result(s) in ${searchMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `video-knowledge-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    const invalid = await engine.analyzeVideo({ videoPath: "", videoName: "" });
    results.validationRejection = {
      passed: !invalid.success,
      detail: invalid.message ?? "rejected",
    };

    const lowQuality = await engine.analyzeVideo({
      videoPath: "samples/bad.mp4",
      videoName: "Bad Video",
      editing: { motionConsistency: 20, visualContinuity: 20 },
      audio: { audioQuality: 20, beatSynchronization: 20 },
      marketing: { customerAttention: 20, hookTiming: 15 },
      visual: { brandingConsistency: 20 },
    });
    results.lowQualityRejection = {
      passed: !lowQuality.success,
      detail: lowQuality.message ?? "rejected",
    };

    const report = engine.buildStatusReport();
    results.performance = {
      passed: analysisMs < 15000 && searchMs < 10000,
      detail: `analysis ${analysisMs}ms, search ${searchMs}ms`,
    };

    results.readiness = {
      passed: report.readinessScore === 100,
      detail: `Readiness ${report.readinessScore}/100`,
    };

    await core.stop("step-4f-validation-complete");

    const allPassed = Object.values(results).every((r) => r.passed);
    const reportPath = path.join(process.cwd(), "STEP-4F-VALIDATION-REPORT.md");
    fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed), "utf8");

    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${report.readinessScore}/100`);
    console.log("Report written:", reportPath);

    if (useTemp && fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildReport(
  status: VideoKnowledgeStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 4 Step 4F Validation Report",
    "",
    "**Phase:** 4 — Knowledge Engine",
    "**Step:** 4F — Video Knowledge Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Video Knowledge Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    `| **Videos Analyzed** | ${status.videosAnalyzed} |`,
    `| **Patterns Learned** | ${status.patternsLearned} |`,
    "",
    "## Validation Results",
    "",
    "| Check | Status | Detail |",
    "|-------|--------|--------|",
    ...Object.entries(results).map(
      ([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`
    ),
    "",
    "## Scene Analysis Status",
    "",
    `- ${status.sceneAnalysisStatus}`,
    "",
    "## Editing Knowledge Status",
    "",
    `- ${status.editingKnowledgeStatus}`,
    "",
    "## Marketing Knowledge Status",
    "",
    `- ${status.marketingKnowledgeStatus}`,
    "",
    "## Relationship Status",
    "",
    `- ${status.relationshipStatus}`,
    "",
    "## Performance",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Average Analysis | ${status.performance.averageAnalysisMs}ms |`,
    `| Average Search | ${status.performance.averageSearchMs}ms |`,
    `| Average Recommendation | ${status.performance.averageRecommendationMs}ms |`,
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 4F Video Knowledge Engine validation complete. Awaiting user approval before Step 4G.",
    "",
  ].join("\n");
}

void main();
