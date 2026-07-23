import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AudioInputCategory,
  createAiCore,
  CreativePlatform,
  ENHANCEMENT_TECHNIQUES,
  AudioEnhancementPlatform,
  AudioEnhancementType,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  RESTORATION_TECHNIQUES,
  type AudioEnhancementGenerationEngineStatusReport,
  type AudioEnhancementGenerationRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-enhancement-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step10h-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI-powered creative workstation",
  features: ["voice enhancement", "audio restoration"],
  price: 299.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "technology" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2B,
  tags: ["software"],
  keywords: ["kwizera"],
};

const SAMPLE_HEALTH: ProductAnalysisEngineInput = {
  productId: "step10h-health-app",
  productName: "VitalCare Health App",
  category: ProductAnalysisCategory.Health,
  subcategory: "wellness",
  brand: "VitalCare",
  description: "Application de santé pour le bien-être",
  features: ["podcast", "wellness"],
  price: 9.99,
  currency: "EUR",
  availability: ProductAvailabilityStatus.InStock,
  industry: "health" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2C,
  tags: ["health"],
  keywords: ["vitalcare"],
};

const SAMPLE_FINANCE: ProductAnalysisEngineInput = {
  productId: "step10h-finance-app",
  productName: "PesaSmart Mobile Banking",
  category: ProductAnalysisCategory.Services,
  subcategory: "mobile-banking",
  brand: "PesaSmart",
  description: "Huduma ya benki ya simu",
  features: ["malipo"],
  price: 0,
  currency: "KES",
  availability: ProductAvailabilityStatus.InStock,
  industry: "general" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2C,
  tags: ["finance"],
  keywords: ["pesasmart"],
};

