export type LearningOutcome = "success" | "failure" | "feedback";
export interface LearningExperience {
    id: string;
    projectId: string;
    outcome: LearningOutcome;
    title: string;
    lesson: string;
    qualityScore: number;
    workflowEfficiency: number;
    recommendations: string[];
    preferences: string[];
    createdAt: string;
}
export interface LearningProfile {
    id: string;
    projectId: string;
    progress: number;
    knowledgeGrowth: number;
    improvements: string[];
    recommendationHistory: string[];
    userPreferences: string[];
    evolution: string[];
    createdAt: string;
    updatedAt: string;
    cached: boolean;
}
export interface LearningStore {
    experiences: LearningExperience[];
    profiles: LearningProfile[];
    history: Array<{
        id: string;
        at: string;
        projectId: string;
        event: string;
        detail: string;
    }>;
    cache: Record<string, string>;
    logs: Array<{
        at: string;
        level: "info" | "warning" | "error";
        message: string;
    }>;
}
//# sourceMappingURL=types.d.ts.map