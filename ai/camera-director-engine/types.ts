/**
 * KWIZERA AI STUDIO — Camera Director Engine types (Step 8D)
 */

import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";

export enum DirectorShotType {
  Establishing = "establishing-shot",
  Hero = "hero-shot",
  Wide = "wide-shot",
  Medium = "medium-shot",
  CloseUp = "close-up",
  ExtremeCloseUp = "extreme-close-up",
  Detail = "detail-shot",
  OverTheShoulder = "over-the-shoulder",
  PointOfView = "point-of-view",
  Tracking = "tracking-shot",
}

export enum DirectorCameraAngle {
  EyeLevel = "eye-level",
  HighAngle = "high-angle",
  LowAngle = "low-angle",
  BirdsEye = "birds-eye",
  WormsEye = "worms-eye",
  DutchAngle = "dutch-angle",
  Front = "front",
  Side = "side",
  Rear = "rear",
}

export enum DirectorCameraMovement {
  Static = "static",
  Pan = "pan",
  Tilt = "tilt",
  Zoom = "zoom",
  Dolly = "dolly",
  Truck = "truck",
  Pedestal = "pedestal",
  Crane = "crane",
  Orbit = "orbit",
  Follow = "follow",
  PushIn = "push-in",
  PullOut = "pull-out",
  HandheldStyle = "handheld-style",
  GimbalStyle = "gimbal-style",
  DroneStyle = "drone-style",
}

export enum CompositionStrategy {
  RuleOfThirds = "rule-of-thirds",
  LeadingLines = "leading-lines",
  CenterComposition = "center-composition",
  Symmetry = "symmetry",
  NegativeSpace = "negative-space",
  ProductHighlight = "product-highlight",
  BrandVisibility = "brand-visibility",
}

export interface CameraPlanProfile {
  cameraPlanId: string;
  sceneId: string;
  storyboardId: string;
  projectId: string;
  brandId: string;
  platform: StoryboardGenerationPlatform;
  cameraVersion: number;
}

export interface DirectorShotPlan {
  shotId: string;
  shotOrder: number;
  shotType: DirectorShotType;
  cameraAngle: DirectorCameraAngle;
  cameraMovement: DirectorCameraMovement;
  framing: string;
  duration: string;
  marketingPurpose: string;
}

export interface FocusPlanning {
  focusSubject: string;
  focusTransition: string;
  depthOfField: string;
  rackFocus: string;
  subjectPriority: string;
}

export interface CompositionPlanning {
  primaryStrategy: CompositionStrategy;
  ruleOfThirds: string;
  leadingLines: string;
  centerComposition: string;
  symmetry: string;
  negativeSpace: string;
  productHighlight: string;
  brandVisibility: string;
}

export interface ContinuityPlanning {
  cameraConsistency: boolean;
  sceneContinuity: boolean;
  motionContinuity: boolean;
  lightingContinuity: boolean;
  storyContinuity: boolean;
  notes: string[];
  issues: string[];
}

export interface PlatformCameraOptimization {
  platform: StoryboardGenerationPlatform;
  aspectRatio: string;
  movementGuidance: string;
  angleGuidance: string;
  framingNotes: string[];
}

