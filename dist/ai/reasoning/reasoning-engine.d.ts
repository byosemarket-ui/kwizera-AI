import type { AiCoreManager } from "../core/ai-core-manager.js";
import { StubKnowledgeSearchProvider } from "../decision/providers/knowledge-search-provider.js";
import { StubMemorySearchProvider } from "../decision/providers/memory-search-provider.js";
import { ApproachComparator } from "./approach-comparator.js";
import { ApproachGenerator } from "./approach-generator.js";
import { ConfidenceCalculator } from "./confidence-calculator.js";
import { ContextAnalyzer } from "./context-analyzer.js";
import { ErrorAnalyzer } from "./error-analyzer.js";
import { MissingInformationDetector } from "./missing-information-detector.js";
import { ReasoningHistoryStore } from "./reasoning-history-store.js";
import { ReasoningLogger } from "./reasoning-logger.js";
import { RiskEvaluator } from "./risk-evaluator.js";
import { ErrorAnalysisInput, ErrorAnalysisResult, ReasoningEngineStatusReport, ReasoningRequest, ReasoningResult } from "./types.js";
export interface AiReasoningEngineOptions {
    storageRoot: string;
    memoryProvider?: StubMemorySearchProvider;
    knowledgeProvider?: StubKnowledgeSearchProvider;
}
/**
 * KWIZERA AI Reasoning Engine — analysis and explanation before decisions.
 * Step 2C: No AI models. No business module implementations.
 */
export declare class AiReasoningEngine {
    readonly logger: ReasoningLogger;
    readonly history: ReasoningHistoryStore;
    readonly contextAnalyzer: ContextAnalyzer;
    readonly approachGenerator: ApproachGenerator;
    readonly approachComparator: ApproachComparator;
    readonly confidenceCalculator: ConfidenceCalculator;
    readonly riskEvaluator: RiskEvaluator;
    readonly missingDetector: MissingInformationDetector;
    readonly errorAnalyzer: ErrorAnalyzer;
    private readonly memoryProvider;
    private readonly knowledgeProvider;
    private readonly storageRoot;
    private readonly reasoningDurations;
    private initialized;
    private core;
    constructor(options: AiReasoningEngineOptions);
    initialize(core: AiCoreManager): void;
    isInitialized(): boolean;
    /**
     * Execute the 12-step reasoning process.
     */
    reason(request: ReasoningRequest): Promise<ReasoningResult>;
    analyzeError(input: ErrorAnalysisInput): ErrorAnalysisResult;
    buildStatusReport(): ReasoningEngineStatusReport;
    private buildImprovements;
    private buildResult;
}
//# sourceMappingURL=reasoning-engine.d.ts.map