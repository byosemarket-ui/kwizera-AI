/**
 * Capability runtime — Admin resolveFeatureExecution → credential → adapter → online API.
 * Features request a capability; they never touch raw API keys.
 */

import { randomUUID } from "node:crypto";
import type { AdminControlPlaneManager } from "./admin-control-plane-manager.js";
import type { AdminCredentialManager } from "./credential-manager.js";
import {
  createDefaultAdapterRegistry,
  isExecutableAdapter,
  type ProviderAdapterRegistry,
} from "./provider-adapters.js";
import { inferProviderKind } from "./provider-kind.js";
import { ProviderRuntimeError, safeLogMeta } from "./runtime-errors.js";
import type {
  CapabilityExecuteInput,
  CapabilityExecuteResult,
  ProviderHealthResult,
  RuntimeExecutionSource,
  SafeRuntimeExecutionView,
} from "./runtime-types.js";
import type { FeatureKey, HealthStatus } from "./types.js";

export class CapabilityRuntime {
  constructor(
    private readonly manager: AdminControlPlaneManager,
    private readonly credentials: AdminCredentialManager | null,
    private readonly adapters: ProviderAdapterRegistry = createDefaultAdapterRegistry(),
  ) {}

  /**
   * Safe view of how a feature would execute — never includes secrets.
   */
  describe(feature: FeatureKey): SafeRuntimeExecutionView {
    const resolution = this.manager.resolveFeatureExecution(feature);
    const model = resolution.selectedModel;
    const provider = resolution.providerId
      ? this.manager.getProviderRecord(resolution.providerId)
      : null;
    const adapter = provider ? this.adapters.resolve(provider) : null;
    const kind = provider ? inferProviderKind(provider) : null;
    let source: RuntimeExecutionSource = "UNAVAILABLE";
    if (resolution.status === "READY" || resolution.status === "FALLBACK") {
      if (kind === "EXTERNAL_API") source = "ONLINE";
      else if (kind === "LOCAL") source = "LOCAL";
      else source = "FALLBACK";
    }
    return {
      feature,
      status: resolution.status,
      providerId: resolution.providerId,
      providerType: provider?.type ?? null,
      modelId: model?.modelId ?? null,
      modelName: model?.name ?? null,
      adapterId: adapter?.id ?? null,
      timeoutMs: model?.timeoutMs ?? 30_000,
      source,
      fallbackAvailable: Boolean(resolution.mapping?.fallbackModelId),
      reason: resolution.reason,
    };
  }

