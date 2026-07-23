import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAssetType,
  AudioGenerationHealthLevel,
  AudioGenerationSource,
  AudioGenerationVerificationStatus,
} from "../audio-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../audio-generation-foundation/audio-generation-asset-registry.js";
import { TextToSpeechGenerationAnalyzer } from "./text-to-speech-generation-analyzer.js";
import { TextToSpeechGenerationLinker } from "./text-to-speech-generation-linker.js";
import { TextToSpeechGenerationLogger } from "./text-to-speech-generation-logger.js";
import { TextToSpeechGenerationScorer } from "./text-to-speech-generation-scorer.js";
import { TextToSpeechGenerationRecordStore } from "./text-to-speech-generation-stores.js";
import {
  TextToSpeechGenerationInput,
  TextToSpeechGenerationRecord,
  TextToSpeechGenerationResult,
  TextToSpeechSearchQuery,
} from "./types.js";

export class TextToSpeechGenerationProcessor {
  constructor(
    private readonly foundation: AiAudioGenerationFoundation,
    private readonly analyzer: TextToSpeechGenerationAnalyzer,
    private readonly scorer: TextToSpeechGenerationScorer,
    private readonly linker: TextToSpeechGenerationLinker,
    private readonly records: TextToSpeechGenerationRecordStore,
    private readonly logger: TextToSpeechGenerationLogger
  ) {}

  async generateSpeechPlan(input: TextToSpeechGenerationInput): Promise<TextToSpeechGenerationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const context = await this.resolveContext(input);
      if (!context) {
        return this.reject(start, "Unable to resolve speech context — provide productId or text/script", [
          "Product intelligence pipeline or text content required",
        ]);
      }

      const platform = this.analyzer.resolvePlatform(input, context);
      const existing = input.productId
        ? this.records.getByProduct(input.productId).find((r) => r.profile.platform === platform)
        : undefined;
      const version = existing ? existing.profile.version + 1 : 1;

      const textAnalysis = this.analyzer.analyzeText(input, context);
      const profile = this.analyzer.buildProfile(input, platform, version, context, textAnalysis);
      const voicePlan = this.analyzer.buildVoicePlan(input, context, textAnalysis);
      const pronunciationPlan = this.analyzer.buildPronunciationPlan(textAnalysis, context);
      const emotionPlan = this.analyzer.buildEmotionPlan(input, context, textAnalysis);
      const naturalnessPlan = this.analyzer.buildNaturalnessPlan(textAnalysis, voicePlan, platform);
      const platformOptimizations = this.analyzer.buildPlatformOptimizations(profile, input);
      const productionInstructions = this.analyzer.buildProductionInstructions(profile, naturalnessPlan, voicePlan);
      const recommendations = this.analyzer.buildRecommendations(textAnalysis, emotionPlan, context);

      const scores = this.scorer.computeScores(
        textAnalysis,
        voicePlan,
        pronunciationPlan,
        emotionPlan,
        naturalnessPlan,
        platformOptimizations,
        context
      );

      const validation = this.scorer.isSpeechPlanValid(scores, {
        textAnalysis,
        pronunciationPlan,
        emotionPlan,
        naturalnessPlan,
      });

