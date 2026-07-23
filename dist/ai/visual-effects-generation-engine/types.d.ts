/**
 * KWIZERA AI STUDIO — Visual Effects Generation Engine types (Step 8G)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export declare enum VisualEffectPlanType {
    Lighting = "lighting",
    Atmospheric = "atmospheric",
    Product = "product",
    Environment = "environment",
    Transition = "transition",
    TextGraphic = "text-graphic",
    Color = "color",
    Combined = "combined"
}
export interface VisualEffectPlanProfile {
    visualEffectPlanId: string;
    sceneId: string;
    storyboardId: string;
    projectId: string;
    productId: string;
    brandId: string;
    platform: StoryboardGenerationPlatform;
    effectVersion: number;
    animationPlanId: string;
    motionPlanId: string;
    cameraPlanId: string;
}
export interface LightingEffectsPlan {
    glow: string;
    lightRays: string;
    lensFlare: string;
    bloom: string;
    reflection: string;
    refraction: string;
    rimLight: string;
    volumetricLighting: string;
}
export interface AtmosphericEffectsPlan {
    fog: string;
    mist: string;
    rain: string;
    snow: string;
    smoke: string;
    fire: string;
    dust: string;
    clouds: string;
    particles: string;
}
export interface ProductEffectsPlan {
    productGlow: string;
    productHighlight: string;
    productOutline: string;
    shine: string;
    reflection: string;
    floatingEffects: string;
    premiumReveal: string;
}
export interface EnvironmentEffectsPlan {
    water: string;
    fire: string;
    wind: string;
    lightning: string;
    sand: string;
    leaves: string;
    ambientMotion: string;
}
export interface TransitionEffectsPlan {
    fade: string;
    flash: string;
    morph: string;
    zoom: string;
    blur: string;
    motionBlur: string;
    dissolve: string;
    customEffects: string;
}
export interface TextGraphicEffectsPlan {
    textGlow: string;
    textShadow: string;
    textReveal: string;
    animatedBorders: string;
    graphicHighlights: string;
    logoEffects: string;
}
export interface ColorEffectsPlan {
    colorGrading: string;
    cinematicLutPlanning: string;
    hdrPreparation: string;
    contrastEnhancement: string;
    saturationPlanning: string;
    toneMapping: string;
}
export interface CinematicEffectsPlan {
    depthOfField: string;
    filmGrain: string;
    vignette: string;
    chromaticAberration: string;
    anamorphicFlare: string;
}
export interface EffectSynchronization {
    motionSync: string[];
    cameraSync: string[];
    audioSync: string[];
    sceneTimingSync: string[];
    animationSync: string[];
    transitionSync: string[];
}
export interface PlatformVisualEffectsOptimization {
    platform: StoryboardGenerationPlatform;
    effectIntensity: string;
    renderComplexity: string;
    notes: string[];
}
export interface VisualEffectsGenerationScores {
    visualEffectsScore: number;
    cinematicScore: number;
    synchronizationScore: number;
    brandConsistencyScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface VisualEffectsGenerationRelationships {
    storyboards: string[];
    scenes: string[];
    cameraPlans: string[];
    motionPlans: string[];
    animationPlans: string[];
    stylePlans: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    knowledgeRecords: string[];
}
export interface VisualEffectsGenerationInput {
    sceneId?: string;
    storyboardId?: string;
    animationPlanId?: string;
    motionPlanId?: string;
    cameraPlanId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    stylePlanId?: string;
    knowledgeRecordIds?: string[];
    platform?: StoryboardGenerationPlatform;
}
export interface VisualEffectsGenerationRecord {
    visualEffectPlanId: string;
    profile: VisualEffectPlanProfile;
    planType: VisualEffectPlanType;
    lightingEffects: LightingEffectsPlan;
    atmosphericEffects: AtmosphericEffectsPlan;
    productEffects: ProductEffectsPlan;
    environmentEffects: EnvironmentEffectsPlan;
    transitionEffects: TransitionEffectsPlan;
    textGraphicEffects: TextGraphicEffectsPlan;
    colorEffects: ColorEffectsPlan;
    cinematicEffects: CinematicEffectsPlan;
    synchronization: EffectSynchronization;
    platformOptimizations: PlatformVisualEffectsOptimization[];
    scores: VisualEffectsGenerationScores;
    relationships: VisualEffectsGenerationRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    cinematicallyConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface VisualEffectsGenerationResult {
    success: boolean;
    plans?: VisualEffectsGenerationRecord[];
    record?: VisualEffectsGenerationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface VisualEffectsGenerationSearchQuery {
    visualEffectPlanId?: string;
    sceneId?: string;
    storyboardId?: string;
    planType?: VisualEffectPlanType;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: StoryboardGenerationPlatform;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface VisualEffectsGenerationEngineStatusReport {
    engineStatus: string;
    planningStatus: string;
    synchronizationStatus: string;
    cinematicStatus: string;
    visualEffectPlansGenerated: number;
    averageVisualEffectsScore: number;
    averageProductionReadinessScore: number;
    performance: {
        averagePlanningMs: number;
        averageSearchMs: number;
        averageSyncMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class VisualEffectsGenerationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const VFX_PLATFORM_TARGETS: StoryboardGenerationPlatform[];
export declare const PLATFORM_VFX_CONFIG: Record<StoryboardGenerationPlatform, {
    effectIntensity: string;
    renderComplexity: string;
}>;
//# sourceMappingURL=types.d.ts.map