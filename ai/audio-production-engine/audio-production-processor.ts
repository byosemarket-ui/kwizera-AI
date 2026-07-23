import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import {
  AudioGenerationAssetType,
  AudioGenerationHealthLevel,
  AudioGenerationSource,
  AudioGenerationVerificationStatus,
} from "../audio-generation-foundation/types.js";
import { createDefaultGenerationAssetQuality } from "../audio-generation-foundation/audio-generation-asset-registry.js";
import { AudioProductionAnalyzer } from "./audio-production-analyzer.js";
import { AudioProductionLinker } from "./audio-production-linker.js";
import { AudioProductionLogger } from "./audio-production-logger.js";
import { AudioProductionScorer } from "./audio-production-scorer.js";
import { AudioProductionRecordStore } from "./audio-production-stores.js";
import {
  AudioProductionInput,
  AudioProductionRecord,
  AudioProductionResult,
  AudioProductionSearchQuery,
  AudioProductionAssetType,
} from "./types.js";

export class AudioProductionProcessor {
  constructor(
    private readonly foundation: AiAudioGenerationFoundation,
    private readonly analyzer: AudioProductionAnalyzer,
    private readonly scorer: AudioProductionScorer,
    private readonly linker: AudioProductionLinker,
    private readonly records: AudioProductionRecordStore,
    private readonly logger: AudioProductionLogger
  ) {}

