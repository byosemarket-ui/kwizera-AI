/**
 * Admin Control Plane — shared types for SaaS model/provider/feature/settings registries.
 * Complementary to AiModelManager (local studio models); does not replace it.
 */

export type ModelCategory =
  | "VISION"
  | "IMAGE"
  | "IMAGE_EDITING"
  | "SEGMENTATION"
  | "UPSCALE"
  | "VIDEO"
  | "AUDIO"
  | "MUSIC"
  | "TTS"
  | "STT"
  | "LLM"
  | "EMBEDDING"
  | "OTHER";

export type ModelCapability =
  | "vision-analysis"
  | "image-generation"
  | "image-editing"
  | "segmentation"
  | "upscale"
  | "image-to-video"
  | "text-to-video"
  | "music-generation"
  | "text-to-speech"
  | "speech-to-text"
  | "chat"
  | "embedding"
  | "other"
  | string;

export type RegistryStatus = "active" | "inactive" | "deprecated" | "error" | "unknown";
export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown" | "unchecked";
export type ProviderType =
  | "fal"
  | "replicate"
  | "alibaba"
  | "openai"
  | "google"
  | "anthropic"
  | "ollama"
  | "local"
  | "custom"
  | string;

export type MediaType = "text" | "image" | "video" | "audio" | "embedding" | "json" | "any";

export interface AdminModelRecord {
  id: string;
  name: string;
  providerId: string;
  category: ModelCategory;
  capability: ModelCapability;
  modelId: string;
  endpoint?: string;
  version?: string;
  status: RegistryStatus;
  priority: number;
  inputType: MediaType;
  outputType: MediaType;
  estimatedCost?: number;
  currency: string;
  timeoutMs: number;
  enabled: boolean;
  fallbackModelId?: string;
  metadata: Record<string, unknown>;
  /** Future multi-tenant isolation fields (optional in Stage 1). */
  customerId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProviderRecord {
  id: string;
  name: string;
  type: ProviderType;
  baseEndpoint?: string;
  /** Reference id into secrets store — never the secret itself. */
  credentialReference?: string;
  status: RegistryStatus;
  enabled: boolean;
  healthStatus: HealthStatus;
  metadata: Record<string, unknown>;
  customerId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Public-safe provider view — credentials never included. */
export interface AdminProviderPublicView extends Omit<AdminProviderRecord, "credentialReference"> {
  hasCredential: boolean;
  credentialMasked: string | null;
  configuredModelCount: number;
}

export type FeatureKey =
  | "VISION_ANALYSIS"
  | "IMAGE_GENERATION"
  | "IMAGE_EDITING"
  | "SEGMENTATION"
  | "IMAGE_UPSCALE"
  | "VIDEO_IMAGE_TO_VIDEO"
  | "VIDEO_TEXT_TO_VIDEO"
  | "MUSIC_GENERATION"
  | "TEXT_TO_SPEECH"
  | "SPEECH_TO_TEXT"
  | "LLM_CHAT"
  | "EMBEDDING"
  | string;

export interface FeatureMappingRecord {
  id: string;
  feature: FeatureKey;
  label: string;
  description: string;
  primaryModelId?: string;
  secondaryModelId?: string;
  fallbackModelId?: string;
  providerId?: string;
  enabled: boolean;
  priority: number;
  metadata: Record<string, unknown>;
  customerId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export type SettingCategory =
  | "general"
  | "ai"
  | "security"
  | "storage"
  | "rendering"
  | "audio"
  | "video"
  | "performance"
  | "limits"
  | "notifications";

export type SettingValueType = "string" | "number" | "boolean" | "json";

export interface TypedSetting {
  key: string;
  category: SettingCategory;
  label: string;
  description: string;
  valueType: SettingValueType;
  value: string | number | boolean | Record<string, unknown> | null;
  defaultValue: string | number | boolean | Record<string, unknown> | null;
  unit?: string;
  min?: number;
  max?: number;
  updatedAt: string;
}

/** Future AI usage tracking contract — Stage 1 stores schema + empty ledger. */
export interface AiUsageRecord {
  id: string;
  customerId?: string;
  projectId?: string;
  feature: FeatureKey;
  modelId?: string;
  providerId?: string;
  operation: string;
  inputSummary?: string;
  outputSummary?: string;
  durationMs?: number;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  estimatedCost?: number;
  actualCost?: number;
  currency: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface AdminControlPlaneStore {
  version: 1;
  providers: AdminProviderRecord[];
  models: AdminModelRecord[];
  featureMappings: FeatureMappingRecord[];
  settings: TypedSetting[];
  usage: AiUsageRecord[];
  updatedAt: string;
}

export interface AdminDashboardSnapshot {
  system: {
    systemStatus: string;
    aiStatus: string;
    providerStatus: string;
    databaseStatus: string;
    storageStatus: string;
    queueStatus: string;
  };
  business: {
    totalCustomers: string | number;
    totalProjects: string | number;
    generatedVideos: string | number;
    generatedImages: string | number;
    generatedAudio: string | number;
    usage: string | number;
  };
  ai: {
    activeModels: number;
    activeProviders: number;
    defaultModels: Array<{ feature: string; modelName: string | null }>;
    recentOperations: string | number;
    failures: string | number;
    latency: string | number;
  };
  cost: {
    today: string | number;
    period: string | number;
    estimated: string | number;
    providerUsage: string | number;
  };
  generatedAt: string;
}

export type AdminRouteId =
  | "dashboard"
  | "models"
  | "providers"
  | "features"
  | "video"
  | "image"
  | "audio"
  | "voice"
  | "customers"
  | "projects"
  | "usage"
  | "costs"
  | "credits"
  | "payments"
  | "system"
  | "logs"
  | "storage"
  | "database"
  | "settings";

export const ADMIN_IMPLEMENTED_ROUTES: AdminRouteId[] = [
  "dashboard",
  "models",
  "providers",
  "features",
  "settings",
  "system",
];
