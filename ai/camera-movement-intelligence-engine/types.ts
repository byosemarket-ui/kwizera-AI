/**
 * KWIZERA AI STUDIO — Camera Movement Intelligence Engine types (Step 7F)
 */

export enum CameraMovementType {
  Static = "static",
  Pan = "pan",
  Tilt = "tilt",
  ZoomIn = "zoom-in",
  ZoomOut = "zoom-out",
  DollyIn = "dolly-in",
  DollyOut = "dolly-out",
  TruckLeft = "truck-left",
  TruckRight = "truck-right",
  PedestalUp = "pedestal-up",
  PedestalDown = "pedestal-down",
  Crane = "crane",
  Orbit = "orbit",
  Handheld = "handheld",
  Gimbal = "gimbal",
  Drone = "drone",
  TrackingShot = "tracking-shot",
  FollowShot = "follow-shot",
  PushIn = "push-in",
  PullOut = "pull-out",
}

export enum CameraAngle {
  EyeLevel = "eye-level",
  LowAngle = "low-angle",
  HighAngle = "high-angle",
  BirdsEye = "birds-eye",
  WormsEye = "worms-eye",
  Overhead = "overhead",
  SideView = "side-view",
  FrontView = "front-view",
  RearView = "rear-view",
  DutchAngle = "dutch-angle",
}

export enum ShotFraming {
  ExtremeWideShot = "extreme-wide-shot",
  WideShot = "wide-shot",
  FullShot = "full-shot",
  MediumShot = "medium-shot",
  MediumCloseUp = "medium-close-up",
  CloseUp = "close-up",
  ExtremeCloseUp = "extreme-close-up",
  HeroShot = "hero-shot",
}

export enum CameraStabilityLevel {
  Stable = "stable",
  SlightShake = "slight-shake",
  HeavyShake = "heavy-shake",
}

export enum CinematicPurpose {
  ProductShowcase = "product-showcase",
  EmotionalImpact = "emotional-impact",
  Storytelling = "storytelling",
  MarketingFocus = "marketing-focus",
  AudienceAttention = "audience-attention",
  CtaFocus = "cta-focus",
}

export interface ShotCameraAnalysis {
  shotId: string;
  sceneId: string;
  startMs: number;
  endMs: number;
  movement: CameraMovementType;
  angle: CameraAngle;
  framing: ShotFraming;
  stability: CameraStabilityLevel;
  motionSmoothness: number;
  stabilizationQuality: number;
  cinematicPurpose: CinematicPurpose;
  confidence: number;
}

export interface CameraTransitionAnalysis {
  transitionId: string;
  fromShotId: string;
  toShotId: string;
  movementChange: string;
  continuityScore: number;
}

export interface CameraMovementPlan {
  recommendedPath: string;
  recommendedMovement: CameraMovementType;
  cinematicStyle: string;
  motionContinuity: number;
  sceneTransitionNotes: string[];
  cameraSynchronization: string;
}

export interface CameraQualityScores {
  cameraMovementScore: number;
  cinematicScore: number;
  stabilityScore: number;
  storytellingScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface CameraRecommendation {
  category: "movement" | "angle" | "framing" | "stability" | "cinematic" | "production";
  suggestion: string;
  priority: "low" | "medium" | "high";
  reason: string;
}

export interface CameraRelationships {
  relatedScenes: string[];
  relatedShots: string[];
  relatedTimelines: string[];
  relatedStoryboards: string[];
  relatedScripts: string[];
  relatedProducts: string[];
  relatedBrands: string[];
  relatedCampaigns: string[];
  relatedKnowledge: string[];
  relatedVideos: string[];
  relatedMemory: string[];
  relatedProjects: string[];
}

export interface CameraMovementInput {
  videoId: string;
  projectId?: string;
  relatedStoryboards?: string[];
  relatedScripts?: string[];
  relatedKnowledge?: string[];
  relatedProjects?: string[];
}

export interface CameraMovementRecord {
  videoId: string;
  intelligenceId: string;
  analysisId: string;
  detectionId: string;
  timelineId?: string;
  shotAnalyses: ShotCameraAnalysis[];
  transitions: CameraTransitionAnalysis[];
  dominantMovement: CameraMovementType;
  dominantAngle: CameraAngle;
  dominantFraming: ShotFraming;
  overallStability: CameraStabilityLevel;
  motionSmoothness: number;
  stabilizationQuality: number;
  cinematicPurposes: CinematicPurpose[];
  movementPlan: CameraMovementPlan;
  scores: CameraQualityScores;
  relationships: CameraRelationships;
  recommendations: CameraRecommendation[];
  detectedMovements: CameraMovementType[];
  keywords: string[];
  validated: boolean;
  analyzedAt: string;
  lastUpdated: string;
  version: number;
}

export interface CameraMovementResult {
  success: boolean;
  record?: CameraMovementRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface CameraMovementSearchQuery {
  videoId?: string;
  movement?: CameraMovementType;
  angle?: CameraAngle;
  framing?: ShotFraming;
  sceneId?: string;
  shotId?: string;
  product?: string;
  brand?: string;
  campaign?: string;
  keywords?: string[];
  text?: string;
  limit?: number;
}

export interface CameraMovementEngineStatusReport {
  engineStatus: string;
  movementAnalysisStatus: string;
  angleDetectionStatus: string;
  framingAnalysisStatus: string;
  stabilityAnalysisStatus: string;
  cinematicPlanningStatus: string;
  relationshipStatus: string;
  knowledgeBridgeStatus: string;
  memoryBridgeStatus: string;
  productIntelligenceBridgeStatus: string;
  imageIntelligenceBridgeStatus: string;
  videosProcessed: number;
  totalShotsAnalyzed: number;
  averageCameraMovementScore: number;
  averageStabilityScore: number;
  performance: {
    averageAnalysisMs: number;
    averageSearchMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class CameraMovementEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "CameraMovementEngineError";
  }
}
