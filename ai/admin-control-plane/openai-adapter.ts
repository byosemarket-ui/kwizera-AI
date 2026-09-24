/**
 * OpenAI HTTPS adapter — reference EXTERNAL_API implementation for Phase 1.
 * Uses Admin provider baseEndpoint + runtime-resolved credential. Never logs secrets.
 */

import { randomUUID } from "node:crypto";
import type { ExecutableProviderAdapter, ProviderAdapterExecuteRequest } from "./adapter-contracts.js";
import type { AdminProviderRecord, HealthStatus } from "./types.js";
import {
  mapHttpStatusToErrorCode,
  ProviderRuntimeError,
  sanitizeRuntimeMessage,
  safeLogMeta,
} from "./runtime-errors.js";
import type {
  CapabilityExecuteInput,
  ProviderHealthCode,
  ProviderHealthResult,
  RuntimeChatMessage,
} from "./runtime-types.js";

const DEFAULT_OPENAI_BASE = "https://api.openai.com";

function endpointHost(base: string): string {
  try {
    return new URL(base).host;
  } catch {
    return "api.openai.com";
  }
}

function resolveBaseUrl(provider: AdminProviderRecord): string {
  const raw = (provider.baseEndpoint ?? DEFAULT_OPENAI_BASE).trim().replace(/\/+$/, "");
  return raw || DEFAULT_OPENAI_BASE;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1_000, timeoutMs));
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function classifyHealthFromHttp(status: number): ProviderHealthCode {
  if (status >= 200 && status < 300) return "HEALTHY";
  if (status === 401 || status === 403) return "AUTHENTICATION_ERROR";
  if (status === 404) return "MODEL_ERROR";
  if (status === 429) return "PROVIDER_ERROR";
  if (status >= 500) return "PROVIDER_ERROR";
  return "PROVIDER_ERROR";
}

function healthStatusFromCode(code: ProviderHealthCode): HealthStatus {
  if (code === "HEALTHY") return "healthy";
  if (code === "AUTHENTICATION_ERROR" || code === "PROVIDER_ERROR" || code === "NETWORK_ERROR" || code === "TIMEOUT") {
    return "unhealthy";
  }
  if (code === "CREDENTIAL_MISSING" || code === "DISABLED" || code === "NOT_IMPLEMENTED") return "unknown";
  if (code === "CONFIGURED" || code === "UNCHECKED") return "unchecked";
  return "degraded";
}

export class OpenAiProviderAdapter implements ExecutableProviderAdapter {
  readonly id = "openai";

  supports(provider: AdminProviderRecord): boolean {
    return provider.type === "openai";
  }

  async healthCheck(request: {
    provider: AdminProviderRecord;
    getSecret?: () => string | undefined;
    timeoutMs?: number;
    requestId?: string;
  }): Promise<HealthStatus> {
    const result = await this.probeHealth(request);
    return result.healthStatus;
  }

