import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AudioMixingPlatform,
  AudioTrackType,
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  type AudioMixMasterGenerationEngineStatusReport,
  type AudioMixMasterGenerationRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-mixmaster-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step10i-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI-powered creative workstation",
  features: ["mixing", "mastering"],
  price: 299.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "technology" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2B,
  tags: ["software"],
  keywords: ["kwizera"],
};

const SAMPLE_HEALTH: ProductAnalysisEngineInput = {
  productId: "step10i-health-app",
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
  productId: "step10i-finance-app",
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

  console.log("KWIZERA AI STUDIO — Step 10I Audio Mixing & Mastering Engine Validation");
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
    await core.start("step-10i-validation");
    const initMs = Date.now() - initStart;

    const audioFoundation = core.getManager().audioGenerationFoundation!;
    const engine = audioFoundation.getAudioMixingMasteringEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? `Mix/Master Engine ready in ${initMs}ms` : "Not initialized",
    };

    const registered = audioFoundation.getRegistry().getModule("audio-mixing-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
    await prepareFullPipeline(piFoundation, SAMPLE_HEALTH, MarketingObjective.BrandAwareness, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FINANCE, MarketingObjective.ProductPromotion, CreativePlatform.TikTok);

    const tech = await engine.generateMixMasterPlan({
      productId: "step10i-kwizera-pro",
      mixPrompt: "Multi-track mix with voice dialogue music and ambient for YouTube video",
      platform: AudioMixingPlatform.YouTube,
      sessionId: "step10i-tech-session",
      videoId: "step10i-tech-video",
      voiceTrackRefs: ["voice-1"],
      musicTrackRefs: ["music-1"],
      ambientTrackRefs: ["ambient-1"],
      trackCount: 5,
      brandGuidelines: "Professional balanced mix",
      durationSec: 120,
    });

    const health = await engine.generateMixMasterPlan({
      productId: "step10i-health-app",
      mixPrompt: "Podcast mix with voice narration and light ambient",
      platform: AudioMixingPlatform.Podcast,
      sessionId: "step10i-health-session",
      voiceTrackRefs: ["voice-podcast"],
      trackTypes: [AudioTrackType.Voice, AudioTrackType.Narration, AudioTrackType.Ambient, AudioTrackType.MasterBus],
      durationSec: 1800,
    });

    const finance = await engine.generateMixMasterPlan({
      productId: "step10i-finance-app",
      mixPrompt: "TikTok ad mix with music voice and sound effects",
      platform: AudioMixingPlatform.TikTok,
      sessionId: "step10i-finance-session",
      musicTrackRefs: ["music-ad"],
      soundEffectRefs: ["sfx-1"],
      durationSec: 30,
    });

    const film = await engine.generateMixMasterPlan({
      mixPrompt: "Cinema film mix with dialogue foley music and surround for KWIZERA production",
      brandName: "KWIZERA",
      platform: AudioMixingPlatform.Film,
      sessionId: "step10i-film-session",
      trackTypes: [AudioTrackType.Dialogue, AudioTrackType.Foley, AudioTrackType.Music, AudioTrackType.Effects, AudioTrackType.MasterBus],
      trackCount: 8,
      durationSec: 5400,
    });

    results.mixMasterPlanGeneration = {
      passed: tech.success && health.success && finance.success && film.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Health ${health.success ? "✓" : "✗"}, Finance ${finance.success ? "✓" : "✗"}, Film ${film.success ? "✓" : "✗"}`,
    };

    results.multiTrackAnalysis = {
      passed: Boolean(
        tech.record?.multiTrackAnalysis.trackCount >= 2 &&
          tech.record?.multiTrackAnalysis.trackTypes.length >= 2 &&
          tech.record?.multiTrackAnalysis.frequencyDistribution.low
      ),
      detail: `${tech.record?.multiTrackAnalysis.trackCount} tracks, types: ${tech.record?.multiTrackAnalysis.trackTypes.slice(0, 3).join(", ")}`,
    };

    results.mixingPlanning = {
      passed: Boolean(
        tech.record?.mixingPlan.busRouting.length >= 3 &&
          Object.keys(tech.record?.mixingPlan.trackBalancing ?? {}).length >= 2 &&
          (tech.record?.scores.mixingQualityScore ?? 0) >= 55
      ),
      detail: `${tech.record?.mixingPlan.busRouting.length} buses, mixing score ${tech.record?.scores.mixingQualityScore}`,
    };

    results.masteringPlanning = {
      passed: Boolean(
        tech.record?.masteringPlan.techniques.length >= 6 &&
          (tech.record?.scores.masteringQualityScore ?? 0) >= 55
      ),
      detail: `${tech.record?.masteringPlan.techniques.length} techniques, score ${tech.record?.scores.masteringQualityScore}`,
    };

    results.loudnessPlanning = {
      passed: Boolean(
        tech.record?.loudnessManagement.platformTarget &&
          tech.record?.loudnessManagement.streamingLoudness &&
          (tech.record?.scores.loudnessScore ?? 0) >= 55
      ),
      detail: `Target: ${tech.record?.outputPreparation.loudnessTarget}, score ${tech.record?.scores.loudnessScore}`,
    };

    results.frequencyBalance = {
      passed: Boolean(
        tech.record?.frequencyManagement.tonalBalance &&
          tech.record?.frequencyManagement.frequencyMasking.length >= 1 &&
          (tech.record?.scores.frequencyBalanceScore ?? 0) >= 55
      ),
      detail: `Masking rules: ${tech.record?.frequencyManagement.frequencyMasking.length}, score ${tech.record?.scores.frequencyBalanceScore}`,
    };

    results.spatialAudio = {
      passed: Boolean(
        film.record?.spatialMixPlan.surroundPreparation &&
          film.record?.spatialMixPlan.dolbyAtmosPreparation &&
          tech.record?.spatialMixPlan.monoCompatibility
      ),
      detail: `Film surround: ${film.record?.spatialMixPlan.surroundPreparation.slice(0, 25)}...`,
    };

    results.mixMasterScores = {
      passed:
        (tech.record?.scores.mixingQualityScore ?? 0) >= 55 &&
        (tech.record?.scores.masteringQualityScore ?? 0) >= 55 &&
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Mix ${tech.record?.scores.mixingQualityScore}, master ${tech.record?.scores.masteringQualityScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.mixingPlans.length ?? 0) >= 1 &&
        (tech.record?.relationships.masteringPlans.length ?? 0) >= 1 &&
        (tech.record?.relationships.products.length ?? 0) >= 1,
      detail: `Mix plans ${tech.record?.relationships.mixingPlans.length}, master plans ${tech.record?.relationships.masteringPlans.length}`,
    };

    results.productionReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: `Ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
    };

    results.brandConsistency = {
      passed: tech.record?.brandConsistent === true,
      detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
    };

    const noContext = await engine.generateMixMasterPlan({ productId: "step10i-nonexistent" });
    results.incompleteRejection = {
      passed: !noContext.success,
      detail: noContext.message ?? "Rejected",
    };

    const promptOnly = await engine.generateMixMasterPlan({
      mixPrompt: "Voice and music mix for KWIZERA creative workspace",
      brandName: "KWIZERA",
      platform: AudioMixingPlatform.Website,
    });
    results.promptOnlyGeneration = {
      passed: promptOnly.success,
      detail: promptOnly.success ? "Prompt-only plan generated" : "Failed",
    };

    const repaired = await engine.repairMixMasterPlan("step10i-health-app", AudioMixingPlatform.Radio);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Repair verified" : "Failed",
    };

    results.searchByProduct = {
      passed: engine.searchMixMasterPlans({ productId: "step10i-kwizera-pro" }).length >= 1,
      detail: `${engine.searchMixMasterPlans({ productId: "step10i-kwizera-pro" }).length} by product`,
    };
    results.searchBySession = {
      passed: engine.searchMixMasterPlans({ sessionId: "step10i-tech-session" }).length >= 1,
      detail: `${engine.searchMixMasterPlans({ sessionId: "step10i-tech-session" }).length} by session`,
    };
    results.searchByMastering = {
      passed: engine.searchMixMasterPlans({ mastering: "limiting" }).length >= 1,
      detail: `${engine.searchMixMasterPlans({ mastering: "limiting" }).length} by mastering`,
    };
    results.searchByKeywords = {
      passed: engine.searchMixMasterPlans({ keywords: "kwizera" }).length >= 1,
      detail: `${engine.searchMixMasterPlans({ keywords: "kwizera" }).length} by keywords`,
    };

    const mixAsset = audioFoundation.getAssetRegistry().getAsset(tech.record!.mixingPlanId);
    const masterAsset = audioFoundation.getAssetRegistry().getAsset(tech.record!.masteringPlanId);
    results.generationAssetRegistration = {
      passed: mixAsset?.assetType === "audio-track" && masterAsset?.assetType === "template",
      detail: `Mix ${mixAsset?.assetId}, Master ${masterAsset?.assetId}`,
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
      `audio-mixing-mastering-engine-${new Date().toISOString().slice(0, 10)}.jsonl`
    );
    results.logging = { passed: fs.existsSync(logFile), detail: logFile };

    results.readiness = { passed: status.readinessScore >= 85, detail: `Readiness ${status.readinessScore}/100` };
    results.multiIndustry = {
      passed: health.success && finance.success,
      detail: `Health ${health.record?.profile.platform}, Finance ${finance.record?.profile.platform}`,
    };
    results.recommendations = {
      passed: (tech.record?.recommendations.length ?? 0) >= 1,
      detail: `${tech.record?.recommendations.length} recommendation(s)`,
    };

    await core.stop("step-10i-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Audio-Mixing-Report.md"),
      buildMixingReport(tech.record, health.record, finance.record, film.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "AI-Audio-Mastering-Report.md"),
      buildMasteringReport(tech.record, health.record, finance.record, film.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Loudness-Planning-Report.md"),
      buildLoudnessReport(tech.record, health.record, finance.record, film.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Frequency-Balance-Report.md"),
      buildFrequencyReport(tech.record, health.record, finance.record, film.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Audio-Mastering-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, health.record, finance.record, film.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-10I-VALIDATION-REPORT.md"),
      buildMainReport(status, results, allPassed, tech.record, health.record, finance.record, film.record),
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
    console.log(`  ${path.join(projectStateDir, "AI-Audio-Mixing-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "AI-Audio-Mastering-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Loudness-Planning-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Frequency-Balance-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Audio-Mastering-Readiness-Report.md")}`);

    if (useTemp && fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildMainReport(
  status: AudioMixMasterGenerationEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  allPassed: boolean,
  tech?: AudioMixMasterGenerationRecord,
  health?: AudioMixMasterGenerationRecord,
  finance?: AudioMixMasterGenerationRecord,
  film?: AudioMixMasterGenerationRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 10 Step 10I Audio Mixing & Mastering Report",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Overall:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`,
    `**Readiness:** ${status.readinessScore}/100`,
    `**Plans Generated:** ${status.mixMasterPlansGenerated}`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅" : "❌"} — ${r.detail}`),
    "",
    "## Plans",
    `- Tech (YouTube): mixing ${tech?.scores.mixingQualityScore ?? 0}/100`,
    `- Health (Podcast): mastering ${health?.scores.masteringQualityScore ?? 0}/100`,
    `- Finance (TikTok): loudness ${finance?.scores.loudnessScore ?? 0}/100`,
    `- Film (Cinema): frequency ${film?.scores.frequencyBalanceScore ?? 0}/100`,
    "",
  ].join("\n");
}

function buildMixingReport(...records: (AudioMixMasterGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as AudioMixMasterGenerationRecord[];
  return [
    "# AI Audio Mixing Report — Step 10I",
    "",
    "| Plan | Platform | Tracks | Buses | Mixing Score |",
    "|------|----------|--------|-------|--------------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.sessionId.slice(0, 20)} | ${r.profile.platform} | ${r.multiTrackAnalysis.trackCount} | ${r.mixingPlan.busRouting.length} | ${r.scores.mixingQualityScore}/100 |`
    ),
  ].join("\n");
}

function buildMasteringReport(...records: (AudioMixMasterGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as AudioMixMasterGenerationRecord[];
  return [
    "# AI Audio Mastering Report — Step 10I",
    "",
    "| Plan | Platform | Techniques | Target LUFS | Mastering Score |",
    "|------|----------|------------|-------------|-----------------|",
    ...rows.map(
      (r) =>
        `| ${r.masteringPlanId.slice(0, 30)}... | ${r.profile.platform} | ${r.masteringPlan.techniques.length} | ${r.masteringPlan.targetLufs} | ${r.scores.masteringQualityScore}/100 |`
    ),
  ].join("\n");
}

function buildLoudnessReport(...records: (AudioMixMasterGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as AudioMixMasterGenerationRecord[];
  return [
    "# Loudness Planning Report — Step 10I",
    "",
    "| Plan | Platform | Target | Streaming | Loudness Score |",
    "|------|----------|--------|-----------|----------------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.platform} | ${r.outputPreparation.loudnessTarget} | ${r.loudnessManagement.platformTarget.slice(0, 25)}... | ${r.loudnessManagement.streamingLoudness.slice(0, 20)}... | ${r.scores.loudnessScore}/100 |`
    ),
  ].join("\n");
}

function buildFrequencyReport(...records: (AudioMixMasterGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as AudioMixMasterGenerationRecord[];
  return [
    "# Frequency Balance Report — Step 10I",
    "",
    "| Plan | Low | Mid | High | Masking Rules | Frequency Score |",
    "|------|-----|-----|------|---------------|-----------------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.platform} | ${r.frequencyManagement.lowFrequencies.slice(0, 20)}... | ${r.frequencyManagement.midFrequencies.slice(0, 20)}... | ${r.frequencyManagement.highFrequencies.slice(0, 20)}... | ${r.frequencyManagement.frequencyMasking.length} | ${r.scores.frequencyBalanceScore}/100 |`
    ),
  ].join("\n");
}

function buildReadinessReport(
  status: AudioMixMasterGenerationEngineStatusReport,
  ...records: (AudioMixMasterGenerationRecord | undefined)[]
): string {
  const rows = records.filter(Boolean) as AudioMixMasterGenerationRecord[];
  return [
    "# Audio Mastering Readiness Report — Step 10I",
    "",
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Plan | Mix | Master | Loudness | Frequency | Production | Confidence | Ready |",
    "|------|-----|--------|----------|-----------|------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.platform} | ${r.scores.mixingQualityScore} | ${r.scores.masteringQualityScore} | ${r.scores.loudnessScore} | ${r.scores.frequencyBalanceScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`
    ),
  ].join("\n");
}

void main();