export interface CameraDirectorScores {
  cameraDirectionScore: number;
  cinematicScore: number;
  compositionScore: number;
  storytellingScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface CameraDirectorRelationships {
  storyboards: string[];
  scenes: string[];
  motionPlans: string[];
  stylePlans: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  knowledgeRecords: string[];
}

export interface CameraDirectorInput {
  sceneId?: string;
  storyboardId?: string;
  productId?: string;
  brandId?: string;
  campaignId?: string;
  motionPlanId?: string;
  stylePlanId?: string;
  knowledgeRecordIds?: string[];
  platform?: StoryboardGenerationPlatform;
}

export interface CameraDirectorRecord {
  cameraPlanId: string;
  profile: CameraPlanProfile;
  shotPlans: DirectorShotPlan[];
  focusPlanning: FocusPlanning;
  compositionPlanning: CompositionPlanning;
  continuity: ContinuityPlanning;
  platformOptimizations: PlatformCameraOptimization[];
  marketingImpact: {
    heroMoment: string;
    productRevealAngle: string;
    brandVisibilityZone: string;
    conversionFraming: string;
  };
  scores: CameraDirectorScores;
  relationships: CameraDirectorRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  brandConsistent: boolean;
  cinematicallyConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface CameraDirectorResult {
  success: boolean;
  plans?: CameraDirectorRecord[];
  record?: CameraDirectorRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface CameraDirectorSearchQuery {
  cameraPlanId?: string;
  sceneId?: string;
  storyboardId?: string;
  cameraAngle?: DirectorCameraAngle;
  shotType?: DirectorShotType;
  brandId?: string;
  productId?: string;
  campaignId?: string;
  platform?: StoryboardGenerationPlatform;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface CameraDirectorEngineStatusReport {
  engineStatus: string;
  planningStatus: string;
  compositionStatus: string;
  continuityStatus: string;
  cameraPlansGenerated: number;
  averageCameraDirectionScore: number;
  averageProductionReadinessScore: number;
  performance: {
    averagePlanningMs: number;
    averageSearchMs: number;
    averageCompositionMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class CameraDirectorEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "CameraDirectorEngineError";
  }
}

export const CAMERA_PLATFORM_TARGETS: StoryboardGenerationPlatform[] = [
  StoryboardGenerationPlatform.TikTok,
  StoryboardGenerationPlatform.InstagramReels,
  StoryboardGenerationPlatform.Facebook,
  StoryboardGenerationPlatform.YouTubeShorts,
  StoryboardGenerationPlatform.YouTubeLongForm,
  StoryboardGenerationPlatform.Website,
  StoryboardGenerationPlatform.Television,
];

export const PLATFORM_CAMERA_CONFIG: Record<
  StoryboardGenerationPlatform,
  { aspectRatio: string; movementStyle: string; anglePreference: string }
> = {
  [StoryboardGenerationPlatform.TikTok]: { aspectRatio: "9:16", movementStyle: "gimbal-style", anglePreference: "eye-level" },
  [StoryboardGenerationPlatform.InstagramReels]: { aspectRatio: "9:16", movementStyle: "gimbal-style", anglePreference: "low-angle" },
  [StoryboardGenerationPlatform.Facebook]: { aspectRatio: "1:1", movementStyle: "static", anglePreference: "eye-level" },
  [StoryboardGenerationPlatform.YouTubeShorts]: { aspectRatio: "9:16", movementStyle: "push-in", anglePreference: "eye-level" },
  [StoryboardGenerationPlatform.YouTubeLongForm]: { aspectRatio: "16:9", movementStyle: "dolly", anglePreference: "eye-level" },
  [StoryboardGenerationPlatform.WhatsApp]: { aspectRatio: "9:16", movementStyle: "handheld-style", anglePreference: "eye-level" },
  [StoryboardGenerationPlatform.Website]: { aspectRatio: "16:9", movementStyle: "crane", anglePreference: "eye-level" },
  [StoryboardGenerationPlatform.Television]: { aspectRatio: "16:9", movementStyle: "crane", anglePreference: "eye-level" },
};

export function mapSceneShotToDirectorShot(shotType: string, purpose: string): DirectorShotType {
  if (purpose === "opening-hook") return DirectorShotType.Establishing;
  if (purpose === "product-showcase") return DirectorShotType.Hero;
  if (purpose === "call-to-action") return DirectorShotType.CloseUp;
  if (shotType === "wide") return DirectorShotType.Wide;
  if (shotType === "close-up" || shotType === "extreme-close-up") return DirectorShotType.CloseUp;
  if (shotType === "over-the-shoulder") return DirectorShotType.OverTheShoulder;
  if (shotType === "pov") return DirectorShotType.PointOfView;
  if (shotType === "medium") return DirectorShotType.Medium;
  return DirectorShotType.Medium;
}

export function mapSceneAngleToDirector(angle: string): DirectorCameraAngle {
  const map: Record<string, DirectorCameraAngle> = {
    "eye-level": DirectorCameraAngle.EyeLevel,
    "low-angle": DirectorCameraAngle.LowAngle,
    "high-angle": DirectorCameraAngle.HighAngle,
    dutch: DirectorCameraAngle.DutchAngle,
    "bird-eye": DirectorCameraAngle.BirdsEye,
    "worm-eye": DirectorCameraAngle.WormsEye,
  };
  return map[angle] ?? DirectorCameraAngle.EyeLevel;
}

export function mapSceneMovementToDirector(movement: string): DirectorCameraMovement {
  const map: Record<string, DirectorCameraMovement> = {
    static: DirectorCameraMovement.Static,
    pan: DirectorCameraMovement.Pan,
    tilt: DirectorCameraMovement.Tilt,
    dolly: DirectorCameraMovement.Dolly,
    tracking: DirectorCameraMovement.Follow,
    crane: DirectorCameraMovement.Crane,
    handheld: DirectorCameraMovement.HandheldStyle,
    zoom: DirectorCameraMovement.Zoom,
  };
  return map[movement] ?? DirectorCameraMovement.Static;
}
