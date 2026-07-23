/**
 * KWIZERA AI STUDIO — Animation Generation Engine types (Step 8F)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export declare enum AnimationPlanType {
    Character = "character",
    Product = "product",
    Object = "object",
    Text = "text",
    Logo = "logo",
    Environment = "environment",
    Transition = "transition",
    Combined = "combined"
}
export interface AnimationPlanProfile {
    animationPlanId: string;
    sceneId: string;
    storyboardId: string;
    projectId: string;
    productId: string;
    brandId: string;
    platform: StoryboardGenerationPlatform;
    animationVersion: number;
    motionPlanId: string;
    cameraPlanId: string;
}
export interface CharacterAnimationPlan {
    idle: string;
    walk: string;
    run: string;
    jump: string;
    gesture: string;
    facialAnimation: string;
    lipMovementPlan: string;
    eyeMovement: string;
    handMovement: string;
}
export interface ProductAnimationPlan {
    rotation: string;
    scale: string;
    reveal: string;
    showcase: string;
    highlight: string;
    floating: string;
    assembly: string;
    explodedView: string;
}
export interface ObjectAnimationPlan {
    movement: string;
    rotation: string;
    physicsMotion: string;
    interaction: string;
    environmentalAnimation: string;
}
export interface TextAnimationPlan {
    fade: string;
    slide: string;
    scale: string;
    typewriter: string;
    bounce: string;
    pop: string;
    reveal: string;
    kineticTypography: string;
}
export interface LogoAnimationPlan {
    logoReveal: string;
    logoRotation: string;
    logoGlow: string;
    logoScale: string;
    logoTransition: string;
}
export interface EnvironmentAnimationPlan {
    rain: string;
    snow: string;
    wind: string;
    smoke: string;
    fire: string;
    water: string;
    dust: string;
    particles: string;
    lightRays: string;
}
export interface TransitionAnimationPlan {
    fade: string;
    cut: string;
    dissolve: string;
    wipe: string;
    zoom: string;
    morph: string;
    motionBlur: string;
    customTransition: string;
}
export interface AnimationTimeline {
    animationStart: string;
    animationEnd: string;
    animationDuration: string;
    easing: string;
    synchronization: string;
    layerPriority: string[];
}
export interface AnimationSynchronization {
    motionSync: string[];
    cameraSync: string[];
    audioSync: string[];
    transitionSync: string[];
}
export interface PlatformAnimationOptimization {
    platform: StoryboardGenerationPlatform;
    pacingStyle: string;
    animationIntensity: string;
    notes: string[];
}
export interface AnimationGenerationScores {
    animationQualityScore: number;
    smoothnessScore: number;
    visualAppealScore: number;
    synchronizationScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface AnimationGenerationRelationships {
    storyboards: string[];
    scenes: string[];
    motionPlans: string[];
    cameraPlans: string[];
    stylePlans: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    knowledgeRecords: string[];
}
export interface AnimationGenerationInput {
    sceneId?: string;
    storyboardId?: string;
    motionPlanId?: string;
    cameraPlanId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    stylePlanId?: string;
    knowledgeRecordIds?: string[];
    platform?: StoryboardGenerationPlatform;
}
export interface AnimationGenerationRecord {
    animationPlanId: string;
    profile: AnimationPlanProfile;
    planType: AnimationPlanType;
    characterAnimation: CharacterAnimationPlan;
    productAnimation: ProductAnimationPlan;
    objectAnimation: ObjectAnimationPlan;
    textAnimation: TextAnimationPlan;
    logoAnimation: LogoAnimationPlan;
    environmentAnimation: EnvironmentAnimationPlan;
    transitionAnimation: TransitionAnimationPlan;
    timeline: AnimationTimeline;
    synchronization: AnimationSynchronization;
    platformOptimizations: PlatformAnimationOptimization[];
    scores: AnimationGenerationScores;
    relationships: AnimationGenerationRelationships;
    recommendations: string[];
    validated: boolean;
    productionReady: boolean;
    brandConsistent: boolean;
    smooth: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface AnimationGenerationResult {
    success: boolean;
    plans?: AnimationGenerationRecord[];
    record?: AnimationGenerationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface AnimationGenerationSearchQuery {
    animationPlanId?: string;
    sceneId?: string;
    storyboardId?: string;
    planType?: AnimationPlanType;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: StoryboardGenerationPlatform;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface AnimationGenerationEngineStatusReport {
    engineStatus: string;
    planningStatus: string;
    synchronizationStatus: string;
    timelineStatus: string;
    animationPlansGenerated: number;
    averageAnimationQualityScore: number;
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
export declare class AnimationGenerationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const ANIMATION_PLATFORM_TARGETS: StoryboardGenerationPlatform[];
export declare const PLATFORM_ANIMATION_CONFIG: Record<StoryboardGenerationPlatform, {
    pacingStyle: string;
    animationIntensity: string;
}>;
//# sourceMappingURL=types.d.ts.map