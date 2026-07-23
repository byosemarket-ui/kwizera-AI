/**
 * KWIZERA AI STUDIO — Ambient Audio Generation Engine types (Step 10G)
 */

export enum AmbientPlatform {
  Website = "website",
  Mobile = "mobile",
  YouTube = "youtube",
  TikTok = "tiktok",
  Instagram = "instagram",
  Facebook = "facebook",
  Television = "television",
  Radio = "radio",
}

export enum EnvironmentCategory {
  Nature = "nature",
  Urban = "urban",
  Indoor = "indoor",
  Weather = "weather",
  Mixed = "mixed",
}

export enum NatureAmbienceType {
  Forest = "forest",
  Rain = "rain",
  Wind = "wind",
  Ocean = "ocean",
  River = "river",
  Waterfall = "waterfall",
  Birds = "birds",
  Insects = "insects",
  Fire = "fire",
  Thunder = "thunder",
}

export enum UrbanAmbienceType {
  City = "city",
  Traffic = "traffic",
  Market = "market",
  Airport = "airport",
  TrainStation = "train-station",
  BusStation = "bus-station",
  Construction = "construction",
  ShoppingMall = "shopping-mall",
  Stadium = "stadium",
}

export enum IndoorAmbienceType {
  Office = "office",
  Home = "home",
  Classroom = "classroom",
  Hospital = "hospital",
  Restaurant = "restaurant",
  Hotel = "hotel",
  Church = "church",
  ConferenceRoom = "conference-room",
  Factory = "factory",
}

export enum WeatherType {
  LightRain = "light-rain",
  HeavyRain = "heavy-rain",
  Storm = "storm",
  Wind = "wind",
  Snow = "snow",
  Fog = "fog",
  Sunrise = "sunrise",
  Sunset = "sunset",
  Night = "night",
  Dawn = "dawn",
}

export enum AmbientSyncTarget {
  Video = "video",
  Animation = "animation",
  Film = "film",
  Podcast = "podcast",
  Game = "game",
  Advertisement = "advertisement",
  Presentation = "presentation",
}

export enum AmbientInputType {
  EnvironmentPrompt = "environment-prompt",
  VideoInformation = "video-information",
  ImageInformation = "image-information",
  Timeline = "timeline",
  BrandGuidelines = "brand-guidelines",
  Campaign = "campaign",
  GeographicContext = "geographic-context",
  KnowledgeRecord = "knowledge-record",
}

export interface AmbientProfile {
  ambientPlanId: string;
  projectId: string;
  brandId: string;
  campaignId?: string;
  platform: AmbientPlatform;
  environmentCategory: EnvironmentCategory;
  version: number;
}

export interface EnvironmentAnalysis {
  environmentType: string;
  location: string;
  timeOfDay: string;
  weather: string;
  season: string;
  crowdDensity: string;
  indoorOutdoor: "indoor" | "outdoor" | "mixed";
  distance: string;
  acousticSpace: string;
  intendedMood: string;
  durationSec: number;
  keywords: string[];
}

export interface AmbientSoundPlan {
  natureAmbience: NatureAmbienceType[];
  layers: Record<string, string>;
  primaryNature: string;
  secondaryLayers: string[];
}

export interface UrbanAmbiencePlan {
  urbanTypes: UrbanAmbienceType[];
  primaryUrban: string;
  layerDetails: Record<string, string>;
  densityNotes: string[];
}

export interface IndoorAmbiencePlan {
  indoorTypes: IndoorAmbienceType[];
  primaryIndoor: string;
  roomTone: string;
  activityLevel: string;
  layerDetails: Record<string, string>;
}

export interface WeatherAmbiencePlan {
  weatherTypes: WeatherType[];
  primaryWeather: string;
  intensity: string;
  weatherLayers: Record<string, string>;
  timeOfDayAlignment: string;
}

export interface SpatialAudioPlan {
  leftRightPositioning: string;
  frontBackPositioning: string;
  distance: string;
  depth: string;
  movement: string;
  surroundPreparation: string;
  binauralPreparation: string;
}

export interface AmbientTimelinePlan {
  cuePoints: { timeSec: number; label: string; layer: string }[];
  layerOrder: string[];
  fadeIn: string;
  fadeOut: string;
  crossfade: string;
  loopPlanning: string;
  dynamicIntensity: string[];
}

export interface AmbientSyncPlan {
  syncTarget: AmbientSyncTarget;
  hitPoints: string[];
  syncNotes: string[];
  platformNotes: string[];
}

export interface ProductionAmbientInstructions {
  renderNotes: string[];
  immersionGuidance: string[];
  spatialGuidance: string[];
  exportPreparation: string[];
  qualityTargets: string[];
}

export interface AmbientAudioScores {
  environmentalRealismScore: number;
  immersionScore: number;
  spatialAudioScore: number;
  synchronizationScore: number;
  brandConsistencyScore: number;
  productionReadinessScore: number;
  aiConfidenceScore: number;
}

export interface AmbientAudioRelationships {
  ambientPlans: string[];
  soundPlans: string[];
  musicPlans: string[];
  voicePlans: string[];
  products: string[];
  brands: string[];
  campaigns: string[];
  videos: string[];
  images: string[];
  knowledgeRecords: string[];
}

