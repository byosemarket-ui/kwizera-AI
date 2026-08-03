export interface MarketingIntelligenceProfile {
    id: string;
    projectId: string;
    productOverview: string;
    audience: {
        persona: string;
        needs: string[];
        messaging: string;
    };
    brand: {
        identity: string;
        voice: string;
        consistency: string;
    };
    campaign: {
        name: string;
        objective: string;
        goal: string;
    };
    sellingPoints: string[];
    valueProposition: string;
    strategy: string;
    ctas: string[];
    platform: {
        name: string;
        format: string;
        recommendations: string[];
    };
    competitors: string[];
    recommendations: string[];
    score: number;
    performancePrediction: string;
    metadata: Record<string, string | number>;
    createdAt: string;
    updatedAt: string;
    cached: boolean;
}
export interface MarketingIntelligenceStore {
    profiles: MarketingIntelligenceProfile[];
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