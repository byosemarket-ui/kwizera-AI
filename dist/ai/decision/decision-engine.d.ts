import type { AiCoreManager } from "../core/ai-core-manager.js";
import { DecisionHistoryStore } from "./decision-history-store.js";
import { DecisionLogger } from "./decision-logger.js";
import { DecisionPriorityManager } from "./decision-priority-manager.js";
import { DecisionValidator } from "./decision-validator.js";
import { QualityEvaluator } from "./quality-evaluator.js";
import { SolutionGenerator } from "./solution-generator.js";
import { SolutionScorer } from "./solution-scorer.js";
import { StubKnowledgeSearchProvider } from "./providers/knowledge-search-provider.js";
import { StubMemorySearchProvider } from "./providers/memory-search-provider.js";
import { DecisionEngineStatusReport, DecisionRequest, DecisionResult } from "./types.js";
import type { AiReasoningEngine } from "../reasoning/reasoning-engine.js";
import type { AiPlanningEngine } from "../planning/planning-engine.js";
export interface AiDecisionEngineOptions {
    storageRoot: string;
    memoryProvider?: StubMemorySearchProvider;
    knowledgeProvider?: StubKnowledgeSearchProvider;
}
/**
 * KWIZERA AI Decision Engine — central intelligent decision authority.
 * Step 2B: No AI models. No business module implementations.
 */
export declare class AiDecisionEngine {
    readonly logger: DecisionLogger;
    readonly history: DecisionHistoryStore;
    readonly priorityManager: DecisionPriorityManager;
    readonly qualityEvaluator: QualityEvaluator;
    readonly solutionGenerator: SolutionGenerator;
    readonly solutionScorer: SolutionScorer;
    readonly validator: DecisionValidator;
    private readonly memoryProvider;
    private readonly knowledgeProvider;
    private readonly storageRoot;
    private readonly decisionDurations;
    private initialized;
    private core;
    private reasoningEngine;
    private planningEngine;
    constructor(options: AiDecisionEngineOptions);
    initialize(core: AiCoreManager): void;
    isInitialized(): boolean;
    setReasoningEngine(engine: AiReasoningEngine): void;
    setPlanningEngine(engine: AiPlanningEngine): void;
    /**
     * Execute the 12-step decision process. No important work should run before this completes.
     */
    decide(request: DecisionRequest): Promise<DecisionResult>;
    buildStatusReport(): DecisionEngineStatusReport;
    private buildIncompleteResult;
    private createRecord;
}
//# sourceMappingURL=decision-engine.d.ts.map