import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
import { VideoQualityValidationLogger } from "./video-quality-validation-logger.js";
import { QualityValidationRecordStore } from "./video-quality-validation-stores.js";
import { QualityValidationInput, QualityValidationRecord, QualityValidationResult, QualityValidationSearchQuery, VideoQualityValidationEngineStatusReport } from "./types.js";
/**
 * AI Video Quality Validation Engine — validates every production component
 * before rendering begins, guaranteeing quality, consistency and platform readiness.
 */
export declare class AiVideoQualityValidationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VideoQualityValidationLogger;
    readonly records: QualityValidationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private validationTimes;
    private searchTimes;
    private repairTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    validateVideoQuality(input: QualityValidationInput): Promise<QualityValidationResult>;
    getValidationRecord(validationId: string): QualityValidationRecord | null;
    getValidationsByStoryboard(storyboardId: string): QualityValidationRecord[];
    searchValidations(query: QualityValidationSearchQuery): QualityValidationRecord[];
    repairValidation(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<QualityValidationResult | null>;
    buildStatusReport(): VideoQualityValidationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=video-quality-validation-engine.d.ts.map