export interface AmbientAudioGenerationInput {
  environmentPrompt?: string;
  videoId?: string;
  videoRef?: string;
  imageId?: string;
  imageRef?: string;
  timelineRef?: string;
  geographicContext?: string;
  productId?: string;
  projectId?: string;
  campaignId?: string;
  brandId?: string;
  brandName?: string;
  brandGuidelines?: string;
  platform?: AmbientPlatform;
  environmentCategory?: EnvironmentCategory;
  syncTarget?: AmbientSyncTarget;
  durationSec?: number;
  timeOfDay?: string;
  weatherHint?: string;
  indoorOutdoor?: "indoor" | "outdoor" | "mixed";
  soundPlanIds?: string[];
  musicPlanIds?: string[];
  voicePlanIds?: string[];
  knowledgeRecordIds?: string[];
  inputTypes?: AmbientInputType[];
}

export interface AmbientAudioGenerationRecord {
  ambientPlanId: string;
  profile: AmbientProfile;
  environmentAnalysis: EnvironmentAnalysis;
  ambientSoundPlan: AmbientSoundPlan;
  urbanAmbiencePlan: UrbanAmbiencePlan;
  indoorAmbiencePlan: IndoorAmbiencePlan;
  weatherAmbiencePlan: WeatherAmbiencePlan;
  spatialAudioPlan: SpatialAudioPlan;
  timelinePlan: AmbientTimelinePlan;
  syncPreparation: AmbientSyncPlan;
  productionInstructions: ProductionAmbientInstructions;
  blueprintId?: string;
  scores: AmbientAudioScores;
  relationships: AmbientAudioRelationships;
  recommendations: string[];
  validated: boolean;
  productionReady: boolean;
  brandConsistent: boolean;
  createdAt: string;
  lastUpdated: string;
}

export interface AmbientAudioGenerationResult {
  success: boolean;
  record?: AmbientAudioGenerationRecord;
  durationMs: number;
  diagnostics: string[];
  message?: string;
}

export interface AmbientAudioSearchQuery {
  ambientPlanId?: string;
  productId?: string;
  brandId?: string;
  environmentCategory?: EnvironmentCategory;
  weather?: string;
  platform?: AmbientPlatform;
  syncTarget?: AmbientSyncTarget;
  keywords?: string;
  text?: string;
  limit?: number;
}

export interface AmbientAudioGenerationEngineStatusReport {
  engineStatus: string;
  environmentAnalysisStatus: string;
  ambientPlanningStatus: string;
  weatherPlanningStatus: string;
  spatialAudioStatus: string;
  timelinePlanningStatus: string;
  syncPreparationStatus: string;
  ambientPlansGenerated: number;
  averageEnvironmentalRealismScore: number;
  averageProductionReadinessScore: number;
  performance: {
    averageGenerationMs: number;
    averageSearchMs: number;
    averageBlueprintMs: number;
  };
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class AmbientAudioGenerationEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AmbientAudioGenerationEngineError";
  }
}

export const ALL_AMBIENT_PLATFORMS: AmbientPlatform[] = [
  AmbientPlatform.Website,
  AmbientPlatform.Mobile,
  AmbientPlatform.YouTube,
  AmbientPlatform.TikTok,
  AmbientPlatform.Instagram,
  AmbientPlatform.Facebook,
  AmbientPlatform.Television,
  AmbientPlatform.Radio,
];

export const SUPPORTED_ENVIRONMENT_CATEGORIES: EnvironmentCategory[] = [
  EnvironmentCategory.Nature,
  EnvironmentCategory.Urban,
  EnvironmentCategory.Indoor,
  EnvironmentCategory.Weather,
  EnvironmentCategory.Mixed,
];

export const NATURE_AMBIENCE_TYPES: NatureAmbienceType[] = Object.values(NatureAmbienceType);
export const URBAN_AMBIENCE_TYPES: UrbanAmbienceType[] = Object.values(UrbanAmbienceType);
export const INDOOR_AMBIENCE_TYPES: IndoorAmbienceType[] = Object.values(IndoorAmbienceType);
export const WEATHER_TYPES: WeatherType[] = Object.values(WeatherType);

export const PLATFORM_AMBIENT_CONFIG: Record<
  AmbientPlatform,
  { maxDurationSec: number; loopRecommended: boolean; formatNotes: string }
> = {
  [AmbientPlatform.Website]: { maxDurationSec: 300, loopRecommended: true, formatNotes: "Seamless background loop" },
  [AmbientPlatform.Mobile]: { maxDurationSec: 180, loopRecommended: true, formatNotes: "Low CPU ambient bed" },
  [AmbientPlatform.YouTube]: { maxDurationSec: 600, loopRecommended: false, formatNotes: "Full environmental arc" },
  [AmbientPlatform.TikTok]: { maxDurationSec: 60, loopRecommended: true, formatNotes: "Short immersive loop" },
  [AmbientPlatform.Instagram]: { maxDurationSec: 90, loopRecommended: true, formatNotes: "Atmospheric bed" },
  [AmbientPlatform.Facebook]: { maxDurationSec: 120, loopRecommended: true, formatNotes: "Subtle ambient layer" },
  [AmbientPlatform.Television]: { maxDurationSec: 180, loopRecommended: false, formatNotes: "Broadcast ambience" },
  [AmbientPlatform.Radio]: { maxDurationSec: 300, loopRecommended: true, formatNotes: "Continuous ambient bed" },
};
