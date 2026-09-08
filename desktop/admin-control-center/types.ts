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

export type ModelCategory =
  | "VISION" | "IMAGE" | "IMAGE_EDITING" | "SEGMENTATION" | "UPSCALE"
  | "VIDEO" | "AUDIO" | "MUSIC" | "TTS" | "STT" | "LLM" | "EMBEDDING" | "OTHER";

export interface AdminModelRecord {
  id: string;
  name: string;
  providerId: string;
  category: ModelCategory;
  capability: string;
  modelId: string;
  endpoint?: string;
  version?: string;
  status: string;
  priority: number;
  inputType: string;
  outputType: string;
  estimatedCost?: number;
  currency: string;
  timeoutMs: number;
  enabled: boolean;
  fallbackModelId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProviderPublicView {
  id: string;
  name: string;
  type: string;
  baseEndpoint?: string;
  status: string;
  enabled: boolean;
  healthStatus: string;
  metadata: Record<string, unknown>;
  hasCredential: boolean;
  credentialMasked: string | null;
  configuredModelCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureMappingView {
  id: string;
  feature: string;
  label: string;
  description: string;
  primaryModelId?: string;
  secondaryModelId?: string;
  fallbackModelId?: string;
  providerId?: string;
  enabled: boolean;
  priority: number;
  primaryModelName?: string | null;
  secondaryModelName?: string | null;
  fallbackModelName?: string | null;
  providerName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TypedSetting {
  key: string;
  category: string;
  label: string;
  description: string;
  valueType: "string" | "number" | "boolean" | "json";
  value: string | number | boolean | Record<string, unknown> | null;
  defaultValue: string | number | boolean | Record<string, unknown> | null;
  unit?: string;
  min?: number;
  max?: number;
  updatedAt: string;
}

export interface AdminDashboardSnapshot {
  system: Record<string, string>;
  business: Record<string, string | number>;
  ai: {
    activeModels: number;
    activeProviders: number;
    defaultModels: Array<{ feature: string; modelName: string | null }>;
    recentOperations: string | number;
    failures: string | number;
    latency: string | number;
  };
  cost: Record<string, string | number>;
  generatedAt: string;
}
