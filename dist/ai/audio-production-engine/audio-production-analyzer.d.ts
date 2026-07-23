import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AssetValidationEntry, AudioProductionInput, AudioProductionPlatform, AudioProductionProfile, DeliveryInstructions, DependencyValidationEntry, ExportPreparationPlan, PlatformProductionRules, ProductionStructure, RecoveryPlan, RenderPreparationPlan, TrackValidationEntry, WorkflowValidationEntry } from "./types.js";
export interface AudioProductionContext {
    productId?: string;
    productName?: string;
    brandName?: string;
    brandId?: string;
    projectId?: string;
    campaignId?: string;
    industry?: string;
    audioPlanId?: string;
    mixingPlanId?: string;
    masteringPlanId?: string;
    productionPrompt?: string;
    creative?: CreativeDirectionRecord | null;
    strategy?: MarketingStrategyRecord | null;
    understanding?: ProductUnderstandingRecord | null;
}
export declare class AudioProductionAnalyzer {
    buildProfile(input: AudioProductionInput, platform: AudioProductionPlatform, version: number, context: AudioProductionContext): AudioProductionProfile;
    resolveAudioPlanId(input: AudioProductionInput, context: AudioProductionContext): string | null;
    buildWorkflowValidation(foundation: AiAudioGenerationFoundation): WorkflowValidationEntry[];
    buildAssetValidation(context: AudioProductionContext, input: AudioProductionInput): AssetValidationEntry[];
    buildTrackValidation(structure: ProductionStructure): TrackValidationEntry[];
    buildDependencyValidation(foundation: AiAudioGenerationFoundation): DependencyValidationEntry[];
    buildProductionStructure(profile: AudioProductionProfile, context: AudioProductionContext): ProductionStructure;
    buildRenderPreparation(profile: AudioProductionProfile): RenderPreparationPlan;
    buildExportPreparation(input: AudioProductionInput): ExportPreparationPlan;
    buildDeliveryInstructions(profile: AudioProductionProfile): DeliveryInstructions;
    buildRecoveryPlan(profile: AudioProductionProfile, context: AudioProductionContext): RecoveryPlan;
    buildPlatformRules(input: AudioProductionInput, profile: AudioProductionProfile): PlatformProductionRules;
    buildRecommendations(context: AudioProductionContext, profile: AudioProductionProfile): string[];
    resolvePlatform(input: AudioProductionInput, context: AudioProductionContext): AudioProductionPlatform;
    extractContextFromInput(input: AudioProductionInput): AudioProductionContext;
    extractContextFromProduct(productId: string, productName: string, brandName: string, understanding?: ProductUnderstandingRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, input?: AudioProductionInput): AudioProductionContext;
    private resolveAssetId;
    private resolveAssetSource;
}
//# sourceMappingURL=audio-production-analyzer.d.ts.map