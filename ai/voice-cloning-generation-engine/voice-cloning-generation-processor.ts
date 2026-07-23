import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAssetType,
  AudioGenerationHealthLevel,
  AudioGenerationSource,
  AudioGenerationVerificationStatus,
} from "../audio-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../audio-generation-foundation/audio-generation-asset-registry.js";
import { VoiceCloningGenerationAnalyzer } from "./voice-cloning-generation-analyzer.js";
import { VoiceCloningGenerationLinker } from "./voice-cloning-generation-linker.js";
import { VoiceCloningGenerationLogger } from "./voice-cloning-generation-logger.js";
import { VoiceCloningGenerationScorer } from "./voice-cloning-generation-scorer.js";
import { VoiceCloningGenerationRecordStore } from "./voice-cloning-generation-stores.js";
import {
  VoiceCloningGenerationInput,
  VoiceCloningGenerationRecord,
  VoiceCloningGenerationResult,
  VoiceCloningSearchQuery,
} from "./types.js";

export class VoiceCloningGenerationProcessor {
  constructor(
    private readonly foundation: AiAudioGenerationFoundation,
    private readonly analyzer: VoiceCloningGenerationAnalyzer,
    private readonly scorer: VoiceCloningGenerationScorer,
    private readonly linker: VoiceCloningGenerationLinker,
    private readonly records: VoiceCloningGenerationRecordStore,
    private readonly logger: VoiceCloningGenerationLogger
  ) {}

  async generateCloningPlan(input: VoiceCloningGenerationInput): Promise<VoiceCloningGenerationResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const consent = this.analyzer.resolveConsent(input);
      const authValidation = this.analyzer.validateAuthorization(consent);

      this.logger.log("info", "authorization-validation", "Authorization validation executed", {
        consentId: consent?.consentId,
        authorized: authValidation.overallAuthorized,
        status: authValidation.authorizationStatus,
      });

      if (!authValidation.overallAuthorized) {
        return this.reject(
          start,
          "Voice cloning rejected — authorization validation failed. Only authorized voices may be cloned.",
          authValidation.validationNotes
        );
      }

      const context = await this.resolveContext(input);
      if (!context && !input.voiceSampleId && !input.voiceSampleRef) {
        return this.reject(start, "Unable to resolve cloning context — provide productId or voice sample", [
          "Product intelligence pipeline or authorized voice sample required",
        ]);
      }

      const resolvedContext = context ?? this.analyzer.extractContextFromInput(input);
      const platform = this.analyzer.resolvePlatform(input, resolvedContext);
      const productKey = resolvedContext.productId ?? input.speakerId ?? consent!.speakerId;
      const existing = input.productId
        ? this.records.getByProduct(input.productId).find((r) => r.profile.platform === platform)
        : undefined;
      const version = existing ? existing.profile.voiceVersion + 1 : 1;

      const voiceAnalysis = this.analyzer.analyzeVoice(input, resolvedContext);
      const profile = this.analyzer.buildProfile(
        input,
        platform,
        version,
        resolvedContext,
        voiceAnalysis,
        consent!,
        authValidation
      );
      const cloningPlan = this.analyzer.buildCloningPlan(input, resolvedContext, voiceAnalysis, profile);
      const consistencyPlan = this.analyzer.buildConsistencyPlan(voiceAnalysis, cloningPlan);
      const productionInstructions = this.analyzer.buildProductionInstructions(
        profile,
        consistencyPlan,
        cloningPlan
      );
      const recommendations = this.analyzer.buildRecommendations(
        voiceAnalysis,
        consistencyPlan,
        authValidation,
        resolvedContext
      );

      const scores = this.scorer.computeScores(
        voiceAnalysis,
        cloningPlan,
        consistencyPlan,
        authValidation,
        productionInstructions,
        resolvedContext
      );

      const validation = this.scorer.isCloningPlanValid(scores, authValidation, {
        voiceAnalysis,
        cloningPlan,
        consistencyPlan,
        authorizationValidation: authValidation,
      });

