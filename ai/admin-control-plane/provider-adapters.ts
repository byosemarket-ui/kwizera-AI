/**
 * Provider adapter boundary.
 * OpenAI is the Phase 1–3 reference EXTERNAL_API adapter (chat/vision HTTPS).
 * fal.ai is the Phase 4 image-to-video executable adapter.
 * Other external types remain placeholders until later phases.
 * Existing Ollama integration remains the local runtime — this adapter does not replace it.
 */
import type { AdminProviderRecord, HealthStatus } from "./types.js";
import { inferProviderKind } from "./provider-kind.js";
import { OpenAiProviderAdapter } from "./openai-adapter.js";
import { FalProviderAdapter } from "./fal-music-adapter.js";
import type {
  ProviderAdapter,
  ProviderAdapterRequest,
} from "./adapter-contracts.js";

export type {
  ExecutableProviderAdapter,
  ProviderAdapter,
  ProviderAdapterExecuteRequest,
  ProviderAdapterRequest,
} from "./adapter-contracts.js";
export { isExecutableAdapter } from "./adapter-contracts.js";

export class OllamaAdapter implements ProviderAdapter {
  readonly id = "ollama";
  supports(provider: AdminProviderRecord): boolean {
    return provider.type === "ollama" || (inferProviderKind(provider) === "LOCAL" && provider.type === "ollama");
  }
  async healthCheck(_request: ProviderAdapterRequest): Promise<HealthStatus> {
    return "unchecked";
  }
}

export class LocalRuntimeAdapter implements ProviderAdapter {
  readonly id = "local";
  supports(provider: AdminProviderRecord): boolean {
    return provider.type === "local" || inferProviderKind(provider) === "LOCAL";
  }
  async healthCheck(_request: ProviderAdapterRequest): Promise<HealthStatus> {
    return "unchecked";
  }
}

/** Placeholder registrations — no remote calls until a real adapter is registered. */
export class ExternalApiAdapter implements ProviderAdapter {
  constructor(readonly id: string) {}
  supports(provider: AdminProviderRecord): boolean {
    return provider.type === this.id;
  }
  async healthCheck(_request: ProviderAdapterRequest): Promise<HealthStatus> {
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
  // Placeholders for future phases (not yet real HTTPS callers).
  registry.register(new ExternalApiAdapter("replicate"));
  registry.register(new ExternalApiAdapter("alibaba"));
  registry.register(new ExternalApiAdapter("google"));
  registry.register(new ExternalApiAdapter("anthropic"));
  // Phase 4–5 online fal (I2V + music).
  registry.register(new FalProviderAdapter());
  // Phase 1–3 / Phase 5 TTS reference online adapter.
  registry.register(new OpenAiProviderAdapter());
  registry.register(new LocalRuntimeAdapter());
  registry.register(new OllamaAdapter());
  return registry;
}
