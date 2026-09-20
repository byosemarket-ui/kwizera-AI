/**
 * Deterministic Feature → Model → Provider resolution.
 * Engines must use this instead of hardcoding providers/models.
 */
import type {
  AdminModelRecord,
  AdminProviderRecord,
  FeatureKey,
  FeatureMappingRecord,
} from "./types.js";
import { inferProviderKind } from "./provider-kind.js";

export type ResolutionStatus = "READY" | "FALLBACK" | "UNAVAILABLE";
export type ResolutionSource = "PRIMARY" | "SECONDARY" | "FALLBACK" | "NONE";

export interface ResolutionAttempt {
  source: Exclude<ResolutionSource, "NONE">;
  modelId?: string;
  providerId?: string;
  ok: boolean;
  reason: string;
}

export interface FeatureResolutionResult {
  feature: FeatureKey;
  status: ResolutionStatus;
  selectedModelId: string | null;
  selectedModel: AdminModelRecord | null;
  providerId: string | null;
  source: ResolutionSource;
  reason?: string;
  attempts: ResolutionAttempt[];
  mapping: FeatureMappingRecord | null;
}

export interface FeatureResolutionDeps {
  mapping: FeatureMappingRecord | null;
  getModel: (id: string) => AdminModelRecord | null;
  getProvider: (id: string) => AdminProviderRecord | null;
  hasCredential: (providerId: string) => boolean;
}

function evaluateCandidate(
  source: Exclude<ResolutionSource, "NONE">,
  modelId: string | undefined,
  mappingProviderId: string | undefined,
  deps: FeatureResolutionDeps,
): ResolutionAttempt & { model: AdminModelRecord | null; provider: AdminProviderRecord | null } {
  if (!modelId) {
    return { source, ok: false, reason: `${source}_MODEL_MISSING`, model: null, provider: null };
  }
  const model = deps.getModel(modelId);
  if (!model) {
    return { source, modelId, ok: false, reason: `${source}_MODEL_MISSING`, model: null, provider: null };
  }
  if (!model.enabled || model.status === "inactive" || model.status === "deprecated" || model.status === "error") {
    return {
      source,
      modelId,
      providerId: model.providerId,
      ok: false,
      reason: `${source}_MODEL_DISABLED`,
      model,
      provider: null,
    };
  }
  const provider = deps.getProvider(model.providerId) ?? (mappingProviderId ? deps.getProvider(mappingProviderId) : null);
  if (!provider) {
    return { source, modelId, providerId: model.providerId, ok: false, reason: `${source}_PROVIDER_MISSING`, model, provider: null };
  }
  if (!provider.enabled || provider.status === "inactive" || provider.status === "deprecated") {
    return { source, modelId, providerId: provider.id, ok: false, reason: `${source}_PROVIDER_DISABLED`, model, provider };
  }
  if (provider.healthStatus === "unhealthy") {
    return { source, modelId, providerId: provider.id, ok: false, reason: `${source}_PROVIDER_UNAVAILABLE`, model, provider };
  }
  const kind = inferProviderKind(provider);
  if (kind === "EXTERNAL_API" && !deps.hasCredential(provider.id)) {
    return { source, modelId, providerId: provider.id, ok: false, reason: `${source}_CREDENTIAL_NOT_CONFIGURED`, model, provider };
  }
  return { source, modelId, providerId: provider.id, ok: true, reason: `${source}_READY`, model, provider };
}

export function resolveFeatureExecution(feature: FeatureKey, deps: FeatureResolutionDeps): FeatureResolutionResult {
  const mapping = deps.mapping;
  if (!mapping) {
    return {
      feature,
      status: "UNAVAILABLE",
      selectedModelId: null,
      selectedModel: null,
      providerId: null,
      source: "NONE",
      reason: "FEATURE_NOT_MAPPED",
      attempts: [],
      mapping: null,
    };
  }
  if (!mapping.enabled) {
    return {
      feature,
      status: "UNAVAILABLE",
      selectedModelId: null,
      selectedModel: null,
      providerId: mapping.providerId ?? null,
      source: "NONE",
      reason: "FEATURE_DISABLED",
      attempts: [],
      mapping,
    };
  }

  const chain: Array<{ source: Exclude<ResolutionSource, "NONE">; modelId?: string }> = [
    { source: "PRIMARY", modelId: mapping.primaryModelId },
    { source: "SECONDARY", modelId: mapping.secondaryModelId },
    { source: "FALLBACK", modelId: mapping.fallbackModelId },
  ];

  const attempts: ResolutionAttempt[] = [];
  for (const step of chain) {
    const result = evaluateCandidate(step.source, step.modelId, mapping.providerId, deps);
    attempts.push({
      source: result.source,
      modelId: result.modelId,
      providerId: result.providerId,
      ok: result.ok,
      reason: result.reason,
    });
    if (result.ok && result.model && result.provider) {
      const status: ResolutionStatus = step.source === "PRIMARY" ? "READY" : "FALLBACK";
      return {
        feature,
        status,
        selectedModelId: result.model.id,
        selectedModel: result.model,
        providerId: result.provider.id,
        source: step.source,
        reason: step.source === "PRIMARY" ? undefined : attempts.find((a) => !a.ok)?.reason,
        attempts,
        mapping,
      };
    }
  }

  return {
    feature,
    status: "UNAVAILABLE",
    selectedModelId: null,
    selectedModel: null,
    providerId: mapping.providerId ?? null,
    source: "NONE",
    reason: attempts.find((a) => !a.ok)?.reason ?? "NO_VALID_MODEL",
    attempts,
    mapping,
  };
}