  async probeHealth(request: {
    provider: AdminProviderRecord;
    getSecret?: () => string | undefined;
    timeoutMs?: number;
    requestId?: string;
  }): Promise<ProviderHealthResult> {
    const requestId = request.requestId ?? randomUUID();
    const started = Date.now();
    const provider = request.provider;
    const base = resolveBaseUrl(provider);
    const host = endpointHost(base);

    if (!provider.enabled || provider.status === "inactive" || provider.status === "deprecated") {
      return {
        providerId: provider.id,
        providerType: provider.type,
        adapterId: this.id,
        code: "DISABLED",
        healthStatus: "unknown",
        durationMs: Date.now() - started,
        requestId,
        detail: "Provider is disabled",
        endpointHost: host,
      };
    }

    const secret = request.getSecret?.()?.trim();
    if (!secret) {
      return {
        providerId: provider.id,
        providerType: provider.type,
        adapterId: this.id,
        code: "CREDENTIAL_MISSING",
        healthStatus: "unknown",
        durationMs: Date.now() - started,
        requestId,
        detail: "Provider credential is not configured",
        endpointHost: host,
      };
    }

    const timeoutMs = Math.min(30_000, Math.max(3_000, request.timeoutMs ?? 12_000));
    try {
      const response = await fetchWithTimeout(
        `${base}/v1/models?limit=1`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secret}`,
            Accept: "application/json",
            "User-Agent": "KWIZERA-AI-STUDIO/phase1",
          },
        },
        timeoutMs,
      );
      const code = classifyHealthFromHttp(response.status);
      console.info("[KWIZERA][online-ai]", JSON.stringify(safeLogMeta({
        event: "provider_health",
        requestId,
        providerId: provider.id,
        adapterId: this.id,
        endpointHost: host,
        httpStatus: response.status,
        code,
        durationMs: Date.now() - started,
      })));
      return {
        providerId: provider.id,
        providerType: provider.type,
        adapterId: this.id,
        code,
        healthStatus: healthStatusFromCode(code),
        durationMs: Date.now() - started,
        requestId,
        httpStatus: response.status,
        detail: code === "HEALTHY" ? "OpenAI models endpoint reachable" : `OpenAI responded with HTTP ${response.status}`,
        endpointHost: host,
      };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      const code: ProviderHealthCode = aborted ? "TIMEOUT" : "NETWORK_ERROR";
      console.warn("[KWIZERA][online-ai]", JSON.stringify(safeLogMeta({
        event: "provider_health_error",
        requestId,
        providerId: provider.id,
        adapterId: this.id,
        endpointHost: host,
        code,
        durationMs: Date.now() - started,
      })));
      return {
        providerId: provider.id,
        providerType: provider.type,
        adapterId: this.id,
        code,
        healthStatus: "unhealthy",
        durationMs: Date.now() - started,
        requestId,
        detail: aborted ? "Health check timed out" : "Network error contacting OpenAI",
        endpointHost: host,
      };
    }
  }

  async execute(request: ProviderAdapterExecuteRequest): Promise<{
    ok: boolean;
    outputText?: string;
    output?: unknown;
    httpStatus?: number;
    errorCode?: string;
    errorMessage?: string;
  }> {
    const provider = request.provider;
    const model = request.model;
    const secret = request.getSecret()?.trim();
    if (!secret) {
      throw new ProviderRuntimeError("CONFIGURATION_ERROR", "Provider credential is not configured");
    }

    const base = resolveBaseUrl(provider);
    const timeoutMs = Math.min(
      120_000,
      Math.max(3_000, request.timeoutMs ?? model.timeoutMs ?? 30_000),
    );
    const visionMode = isVisionMode(request.input);
    const chatMode = request.input?.mode === "chat" || visionMode;
    const messages = normalizeMessages(request.input);
    const body: Record<string, unknown> = {
      model: model.modelId,
      messages,
      max_tokens: visionMode ? 2_048 : chatMode ? 1_024 : 16,
      temperature: chatMode ? 0.2 : 0,
    };
    if (chatMode) {
      body.response_format = { type: "json_object" };
    }

    const started = Date.now();
    try {
      const response = await fetchWithTimeout(
        `${base}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "KWIZERA-AI-STUDIO/phase3",
          },
          body: JSON.stringify(body),
        },
        timeoutMs,
      );

      const httpStatus = response.status;
      const rawText = await response.text();
      let parsed: unknown = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      console.info("[KWIZERA][online-ai]", JSON.stringify(safeLogMeta({
        event: "provider_execute",
        requestId: request.requestId,
        providerId: provider.id,
        modelId: model.modelId,
        adapterId: this.id,
        endpointHost: endpointHost(base),
        httpStatus,
        durationMs: Date.now() - started,
        ok: response.ok,
      })));

      if (!response.ok) {
        const code = mapHttpStatusToErrorCode(httpStatus);
        const upstream = extractOpenAiErrorMessage(parsed) ?? `OpenAI HTTP ${httpStatus}`;
        throw new ProviderRuntimeError(code, upstream, {
          httpStatus,
          retryable: httpStatus === 429 || httpStatus >= 500,
        });
      }

      const outputText = extractChatText(parsed);
      return {
        ok: true,
        outputText,
        output: {
          id: typeof (parsed as { id?: unknown })?.id === "string" ? (parsed as { id: string }).id : undefined,
          model: typeof (parsed as { model?: unknown })?.model === "string" ? (parsed as { model: string }).model : model.modelId,
          choices: Array.isArray((parsed as { choices?: unknown })?.choices)
            ? (parsed as { choices: unknown[] }).choices.length
            : 0,
        },
        httpStatus,
      };
    } catch (error) {
      if (error instanceof ProviderRuntimeError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderRuntimeError("TIMEOUT", "OpenAI request timed out", { retryable: true });
      }
      throw new ProviderRuntimeError(
        "NETWORK_ERROR",
        sanitizeRuntimeMessage(error instanceof Error ? error.message : "Network error"),
        { retryable: true },
      );
    }
  }
}

function isVisionMode(input?: CapabilityExecuteInput): boolean {
  if (!input) return false;
  if (input.mode === "vision") return true;
  return Array.isArray(input.images) && input.images.length > 0;
}

function sanitizeMime(mimeType: string | undefined): string {
  const raw = (mimeType ?? "image/jpeg").trim().toLowerCase();
  if (raw === "image/png" || raw === "image/jpeg" || raw === "image/jpg" || raw === "image/webp" || raw === "image/gif") {
    return raw === "image/jpg" ? "image/jpeg" : raw;
  }
  return "image/jpeg";
}

function normalizeMessages(input?: CapabilityExecuteInput): RuntimeChatMessage[] {
  if (input?.messages?.length) return input.messages;
  const visionMode = isVisionMode(input);
  const prompt = input?.prompt?.trim()
    || (visionMode ? "Analyze the product image and reply with JSON only." : "Reply with exactly: OK");

  if (visionMode && input?.images?.length) {
    const parts: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } }
    > = [{ type: "text", text: prompt }];
    for (const image of input.images.slice(0, 4)) {
      const b64 = image.base64?.trim();
      if (!b64) continue;
      // Cap individual image payload (~3.5MB base64 ≈ ~2.6MB binary).
      if (b64.length > 3_500_000) continue;
      const mime = sanitizeMime(image.mimeType);
      parts.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${b64}`, detail: "low" },
      });
    }
    return [
      {
        role: "system",
        content: "You are a product vision analyst for KWIZERA. Reply with JSON only. Never invent product attributes.",
      },
      { role: "user", content: parts },
    ];
  }

  return [
    {
      role: "system",
      content: visionMode
        ? "You are a product vision analyst for KWIZERA. Reply with JSON only."
        : input?.mode === "chat"
          ? "You are the Creative Director for KWIZERA AI STUDIO. Reply with JSON only."
          : "You are a connectivity probe. Reply briefly.",
    },
    { role: "user", content: prompt },
  ];
}

function extractChatText(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const choices = (parsed as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return undefined;
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  if (typeof message?.content === "string") return message.content.trim();
  return undefined;
}

function extractOpenAiErrorMessage(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const err = (parsed as { error?: { message?: unknown } }).error;
  if (err && typeof err.message === "string") return sanitizeRuntimeMessage(err.message);
  return undefined;
}
