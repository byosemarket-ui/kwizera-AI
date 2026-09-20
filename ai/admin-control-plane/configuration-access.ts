/**
 * Central configuration access for AI runtime.
 * Engines should call these helpers instead of reading scattered env vars for model/provider config.
 */
import type { AdminControlPlaneManager } from "./admin-control-plane-manager.js";
import type { AdminCredentialManager } from "./credential-manager.js";
import { inferProviderKind } from "./provider-kind.js";
import type { FeatureKey } from "./types.js";
import { createDefaultAdapterRegistry, type ProviderAdapterRegistry } from "./provider-adapters.js";

export interface ProviderConfigurationView {
  providerId: string;
  name: string;
  type: string;
  kind: string;
  baseUrl?: string;
  enabled: boolean;
  healthStatus: string;
  credential: {
    configured: boolean;
    display: string | null;
  };
}

export class AdminConfiguration {
  constructor(
    private readonly manager: AdminControlPlaneManager,
    private readonly credentials?: AdminCredentialManager,
    private readonly adapters: ProviderAdapterRegistry = createDefaultAdapterRegistry(),
  ) {}

  resolveFeatureModel(featureKey: FeatureKey) {
    return this.manager.resolveFeatureExecution(featureKey);
  }

  getProviderConfiguration(providerId: string): ProviderConfigurationView | null {
    const provider = this.manager.getProviderRecord(providerId);
    if (!provider) return null;
    const publicView = this.manager.getProvider(providerId);
    return {
      providerId: provider.id,
      name: provider.name,
      type: provider.type,
      kind: inferProviderKind(provider),
      baseUrl: provider.baseEndpoint,
      enabled: provider.enabled,
      healthStatus: provider.healthStatus,
      credential: {
        configured: publicView?.hasCredential ?? this.credentials?.has(provider.id) ?? false,
        display: publicView?.credentialMasked ?? null,
      },
    };
  }

  getAdapterId(providerId: string): string | null {
    const provider = this.manager.getProviderRecord(providerId);
    if (!provider) return null;
    return this.adapters.resolve(provider)?.id ?? null;
  }
}