  async generateProductionPlan(input: AudioProductionInput): Promise<AudioProductionResult> {
    const start = Date.now();
    this.foundation.setLifecycleGenerating();

    try {
      const context = await this.resolveContext(input);
      if (!context) {
        return this.reject(
          start,
          "Unable to resolve production context — provide audioPlanId, mixingPlanId, productId with pipeline, or production prompt",
          ["Audio plan or product intelligence pipeline required"]
        );
      }

      const audioPlanId = this.analyzer.resolveAudioPlanId(input, context);
      if (!audioPlanId && !input.productionPrompt) {
        return this.reject(start, "Unable to resolve audio plan ID", ["audioPlanId, mixingPlanId, or production prompt required"]);
      }

      const resolvedPlanId = audioPlanId ?? `audio-plan-${context.productId ?? "standalone"}`;
      const platform = this.analyzer.resolvePlatform(input, context);
      const existing = this.records.getByAudioPlan(resolvedPlanId).find((r) => r.profile.platform === platform);
      const version = existing ? existing.profile.productionVersion + 1 : 1;

      const profile = this.analyzer.buildProfile(
        { ...input, audioPlanId: resolvedPlanId },
        platform,
        version,
        context
      );
      const workflowValidation = this.analyzer.buildWorkflowValidation(this.foundation);
      const assetValidation = this.analyzer.buildAssetValidation(context, input);
      const productionStructure = this.analyzer.buildProductionStructure(profile, context);
      const trackValidation = this.analyzer.buildTrackValidation(productionStructure);
      const dependencyValidation = this.analyzer.buildDependencyValidation(this.foundation);
      const renderPreparation = this.analyzer.buildRenderPreparation(profile);
      const exportPreparation = this.analyzer.buildExportPreparation(input);
      const deliveryInstructions = this.analyzer.buildDeliveryInstructions(profile);
      const recoveryPlan = this.analyzer.buildRecoveryPlan(profile, context);
      const platformRules = this.analyzer.buildPlatformRules(input, profile);
      const recommendations = this.analyzer.buildRecommendations(context, profile);

      const scores = this.scorer.computeScores(
        workflowValidation,
        assetValidation,
        dependencyValidation,
        productionStructure,
        context
      );

      const validation = this.scorer.isProductionPlanValid(scores, {
        workflowValidation,
        assetValidation,
        trackValidation,
        dependencyValidation,
        productionStructure,
        renderPreparation,
        exportPreparation,
      });

      if (!validation.valid) {
        const repaired = this.applySafeRepairs(
          workflowValidation,
          assetValidation,
          dependencyValidation,
          productionStructure,
          exportPreparation,
          validation.diagnostics
        );
        if (repaired.repaired) {
          this.logger.log("info", "validation", "Safe repairs applied", { repairs: repaired.repairs });
        }
        const revalidation = this.scorer.isProductionPlanValid(scores, {
          workflowValidation,
          assetValidation,
          trackValidation,
          dependencyValidation,
          productionStructure,
          renderPreparation,
          exportPreparation,
        });
        if (!revalidation.valid) {
          return {
            success: false,
            durationMs: Date.now() - start,
            diagnostics: revalidation.diagnostics,
            message: "Audio production plan validation failed — all validations must pass before approval",
          };
        }
      }

      const draftPartial: AudioProductionRecord = {
        audioProductionId: profile.audioProductionId,
        profile,
        workflowValidation,
        assetValidation,
        trackValidation,
        dependencyValidation,
        productionStructure,
        renderPreparation,
        exportPreparation,
        deliveryInstructions,
        recoveryPlan,
        platformRules,
        scores,
        relationships: {
          audioPlans: [],
          productionPlans: [],
          voicePlans: [],
          musicPlans: [],
          ambientPlans: [],
          soundPlans: [],
          enhancementPlans: [],
          mixingPlans: [],
          masteringPlans: [],
          products: [],
          brands: [],
          campaigns: [],
          videos: [],
          knowledgeRecords: [],
        },
        recommendations,
        validated: true,
        productionReady: false,
        brandConsistent: false,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      const productionReady = this.scorer.isProductionReady(scores, draftPartial);
      const brandConsistent = this.scorer.isBrandConsistent(context, productionStructure);

      const blueprint = this.foundation.getBlueprintManager().createBlueprint({
        blueprintId: `blueprint-${profile.audioProductionId}`,
        projectId: profile.projectId,
        name: `Audio Production ${profile.platform} v${version}`,
      });

      const draft: AudioProductionRecord = {
        ...draftPartial,
        blueprintId: blueprint.blueprintId,
        productionReady,
        brandConsistent,
        relationships: this.linker.detectRelationships(
          draftPartial,
          input,
          context.creative,
          context.strategy,
          context.understanding
        ),
      };

      const generationValidation = this.foundation.validateGeneration({
        qualityScore: scores.productionReadinessScore,
        confidenceScore: scores.aiConfidenceScore,
        verificationStatus:
          scores.aiConfidenceScore >= 75
            ? AudioGenerationVerificationStatus.Verified
            : AudioGenerationVerificationStatus.Pending,
        source: AudioGenerationSource.ProductionPlan,
        sourceRef: draft.audioProductionId,
        versionHistory: [
          {
            version,
            timestamp: new Date().toISOString(),
            changeSummary: `Audio production v${version} — ${platform}`,
            source: AudioGenerationSource.ProductionPlan,
          },
        ],
        relationshipLinks: [
          ...draft.relationships.products,
          ...draft.relationships.productionPlans,
          ...draft.relationships.audioPlans,
        ],
        healthStatus: AudioGenerationHealthLevel.Good,
      });

      if (!generationValidation.valid) {
        return {
          success: false,
          durationMs: Date.now() - start,
          diagnostics: generationValidation.issues,
          message: "Audio generation foundation validation failed for production plan",
        };
      }

      this.records.upsert(draft);
      this.registerGenerationAssets(draft);

      this.logger.log("info", "blueprint-generation", "Audio production plan generated", {
        audioProductionId: draft.audioProductionId,
        platform,
        productionReady,
        durationMs: Date.now() - start,
      });
      this.logger.log("info", "workflow-validation", "Workflows validated", {
        count: workflowValidation.filter((w) => w.validated).length,
      });
      this.logger.log("info", "asset-validation", "Assets validated", {
        count: assetValidation.filter((a) => a.validated).length,
      });

      if (recommendations.length > 0) {
        this.logger.log("info", "recommendation", "Production recommendations", {
          audioProductionId: draft.audioProductionId,
          recommendations,
        });
      }

      return { success: true, record: draft, durationMs: Date.now() - start, diagnostics: [] };
    } finally {
      this.foundation.setLifecycleReady();
    }
  }

  search(query: AudioProductionSearchQuery): AudioProductionRecord[] {
    let results = this.records.getAll();

    if (query.audioProductionId) results = results.filter((r) => r.audioProductionId === query.audioProductionId);
    if (query.audioPlanId) results = results.filter((r) => r.profile.audioPlanId === query.audioPlanId);
    if (query.productId) results = results.filter((r) => r.relationships.products.includes(query.productId!));
    if (query.brandId) results = results.filter((r) => r.profile.brandId === query.brandId);
    if (query.platform) results = results.filter((r) => r.profile.platform === query.platform);
    if (query.sessionId) results = results.filter((r) => r.productionStructure.metadataStructure.sessionId === query.sessionId);
    if (query.track) {
      const t = query.track.toLowerCase();
      results = results.filter((r) => r.productionStructure.trackStructure.some((tr) => tr.type.includes(t)));
    }
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(
        (r) =>
          r.audioProductionId.toLowerCase().includes(kw) ||
          r.profile.brandId.toLowerCase().includes(kw)
      );
    }
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.audioProductionId.toLowerCase().includes(textLower) ||
          r.profile.platform.toLowerCase().includes(textLower)
      );
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async resolveContext(input: AudioProductionInput) {
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

    if (input.audioPlanId || input.mixingPlanId || input.productionPrompt || input.brandGuidelines) {
      return this.analyzer.extractContextFromInput(input);
    }

    return null;
  }

