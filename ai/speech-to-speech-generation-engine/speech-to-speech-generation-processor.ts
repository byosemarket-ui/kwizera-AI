import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAssetType,
  AudioGenerationHealthLevel,
  AudioGenerationSource,
  AudioGenerationVerificationStatus,
} from "../audio-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../audio-generation-foundation/audio-generation-asset-registry.js";
import { SpeechToSpeechGenerationAnalyzer } from "./speech-to-speech-generation-analyzer.js";
import { SpeechToSpeechGenerationLinker } from "./speech-to-speech-generation-linker.js";
import { SpeechToSpeechGenerationLogger } from "./speech-to-speech-generation-logger.js";
import { SpeechToSpeechGenerationScorer } from "./speech-to-speech-generation-scorer.js";
import { SpeechToSpeechGenerationRecordStore } from "./speech-to-speech-generation-stores.js";
import {
  SpeechToSpeechGenerationInput,
  SpeechToSpeechGenerationRecord,
  SpeechToSpeechGenerationResult,
  SpeechToSpeechSearchQuery,
} from "./types.js";

export class SpeechToSpeechGenerationProcessor {
  constructor(
    private readonly foundation: AiAudioGenerationFoundation,
    private readonly analyzer: SpeechToSpeechGenerationAnalyzer,
    private readonly scorer: SpeechToSpeechGenerationScorer,
    private readonly linker: SpeechToSpeechGenerationLinker,
    private readonly records: SpeechToSpeechGenerationRecordStore,
    private readonly logger: SpeechToSpeechGenerationLogger
  ) {}

  async generateTransformationPlan(input: SpeechToSpeechGenerationInput): Promise<SpeechToSpeechGenerationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const context = await this.resolveContext(input);
      if (!context) {
        return this.reject(start, "Unable to resolve transformation context — provide productId or source audio", [
          "Product intelligence pipeline or source audio reference required",
        ]);
      }

      const platform = this.analyzer.resolvePlatform(input, context);
      const existing = input.productId
        ? this.records.getByProduct(input.productId).find((r) => r.profile.platform === platform)
        : undefined;
      const version = existing ? existing.profile.version + 1 : 1;

      const speechAnalysis = this.analyzer.analyzeSpeech(input, context);
      const profile = this.analyzer.buildProfile(input, platform, version, context, speechAnalysis);
      const voiceTransformation = this.analyzer.buildVoiceTransformation(input, context, speechAnalysis);
      const emotionPreservation = this.analyzer.buildEmotionPreservation(input, speechAnalysis);
      const pronunciationAdaptation = this.analyzer.buildPronunciationAdaptation(speechAnalysis, context);
      const timingPreservation = this.analyzer.buildTimingPreservation(speechAnalysis);
      const platformOptimizations = this.analyzer.buildPlatformOptimizations(profile, input);
      const productionInstructions = this.analyzer.buildProductionInstructions(
        profile,
        timingPreservation,
        voiceTransformation
      );
      const recommendations = this.analyzer.buildRecommendations(speechAnalysis, emotionPreservation, context);

      const scores = this.scorer.computeScores(
        speechAnalysis,
        voiceTransformation,
        emotionPreservation,
        pronunciationAdaptation,
        timingPreservation,
        platformOptimizations,
        context
      );

      const validation = this.scorer.isTransformationValid(scores, {
        speechAnalysis,
        voiceTransformation,
        emotionPreservation,
        timingPreservation,
      });