      if (!validation.valid) {
        const repaired = this.applySafeRepairs(textAnalysis, pronunciationPlan, emotionPlan, naturalnessPlan, validation.diagnostics);
        if (repaired.repaired) {
          this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
        }
        const revalidation = this.scorer.isSpeechPlanValid(scores, {
          textAnalysis,
          pronunciationPlan,
          emotionPlan,
          naturalnessPlan,
        });
        if (!revalidation.valid) {
          this.logger.log("warn", "validation", "Speech plan generation rejected", {
            diagnostics: revalidation.diagnostics,
          });
          return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: revalidation.diagnostics,
            message: "Speech plan validation failed — all validations must pass before approval",
          };
        }
      }

      const productionReady = this.scorer.isProductionReady(scores, {
        speechPlanId: profile.speechPlanId,
        profile,
        textAnalysis,
        voicePlan,
        pronunciationPlan,
        emotionPlan,
        naturalnessPlan,
        platformOptimizations,
        productionInstructions,
        scores,
        relationships: {
          scripts: [],
          voices: [],
          products: [],
          brands: [],
          campaigns: [],
          videos: [],
          images: [],
          knowledgeRecords: [],
          productionPlans: [],
        },
        recommendations,
        validated: true,
        productionReady: false,
        brandConsistent: false,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
      const brandConsistent = this.scorer.isBrandConsistent(context, voicePlan);

      const blueprint = this.foundation.getBlueprintManager().createBlueprint({
        blueprintId: `blueprint-${profile.speechPlanId}`,
        projectId: profile.projectId,
        name: `Text-to-Speech ${profile.language} ${platform}`,
      });

      const draft: TextToSpeechGenerationRecord = {
        speechPlanId: profile.speechPlanId,
        profile,
        textAnalysis,
        voicePlan,
        pronunciationPlan,
        emotionPlan,
        naturalnessPlan,
        platformOptimizations,
        productionInstructions,
        blueprintId: blueprint.blueprintId,
        scores,
        relationships: {
          scripts: [profile.scriptId],
          voices: [profile.voiceProfileId],
          products: [],
          brands: [],
          campaigns: [],
          videos: [],
          images: [],
          knowledgeRecords: [],
          productionPlans: [],
        },
        recommendations,
        validated: true,
        productionReady,
        brandConsistent,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      draft.relationships = this.linker.detectRelationships(
        draft,
        input,
        context.creative,
        context.strategy,
        context.understanding
      );

      const generationValidation = this.foundation.validateGeneration({
        qualityScore: scores.pronunciationScore,
        confidenceScore: scores.aiConfidenceScore,
        verificationStatus:
          scores.aiConfidenceScore >= 75
            ? AudioGenerationVerificationStatus.Verified
            : AudioGenerationVerificationStatus.Pending,
        source: AudioGenerationSource.Prompt,
        sourceRef: draft.speechPlanId,
        versionHistory: [
          {
            version,
            timestamp: new Date().toISOString(),
            changeSummary: `Speech plan v${version} — ${platform} ${textAnalysis.language}`,
            source: AudioGenerationSource.Prompt,
          },
        ],
        relationshipLinks: [
          ...draft.relationships.products,
          ...draft.relationships.scripts,
          ...draft.relationships.voices,
        ],
        healthStatus: AudioGenerationHealthLevel.Good,
      });

      if (!generationValidation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: generationValidation.issues,
          message: "Audio generation foundation validation failed for speech plan",
        };
      }

      this.records.upsert(draft);
      this.registerGenerationAssets(draft);

      this.logger.log("info", "blueprint-generation", "Speech plan generated", {
        speechPlanId: draft.speechPlanId,
        platform,
        productionReady,
        durationMs: Date.now() - start,
      });
      this.logger.log("info", "text-analysis", "Text analyzed", {
        speechPlanId: draft.speechPlanId,
        wordCount: textAnalysis.wordCount,
        language: textAnalysis.language,
      });
      this.logger.log("info", "pronunciation-planning", "Pronunciation planned", {
        speechPlanId: draft.speechPlanId,
        dictionaryEntries: Object.keys(pronunciationPlan.pronunciationDictionary).length,
      });
      this.logger.log("info", "emotion-planning", "Emotion planned", {
        speechPlanId: draft.speechPlanId,
        primaryEmotion: emotionPlan.primaryEmotion,
      });

      if (recommendations.length > 0) {
        this.logger.log("info", "recommendation", "Speech recommendations", {
          speechPlanId: draft.speechPlanId,
          recommendations,
        });
      }

      return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: TextToSpeechSearchQuery): TextToSpeechGenerationRecord[] {
    let results = this.records.getAll();

    if (query.speechPlanId) results = results.filter((r) => r.speechPlanId === query.speechPlanId);
    if (query.scriptId) results = results.filter((r) => r.profile.scriptId === query.scriptId);
    if (query.productId) results = results.filter((r) => r.relationships.products.includes(query.productId!));
    if (query.brandId) results = results.filter((r) => r.profile.brandId === query.brandId);
    if (query.voiceProfileId) results = results.filter((r) => r.profile.voiceProfileId === query.voiceProfileId);
    if (query.language) results = results.filter((r) => r.profile.language === query.language);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.textAnalysis.keywords.some((k) => k.includes(kw)) ||
          r.voicePlan.voiceDescription.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.speechPlanId.toLowerCase().includes(textLower) ||
          r.profile.scriptId.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async resolveContext(input: TextToSpeechGenerationInput) {
    const bridge = this.foundation.integration;
    const productFoundation = bridge.getProductIntelligenceFoundation();

    if (input.productId && productFoundation) {
      const analysis = productFoundation.getProductAnalysisEngine().getProduct(input.productId);
      const understanding = productFoundation.getProductUnderstandingEngine().getUnderstanding(input.productId);
      const creativeRecords = productFoundation.getCreativeDirectionEngine().getCreativeDirectionsByProduct(input.productId);
      const creative = creativeRecords[0] ?? null;
      const strategy = creative
        ? productFoundation.getMarketingStrategyIntelligenceEngine().getStrategy(creative.strategyId)
        : null;

      if (analysis || understanding) {
        return this.analyzer.extractContextFromProduct(
          input.productId,
          analysis?.profile.productName ?? understanding?.identity.productName ?? input.productId,
          analysis?.profile.brand ?? understanding?.identity.brand ?? input.brandName ?? "Brand",
          understanding,
          creative,
          strategy,
          input
        );
      }
    }

    if (input.text || input.script || input.subtitleContent || input.brandGuidelines) {
      return this.analyzer.extractContextFromInput(input);
    }

    return null;
  }

  private registerGenerationAssets(record: TextToSpeechGenerationRecord): void {
    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.profile.scriptId,
      assetType: AudioGenerationAssetType.Prompt,
      assetName: `Script ${record.profile.platform} v${record.profile.version}`,
      projectId: record.profile.projectId,
      voiceId: record.profile.voiceProfileId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.Prompt),
      qualityScore: record.scores.pronunciationScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.scripts, ...record.relationships.products],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
    });

    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.profile.voiceProfileId,
      assetType: AudioGenerationAssetType.Voice,
      assetName: `Voice Profile ${record.profile.language} v${record.profile.version}`,
      projectId: record.profile.projectId,
      voiceId: record.profile.voiceProfileId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.Voice),
      qualityScore: record.scores.emotionScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.voices, record.speechPlanId],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
    });

    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.speechPlanId,
      assetType: AudioGenerationAssetType.Narration,
      assetName: `Speech Plan ${record.profile.platform} v${record.profile.version}`,
      projectId: record.profile.projectId,
      voiceId: record.profile.voiceProfileId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.Prompt),
      qualityScore: record.scores.productionReadinessScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [record.profile.scriptId, record.profile.voiceProfileId],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
    });
  }

  private applySafeRepairs(
    textAnalysis: { wordCount: number; properNames: string[] },
    pronunciationPlan: { pronunciationDictionary: Record<string, string>; namePronunciations: Record<string, string> },
    emotionPlan: { emotionalArc: string[]; sceneEmotionNotes: string[] },
    naturalnessPlan: { pauses: string[]; breathPlanning: string[] },
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("word count")) && textAnalysis.wordCount < 3) {
      textAnalysis.wordCount = 10;
      repairs.push("Default word count applied");
    }
    if (diagnostics.some((d) => d.includes("Pronunciation dictionary"))) {
      for (const name of textAnalysis.properNames) {
        pronunciationPlan.pronunciationDictionary[name] = `${name} [default pronunciation]`;
        pronunciationPlan.namePronunciations[name] = `${name} [default pronunciation]`;
      }
      repairs.push("Default pronunciation entries applied");
    }
    if (diagnostics.some((d) => d.includes("Emotion plan"))) {
      if (emotionPlan.emotionalArc.length < 2) {
        emotionPlan.emotionalArc.push("Body: balanced professional delivery", "Closing: clear summary");
        repairs.push("Default emotion arc applied");
      }
    }
    if (diagnostics.some((d) => d.includes("pause planning"))) {
      if (naturalnessPlan.pauses.length < 2) {
        naturalnessPlan.pauses.push("Comma pause: 200ms", "Period pause: 400ms");
        naturalnessPlan.breathPlanning.push("Breath pause every 2 sentences");
        repairs.push("Default pause planning applied");
      }
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): TextToSpeechGenerationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
