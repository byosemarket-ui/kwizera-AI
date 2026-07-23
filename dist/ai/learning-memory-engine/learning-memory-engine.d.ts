import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { LearningHistoryStore } from "./learning-history-store.js";
import { LearningMemoryLogger } from "./learning-logger.js";
import { PreferenceStore } from "./preference-store.js";
import { LearningEventInput, LearningMemoryStatusReport, LearningProcessResult, LearningRecord, SelfImprovementInsight, UserPreferences } from "./types.js";
/**
 * Learning Memory Engine — continuous learning from projects, workflows, and user feedback.
 */
export declare class AiLearningMemoryEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: LearningMemoryLogger;
    readonly history: LearningHistoryStore;
    readonly preferences: PreferenceStore;
    private readonly evaluator;
    private patterns;
    private processor;
    private selfImprovement;
    private learningTimes;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    learnFromEvent(input: LearningEventInput): Promise<LearningProcessResult>;
    learnFromUserCorrection(correction: string, context: Partial<LearningEventInput>): Promise<LearningProcessResult>;
    updateUserPreferences(partial: Partial<UserPreferences>): Promise<UserPreferences>;
    getUserPreferences(): UserPreferences;
    getLearningHistory(): ReadonlyArray<LearningRecord>;
    getSelfImprovementInsights(): SelfImprovementInsight;
    getDetectedPatterns(): string[];
    getRecommendationsForProject(projectId: string): Promise<string[]>;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    buildStatusReport(): LearningMemoryStatusReport;
    private ensureReady;
}
//# sourceMappingURL=learning-memory-engine.d.ts.map