  async healthCheckProvider(providerId: string, opts?: { timeoutMs?: number }): Promise<ProviderHealthResult> {
    const requestId = randomUUID();
    const started = Date.now();
    const provider = this.manager.getProviderRecord(providerId);
    if (!provider) {
      return {
        providerId,
        providerType: "unknown",
        adapterId: null,
        code: "PROVIDER_ERROR",
        healthStatus: "unknown",
        durationMs: Date.now() - started,
        requestId,
        detail: "Provider not found",
      };
    }

    const adapter = this.adapters.resolve(provider);
    const getSecret = () => this.credentials?.getProviderSecret(provider.id);

    if (adapter && isExecutableAdapter(adapter) && typeof adapter.probeHealth === "function") {
      const result = await adapter.probeHealth({
        provider,
        getSecret,
        timeoutMs: opts?.timeoutMs,
        requestId,
      });
      await this.persistProviderHealth(provider.id, result.healthStatus);
      return result;
    }

    if (!adapter) {
      return {
        providerId: provider.id,
        providerType: provider.type,
        adapterId: null,
        code: "NOT_IMPLEMENTED",
        healthStatus: "unchecked",
        durationMs: Date.now() - started,
        requestId,
        detail: "No adapter registered for provider type",
      };
    }

    // Placeholder adapters: report credential/config state without inventing ONLINE success.
    if (!provider.enabled) {
      return {
        providerId: provider.id,
        providerType: provider.type,
        adapterId: adapter.id,
        code: "DISABLED",
        healthStatus: "unknown",
        durationMs: Date.now() - started,
        requestId,
        detail: "Provider disabled",
      };
    }
    if (inferProviderKind(provider) === "EXTERNAL_API" && !this.credentials?.has(provider.id) && !provider.credentialHint) {
      return {
        providerId: provider.id,
        providerType: provider.type,
        adapterId: adapter.id,
        code: "CREDENTIAL_MISSING",
        healthStatus: "unknown",
        durationMs: Date.now() - started,
        requestId,
        detail: "Credential not configured; adapter not yet implemented for live health",
      };
    }

    const legacy = await adapter.healthCheck({
      provider,
      model: {
        id: "health-probe",
        name: "health-probe",
        providerId: provider.id,
        category: "OTHER",
        capability: "other",
        modelId: "health-probe",
        status: "active",
        priority: 0,
        inputType: "any",
        outputType: "any",
        currency: "USD",
        timeoutMs: 5_000,
        enabled: true,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      getSecret,
      requestId,
    });

    return {
      providerId: provider.id,
      providerType: provider.type,
      adapterId: adapter.id,
      code: legacy === "healthy" ? "HEALTHY" : legacy === "unchecked" ? "NOT_IMPLEMENTED" : "UNCHECKED",
      healthStatus: legacy,
      durationMs: Date.now() - started,
      requestId,
      detail: legacy === "unchecked"
        ? "Adapter registered but live health is not implemented for this provider type"
        : undefined,
    };
  }

  /**
   * Execute a mapped capability through the resolved provider adapter.
   * Consumes getProviderSecret only inside the trusted server path.
   */
  async execute(feature: FeatureKey, input: CapabilityExecuteInput = {}): Promise<CapabilityExecuteResult> {
    const requestId = input.requestId ?? randomUUID();
    const started = Date.now();
    const resolution = this.manager.resolveFeatureExecution(feature);
    const view = this.describe(feature);

    if (resolution.status === "UNAVAILABLE" || !resolution.selectedModel || !resolution.providerId) {
      return {
        ok: false,
        feature,
        source: "UNAVAILABLE",
        providerId: resolution.providerId,
        providerType: view.providerType,
        modelRecordId: null,
        modelId: null,
        modelName: null,
        adapterId: view.adapterId,
        requestId,
        durationMs: Date.now() - started,
        timeoutMs: view.timeoutMs,
        errorCode: "CONFIGURATION_ERROR",
        errorMessage: resolution.reason ?? "Feature is not available",
        resolutionStatus: resolution.status,
        resolutionSource: resolution.source,
      };
    }

    const provider = this.manager.getProviderRecord(resolution.providerId);
    const model = resolution.selectedModel;
    if (!provider) {
      return {
        ok: false,
        feature,
        source: "UNAVAILABLE",
        providerId: resolution.providerId,
        providerType: null,
        modelRecordId: model.id,
        modelId: model.modelId,
        modelName: model.name,
        adapterId: null,
        requestId,
        durationMs: Date.now() - started,
        timeoutMs: model.timeoutMs,
        errorCode: "CONFIGURATION_ERROR",
        errorMessage: "Resolved provider record missing",
        resolutionStatus: resolution.status,
        resolutionSource: resolution.source,
      };
    }

    const adapter = this.adapters.resolve(provider);
    if (!adapter || !isExecutableAdapter(adapter)) {
      return {
        ok: false,
        feature,
        source: inferProviderKind(provider) === "EXTERNAL_API" ? "ONLINE" : "LOCAL",
        providerId: provider.id,
        providerType: provider.type,
        modelRecordId: model.id,
        modelId: model.modelId,
        modelName: model.name,
        adapterId: adapter?.id ?? null,
        requestId,
        durationMs: Date.now() - started,
        timeoutMs: model.timeoutMs,
        errorCode: "NOT_IMPLEMENTED",
        errorMessage: "No executable online adapter for this provider type",
        resolutionStatus: resolution.status,
        resolutionSource: resolution.source,
      };
    }

    const kind = inferProviderKind(provider);
    const source: RuntimeExecutionSource = kind === "EXTERNAL_API" ? "ONLINE" : kind === "LOCAL" ? "LOCAL" : "FALLBACK";
    const timeoutMs = input.timeoutMs ?? model.timeoutMs ?? 30_000;

    try {
      // Trusted path: decrypt only for the outbound request factory.
      const result = await adapter.execute({
        provider,
        model,
        getSecret: () => this.credentials?.getProviderSecret(provider.id),
        input,
        timeoutMs,
        requestId,
      });

      console.info("[KWIZERA][online-ai]", JSON.stringify(safeLogMeta({
        event: "capability_execute_ok",
        requestId,
        feature,
        providerId: provider.id,
        modelId: model.modelId,
        adapterId: adapter.id,
        source,
        durationMs: Date.now() - started,
      })));

      await this.manager.recordUsage({
        feature,
        modelId: model.id,
        providerId: provider.id,
        operation: "capability.execute",
        status: "succeeded",
        durationMs: Date.now() - started,
        projectId: input.projectId,
        customerId: input.customerId,
        metadata: {
          requestId,
          source,
          adapterId: adapter.id,
          httpStatus: result.httpStatus ?? null,
        },
      });

      return {
        ok: true,
        feature,
        source,
        providerId: provider.id,
        providerType: provider.type,
        modelRecordId: model.id,
        modelId: model.modelId,
        modelName: model.name,
        adapterId: adapter.id,
        requestId,
        durationMs: Date.now() - started,
        timeoutMs,
        outputText: result.outputText ?? null,
        output: result.output,
        httpStatus: result.httpStatus,
        resolutionStatus: resolution.status,
        resolutionSource: resolution.source,
      };
    } catch (error) {
      const runtimeError = error instanceof ProviderRuntimeError
        ? error
        : new ProviderRuntimeError(
          "UNKNOWN",
          error instanceof Error ? error.message : "Capability execution failed",
        );

      console.warn("[KWIZERA][online-ai]", JSON.stringify(safeLogMeta({
        event: "capability_execute_error",
        requestId,
        feature,
        providerId: provider.id,
        modelId: model.modelId,
        adapterId: adapter.id,
        source,
        errorCode: runtimeError.code,
        httpStatus: runtimeError.httpStatus ?? null,
        durationMs: Date.now() - started,
      })));

      await this.manager.recordUsage({
        feature,
        modelId: model.id,
        providerId: provider.id,
        operation: "capability.execute",
        status: "failed",
        durationMs: Date.now() - started,
        projectId: input.projectId,
        customerId: input.customerId,
        metadata: {
          requestId,
          source,
          adapterId: adapter.id,
          errorCode: runtimeError.code,
          httpStatus: runtimeError.httpStatus ?? null,
        },
      });

      return {
        ok: false,
        feature,
        source,
        providerId: provider.id,
        providerType: provider.type,
        modelRecordId: model.id,
        modelId: model.modelId,
        modelName: model.name,
        adapterId: adapter.id,
        requestId,
        durationMs: Date.now() - started,
        timeoutMs,
        errorCode: runtimeError.code,
        errorMessage: runtimeError.message,
        httpStatus: runtimeError.httpStatus,
        resolutionStatus: resolution.status,
        resolutionSource: resolution.source,
      };
    }
  }

  private async persistProviderHealth(providerId: string, healthStatus: HealthStatus): Promise<void> {
    const provider = this.manager.getProviderRecord(providerId);
    if (!provider) return;
    try {
      await this.manager.upsertProvider({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        kind: provider.kind,
        baseEndpoint: provider.baseEndpoint,
        status: provider.status,
        enabled: provider.enabled,
        healthStatus,
        metadata: provider.metadata,
      });
    } catch {
      /* health persistence is best-effort */
    }
  }
}

export function createCapabilityRuntime(
  manager: AdminControlPlaneManager,
  credentials: AdminCredentialManager | null,
  adapters?: ProviderAdapterRegistry,
): CapabilityRuntime {
  return new CapabilityRuntime(manager, credentials, adapters ?? createDefaultAdapterRegistry());
}
