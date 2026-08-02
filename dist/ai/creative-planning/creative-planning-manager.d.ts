import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, ValidationResult } from "../creative-workspace/creative-workspace-manager.js";
export interface PlanScene {
    id: string;
    order: number;
    durationSeconds: number;
    purpose: string;
    visual: string;
    narration: string;
    camera: string;
    lighting: string;
    composition: string;
    animation: string;
}
export interface CreativePlan {
    id: string;
    projectId: string;
    createdAt: string;
    modifiedAt: string;
    version: number;
    analyses: {
        product: string;
        brand: string;
        campaign: string;
        audience: string;
        platform: string;
        language: string;
    };
    creativeBrief: string;
    marketingStrategy: string;
    creativeStrategy: string;
    storyboard: string;
    script: string;
    scenes: PlanScene[];
    cameraPlan: string;
    lightingPlan: string;
    colourStyle: string;
    compositionGuide: string;
    animationPlan: string;
    prompts: {
        image: string;
        video: string;
        audio: string;
    };
    workflow: string[];
}
export interface PlanResult {
    plan?: CreativePlan;
    validation: ValidationResult;
}
/**
 * Step 2 planning only: it creates editable production direction, never media,
 * rendering, encoding, export, or calls to generation foundations.
 */
export declare class CreativePlanningManager {
    private root;
    private core;
    initialize(storageRoot: string, core?: AiCoreManager): Promise<void>;
    getPlan(projectId: string): Promise<CreativePlan | null>;
    createPlan(project: CreativeProject, validation: ValidationResult): Promise<PlanResult>;
    updatePlan(projectId: string, changes: Partial<Omit<CreativePlan, "id" | "projectId" | "createdAt" | "modifiedAt" | "version">>): Promise<CreativePlan>;
    getIntegrationStatus(): Record<string, boolean>;
    private buildPlan;
    private transition;
    private readJson;
    private writeJson;
    private ensureInitialized;
    private planPath;
}
//# sourceMappingURL=creative-planning-manager.d.ts.map