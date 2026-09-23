/**
 * Provider adapter contracts — kept separate to avoid circular imports
 * between the registry and concrete adapters (e.g. OpenAI).
 */

import type { AdminModelRecord, AdminProviderRecord, HealthStatus } from "./types.js";
import type { CapabilityExecuteInput, ProviderHealthResult } from "./runtime-types.js";

export interface ProviderAdapterRequest {
  provider: AdminProviderRecord;
  model: AdminModelRecord;
  /** Runtime-only secret getter. Must not be serialized. */
  getSecret?: () => string | undefined;
  timeoutMs?: number;
  requestId?: string;
}

export interface ProviderAdapterExecuteRequest {
  provider: AdminProviderRecord;
  model: AdminModelRecord;
  getSecret: () => string | undefined;
  input?: CapabilityExecuteInput;
  timeoutMs?: number;
  requestId: string;
}

export interface ProviderAdapter {
  id: string;
  supports(provider: AdminProviderRecord): boolean;
  healthCheck(request: ProviderAdapterRequest): Promise<HealthStatus>;
}

/** Adapters that can perform real online execution. */
export interface ExecutableProviderAdapter extends ProviderAdapter {
  execute(request: ProviderAdapterExecuteRequest): Promise<{
    ok: boolean;
    outputText?: string;
    output?: unknown;
    httpStatus?: number;
    errorCode?: string;
    errorMessage?: string;
  }>;
  probeHealth?(request: {
    provider: AdminProviderRecord;
    getSecret?: () => string | undefined;
    timeoutMs?: number;
    requestId?: string;
  }): Promise<ProviderHealthResult>;
}

export function isExecutableAdapter(adapter: ProviderAdapter): adapter is ExecutableProviderAdapter {
  return typeof (adapter as ExecutableProviderAdapter).execute === "function";
}
