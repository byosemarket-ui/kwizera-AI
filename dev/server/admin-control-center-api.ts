/**
 * HTTP handlers for Admin Control Plane APIs (/api/admin/*).
 * Secrets are never returned. Auth boundary is enforced on every call.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  assertAdminAccess,
  rolesFromHeaders,
  adminTokenFromHeaders,
  AdminValidationError,
  type AdminControlPlaneManager,
} from "../../ai/admin-control-plane/index.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;
type ReadBody = (req: IncomingMessage) => Promise<string>;

export interface AdminApiDeps {
  getManager: () => AdminControlPlaneManager | null;
  sendJson: SendJson;
  readBody: ReadBody;
  dashboardHints?: () => {
    aiCoreOnline?: boolean;
    projectCount?: number | null;
    queueDepth?: number | null;
    storageOk?: boolean;
  };
}

function headersRecord(req: IncomingMessage): Record<string, string | string[] | undefined> {
  return req.headers as Record<string, string | string[] | undefined>;
}

function fail(sendJson: SendJson, res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, {
    ok: false,
    error: { code, message },
    code,
    message,
  });
}

function ok(sendJson: SendJson, res: ServerResponse, data: Record<string, unknown>, status = 200): void {
  sendJson(res, status, { ok: true, ...data });
}

function guard(req: IncomingMessage, res: ServerResponse, sendJson: SendJson, pathname: string): boolean {
  const decision = assertAdminAccess({
    roles: rolesFromHeaders(headersRecord(req)),
    adminToken: adminTokenFromHeaders(headersRecord(req)),
    path: pathname,
    adminApi: true,
    remoteAddress: req.socket.remoteAddress,
  });
  if (!decision.allowed) {
    fail(sendJson, res, 403, "ADMIN_FORBIDDEN", decision.reason);
    return false;
  }
  return true;
}

function requireManager(deps: AdminApiDeps, res: ServerResponse): AdminControlPlaneManager | null {
  const manager = deps.getManager();
  if (!manager?.isInitialized()) {
    fail(deps.sendJson, res, 503, "ADMIN_NOT_READY", "Admin Control Plane is not ready");
    return null;
  }
  return manager;
}

async function parseJsonBody(req: IncomingMessage, readBody: ReadBody): Promise<unknown> {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  return JSON.parse(raw) as unknown;
}

function looksLikeSecret(value: string): boolean {
  return /^(sk-|rk-|Bearer\s|api[_-]?key)/i.test(value.trim()) || value.trim().length > 80;
}

/**
 * Returns true if the request was handled as an admin API call.
 */