      if (!validation.valid) {
        const repaired = this.applySafeRepairs(
          speechAnalysis,
          voiceTransformation,
          emotionPreservation,
          pronunciationAdaptation,
          timingPreservation,
          validation.diagnostics
        );
        if (repaired.repaired) {
          this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
        }
        const revalidation = this.scorer.isTransformationValid(scores, {
          speechAnalysis,
          voiceTransformation,
          emotionPreservation,
          timingPreservation,
        });
        if (!revalidation.valid) {
          this.logger.log("warn", "validation", "Speech transformation plan rejected", {
            diagnostics: revalidation.diagnostics,
          });
          return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: revalidation.diagnostics,
            message: "Speech transformation validation failed — all validations must pass before approval",
          };
        }
      }

      const productionReady = this.scorer.isProductionReady(scores, {
        transformationId: profile.transformationId,
        profile,
        speechAnalysis,
        voiceTransformation,
        emotionPreservation,
        pronunciationAdaptation,
        timingPreservation,
        platformOptimizations,
        productionInstructions,
        scores,
        relationships: {
          sourceAudio: [],
          targetVoices: [],
          voiceProfiles: [],
          products: [],
          brands: [],
          campaigns: [],
          videos: [],
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
      const brandConsistent = this.scorer.isBrandConsistent(context, voiceTransformation);

      const blueprint = this.foundation.getBlueprintManager().createBlueprint({
        blueprintId: `blueprint-${profile.transformationId}`,
        projectId: profile.projectId,
        name: `Speech-to-Speech ${profile.language} ${platform}`,
      });

      const draft: SpeechToSpeechGenerationRecord = {
        transformationId: profile.transformationId,
        profile,
        speechAnalysis,
        voiceTransformation,
        emotionPreservation,
        pronunciationAdaptation,
        timingPreservation,
        platformOptimizations,
        productionInstructions,
        blueprintId: blueprint.blueprintId,
        scores,
        relationships: {
          sourceAudio: [profile.sourceAudioId],
          targetVoices: [profile.targetVoiceId],
          voiceProfiles: [profile.sourceVoiceId, profile.targetVoiceId],
          products: [],
          brands: [],
          campaigns: [],
          videos: [],
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
        qualityScore: scores.transformationQualityScore,
        confidenceScore: scores.aiConfidenceScore,
        verificationStatus:
          scores.aiConfidenceScore >= 75
            ? AudioGenerationVerificationStatus.Verified
            : AudioGenerationVerificationStatus.Pending,
        source: AudioGenerationSource.Voice,
        sourceRef: draft.transformationId,
        versionHistory: [
          {
            version,
            timestamp: new Date().toISOString(),
            changeSummary: `Speech transformation v${version} — ${platform} ${speechAnalysis.language}`,
            source: AudioGenerationSource.Voice,
          },
        ],
        relationshipLinks: [
          ...draft.relationships.products,
          ...draft.relationships.sourceAudio,
          ...draft.relationships.targetVoices,
        ],
        healthStatus: AudioGenerationHealthLevel.Good,
      });

      if (!generationValidation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: generationValidation.issues,
          message: "Audio generation foundation validation failed for speech transformation plan",
        };
      }

      this.records.upsert(draft);
      this.registerGenerationAssets(draft);

      this.logger.log("info", "blueprint-generation", "Speech transformation plan generated", {
        transformationId: draft.transformationId,
        platform,
        productionReady,
        durationMs: Date.now() - start,
      });
      this.logger.log("info", "speech-analysis", "Speech analyzed", {
        transformationId: draft.transformationId,
        segments: speechAnalysis.speakerSegments.length,
        language: speechAnalysis.language,
      });
      this.logger.log("info", "voice-transformation", "Voice transformation planned", {
        transformationId: draft.transformationId,
        source: voiceTransformation.sourceVoiceType,
        target: voiceTransformation.targetVoiceType,
      });
      this.logger.log("info", "emotion-planning", "Emotion preservation planned", {
        transformationId: draft.transformationId,
        preservationScore: emotionPreservation.preservationScore,
      });

      if (recommendations.length > 0) {
        this.logger.log("info", "recommendation", "Transformation recommendations", {
          transformationId: draft.transformationId,
          recommendations,
        });
      }

      return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: SpeechToSpeechSearchQuery): SpeechToSpeechGenerationRecord[] {
    let results = this.records.getAll();

    if (query.transformationId) results = results.filter((r) => r.transformationId === query.transformationId);
    if (query.sourceAudioId) results = results.filter((r) => r.profile.sourceAudioId === query.sourceAudioId);
    if (query.sourceVoiceId) results = results.filter((r) => r.profile.sourceVoiceId === query.sourceVoiceId);
    if (query.targetVoiceId) results = results.filter((r) => r.profile.targetVoiceId === query.targetVoiceId);
    if (query.productId) results = results.filter((r) => r.relationships.products.includes(query.productId!));
    if (query.brandId) results = results.filter((r) => r.profile.brandId === query.brandId);
    if (query.language) results = results.filter((r) => r.profile.language === query.language);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.speechAnalysis.keywords.some((k) => k.includes(kw)) ||
          r.voiceTransformation.brandVoiceAlignment.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.transformationId.toLowerCase().includes(textLower) ||
          r.profile.sourceAudioId.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async resolveContext(input: SpeechToSpeechGenerationInput) {
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

    if (input.sourceAudioId || input.sourceAudioRef || input.transcriptHint || input.brandGuidelines) {
      return this.analyzer.extractContextFromInput(input);
    }

    return null;
  }

  private registerGenerationAssets(record: SpeechToSpeechGenerationRecord): void {
    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.profile.sourceAudioId,
      assetType: AudioGenerationAssetType.AudioTrack,
      assetName: `Source Audio ${record.profile.platform} v${record.profile.version}`,
      projectId: record.profile.projectId,
      trackId: record.profile.sourceAudioId,
      voiceId: record.profile.sourceVoiceId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.Voice),
      qualityScore: record.scores.transformationQualityScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.sourceAudio, ...record.relationships.products],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
    });

    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.profile.targetVoiceId,
      assetType: AudioGenerationAssetType.Voice,
      assetName: `Target Voice ${record.profile.language} v${record.profile.version}`,
      projectId: record.profile.projectId,
      voiceId: record.profile.targetVoiceId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.Voice),
      qualityScore: record.scores.emotionPreservationScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.targetVoices, record.transformationId],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
    });

    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.transformationId,
      assetType: AudioGenerationAssetType.Narration,
      assetName: `Speech Transformation ${record.profile.platform} v${record.profile.version}`,
      projectId: record.profile.projectId,
      voiceId: record.profile.targetVoiceId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.Voice),
      qualityScore: record.scores.productionReadinessScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [record.profile.sourceAudioId, record.profile.targetVoiceId],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
    });
  }

  private applySafeRepairs(
    speechAnalysis: { speakerSegments: unknown[]; properNames: string[] },
    voiceTransformation: { voiceMapping: Record<string, string> },
    emotionPreservation: { emotionalArc: string[] },
    pronunciationAdaptation: { pronunciationDictionary: Record<string, string>; namePreservation: Record<string, string> },
    timingPreservation: { segmentTiming: unknown[]; naturalPauses: string[]; breathPlanning: string[] },
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("speaker segments")) && speechAnalysis.speakerSegments.length < 1) {
      (speechAnalysis as { speakerSegments: unknown[] }).speakerSegments = [
        { segmentId: "seg-1", startMs: 0, endMs: 5000 },
      ];
      repairs.push("Default speaker segment applied");
    }
    if (diagnostics.some((d) => d.includes("Voice transformation"))) {
      if (Object.keys(voiceTransformation.voiceMapping).length < 1) {
        voiceTransformation.voiceMapping = { narrator: "professional" };
        repairs.push("Default voice mapping applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Emotion preservation"))) {
      if (emotionPreservation.emotionalArc.length < 1) {
        emotionPreservation.emotionalArc.push("Preserve source emotion through transformation");
        repairs.push("Default emotion arc applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Pronunciation dictionary"))) {
      for (const name of speechAnalysis.properNames) {
        pronunciationAdaptation.pronunciationDictionary[name] = `${name} [default pronunciation]`;
        pronunciationAdaptation.namePreservation[name] = `${name} [default pronunciation]`;
      }
      repairs.push("Default pronunciation entries applied");
    }
    if (diagnostics.some((d) => d.includes("Timing preservation"))) {
      if (timingPreservation.segmentTiming.length < 1) {
        (timingPreservation as { segmentTiming: unknown[] }).segmentTiming = [
          { segmentId: "seg-1", startMs: 0, endMs: 5000 },
        ];
        timingPreservation.naturalPauses.push("Period pause: 400ms");
        timingPreservation.breathPlanning.push("Breath pause at segment boundary");
        repairs.push("Default timing preservation applied");
      }
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): SpeechToSpeechGenerationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
