import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALL_TTS_PLATFORMS,
  createAiCore,
  CreativePlatform,
  EmotionType,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  SUPPORTED_TTS_LANGUAGES,
  TtsLanguage,
  TtsOutputUseCase,
  TtsPlatform,
  VoiceType,
  type TextToSpeechGenerationEngineStatusReport,
  type TextToSpeechGenerationRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-text-to-speech-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step10b-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI-powered creative workstation for marketing teams",
  features: ["AI audio generation", "brand consistency", "multi-language TTS"],
  specifications: { license: "pro" },
  materials: ["digital-license"],
  price: 299.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "technology" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2B,
  tags: ["software", "validation"],
  keywords: ["AI studio", "kwizera"],
};

const SAMPLE_HEALTH: ProductAnalysisEngineInput = {
  productId: "step10b-health-app",
  productName: "VitalCare Health App",
  category: ProductAnalysisCategory.Health,
  subcategory: "wellness",
  brand: "VitalCare",
  description: "Application de santé pour le suivi du bien-être quotidien",
  features: ["suivi", "rappels", "conseils"],
  price: 9.99,
  currency: "EUR",
  availability: ProductAvailabilityStatus.InStock,
  industry: "health" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2C,
  tags: ["health", "validation"],
  keywords: ["santé", "vitalcare"],
};

