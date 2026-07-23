import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AuthorizationStatus,
  createAiCore,
  CreativePlatform,
  EmotionType,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  VcLanguage,
  VcOutputUseCase,
  VcPlatform,
  VOICE_LIBRARY_TYPES,
  VoiceLibraryType,
  VoiceType,
  type VoiceCloningGenerationEngineStatusReport,
  type VoiceCloningGenerationRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-voice-cloning-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step10d-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI-powered creative workstation for marketing teams",
  features: ["AI audio generation", "voice cloning", "multi-language support"],
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
  productId: "step10d-health-app",
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
  productId: "step10d-finance-app",
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

  console.log("KWIZERA AI STUDIO — Step 10D Voice Cloning Generation Engine Validation");
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
    await core.start("step-10d-validation");
    const initMs = Date.now() - initStart;

    const audioFoundation = core.getManager().audioGenerationFoundation!;
    const engine = audioFoundation.getVoiceCloningGenerationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete()
        ? `Voice Cloning Engine ready in ${initMs}ms`
        : "Not initialized",
    };

    const registered = audioFoundation.getRegistry().getModule("voice-cloning-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    await prepareFullPipeline(piFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch, CreativePlatform.YouTube);
    await prepareFullPipeline(piFoundation, SAMPLE_HEALTH, MarketingObjective.BrandAwareness, CreativePlatform.Website);
    await prepareFullPipeline(piFoundation, SAMPLE_FINANCE, MarketingObjective.ProductPromotion, CreativePlatform.TikTok);

    const tech = await engine.generateCloningPlan({
      productId: "step10d-kwizera-pro",
      voiceSampleId: "step10d-sample-tech-narrator",
      consentId: "demo-consent-tech-en",
      platform: VcPlatform.YouTube,
      language: VcLanguage.English,
      outputUseCase: VcOutputUseCase.VideoNarration,
      voiceLibraryType: VoiceLibraryType.Professional,
      sampleHint: "Introducing KWIZERA Pro Studio. Our AI-powered creative workstation empowers marketing teams worldwide.",
      voiceType: VoiceType.Professional,
      sourceEmotion: EmotionType.Inspirational,
      durationMs: 60000,
      voiceMetadata: { recordingQuality: "studio", sampleDurationMs: 60000, sampleCount: 3 },
    });

    const health = await engine.generateCloningPlan({
      productId: "step10d-health-app",
      voiceSampleId: "step10d-sample-health-narrator",
      consentId: "demo-consent-health-fr",
      platform: VcPlatform.Website,
      language: VcLanguage.French,
      outputUseCase: VcOutputUseCase.Elearning,
      voiceLibraryType: VoiceLibraryType.Educational,
      sampleHint: "Bienvenue sur VitalCare. Nous vous accompagnons chaque jour pour votre bien-être.",
      voiceType: VoiceType.Neutral,
      sourceEmotion: EmotionType.Calm,
      durationMs: 45000,
    });

    const finance = await engine.generateCloningPlan({
      productId: "step10d-finance-app",
      voiceSampleId: "step10d-sample-finance-narrator",
      consentId: "demo-consent-finance-sw",
      platform: VcPlatform.TikTok,
      language: VcLanguage.Swahili,
      outputUseCase: VcOutputUseCase.Advertisement,
      voiceLibraryType: VoiceLibraryType.Commercial,
      sampleHint: "Karibu PesaSmart! Huduma ya benki ya simu inayokupa udhibiti wa fedha zako.",
      voiceType: VoiceType.Professional,
      sourceEmotion: EmotionType.Friendly,
      durationMs: 30000,
    });

    const kinyarwanda = await engine.generateCloningPlan({
      voiceSampleId: "step10d-sample-rw-narrator",
      consentId: "demo-consent-rw",
      sampleHint: "Murakoze guhitamo KWIZERA. Dufite ibikorwa byiza byo gufasha abakora mu bucuruzi.",
      brandName: "KWIZERA",
      language: VcLanguage.Kinyarwanda,
      platform: VcPlatform.MobileApp,
      outputUseCase: VcOutputUseCase.Podcast,
      voiceLibraryType: VoiceLibraryType.Corporate,
      voiceType: VoiceType.Professional,
      sourceEmotion: EmotionType.Professional,
      durationMs: 40000,
    });

    results.cloningPlanGeneration = {
      passed: tech.success && health.success && finance.success && kinyarwanda.success,
      detail: `Tech ${tech.success ? "✓" : "✗"}, Health ${health.success ? "✓" : "✗"}, Finance ${finance.success ? "✓" : "✗"}, RW ${kinyarwanda.success ? "✓" : "✗"}`,
    };

    results.voiceAnalysis = {
      passed: Boolean(
        tech.record?.voiceAnalysis.pitch &&
          tech.record?.voiceAnalysis.timbre &&
          tech.record?.voiceAnalysis.voiceQualityScore >= 70
      ),
      detail: `Quality ${tech.record?.voiceAnalysis.voiceQualityScore}, lang ${tech.record?.voiceAnalysis.language}`,
    };

    results.voiceProfile = {
      passed: Boolean(
        tech.record?.profile.voiceProfileId &&
          tech.record?.profile.speakerId &&
          tech.record?.profile.authorizationStatus === AuthorizationStatus.Authorized
      ),
      detail: `Profile ${tech.record?.profile.voiceProfileId}, auth ${tech.record?.profile.authorizationStatus}`,
    };

    results.authorizationValidation = {
      passed: Boolean(
        tech.record?.authorizationValidation.overallAuthorized &&
          tech.record?.authorizationCompliant === true &&
          (tech.record?.scores.authorizationComplianceScore ?? 0) === 100
      ),
      detail: `Compliance ${tech.record?.scores.authorizationComplianceScore}, compliant ${tech.record?.authorizationCompliant}`,
    };

    results.voiceConsistency = {
      passed: Boolean(
        tech.record?.consistencyPlan.voiceIdentity &&
          tech.record?.consistencyPlan.consistencyScore >= 80 &&
          (tech.record?.scores.voiceStabilityScore ?? 0) >= 55
      ),
      detail: `Consistency ${tech.record?.consistencyPlan.consistencyScore}, stability ${tech.record?.scores.voiceStabilityScore}`,
    };

    results.pronunciationQuality = {
      passed: Boolean(
        Object.keys(tech.record?.cloningPlan.pronunciationMapping ?? {}).length >= 1 &&
          (tech.record?.scores.pronunciationScore ?? 0) >= 55
      ),
      detail: `Pronunciation score ${tech.record?.scores.pronunciationScore}`,
    };

    results.emotionPreservation = {
      passed: Boolean(
        tech.record?.cloningPlan.emotionMapping.source &&
          (tech.record?.scores.emotionPreservationScore ?? 0) >= 50
      ),
      detail: `Emotion ${tech.record?.cloningPlan.emotionMapping.source}, score ${tech.record?.scores.emotionPreservationScore}`,
    };

    results.cloningScores = {
      passed:
        (tech.record?.scores.voiceSimilarityScore ?? 0) >= 55 &&
        (tech.record?.scores.voiceStabilityScore ?? 0) >= 55 &&
        (tech.record?.scores.productionReadinessScore ?? 0) >= 55 &&
        (tech.record?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Similarity ${tech.record?.scores.voiceSimilarityScore}, production ${tech.record?.scores.productionReadinessScore}, confidence ${tech.record?.scores.aiConfidenceScore}`,
    };

    results.voiceLibrary = {
      passed: VOICE_LIBRARY_TYPES.length >= 7,
      detail: `${VOICE_LIBRARY_TYPES.length} voice library types supported`,
    };

    results.relationships = {
      passed:
        (tech.record?.relationships.voiceSamples.length ?? 0) >= 1 &&
        (tech.record?.relationships.voiceProfiles.length ?? 0) >= 1 &&
        (tech.record?.relationships.consentRecords.length ?? 0) >= 1 &&
        (tech.record?.relationships.products.length ?? 0) >= 1,
      detail: `Samples ${tech.record?.relationships.voiceSamples.length}, profiles ${tech.record?.relationships.voiceProfiles.length}, consent ${tech.record?.relationships.consentRecords.length}`,
    };

    results.productionReadiness = {
      passed: tech.record?.productionReady === true && tech.record?.validated === true,
      detail: `Production ready: ${tech.record?.productionReady}, validated: ${tech.record?.validated}`,
    };

    results.brandConsistency = {
      passed: tech.record?.brandConsistent === true,
      detail: `Brand consistent: ${tech.record?.brandConsistent}, score ${tech.record?.scores.brandConsistencyScore}`,
    };

    const unauthorized = await engine.generateCloningPlan({
      productId: "step10d-kwizera-pro",
      voiceSampleId: "step10d-unauthorized-sample",
      consentId: "invalid-consent-no-auth",
    });
    results.unauthorizedRejection = {
      passed: !unauthorized.success,
      detail: unauthorized.message ?? "Unauthorized cloning rejected",
    };

    const noPipeline = await engine.generateCloningPlan({ productId: "step10d-nonexistent" });
    results.incompleteRejection = {
      passed: !noPipeline.success,
      detail: noPipeline.message ?? "Rejected without context",
    };

    const sampleOnly = await engine.generateCloningPlan({
      voiceSampleId: "step10d-standalone-sample",
      consentId: "demo-consent-tech-en",
      sampleHint: "Standalone authorized voice sample for KWIZERA brand announcement with professional delivery",
      brandName: "KWIZERA",
      platform: VcPlatform.Website,
    });
    results.standaloneGeneration = {
      passed: sampleOnly.success,
      detail: sampleOnly.success ? "Standalone cloning plan generated" : sampleOnly.message ?? "Failed",
    };

    const repaired = await engine.repairCloningPlan("step10d-health-app", VcPlatform.Facebook);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Cloning plan repair pipeline verified" : "Repair failed",
    };

    const productSearch = engine.searchCloningPlans({ productId: "step10d-kwizera-pro" });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const speakerSearch = engine.searchCloningPlans({ speakerId: tech.record!.profile.speakerId });
    results.searchBySpeaker = {
      passed: speakerSearch.length >= 1,
      detail: `${speakerSearch.length} result(s) by speaker`,
    };

    const authSearch = engine.searchCloningPlans({ authorizationStatus: AuthorizationStatus.Authorized });
    results.searchByAuthorization = {
      passed: authSearch.length >= 1,
      detail: `${authSearch.length} result(s) by authorization`,
    };

    const keywordSearch = engine.searchCloningPlans({ keywords: "kwizera" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const sampleAsset = audioFoundation.getAssetRegistry().getAsset(tech.record!.profile.sampleId);
    const profileAsset = audioFoundation.getAssetRegistry().getAsset(tech.record!.profile.voiceProfileId);
    results.generationAssetRegistration = {
      passed: sampleAsset?.assetType === "audio-track" && profileAsset?.assetType === "voice-profile",
      detail: `Sample ${sampleAsset?.assetId}, Profile ${profileAsset?.assetId}`,
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
    const logFile = path.join(storageRoot, "logs", `voice-cloning-generation-engine-${logDate}.jsonl`);
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
      detail: `Healthcare ${health.record?.voiceAnalysis.detectedEmotion}, Finance ${finance.record?.voiceAnalysis.detectedEmotion}`,
    };

    results.recommendations = {
      passed: (tech.record?.recommendations.length ?? 0) >= 1,
      detail: `${tech.record?.recommendations.length} recommendation(s)`,
    };

    await core.stop("step-10d-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Voice-Cloning-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, tech.record, health.record, finance.record, kinyarwanda.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Voice-Analysis-Report.md"),
      buildVoiceAnalysisReport(tech.record, health.record, finance.record, kinyarwanda.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Voice-Profile-Report.md"),
      buildVoiceProfileReport(tech.record, health.record, finance.record, kinyarwanda.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Authorization-Validation-Report.md"),
      buildAuthorizationReport(tech.record, health.record, finance.record, kinyarwanda.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Voice-Cloning-Readiness-Report.md"),
      buildReadinessReport(status, tech.record, health.record, finance.record, kinyarwanda.record),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-10D-VALIDATION-REPORT.md"),
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
    console.log(`  ${path.join(projectStateDir, "AI-Voice-Cloning-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Voice-Analysis-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Voice-Profile-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Authorization-Validation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Voice-Cloning-Readiness-Report.md")}`);

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
  status: VoiceCloningGenerationEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: VoiceCloningGenerationRecord,
  health?: VoiceCloningGenerationRecord,
  finance?: VoiceCloningGenerationRecord,
  rw?: VoiceCloningGenerationRecord
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 10 Step 10D Voice Cloning Generation Report",
    "",
    `**Phase:** 10 — Audio Generation Engine`,
    `**Step:** 10D — AI Voice Cloning Generation Engine`,
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
    `| **Cloning Plans Generated** | ${status.cloningPlansGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Generated Cloning Plans",
    "",
    `- Technology (EN): ${tech?.profile.platform ?? "n/a"} (${tech?.scores.voiceSimilarityScore ?? 0}/100)`,
    `- Healthcare (FR): ${health?.profile.language ?? "n/a"} (${health?.scores.emotionPreservationScore ?? 0}/100)`,
    `- Finance (SW): ${finance?.profile.language ?? "n/a"} (${finance?.scores.voiceStabilityScore ?? 0}/100)`,
    `- Kinyarwanda (RW): ${rw?.profile.language ?? "n/a"} (${rw?.scores.productionReadinessScore ?? 0}/100)`,
    "",
  ].join("\n");
}

function buildVoiceAnalysisReport(...records: (VoiceCloningGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as VoiceCloningGenerationRecord[];
  const lines = [
    "# Voice Analysis Report — Step 10D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Plan | Language | Accent | Pitch | Quality | Emotion |",
    "|------|----------|--------|-------|---------|---------|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.cloningPlanId.slice(0, 30)}... | ${r.voiceAnalysis.language} | ${r.voiceAnalysis.accent} | ${r.voiceAnalysis.pitch.slice(0, 20)}... | ${r.voiceAnalysis.voiceQualityScore}/100 | ${r.voiceAnalysis.detectedEmotion} |`
    );
  }
  return lines.join("\n");
}

function buildVoiceProfileReport(...records: (VoiceCloningGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as VoiceCloningGenerationRecord[];
  const lines = [
    "# Voice Profile Report — Step 10D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Plan | Profile ID | Speaker | Library | Auth Status | Version |",
    "|------|------------|---------|---------|-------------|---------|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.cloningPlanId.slice(0, 20)} | ${r.profile.voiceProfileId.slice(0, 25)}... | ${r.profile.speakerId} | ${r.profile.voiceLibraryType} | ${r.profile.authorizationStatus} | v${r.profile.voiceVersion} |`
    );
  }
  return lines.join("\n");
}

function buildAuthorizationReport(...records: (VoiceCloningGenerationRecord | undefined)[]): string {
  const rows = records.filter(Boolean) as VoiceCloningGenerationRecord[];
  const lines = [
    "# Authorization Validation Report — Step 10D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Plan | Consent | Authorized | Compliance Score | Notes |",
    "|------|---------|------------|------------------|-------|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.profile.consentId} | ${r.authorizationValidation.voiceConsentValid ? "✅" : "❌"} | ${r.authorizationValidation.overallAuthorized ? "✅" : "❌"} | ${r.scores.authorizationComplianceScore}/100 | ${r.authorizationValidation.validationNotes[0] ?? "n/a"} |`
    );
  }
  return lines.join("\n");
}

function buildReadinessReport(
  status: VoiceCloningGenerationEngineStatusReport,
  ...records: (VoiceCloningGenerationRecord | undefined)[]
): string {
  const rows = records.filter(Boolean) as VoiceCloningGenerationRecord[];
  return [
    "# Voice Cloning Readiness Report — Step 10D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    "",
    "| Plan | Similarity | Stability | Pronunciation | Emotion | Auth | Production | Confidence | Ready |",
    "|------|------------|-----------|---------------|---------|------|------------|------------|-------|",
    ...rows.map(
      (r) =>
        `| ${r.profile.language} | ${r.scores.voiceSimilarityScore} | ${r.scores.voiceStabilityScore} | ${r.scores.pronunciationScore} | ${r.scores.emotionPreservationScore} | ${r.scores.authorizationComplianceScore} | ${r.scores.productionReadinessScore} | ${r.scores.aiConfidenceScore} | ${r.productionReady ? "✅" : "❌"} |`
    ),
    "",
    "## Performance",
    "",
    `- Average generation: ${status.performance.averageGenerationMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    `- Voice library: ${status.voiceLibraryStatus}`,
    "",
  ].join("\n");
}

void main();