async function prepareFullPipeline(
  foundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>,
  sample: ProductAnalysisEngineInput,
  objective: MarketingObjective,
  platform: CreativePlatform
): Promise<void> {
  await foundation.getProductAnalysisEngine().analyzeProduct(sample);
  await foundation.getProductUnderstandingEngine().understandProduct({
    productId: sample.productId!,
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: sample.productId! });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: sample.productId!,
    marketingObjective: objective,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({ productId: sample.productId!, platform });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 10H Audio Enhancement & Restoration Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("Project state:", projectStateDir);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({
      storageRootOverride: storageRoot,
      skipPlanningEngine: true,
      skipWorkflowEngine: true,
      skipTaskManager: true,
    });
    const initStart = Date.now();
    await core.start("step-10h-validation");
    const initMs = Date.now() - initStart;

    const audioFoundation = core.getManager().audioGenerationFoundation!;
    const engine = audioFoundation.getAudioEnhancementRestorationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? `Enhancement Engine ready in ${initMs}ms` : "Not initialized",
    };

    const registered = audioFoundation.getRegistry().getModule("audio-enhancement-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
    await prepareFullPipeline(piFoundation, SAMPLE_HEALTH, MarketingObjective.BrandAwareness, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FINANCE, MarketingObjective.ProductPromotion, CreativePlatform.TikTok);

    const tech = await engine.generateEnhancementPlan({
      productId: "step10h-kwizera-pro",
      audioPrompt: "Voice narration with background noise and slight echo for video",
      platform: AudioEnhancementPlatform.YouTube,
      enhancementType: AudioEnhancementType.Voice,
      audioCategory: AudioInputCategory.VoiceAudio,
      videoId: "step10h-tech-video",
      voiceAudioRef: "voice-step10h-tech",
      durationSec: 120,
      brandGuidelines: "Clear professional voice tone",
    });

    const health = await engine.generateEnhancementPlan({
      productId: "step10h-health-app",
      audioPrompt: "Podcast voice with hum clicks and hiss noise",
      platform: AudioEnhancementPlatform.Podcast,
      enhancementType: AudioEnhancementType.Voice,
      audioCategory: AudioInputCategory.VoiceAudio,
      durationSec: 1800,
    });

    const finance = await engine.generateEnhancementPlan({
      productId: "step10h-finance-app",
      audioPrompt: "Music track with distortion and clipping for mobile ad",
      platform: AudioEnhancementPlatform.TikTok,
      enhancementType: AudioEnhancementType.Music,
      audioCategory: AudioInputCategory.MusicAudio,
      musicAudioRef: "music-step10h-finance",
      durationSec: 30,
    });

    const restoration = await engine.generateEnhancementPlan({
      audioPrompt: "Old vintage recording with crackle distortion hum and silence gaps",
      brandName: "KWIZERA",
      platform: AudioEnhancementPlatform.Television,
      enhancementType: AudioEnhancementType.Mixed,
      audioCategory: AudioInputCategory.AmbientAudio,
      ambientAudioRef: "ambient-step10h-vintage",
      durationSec: 240,
    });

    results.enhancementPlanGeneration = {
      passed: tech.success && health.success && finance.success && restoration.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Health ${health.success ? "✓" : "✗"}, Finance ${finance.success ? "✓" : "✗"}, Restoration ${restoration.success ? "✓" : "✗"}`,
    };

    results.audioAnalysis = {
      passed: Boolean(
        tech.record?.audioQualityAnalysis.sampleRate >= 44100 &&
          tech.record?.audioQualityAnalysis.bitDepth >= 16 &&
          tech.record?.audioQualityAnalysis.defects.length >= 1
      ),
      detail: `${tech.record?.audioQualityAnalysis.audioCategory}, SNR ${tech.record?.audioQualityAnalysis.signalToNoiseRatioDb}dB`,
    };

    results.enhancementPlanning = {
      passed: Boolean(
        tech.record?.enhancementPlan.techniques.length >= 2 &&
          (tech.record?.scores.audioClarityScore ?? 0) >= 55 &&
          ENHANCEMENT_TECHNIQUES.length >= 8
      ),
      detail: `${tech.record?.enhancementPlan.techniques.length} techniques, ${ENHANCEMENT_TECHNIQUES.length} types supported`,
    };

    results.restorationPlanning = {
      passed: Boolean(
        health.record?.restorationPlan.techniques.length >= 2 &&
          restoration.record?.restorationPlan.techniques.includes("old-recording-restoration") &&
          RESTORATION_TECHNIQUES.length >= 9
      ),
      detail: `Health: ${health.record?.restorationPlan.primaryTechnique}, Vintage: ${restoration.record?.restorationPlan.primaryTechnique}`,
    };

    results.voiceImprovement = {
      passed: Boolean(
        tech.record?.voiceImprovementPlan.speechClarity &&
          !tech.record?.voiceImprovementPlan.speechClarity.includes("N/A")
      ),
      detail: `De-esser: ${tech.record?.voiceImprovementPlan.deEsserPlanning.slice(0, 25)}...`,
    };

    results.musicImprovement = {
      passed: Boolean(
        finance.record?.musicImprovementPlan.instrumentSeparation &&
          !finance.record?.musicImprovementPlan.instrumentSeparation.includes("N/A")
      ),
      detail: `Stereo width: ${finance.record?.musicImprovementPlan.stereoWidth.slice(0, 30)}...`,
    };

    results.synchronization = {
      passed: Boolean(
        tech.record?.syncPlan.timelineAlignment &&
          tech.record?.syncPlan.multiTrackAlignment.length >= 2 &&
          (tech.record?.scores.synchronizationScore ?? 0) >= 55
      ),
      detail: `Sync score ${tech.record?.scores.synchronizationScore}, video: ${tech.record?.syncPlan.videoSync.slice(0, 25)}...`,
    };

    results.enhancementScores = {
      passed:
        (tech.record?.scores.audioClarityScore ?? 0) >= 55 &&
        (health.record?.scores.restorationScore ?? 0) >= 55 &&
        (tech.record?.scores.noiseReductionScore ?? 0) >= 55 &&
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Clarity ${tech.record?.scores.audioClarityScore}, restoration ${health.record?.scores.restorationScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.outputPreparation = {
      passed: Boolean(
        tech.record?.outputPreparation.formatNotes.length >= 1 &&
          finance.record?.outputPreparation.loudnessTarget.includes("LUFS")
      ),
      detail: `YouTube: ${tech.record?.outputPreparation.loudnessTarget}, TikTok: ${finance.record?.outputPreparation.loudnessTarget}`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.enhancementPlans.length ?? 0) >= 1 &&
        (tech.record?.relationships.products.length ?? 0) >= 1 &&
        (tech.record?.relationships.videos.length ?? 0) >= 1,
      detail: `Plans ${tech.record?.relationships.enhancementPlans.length}, products ${tech.record?.relationships.products.length}`,
    };

    results.productionReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: `Ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
    };

    results.brandConsistency = {
      passed: tech.record?.brandConsistent === true,
      detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
    };

    const noContext = await engine.generateEnhancementPlan({ productId: "step10h-nonexistent" });
    results.incompleteRejection = {
      passed: !noContext.success,
      detail: noContext.message ?? "Rejected",
    };

    const promptOnly = await engine.generateEnhancementPlan({
      audioPrompt: "Voice audio enhancement for KWIZERA creative workspace narration",
      brandName: "KWIZERA",
      platform: AudioEnhancementPlatform.Website,
      enhancementType: AudioEnhancementType.Voice,
    });
    results.promptOnlyGeneration = {
      passed: promptOnly.success,
      detail: promptOnly.success ? "Prompt-only plan generated" : "Failed",
    };

    const repaired = await engine.repairEnhancementPlan("step10h-health-app", AudioEnhancementPlatform.Radio);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Repair verified" : "Failed",
    };

    results.searchByProduct = {
      passed: engine.searchEnhancementPlans({ productId: "step10h-kwizera-pro" }).length >= 1,
      detail: `${engine.searchEnhancementPlans({ productId: "step10h-kwizera-pro" }).length} by product`,
    };
    results.searchByType = {
      passed: engine.searchEnhancementPlans({ enhancementType: AudioEnhancementType.Voice }).length >= 1,
      detail: `${engine.searchEnhancementPlans({ enhancementType: AudioEnhancementType.Voice }).length} by type`,
    };
    results.searchByRestoration = {
      passed: engine.searchEnhancementPlans({ restoration: "hiss" }).length >= 1,
      detail: `${engine.searchEnhancementPlans({ restoration: "hiss" }).length} by restoration`,
    };
    results.searchByKeywords = {
      passed: engine.searchEnhancementPlans({ keywords: "kwizera" }).length >= 1,
      detail: `${engine.searchEnhancementPlans({ keywords: "kwizera" }).length} by keywords`,
    };

    const enhancementAsset = audioFoundation.getAssetRegistry().getAsset(tech.record!.enhancementPlanId);
    const restorationAsset = audioFoundation.getAssetRegistry().getAsset(`restoration-${tech.record!.enhancementPlanId}`);
    results.generationAssetRegistration = {
      passed: enhancementAsset?.assetType === "audio-track" && restorationAsset?.assetType === "template",
      detail: `Enhancement ${enhancementAsset?.assetId}, Restoration ${restorationAsset?.assetId}`,
    };

    const blueprint = audioFoundation.getBlueprintManager().getBlueprint(tech.record!.blueprintId!);
    results.blueprintLink = {
      passed: Boolean(blueprint?.blueprintId),
      detail: blueprint ? `Blueprint ${blueprint.blueprintId}` : "Not found",
    };

    const status = engine.buildStatusReport();
    results.performance = {
      passed: status.performance.averageGenerationMs < 120000,
      detail: `avg ${status.performance.averageGenerationMs}ms`,
    };

    const logFile = path.join(
      storageRoot,
      "logs",
      `audio-enhancement-restoration-engine-${new Date().toISOString().slice(0, 10)}.jsonl`
    );
    results.logging = { passed: fs.existsSync(logFile), detail: logFile };

    results.readiness = { passed: status.readinessScore >= 85, detail: `Readiness ${status.readinessScore}/100` };
    results.multiIndustry = {
      passed: health.success && finance.success,
      detail: `Health ${health.record?.profile.enhancementType}, Finance ${finance.record?.profile.enhancementType}`,
    };
    results.recommendations = {
      passed: (tech.record?.recommendations.length ?? 0) >= 1,
      detail: `${tech.record?.recommendations.length} recommendation(s)`,
    };

    await core.stop("step-10h-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Audio-Enhancement-Report.md"),
      buildMainReport(status, results, allPassed, tech.record, health.record, finance.record, restoration.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Audio-Restoration-Report.md"),
      buildRestorationReport(tech.record, health.record, finance.record, restoration.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Noise-Reduction-Report.md"),
      buildNoiseReductionReport(tech.record, health.record, finance.record, restoration.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Synchronization-Report.md"),
      buildSynchronizationReport(tech.record, health.record, finance.record, restoration.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Audio-Enhancement-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, health.record, finance.record, restoration.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-10H-VALIDATION-REPORT.md"),
      buildMainReport(status, results, allPassed, tech.record, health.record, finance.record, restoration.record),
      "utf8"
    );

    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);

    console.log("Reports written:");
    console.log(`  ${path.join(projectStateDir, "AI-Audio-Enhancement-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Audio-Restoration-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Noise-Reduction-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Synchronization-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Audio-Enhancement-Readiness-Report.md")}`);

    if (useTemp && fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildMainReport(
  status: AudioEnhancementGenerationEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  allPassed: boolean,
  tech?: AudioEnhancementGenerationRecord,
  health?: AudioEnhancementGenerationRecord,
  finance?: AudioEnhancementGenerationRecord,
  restoration?: AudioEnhancementGenerationRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 10 Step 10H Audio Enhancement & Restoration Report",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
    `**Readiness:** ${status.readinessScore}/100`,
    `**Plans Generated:** ${status.enhancementPlansGenerated}`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅" : "❌"} — ${r.detail}`),
    "",
    "## Plans",
    `- Tech (Voice): clarity ${tech?.scores.audioClarityScore ?? 0}/100`,
    `- Health (Podcast): restoration ${health?.scores.restorationScore ?? 0}/100`,
    `- Finance (Music): noise reduction ${finance?.scores.noiseReductionScore ?? 0}/100`,
    `- Vintage (Restoration): production ${restoration?.scores.productionReadinessScore ?? 0}/100`,
    "",
  ].join("\n");
}

function buildRestorationReport(...records: (AudioEnhancementGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as AudioEnhancementGenerationRecord[];
  return [
    "# Audio Restoration Report — Step 10H",
    "",
    "| Plan | Type | Primary | Techniques | Severity | Restoration Score |",
    "|------|------|---------|------------|----------|-------------------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.enhancementType} | ${r.audioQualityAnalysis.audioCategory} | ${r.restorationPlan.primaryTechnique} | ${r.restorationPlan.techniques.length} | ${r.restorationPlan.severityLevel} | ${r.scores.restorationScore}/100 |`
    ),
  ].join("\n");
}

function buildNoiseReductionReport(...records: (AudioEnhancementGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as AudioEnhancementGenerationRecord[];
  return [
    "# Noise Reduction Report — Step 10H",
    "",
    "| Plan | Defects | Noise Level | Enhancement | Noise Reduction Score |",
    "|------|---------|-------------|-------------|----------------------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.platform} | ${r.audioQualityAnalysis.defects.join(", ")} | ${r.audioQualityAnalysis.backgroundNoiseLevel} | ${r.enhancementPlan.primaryTechnique} | ${r.scores.noiseReductionScore}/100 |`
    ),
  ].join("\n");
}

function buildSynchronizationReport(...records: (AudioEnhancementGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as AudioEnhancementGenerationRecord[];
  return [
    "# Synchronization Report — Step 10H",
    "",
    "| Plan | Video Sync | Timeline | Tracks | Sync Score |",
    "|------|------------|----------|--------|------------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.enhancementType} | ${r.syncPlan.videoSync.slice(0, 30)}... | ${r.syncPlan.timelineAlignment.slice(0, 25)}... | ${r.syncPlan.multiTrackAlignment.length} | ${r.scores.synchronizationScore}/100 |`
    ),
  ].join("\n");
}

function buildReadinessReport(
  status: AudioEnhancementGenerationEngineStatusReport,
  ...records: (AudioEnhancementGenerationRecord | undefined)[]
): string {
  const rows = records.filter(Boolean) as AudioEnhancementGenerationRecord[];
  return [
    "# Audio Enhancement Readiness Report — Step 10H",
    "",
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Plan | Clarity | Restoration | Noise Reduction | Sync | Production | Confidence | Ready |",
    "|------|---------|-------------|-----------------|------|------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.enhancementType} | ${r.scores.audioClarityScore} | ${r.scores.restorationScore} | ${r.scores.noiseReductionScore} | ${r.scores.synchronizationScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`
    ),
  ].join("\n");
}

void main();