const SAMPLE_FINANCE: ProductAnalysisEngineInput = {
  productId: "step10b-finance-app",
  productName: "PesaSmart Mobile Banking",
  category: ProductAnalysisCategory.Services,
  subcategory: "mobile-banking",
  brand: "PesaSmart",
  description: "Huduma ya benki ya simu kwa wateja wa Afrika Mashariki",
  features: ["malipo", "akiba", "mikopo"],
  price: 0,
  currency: "KES",
  availability: ProductAvailabilityStatus.InStock,
  industry: "general" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2C,
  tags: ["finance", "validation"],
  keywords: ["benki", "pesasmart"],
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
  await foundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: sample.productId!,
  });
  await foundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: sample.productId!,
    marketingObjective: objective,
  });
  await foundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: sample.productId!,
    platform,
  });
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 10B Text-to-Speech Generation Engine Validation");
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
    await core.start("step-10b-validation");
    const initMs = Date.now() - initStart;

    const audioFoundation = core.getManager().audioGenerationFoundation!;
    const engine = audioFoundation.getTextToSpeechGenerationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete()
        ? `Text-to-Speech Engine ready in ${initMs}ms`
        : "Not initialized",
    };

    const registered = audioFoundation.getRegistry().getModule("text-to-speech-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
    await prepareFullPipeline(piFoundation, SAMPLE_HEALTH, MarketingObjective.BrandAwareness, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FINANCE, MarketingObjective.ProductPromotion, CreativePlatform.TikTok);

    const tech = await engine.generateSpeechPlan({
      productId: "step10b-kwizera-pro",
      platform: TtsPlatform.YouTube,
      language: TtsLanguage.English,
      outputUseCase: TtsOutputUseCase.VideoNarration,
      text: "Introducing KWIZERA Pro Studio — the AI-powered creative workstation trusted by marketing teams worldwide. Launch your campaign today.",
      voiceType: VoiceType.Professional,
      emotion: EmotionType.Inspirational,
      generatePlatformOptimizations: true,
    });

    const health = await engine.generateSpeechPlan({
      productId: "step10b-health-app",
      platform: TtsPlatform.Website,
      language: TtsLanguage.French,
      outputUseCase: TtsOutputUseCase.Elearning,
      text: "Bienvenue sur VitalCare. Nous vous accompagnons chaque jour pour votre bien-être et votre santé.",
      voiceType: VoiceType.Female,
      emotion: EmotionType.Calm,
      generatePlatformOptimizations: true,
    });

    const finance = await engine.generateSpeechPlan({
      productId: "step10b-finance-app",
      platform: TtsPlatform.TikTok,
      language: TtsLanguage.Swahili,
      outputUseCase: TtsOutputUseCase.Advertisement,
      text: "Karibu PesaSmart! Huduma ya benki ya simu inayokupa udhibiti wa fedha zako popote ulipo.",
      voiceType: VoiceType.Male,
      emotion: EmotionType.Friendly,
      generatePlatformOptimizations: true,
    });

    const kinyarwanda = await engine.generateSpeechPlan({
      text: "Murakoze guhitamo KWIZERA. Dufite ibikorwa byiza byo gufasha abakora mu bucuruzi.",
      brandName: "KWIZERA",
      language: TtsLanguage.Kinyarwanda,
      platform: TtsPlatform.MobileApp,
      outputUseCase: TtsOutputUseCase.Presentation,
      voiceType: VoiceType.Narrator,
      emotion: EmotionType.Professional,
      generatePlatformOptimizations: false,
    });

    results.speechPlanGeneration = {
      passed: tech.success && health.success && finance.success && kinyarwanda.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Health ${health.success ? "✓" : "✗"}, Finance ${finance.success ? "✓" : "✗"}, RW ${kinyarwanda.success ? "✓" : "✗"}`,
    };

    results.textAnalysis = {
      passed: Boolean(
        tech.record?.textAnalysis.language &&
          tech.record?.textAnalysis.sentenceCount >= 1 &&
          tech.record?.textAnalysis.keywords.length >= 1 &&
          tech.record?.textAnalysis.wordCount >= 5
      ),
      detail: `${tech.record?.textAnalysis.wordCount} words, ${tech.record?.textAnalysis.sentenceCount} sentences, lang ${tech.record?.textAnalysis.language}`,
    };

    results.pronunciationPlanning = {
      passed: Boolean(
        tech.record?.pronunciationPlan.numberReadingRules.length >= 2 &&
          tech.record?.pronunciationPlan.currencyReadingRules.length >= 1 &&
          Object.keys(tech.record?.pronunciationPlan.pronunciationDictionary ?? {}).length >= 1
      ),
      detail: `Pronunciation score ${tech.record?.scores.pronunciationScore}`,
    };

    results.emotionPlanning = {
      passed: Boolean(
        tech.record?.emotionPlan.primaryEmotion &&
          tech.record?.emotionPlan.emotionalArc.length >= 2 &&
          (tech.record?.scores.emotionScore ?? 0) >= 50
      ),
      detail: `Emotion ${tech.record?.emotionPlan.primaryEmotion}, score ${tech.record?.scores.emotionScore}`,
    };

    results.speechNaturalness = {
      passed: Boolean(
        tech.record?.naturalnessPlan.pauses.length >= 3 &&
          tech.record?.naturalnessPlan.breathPlanning.length >= 2 &&
          tech.record?.naturalnessPlan.speakingRate &&
          (tech.record?.scores.naturalnessScore ?? 0) >= 55
      ),
      detail: `Naturalness score ${tech.record?.scores.naturalnessScore}, rate ${tech.record?.naturalnessPlan.speakingRate}`,
    };

    results.multiLanguageSupport = {
      passed:
        tech.record?.textAnalysis.language === TtsLanguage.English &&
        health.record?.textAnalysis.language === TtsLanguage.French &&
        finance.record?.textAnalysis.language === TtsLanguage.Swahili &&
        kinyarwanda.record?.textAnalysis.language === TtsLanguage.Kinyarwanda &&
        SUPPORTED_TTS_LANGUAGES.length >= 4,
      detail: `${SUPPORTED_TTS_LANGUAGES.length} languages supported (en, fr, sw, rw verified)`,
    };

    results.platformOptimization = {
      passed: (tech.record?.platformOptimizations.length ?? 0) === ALL_TTS_PLATFORMS.length,
      detail: `${tech.record?.platformOptimizations.length}/${ALL_TTS_PLATFORMS.length} platform profiles`,
    };

    results.speechPlanScores = {
      passed:
        (tech.record?.scores.pronunciationScore ?? 0) >= 55 &&
        (tech.record?.scores.naturalnessScore ?? 0) >= 55 &&
        (tech.record?.scores.emotionScore ?? 0) >= 50 &&
        (tech.record?.scores.brandConsistencyScore ?? 0) >= 50 &&
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Pronunciation ${tech.record?.scores.pronunciationScore}, production ${tech.record?.scores.productionReadinessScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.products.length ?? 0) >= 1 &&
        (tech.record?.relationships.scripts.length ?? 0) >= 1 &&
        (tech.record?.relationships.voices.length ?? 0) >= 1,
      detail: `Products ${tech.record?.relationships.products.length}, scripts ${tech.record?.relationships.scripts.length}, voices ${tech.record?.relationships.voices.length}`,
    };

    results.productionReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
    };

    results.brandConsistency = {
      passed: tech.record?.brandConsistent === true,
      detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
    };

    const noPipeline = await engine.generateSpeechPlan({ productId: "step10b-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without upstream pipeline",
    };

    const textOnly = await engine.generateSpeechPlan({
      text: "Minimal narration script for brand announcement with clear pronunciation and professional delivery tone",
      brandName: "KWIZERA",
      platform: TtsPlatform.Website,
      outputUseCase: TtsOutputUseCase.Podcast,
      generatePlatformOptimizations: false,
    });
    results.textOnlyGeneration = {
      passed: textOnly.success,
      detail: textOnly.success ? "Text-only speech plan generated" : textOnly.message ?? "Failed",
    };

    const repaired = await engine.repairSpeechPlan("step10b-health-app", TtsPlatform.Facebook);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Speech plan repair pipeline verified" : "Repair failed",
    };

    const productSearch = engine.searchSpeechPlans({ productId: "step10b-kwizera-pro" });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const languageSearch = engine.searchSpeechPlans({ language: TtsLanguage.French });
    results.searchByLanguage = {
      passed: languageSearch.length >= 1,
      detail: `${languageSearch.length} result(s) by language`,
    };

    const platformSearch = engine.searchSpeechPlans({ platform: TtsPlatform.TikTok });
    results.searchByPlatform = {
      passed: platformSearch.length >= 1,
      detail: `${platformSearch.length} result(s) by platform`,
    };

    const keywordSearch = engine.searchSpeechPlans({ keywords: "kwizera" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const scriptAsset = audioFoundation.getAssetRegistry().getAsset(tech.record!.profile.scriptId);
    const voiceAsset = audioFoundation.getAssetRegistry().getAsset(tech.record!.profile.voiceProfileId);
    results.generationAssetRegistration = {
      passed: scriptAsset?.assetType === "prompt" && voiceAsset?.assetType === "voice",
      detail: `Script ${scriptAsset?.assetId}, Voice ${voiceAsset?.assetId}`,
    };

    const blueprint = audioFoundation.getBlueprintManager().getBlueprint(tech.record!.blueprintId!);
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
    const logFile = path.join(storageRoot, "logs", `text-to-speech-generation-engine-${logDate}.jsonl`);
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
      detail: `Healthcare ${health.record?.emotionPlan.primaryEmotion}, Finance ${finance.record?.emotionPlan.primaryEmotion}`,
    };

    results.recommendations = {
      passed: (tech.record?.recommendations.length ?? 0) >= 1,
      detail: `${tech.record?.recommendations.length} recommendation(s)`,
    };

    await core.stop("step-10b-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Text-to-Speech-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, health.record, finance.record, kinyarwanda.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Pronunciation-Planning-Report.md"),
      buildPronunciationReport(tech.record, health.record, finance.record, kinyarwanda.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Emotion-Planning-Report.md"),
      buildEmotionReport(tech.record, health.record, finance.record, kinyarwanda.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Speech-Naturalness-Report.md"),
      buildNaturalnessReport(tech.record, health.record, finance.record, kinyarwanda.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Text-to-Speech-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, health.record, finance.record, kinyarwanda.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-10B-VALIDATION-REPORT.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, health.record, finance.record, kinyarwanda.record),
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
    console.log(`  ${path.join(projectStateDir, "AI-Text-to-Speech-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Pronunciation-Planning-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Emotion-Planning-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Speech-Naturalness-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Text-to-Speech-Readiness-Report.md")}`);

    if (useTemp && fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildMainReport(
  status: TextToSpeechGenerationEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: TextToSpeechGenerationRecord,
  health?: TextToSpeechGenerationRecord,
  finance?: TextToSpeechGenerationRecord,
  rw?: TextToSpeechGenerationRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 10 Step 10B Text-to-Speech Generation Report",
    "",
    `**Phase:** 10 — Audio Generation Engine`,
    `**Step:** 10B — AI Text-to-Speech Generation Engine`,
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
    `| **Speech Plans Generated** | ${status.speechPlansGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Generated Speech Plans",
    "",
    `- Technology (EN): ${tech?.profile.platform ?? "n/a"} (${tech?.scores.pronunciationScore ?? 0}/100)`,
    `- Healthcare (FR): ${health?.profile.language ?? "n/a"} (${health?.scores.emotionScore ?? 0}/100)`,
    `- Finance (SW): ${finance?.profile.language ?? "n/a"} (${finance?.scores.naturalnessScore ?? 0}/100)`,
    `- Kinyarwanda (RW): ${rw?.profile.language ?? "n/a"} (${rw?.scores.productionReadinessScore ?? 0}/100)`,
    "",
  ].join("\n");
}

function buildPronunciationReport(...records: (TextToSpeechGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as TextToSpeechGenerationRecord[];
  const lines = [
    "# Pronunciation Planning Report — Step 10B",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Plan | Language | Dictionary Entries | Acronyms | Pronunciation Score |",
    "|------|----------|-------------------|----------|---------------------|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.speechPlanId} | ${r.textAnalysis.language} | ${Object.keys(r.pronunciationPlan.pronunciationDictionary).length} | ${Object.keys(r.pronunciationPlan.acronymExpansions).length} | ${r.scores.pronunciationScore}/100 |`
    );
  }
  if (rows[0]) {
    lines.push("", "## Number & Currency Rules", "", ...rows[0].pronunciationPlan.numberReadingRules.map((n) => `- ${n}`));
  }
  return lines.join("\n");
}

function buildEmotionReport(...records: (TextToSpeechGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as TextToSpeechGenerationRecord[];
  const lines = [
    "# Emotion Planning Report — Step 10B",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Plan | Primary | Secondary | Intensity | Emotion Score |",
    "|------|---------|-----------|-----------|---------------|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.profile.productId ?? r.speechPlanId} | ${r.emotionPlan.primaryEmotion} | ${r.emotionPlan.secondaryEmotion ?? "n/a"} | ${r.emotionPlan.emotionIntensity} | ${r.scores.emotionScore}/100 |`
    );
  }
  return lines.join("\n");
}

function buildNaturalnessReport(...records: (TextToSpeechGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as TextToSpeechGenerationRecord[];
  const lines = [
    "# Speech Naturalness Report — Step 10B",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
  ];
  for (const r of rows) {
    lines.push(`## ${r.speechPlanId}`, "");
    lines.push(`- Speaking rate: ${r.naturalnessPlan.speakingRate}`);
    lines.push(`- Intonation: ${r.naturalnessPlan.intonation.slice(0, 60)}...`);
    lines.push(`- Pauses: ${r.naturalnessPlan.pauses.length} mapped`);
    lines.push(`- Naturalness score: ${r.scores.naturalnessScore}/100`);
    lines.push("");
  }
  return lines.join("\n");
}

function buildReadinessReport(
  status: TextToSpeechGenerationEngineStatusReport,
  ...records: (TextToSpeechGenerationRecord | undefined)[]
): string {
  const rows = records.filter(Boolean) as TextToSpeechGenerationRecord[];
  return [
    "# Text-to-Speech Readiness Report — Step 10B",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Plan | Pronunciation | Naturalness | Emotion | Brand | Production | Confidence | Ready |",
    "|------|---------------|-------------|---------|-------|------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.language} | ${r.scores.pronunciationScore} | ${r.scores.naturalnessScore} | ${r.scores.emotionScore} | ${r.scores.brandConsistencyScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`
    ),
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