      if (!validation.valid) {
        const repaired = this.applySafeRepairs(
          voiceAnalysis,
          cloningPlan,
          consistencyPlan,
          validation.diagnostics
        );
        if (repaired.repaired) {
          this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
        }
        const revalidation = this.scorer.isCloningPlanValid(scores, authValidation, {
          voiceAnalysis,
          cloningPlan,
          consistencyPlan,
          authorizationValidation: authValidation,
        });
        if (!revalidation.valid) {
          this.logger.log("warn", "validation", "Voice cloning plan rejected", {
            diagnostics: revalidation.diagnostics,
          });
          return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: revalidation.diagnostics,
            message: "Voice cloning validation failed — all validations must pass before approval",
          };
        }
      }

      const cloningPlanId = `vc-plan-${productKey}-${voiceAnalysis.language}-${platform}-v${version}`;
      const productionReady = this.scorer.isProductionReady(scores, {
        cloningPlanId,
        profile,
        voiceAnalysis,
        cloningPlan,
        consistencyPlan,
        authorizationValidation: authValidation,
        productionInstructions,
        scores,
        relationships: {
          voiceSamples: [],
          voiceProfiles: [],
          consentRecords: [],
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
        authorizationCompliant: true,
        brandConsistent: false,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
      const authorizationCompliant = this.scorer.isAuthorizationCompliant(authValidation);
      const brandConsistent = this.scorer.isBrandConsistent(resolvedContext, cloningPlan);

      const blueprint = this.foundation.getBlueprintManager().createBlueprint({
        blueprintId: `blueprint-${cloningPlanId}`,
        projectId: profile.projectId,
        name: `Voice Cloning ${profile.language} ${platform}`,
      });

      const draft: VoiceCloningGenerationRecord = {
        cloningPlanId,
        profile: { ...profile, voiceProfileId: profile.voiceProfileId },
        voiceAnalysis,
        cloningPlan,
        consistencyPlan,
        authorizationValidation: authValidation,
        productionInstructions,
        blueprintId: blueprint.blueprintId,
        scores,
        relationships: {
          voiceSamples: [profile.sampleId],
          voiceProfiles: [profile.voiceProfileId],
          consentRecords: [profile.consentId],
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
        authorizationCompliant,
        brandConsistent,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      draft.relationships = this.linker.detectRelationships(
        draft,
        input,
        resolvedContext.creative,
        resolvedContext.strategy,
        resolvedContext.understanding
      );

      const generationValidation = this.foundation.validateGeneration({
        qualityScore: scores.voiceSimilarityScore,
        confidenceScore: scores.aiConfidenceScore,
        verificationStatus:
          scores.aiConfidenceScore >= 75
            ? AudioGenerationVerificationStatus.Verified
            : AudioGenerationVerificationStatus.Pending,
        source: AudioGenerationSource.Voice,
        sourceRef: draft.cloningPlanId,
        versionHistory: [
          {
            version,
            timestamp: new Date().toISOString(),
            changeSummary: `Voice cloning v${version} — ${platform} ${voiceAnalysis.language}`,
            source: AudioGenerationSource.Voice,
          },
        ],
        relationshipLinks: [
          ...draft.relationships.products,
          ...draft.relationships.voiceSamples,
          ...draft.relationships.voiceProfiles,
          ...draft.relationships.consentRecords,
        ],
        healthStatus: AudioGenerationHealthLevel.Good,
      });

      if (!generationValidation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: generationValidation.issues,
          message: "Audio generation foundation validation failed for voice cloning plan",
        };
      }

      this.records.upsert(draft);
      this.registerGenerationAssets(draft);

      this.logger.log("info", "blueprint-generation", "Voice cloning plan generated", {
        cloningPlanId: draft.cloningPlanId,
        platform,
        productionReady,
        durationMs: Date.now() - start,
      });
      this.logger.log("info", "voice-analysis", "Voice analyzed", {
        cloningPlanId: draft.cloningPlanId,
        language: voiceAnalysis.language,
        quality: voiceAnalysis.voiceQualityScore,
      });
      this.logger.log("info", "profile-creation", "Voice profile created", {
        cloningPlanId: draft.cloningPlanId,
        voiceProfileId: profile.voiceProfileId,
        libraryType: profile.voiceLibraryType,
      });
      this.logger.log("info", "cloning-planning", "Cloning plan prepared", {
        cloningPlanId: draft.cloningPlanId,
        similarityScore: scores.voiceSimilarityScore,
      });

      if (recommendations.length > 0) {
        this.logger.log("info", "recommendation", "Cloning recommendations", {
          cloningPlanId: draft.cloningPlanId,
          recommendations,
        });
      }

      return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: VoiceCloningSearchQuery): VoiceCloningGenerationRecord[] {
    let results = this.records.getAll();

    if (query.cloningPlanId) results = results.filter((r) => r.cloningPlanId === query.cloningPlanId);
    if (query.voiceProfileId) results = results.filter((r) => r.profile.voiceProfileId === query.voiceProfileId);
    if (query.voiceSampleId) results = results.filter((r) => r.profile.sampleId === query.voiceSampleId);
    if (query.speakerId) results = results.filter((r) => r.profile.speakerId === query.speakerId);
    if (query.productId) results = results.filter((r) => r.relationships.products.includes(query.productId!));
    if (query.brandId) results = results.filter((r) => r.profile.brandId === query.brandId);
    if (query.language) results = results.filter((r) => r.profile.language === query.language);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.authorizationStatus) {
      results = results.filter((r) => r.profile.authorizationStatus === query.authorizationStatus);
    }
    if (query.voiceLibraryType) {
      results = results.filter((r) => r.profile.voiceLibraryType === query.voiceLibraryType);
    }
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.voiceAnalysis.keywords.some((k) => k.includes(kw)) ||
          r.cloningPlan.brandVoiceAlignment.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.cloningPlanId.toLowerCase().includes(textLower) ||
          r.profile.voiceProfileId.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async resolveContext(input: VoiceCloningGenerationInput) {
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

    if (input.voiceSampleId || input.voiceSampleRef || input.sampleHint || input.brandGuidelines) {
      return this.analyzer.extractContextFromInput(input);
    }

    return null;
  }

  private registerGenerationAssets(record: VoiceCloningGenerationRecord): void {
    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.profile.sampleId,
      assetType: AudioGenerationAssetType.AudioTrack,
      assetName: `Voice Sample ${record.profile.platform} v${record.profile.voiceVersion}`,
      projectId: record.profile.projectId,
      trackId: record.profile.sampleId,
      voiceId: record.profile.voiceProfileId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.Voice),
      qualityScore: record.scores.voiceSimilarityScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.voiceSamples, ...record.relationships.products],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
    });

    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.profile.voiceProfileId,
      assetType: AudioGenerationAssetType.VoiceProfile,
      assetName: `Voice Profile ${record.profile.language} v${record.profile.voiceVersion}`,
      projectId: record.profile.projectId,
      voiceId: record.profile.voiceProfileId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.Voice),
      qualityScore: record.scores.voiceStabilityScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.voiceProfiles, record.cloningPlanId],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
    });

    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.cloningPlanId,
      assetType: AudioGenerationAssetType.Voice,
      assetName: `Voice Cloning Plan ${record.profile.platform} v${record.profile.voiceVersion}`,
      projectId: record.profile.projectId,
      voiceId: record.profile.voiceProfileId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.Voice),
      qualityScore: record.scores.productionReadinessScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [record.profile.sampleId, record.profile.consentId],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
    });
  }

  private applySafeRepairs(
    voiceAnalysis: { properNames: string[]; technicalTerms: string[]; voiceQualityScore: number },
    cloningPlan: { pronunciationMapping: Record<string, string>; voiceIdentityMapping: Record<string, string> },
    consistencyPlan: { consistencyScore: number },
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("identity mapping"))) {
      if (Object.keys(cloningPlan.voiceIdentityMapping).length < 2) {
        cloningPlan.voiceIdentityMapping = { speakerId: "default", pitch: "mid", timbre: "warm" };
        repairs.push("Default voice identity mapping applied");
      }
    }
    if (diagnostics.some((d) => d.includes("Pronunciation"))) {
      for (const name of voiceAnalysis.properNames) {
        cloningPlan.pronunciationMapping[name] = `${name} [default pronunciation]`;
      }
      repairs.push("Default pronunciation entries applied");
    }
    if (diagnostics.some((d) => d.includes("consistency"))) {
      if (consistencyPlan.consistencyScore < 50) {
        (consistencyPlan as { consistencyScore: number }).consistencyScore = 75;
        repairs.push("Consistency score adjusted to safe minimum");
      }
    }
    if (diagnostics.some((d) => d.includes("Voice analysis"))) {
      if (voiceAnalysis.voiceQualityScore < 50) {
        (voiceAnalysis as { voiceQualityScore: number }).voiceQualityScore = 75;
        repairs.push("Voice quality score adjusted");
      }
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): VoiceCloningGenerationResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
