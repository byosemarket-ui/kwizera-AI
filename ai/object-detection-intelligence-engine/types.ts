/**
 * KWIZERA AI STUDIO — Object Detection Intelligence Engine types (Step 6D)
 */

export enum DetectedObjectType {
  Product = "product",
  Logo = "logo",
  Text = "text",
  Icon = "icon",
  Person = "person",
  Animal = "animal",
  Vehicle = "vehicle",
  Building = "building",
  Furniture = "furniture",
  Food = "food",
  Clothing = "clothing",
  Electronics = "electronics",
  BackgroundObject = "background-object",
  DecorativeElement = "decorative-element",
}

export enum ObjectPosition {
  Center = "center",
  TopLeft = "top-left",
  TopRight = "top-right",
  BottomLeft = "bottom-left",
  BottomRight = "bottom-right",
  FullFrame = "full-frame",
}

export enum ObjectOrientation {
  Horizontal = "horizontal",
  Vertical = "vertical",
  Diagonal = "diagonal",
  Unknown = "unknown",
}

export interface BoundingRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  objectId: string;
  objectType: DetectedObjectType;
  objectName: string;
  boundingRegion: BoundingRegion;
  estimatedSize: string;
  position: ObjectPosition;
  visibility: number;
  orientation: ObjectOrientation;
  confidenceScore: number;
  relatedObjectIds: string[];
}

export interface ProductDetection {
  mainProduct: string | null;
  secondaryProducts: string[];
  productVisibility: number;
  productPosition: ObjectPosition;
  productImportance: string;
  productGrouping: string;
  productPresentation: string;
}

export interface TextDetection {
  textPresent: boolean;
  textRegions: BoundingRegion[];
  textOrientation: ObjectOrientation;
  textSize: string;
  textImportance: string;
  detectedTextLabels: string[];
}

export interface LogoDetection {
  logoPresent: boolean;
  logoPosition: ObjectPosition;
  logoVisibility: number;
  logoSize: string;
  brandAssociation: string;
  logoRegions: BoundingRegion[];
}

export interface ObjectDetectionScores {
  objectDetectionScore: number;
  productVisibilityScore: number;
  sceneOrganizationScore: number;
  brandVisibilityScore: number;
  creativeReadinessScore: number;
  aiConfidenceScore: number;
}

export interface ObjectDetectionRelationships {
  relatedProducts: string[];
  relatedBrands: string[];
  relatedScenes: string[];
  relatedBackgrounds: string[];
  relatedCreativeStyles: string[];
  relatedMarketingCampaigns: string[];
  relatedKnowledge: string[];
  relatedImages: string[];
  relatedProjects: string[];
}

export interface ObjectDetectionRecommendation {
  category: "placement" | "visibility" | "branding" | "composition" | "product" | "creative";
  suggestion: string;
  priority: "low" | "medium" | "high";
  reason: string;
}

export interface ObjectDetectionInput {
  imageId: string;
  objectHints?: Partial<DetectedObject>[];
  relatedProjects?: string[];
  relatedKnowledge?: string[];
  keywords?: string[];
}

export interface ObjectDetectionRecord {
  imageId: string;
  detectionId: string;
  analysisId: string;
  understandingId: string;
  objects: DetectedObject[];
  productDetection: ProductDetection;
  textDetection: TextDetection;
  logoDetection: LogoDetection;
  scores: ObjectDetectionScores;
  relationships: ObjectDetectionRelationships;
  recommendations: ObjectDetectionRecommendation[];
  keywords: string[];
  validated: boolean;
  detectedAt: string;
  lastUpdated: string;
  version: number;
}

export interface ObjectDetectionResult {
  success: boolean;
  record?: ObjectDetectionRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface ObjectDetectionSearchQuery {
  objectType?: DetectedObjectType;
  product?: string;
  brand?: string;
  category?: string;
  imageId?: string;
  project?: string;
  campaign?: string;
  keywords?: string[];
  text?: string;
  limit?: number;
}

export interface ObjectDetectionEngineStatusReport {
  engineStatus: string;
  objectDetectionStatus: string;
  productDetectionStatus: string;
  logoDetectionStatus: string;
  relationshipStatus: string;
  knowledgeBridgeStatus: string;
  memoryBridgeStatus: string;
  productIntelligenceBridgeStatus: string;
  imagesDetected: number;
  totalObjectsDetected: number;
  averageDetectionScore: number;
  averageConfidenceScore: number;
  performance: {
    averageDetectionMs: number;
    averageSearchMs: number;
    averageRelationshipMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class ObjectDetectionEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ObjectDetectionEngineError";
  }
}