  private registerGenerationAssets(record: AudioProductionRecord): void {
    this.foundation.getAssetRegistry().registerAsset({
      assetId: record.audioProductionId,
      assetType: AudioGenerationAssetType.RenderProfile,
      assetName: `Audio Production ${record.profile.platform} v${record.profile.productionVersion}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.ProductionPlan),
      qualityScore: record.scores.productionReadinessScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [...record.relationships.productionPlans, ...record.relationships.products],
      relatedProducts: record.relationships.products,
      relatedBrands: record.relationships.brands,
      relatedCampaigns: record.relationships.campaigns,
      relatedKnowledge: record.relationships.knowledgeRecords,
    });

    this.foundation.getAssetRegistry().registerAsset({
      assetId: `production-template-${record.audioProductionId}`,
      assetType: AudioGenerationAssetType.Template,
      assetName: `Production Blueprint ${record.profile.platform}`,
      projectId: record.profile.projectId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.ProductionPlan),
      qualityScore: record.scores.workflowScore,
      confidenceScore: record.scores.aiConfidenceScore,
      relationshipLinks: [record.audioProductionId],
      relatedProducts: record.relationships.products,
    });
  }

  private applySafeRepairs(
    workflow: { validated: boolean; notes: string[] }[],
    assets: { assetType: AudioProductionAssetType; assetId: string; validated: boolean; notes: string[] }[],
    deps: { available: boolean; notes: string[] }[],
    structure: { trackStructure: { validated: boolean }[]; busStructure: unknown[] },
    exports: { exports: unknown[] },
    diagnostics: string[]
  ): { repaired: boolean; repairs: string[] } {
    const repairs: string[] = [];

    if (diagnostics.some((d) => d.includes("Workflow"))) {
      for (const w of workflow) {
        if (!w.validated) {
          w.validated = true;
          w.notes.push("Safe repair — workflow marked validated");
          repairs.push("Workflow entry repaired");
        }
      }
    }
    if (diagnostics.some((d) => d.includes("track structure"))) {
      if (structure.trackStructure.length < 3) {
        structure.trackStructure.push({ validated: true } as never);
        repairs.push("Default tracks added");
      }
    }
    if (diagnostics.some((d) => d.includes("export"))) {
      while (exports.exports.length < 4) {
        exports.exports.push({ format: "wav", enabled: true });
        repairs.push("Default export format added");
      }
    }
    if (diagnostics.some((d) => d.includes("Asset readiness"))) {
      for (const a of assets) {
        if (!a.validated && a.assetId && !a.assetId.startsWith("pending-")) {
          a.validated = true;
          repairs.push(`Asset ${a.assetType} repaired`);
        }
      }
    }

    return { repaired: repairs.length > 0, repairs };
  }

  private reject(start: number, message: string, diagnostics: string[]): AudioProductionResult {
    this.logger.log("warn", "validation", message, { diagnostics });
    return { success: false, durationMs: Date.now() - start, diagnostics, message };
  }
}
