/**
 * Provider adapter boundary.
 * Future Fal/Replicate/Alibaba/OpenAI adapters register here without changing each feature.
 * Existing Ollama integration remains the local runtime — this adapter does not replace it.
 */
import type { AdminModelRecord, AdminProviderRecord, HealthStatus } from "./types.js";
import { inferProviderKind } from "./provider-kind.js";

export interface ProviderAdapterRequest {
  provider: AdminProviderRecord;
  model: AdminModelRecord;
  /** Runtime-only secret getter. Must not be serialized. */
  getSecret?: () => string | undefined;
}

export interface ProviderAdapter {
  id: string;
  supports(provider: AdminProviderRecord): boolean;
  healthCheck(request: ProviderAdapterRequest): Promise<HealthStatus>;
}

export class OllamaAdapter implements ProviderAdapter {
  readonly id = "ollama";
  supports(provider: AdminProviderRecord): boolean {
    return provider.type === "ollama" || (inferProviderKind(provider) === "LOCAL" && provider.type === "ollama");
  }
  async healthCheck(): Promise<HealthStatus> {
    return "unchecked";
  }
}

export class LocalRuntimeAdapter implements ProviderAdapter {
  readonly id = "local";
  supports(provider: AdminProviderRecord): boolean {
    return provider.type === "local" || inferProviderKind(provider) === "LOCAL";
  }
  async healthCheck(): Promise<HealthStatus> {
    return "unchecked";
  }
}

/** Placeholder registrations — no remote calls in this step. */
export class ExternalApiAdapter implements ProviderAdapter {
  constructor(readonly id: string) {}
  supports(provider: AdminProviderRecord): boolean {
    return provider.type === this.id;
  }
  async healthCheck(): Promise<HealthStatus> {
    return "unchecked";
  }
}

export class ProviderAdapterRegistry {
  private adapters: ProviderAdapter[] = [];

  register(adapter: ProviderAdapter): void {
    this.adapters = [adapter, ...this.adapters.filter((item) => item.id !== adapter.id)];
  }

  resolve(provider: AdminProviderRecord): ProviderAdapter | null {
    return this.adapters.find((adapter) => adapter.supports(provider)) ?? null;
  }
}

export function createDefaultAdapterRegistry(): ProviderAdapterRegistry {
  const registry = new ProviderAdapterRegistry();
  registry.register(new ExternalApiAdapter("fal"));
  registry.register(new ExternalApiAdapter("replicate"));
  registry.register(new ExternalApiAdapter("alibaba"));
  registry.register(new ExternalApiAdapter("openai"));
  registry.register(new ExternalApiAdapter("google"));
  registry.register(new ExternalApiAdapter("anthropic"));
  registry.register(new LocalRuntimeAdapter());
  registry.register(new OllamaAdapter());
  return registry;
}
