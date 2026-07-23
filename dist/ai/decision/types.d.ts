/**
 * KWIZERA AI STUDIO — AI Decision Engine types (Step 2B)
 */
export declare enum DecisionType {
    ProductAnalysis = "product-analysis",
    ImageAnalysis = "image-analysis",
    VideoGeneration = "video-generation",
    Marketing = "marketing",
    Translation = "translation",
    Memory = "memory",
    Learning = "learning",
    Export = "export",
    Recovery = "recovery",
    General = "general"
}
export declare enum DecisionPriority {
    Critical = "critical",
    High = "high",
    Normal = "normal",
    Low = "low",
    Background = "background"
}
export declare enum DecisionStep {
    ReceiveRequest = 1,
    UnderstandGoal = 2,
    AnalyzeData = 3,
    SearchMemory = 4,
    SearchKnowledge = 5,
    DetectMissing = 6,
    GenerateSolutions = 7,
    CompareSolutions = 8,
    ScoreSolutions = 9,
    SelectBest = 10,
    ExplainInternally = 11,
    PassToWorkflow = 12
}
export declare enum DecisionStatus {
    Pending = "pending",
    InProgress = "in-progress",
    AwaitingInput = "awaiting-input",
    Validated = "validated",
    Approved = "approved",
    Rejected = "rejected",
    Failed = "failed"
}
export interface DecisionRequest {
    requestId: string;
    type: DecisionType;
    priority: DecisionPriority;
    userRequest: string;
    statedObjective?: string;
    availableData: Record<string, unknown>;
    correlationId?: string;
    requiredModules?: string[];
}
export interface MemorySearchResult {
    found: boolean;
    items: Array<{
        id: string;
        summary: string;
        relevance: number;
    }>;
    message: string;
}
export interface KnowledgeSearchResult {
    found: boolean;
    items: Array<{
        id: string;
        fact: string;
        source: string;
    }>;
    message: string;
}
export interface MissingInformationItem {
    field: string;
    severity: "critical" | "important" | "optional";
    message: string;
}
export interface CandidateSolution {
    id: string;
    label: string;
    workflowId: string;
    requiredModules: string[];
    description: string;
    estimatedQuality: number;
}
export interface ScoredSolution extends CandidateSolution {
    scores: {
        overall: number;
        goalAlignment: number;
        resourceFit: number;
        qualityPotential: number;
        risk: number;
    };
}
export interface QualityAssessment {
    sufficient: boolean;
    score: number;
    checks: Array<{
        name: string;
        passed: boolean;
        message: string;
    }>;
    recommendations: string[];
}
export interface DecisionRationale {
    summary: string;
    selectedReason: string;
    rejectedAlternatives: Array<{
        id: string;
        reason: string;
    }>;
    factorsConsidered: string[];
}
export interface WorkflowHandoff {
    workflowId: string;
    requiredModules: string[];
    executionPriority: DecisionPriority;
    objective: string;
    parameters: Record<string, unknown>;
    qualityAssessment: QualityAssessment;
}
export interface DecisionValidationResult {
    passed: boolean;
    checks: Array<{
        name: string;
        passed: boolean;
        message: string;
    }>;
    nextAction?: string;
}
export interface DecisionRecord {
    decisionId: string;
    decisionTime: string;
    decisionType: DecisionType;
    reason: string;
    selectedWorkflow: string;
    alternativeSolutions: string[];
    qualityScore: number;
    executionResult?: "pending" | "success" | "failure";
    futureLearningValue: number;
    priority: DecisionPriority;
    status: DecisionStatus;
    rationale: DecisionRationale;
    requestId: string;
}
export interface DecisionResult {
    decisionId: string;
    status: DecisionStatus;
    approved: boolean;
    canExecute: boolean;
    missingInformation: MissingInformationItem[];
    recommendations: string[];
    selectedSolution?: ScoredSolution;
    rationale?: DecisionRationale;
    workflowHandoff?: WorkflowHandoff;
    validation?: DecisionValidationResult;
    record: DecisionRecord;
    stepsCompleted: DecisionStep[];
    durationMs: number;
    reasoningResult?: import("../reasoning/types.js").ReasoningResult;
    planningResult?: import("../planning/types.js").PlanningResult;
}
export declare class DecisionEngineError extends Error {
    readonly code: string;
    readonly missingInformation?: MissingInformationItem[] | undefined;
    constructor(message: string, code: string, missingInformation?: MissingInformationItem[] | undefined);
}
export interface DecisionEngineStatusReport {
    decisionEngineStatus: string;
    decisionAccuracy: number;
    validationStatus: string;
    performance: {
        averageDecisionMs: number;
        totalDecisions: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
//# sourceMappingURL=types.d.ts.map