export async function handleAdminApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: AdminApiDeps,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/admin")) return false;

  if (!guard(req, res, deps.sendJson, url.pathname)) return true;

  const manager = requireManager(deps, res);
  if (!manager) return true;

  try {
    if (url.pathname === "/api/admin/dashboard" && req.method === "GET") {
      const hints = deps.dashboardHints?.() ?? {};
      ok(deps.sendJson, res, manager.buildDashboard(hints) as unknown as Record<string, unknown>);
      return true;
    }

    if (url.pathname === "/api/admin/providers" && req.method === "GET") {
      const vault = manager.getCredentialVaultStatus();
      ok(deps.sendJson, res, {
        items: manager.listProviders(),
        credentialVault: vault,
      });
      return true;
    }
    if (url.pathname === "/api/admin/providers" && req.method === "POST") {
      const body = (await parseJsonBody(req, deps.readBody)) as Record<string, unknown>;
      if (typeof body.credentialReference === "string" && looksLikeSecret(body.credentialReference)) {
        fail(deps.sendJson, res, 400, "CREDENTIAL_REQUIRED", "Do not send raw API keys. Use POST /api/admin/providers/:id/credential");
        return true;
      }
      const saved = await manager.upsertProvider({
        id: typeof body.id === "string" ? body.id : undefined,
        name: String(body.name ?? ""),
        type: String(body.type ?? "custom"),
        kind: body.kind as never,
        baseEndpoint: typeof body.baseEndpoint === "string" ? body.baseEndpoint : undefined,
        status: body.status as never,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        healthStatus: body.healthStatus as never,
        metadata: (body.metadata as Record<string, unknown>) ?? {},
        credentialReference: typeof body.credentialReference === "string" ? body.credentialReference : undefined,
      });
      ok(deps.sendJson, res, saved as unknown as Record<string, unknown>);
      return true;
    }
    if (url.pathname.match(/^\/api\/admin\/providers\/[^/]+\/credential$/) && req.method === "POST") {
      const id = decodeURIComponent(url.pathname.split("/")[4] ?? "");
      const body = (await parseJsonBody(req, deps.readBody)) as {
        secret?: string;
        value?: string;
        enable?: boolean;
      };
      const secret = typeof body.secret === "string" ? body.secret : body.value;
      if (!secret) {
        fail(deps.sendJson, res, 400, "CREDENTIAL_REQUIRED", "Credential value is required");
        return true;
      }
      const saved = await manager.setProviderSecret(id, secret, {
        enable: typeof body.enable === "boolean" ? body.enable : undefined,
      });
      ok(deps.sendJson, res, saved as unknown as Record<string, unknown>);
      return true;
    }
    if (url.pathname.match(/^\/api\/admin\/providers\/[^/]+\/health$/) && req.method === "POST") {
      const id = decodeURIComponent(url.pathname.split("/")[4] ?? "");
      const runtime = manager.getCapabilityRuntime();
      const result = await runtime.healthCheckProvider(id);
      ok(deps.sendJson, res, result as unknown as Record<string, unknown>);
      return true;
    }
    if (url.pathname.startsWith("/api/admin/providers/") && req.method === "GET") {
      const id = decodeURIComponent(url.pathname.slice("/api/admin/providers/".length));
      if (id.includes("/")) {
        fail(deps.sendJson, res, 404, "NOT_FOUND", "Unknown admin API route");
        return true;
      }
      const provider = manager.getProvider(id);
      if (!provider) {
        fail(deps.sendJson, res, 404, "UNKNOWN_PROVIDER", "Provider not found");
        return true;
      }
      ok(deps.sendJson, res, provider as unknown as Record<string, unknown>);
      return true;
    }

    if (url.pathname === "/api/admin/models" && req.method === "GET") {
      const enabledParam = url.searchParams.get("enabled");
      const result = manager.listModels({
        search: url.searchParams.get("search") ?? undefined,
        category: url.searchParams.get("category") ?? undefined,
        providerId: url.searchParams.get("providerId") ?? undefined,
        capability: url.searchParams.get("capability") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        enabled: enabledParam === null ? undefined : enabledParam === "true",
        page: Number(url.searchParams.get("page") ?? 1),
        pageSize: Number(url.searchParams.get("pageSize") ?? 25),
      });
      ok(deps.sendJson, res, result as unknown as Record<string, unknown>);
      return true;
    }
    if (url.pathname === "/api/admin/models" && req.method === "POST") {
      const body = (await parseJsonBody(req, deps.readBody)) as Record<string, unknown>;
      const saved = await manager.upsertModel({
        id: typeof body.id === "string" ? body.id : undefined,
        name: String(body.name ?? ""),
        providerId: String(body.providerId ?? ""),
        category: body.category as never,
        capability: String(body.capability ?? "other"),
        modelId: String(body.modelId ?? ""),
        endpoint: typeof body.endpoint === "string" ? body.endpoint : undefined,
        version: typeof body.version === "string" ? body.version : undefined,
        status: body.status as never,
        priority: typeof body.priority === "number" ? body.priority : undefined,
        inputType: body.inputType as never,
        outputType: body.outputType as never,
        estimatedCost: typeof body.estimatedCost === "number" ? body.estimatedCost : undefined,
        currency: typeof body.currency === "string" ? body.currency : undefined,
        timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        fallbackModelId: typeof body.fallbackModelId === "string" ? body.fallbackModelId : undefined,
        costModel: body.costModel as never,
        metadata: (body.metadata as Record<string, unknown>) ?? {},
      });
      ok(deps.sendJson, res, saved as unknown as Record<string, unknown>);
      return true;
    }
    if (url.pathname.match(/^\/api\/admin\/models\/[^/]+\/enabled$/) && req.method === "POST") {
      const id = decodeURIComponent(url.pathname.split("/")[4] ?? "");
      const body = (await parseJsonBody(req, deps.readBody)) as { enabled?: boolean };
      const saved = await manager.setModelEnabled(id, Boolean(body.enabled));
      ok(deps.sendJson, res, saved as unknown as Record<string, unknown>);
      return true;
    }
    if (url.pathname.startsWith("/api/admin/models/") && req.method === "GET") {
      const id = decodeURIComponent(url.pathname.slice("/api/admin/models/".length));
      const model = manager.getModel(id);
      if (!model) {
        fail(deps.sendJson, res, 404, "UNKNOWN_MODEL", "Model not found");
        return true;
      }
      ok(deps.sendJson, res, model as unknown as Record<string, unknown>);
      return true;
    }

    if (url.pathname === "/api/admin/features" && req.method === "GET") {
      const items = manager.listFeatureMappings().map((mapping) => {
        const resolved = manager.resolveFeature(mapping.feature);
        const execution = manager.resolveFeatureExecution(mapping.feature);
        return {
          ...mapping,
          primaryModelName: resolved.primaryModel?.name ?? null,
          secondaryModelName: resolved.secondaryModel?.name ?? null,
          fallbackModelName: resolved.fallbackModel?.name ?? null,
          providerName: resolved.provider?.name ?? null,
          resolutionStatus: execution.status,
          resolutionSource: execution.source,
          resolutionReason: execution.reason ?? null,
        };
      });
      ok(deps.sendJson, res, { items });
      return true;
    }
    if (url.pathname === "/api/admin/features" && req.method === "POST") {
      const body = (await parseJsonBody(req, deps.readBody)) as Record<string, unknown>;
      const saved = await manager.upsertFeatureMapping({
        id: typeof body.id === "string" ? body.id : undefined,
        feature: String(body.feature ?? ""),
        label: String(body.label ?? ""),
        description: typeof body.description === "string" ? body.description : undefined,
        primaryModelId: typeof body.primaryModelId === "string" ? body.primaryModelId : undefined,
        secondaryModelId: typeof body.secondaryModelId === "string" ? body.secondaryModelId : undefined,
        fallbackModelId: typeof body.fallbackModelId === "string" ? body.fallbackModelId : undefined,
        providerId: typeof body.providerId === "string" ? body.providerId : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        priority: typeof body.priority === "number" ? body.priority : undefined,
        configuration: (body.configuration as Record<string, unknown>) ?? undefined,
        metadata: (body.metadata as Record<string, unknown>) ?? {},
      });
      ok(deps.sendJson, res, saved as unknown as Record<string, unknown>);
      return true;
    }
    if (url.pathname.startsWith("/api/admin/features/resolve/") && req.method === "GET") {
      const feature = decodeURIComponent(url.pathname.slice("/api/admin/features/resolve/".length));
      ok(deps.sendJson, res, manager.resolveFeatureExecution(feature) as unknown as Record<string, unknown>);
      return true;
    }
    if (url.pathname === "/api/admin/runtime/describe" && req.method === "GET") {
      const feature = url.searchParams.get("feature") ?? "ONLINE_API_PROBE";
      const runtime = manager.getCapabilityRuntime();
      ok(deps.sendJson, res, runtime.describe(feature) as unknown as Record<string, unknown>);
      return true;
    }
    if (url.pathname === "/api/admin/runtime/execute" && req.method === "POST") {
      const body = (await parseJsonBody(req, deps.readBody)) as {
        feature?: string;
        prompt?: string;
        negativePrompt?: string;
        mode?: "probe" | "vision" | "chat" | "image-to-video" | "music-generation" | "tts";
        messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
        images?: Array<{ mimeType?: string; base64?: string }>;
        projectId?: string;
        durationSeconds?: number;
        aspectRatio?: string;
        resolution?: string;
        outputPath?: string;
        sceneId?: string;
        sourceAssetId?: string;
        voice?: string;
      };
      const feature = typeof body.feature === "string" && body.feature.trim()
        ? body.feature.trim()
        : "ONLINE_API_PROBE";
      // Phase 1 probe + Phase 2 vision + Phase 3 creative + Phase 4 I2V + Phase 5 music/TTS.
      if (
        feature !== "ONLINE_API_PROBE"
        && feature !== "VISION_ANALYSIS"
        && feature !== "CREATIVE_REASONING"
        && feature !== "VIDEO_IMAGE_TO_VIDEO"
        && feature !== "MUSIC_GENERATION"
        && feature !== "TEXT_TO_SPEECH"
      ) {
        fail(
          deps.sendJson,
          res,
          400,
          "FEATURE_NOT_ALLOWED",
          "Admin runtime execute allows ONLINE_API_PROBE, VISION_ANALYSIS, CREATIVE_REASONING, VIDEO_IMAGE_TO_VIDEO, MUSIC_GENERATION, and TEXT_TO_SPEECH only",
        );
        return true;
      }
      const runtime = manager.getCapabilityRuntime();
      const images = Array.isArray(body.images)
        ? body.images
            .filter((item) => item && typeof item.base64 === "string" && item.base64.trim())
            .map((item) => ({
              mimeType: typeof item.mimeType === "string" ? item.mimeType : "image/png",
              base64: String(item.base64).trim(),
            }))
            .slice(0, 4)
        : undefined;
      const result = await runtime.execute(feature, {
        prompt: typeof body.prompt === "string" ? body.prompt : undefined,
        negativePrompt: typeof body.negativePrompt === "string" ? body.negativePrompt : undefined,
        messages: Array.isArray(body.messages) ? body.messages : undefined,
        mode: body.mode === "vision" || feature === "VISION_ANALYSIS"
          ? "vision"
          : body.mode === "chat" || feature === "CREATIVE_REASONING"
            ? "chat"
            : body.mode === "image-to-video" || feature === "VIDEO_IMAGE_TO_VIDEO"
              ? "image-to-video"
              : body.mode === "music-generation" || feature === "MUSIC_GENERATION"
                ? "music-generation"
                : body.mode === "tts" || feature === "TEXT_TO_SPEECH"
                  ? "tts"
                  : body.mode === "probe"
                    ? "probe"
                    : body.mode,
        images,
        durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : undefined,
        aspectRatio: typeof body.aspectRatio === "string" ? body.aspectRatio : undefined,
        resolution: typeof body.resolution === "string" ? body.resolution : undefined,
        outputPath: typeof body.outputPath === "string" ? body.outputPath : undefined,
        sceneId: typeof body.sceneId === "string" ? body.sceneId : undefined,
        sourceAssetId: typeof body.sourceAssetId === "string" ? body.sourceAssetId : undefined,
        voice: typeof body.voice === "string" ? body.voice : undefined,
        projectId: typeof body.projectId === "string" ? body.projectId : undefined,
      });
      ok(deps.sendJson, res, result as unknown as Record<string, unknown>);
      return true;
    }

    if (url.pathname === "/api/admin/settings" && req.method === "GET") {
      const category = url.searchParams.get("category") as never;
      ok(deps.sendJson, res, { items: manager.listSettings(category || undefined) });
      return true;
    }
    if (url.pathname === "/api/admin/settings" && req.method === "POST") {
      const body = (await parseJsonBody(req, deps.readBody)) as { key?: string; value?: unknown };
      if (!body.key) {
        fail(deps.sendJson, res, 400, "REQUIRED_FIELD", "Setting key is required");
        return true;
      }
      const saved = await manager.updateSetting(body.key, body.value as never);
      ok(deps.sendJson, res, saved as unknown as Record<string, unknown>);
      return true;
    }

    if (url.pathname === "/api/admin/usage" && req.method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? 50);
      ok(deps.sendJson, res, {
        items: manager.listUsage(limit),
        note: "Usage ledger is empty until AI operations record costs",
      });
      return true;
    }

    if (url.pathname === "/api/admin/configuration/provider" && req.method === "GET") {
      const providerId = url.searchParams.get("providerId") ?? "";
      const { AdminConfiguration } = await import("../../ai/admin-control-plane/configuration-access.js");
      const config = new AdminConfiguration(manager).getProviderConfiguration(providerId);
      if (!config) {
        fail(deps.sendJson, res, 404, "UNKNOWN_PROVIDER", "Provider not found");
        return true;
      }
      ok(deps.sendJson, res, config as unknown as Record<string, unknown>);
      return true;
    }

    if (url.pathname === "/api/admin/health" && req.method === "GET") {
      const vault = manager.getCredentialVaultStatus();
      ok(deps.sendJson, res, {
        initialized: manager.isInitialized(),
        providers: manager.listProviders().length,
        models: manager.listModels({ pageSize: 1 }).total,
        features: manager.listFeatureMappings().length,
        settings: manager.listSettings().length,
        credentialVault: vault,
      });
      return true;
    }

    fail(deps.sendJson, res, 404, "NOT_FOUND", "Unknown admin API route");
    return true;
  } catch (error) {
    if (error instanceof AdminValidationError) {
      fail(deps.sendJson, res, 400, error.code, error.message);
      return true;
    }
    if (error instanceof SyntaxError) {
      fail(deps.sendJson, res, 400, "INVALID_JSON", "Request body is not valid JSON");
      return true;
    }
    const message = error instanceof Error ? error.message : String(error);
    const redacted = /secret|api[_-]?key|password|token|credential|stack|\\\\|C:\\\\|\/home\/|\/var\/|process\.env/i.test(message);
    const safe = redacted ? "Admin request failed (details redacted)" : message;
    fail(deps.sendJson, res, 400, "ADMIN_REQUEST_FAILED", safe);
    return true;
  }
}
