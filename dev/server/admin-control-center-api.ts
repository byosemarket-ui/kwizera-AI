/**
 * HTTP handlers for Admin Control Plane APIs (/api/admin/*).
 * Secrets are never returned. Auth boundary is enforced on every call.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  assertAdminAccess,
  rolesFromHeaders,
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

function guard(req: IncomingMessage, res: ServerResponse, sendJson: SendJson, pathname: string): boolean {
  const decision = assertAdminAccess({
    roles: rolesFromHeaders(headersRecord(req)),
    path: pathname,
    adminApi: true,
    remoteAddress: req.socket.remoteAddress,
  });
  if (!decision.allowed) {
    sendJson(res, 403, { error: decision.reason, code: "ADMIN_FORBIDDEN" });
    return false;
  }
  return true;
}

function requireManager(deps: AdminApiDeps, res: ServerResponse): AdminControlPlaneManager | null {
  const manager = deps.getManager();
  if (!manager?.isInitialized()) {
    deps.sendJson(res, 503, { error: "Admin Control Plane is not ready", code: "ADMIN_NOT_READY" });
    return null;
  }
  return manager;
}

async function parseJsonBody(req: IncomingMessage, readBody: ReadBody): Promise<unknown> {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  return JSON.parse(raw) as unknown;
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
    // Dashboard
    if (url.pathname === "/api/admin/dashboard" && req.method === "GET") {
      const hints = deps.dashboardHints?.() ?? {};
      deps.sendJson(res, 200, manager.buildDashboard(hints));
      return true;
    }

    // Providers
    if (url.pathname === "/api/admin/providers" && req.method === "GET") {
      deps.sendJson(res, 200, { items: manager.listProviders() });
      return true;
    }
    if (url.pathname === "/api/admin/providers" && req.method === "POST") {
      const body = (await parseJsonBody(req, deps.readBody)) as Record<string, unknown>;
      const saved = await manager.upsertProvider({
        id: typeof body.id === "string" ? body.id : undefined,
        name: String(body.name ?? ""),
        type: String(body.type ?? "custom"),
        baseEndpoint: typeof body.baseEndpoint === "string" ? body.baseEndpoint : undefined,
        status: body.status as never,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        healthStatus: body.healthStatus as never,
        metadata: (body.metadata as Record<string, unknown>) ?? {},
        // credentialReference may be set only as a reference id — never accept raw API keys as response fields
        credentialReference: typeof body.credentialReference === "string" ? body.credentialReference : undefined,
      });
      deps.sendJson(res, 200, saved);
      return true;
    }
    if (url.pathname.startsWith("/api/admin/providers/") && req.method === "GET") {
      const id = decodeURIComponent(url.pathname.slice("/api/admin/providers/".length));
      const provider = manager.getProvider(id);
      if (!provider) {
        deps.sendJson(res, 404, { error: "Provider not found" });
        return true;
      }
      deps.sendJson(res, 200, provider);
      return true;
    }

    // Models
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
      deps.sendJson(res, 200, result);
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
        metadata: (body.metadata as Record<string, unknown>) ?? {},
      });
      deps.sendJson(res, 200, saved);
      return true;
    }
    if (url.pathname.match(/^\/api\/admin\/models\/[^/]+\/enabled$/) && req.method === "POST") {
      const id = decodeURIComponent(url.pathname.split("/")[4] ?? "");
      const body = (await parseJsonBody(req, deps.readBody)) as { enabled?: boolean };
      const saved = await manager.setModelEnabled(id, Boolean(body.enabled));
      deps.sendJson(res, 200, saved);
      return true;
    }
    if (url.pathname.startsWith("/api/admin/models/") && req.method === "GET") {
      const id = decodeURIComponent(url.pathname.slice("/api/admin/models/".length));
      const model = manager.getModel(id);
      if (!model) {
        deps.sendJson(res, 404, { error: "Model not found" });
        return true;
      }
      deps.sendJson(res, 200, model);
      return true;
    }

    // Feature mappings
    if (url.pathname === "/api/admin/features" && req.method === "GET") {
      const items = manager.listFeatureMappings().map((mapping) => {
        const resolved = manager.resolveFeature(mapping.feature);
        return {
          ...mapping,
          primaryModelName: resolved.primaryModel?.name ?? null,
          secondaryModelName: resolved.secondaryModel?.name ?? null,
          fallbackModelName: resolved.fallbackModel?.name ?? null,
          providerName: resolved.provider?.name ?? null,
        };
      });
      deps.sendJson(res, 200, { items });
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
        metadata: (body.metadata as Record<string, unknown>) ?? {},
      });
      deps.sendJson(res, 200, saved);
      return true;
    }
    if (url.pathname.startsWith("/api/admin/features/resolve/") && req.method === "GET") {
      const feature = decodeURIComponent(url.pathname.slice("/api/admin/features/resolve/".length));
      deps.sendJson(res, 200, manager.resolveFeature(feature));
      return true;
    }

    // Settings
    if (url.pathname === "/api/admin/settings" && req.method === "GET") {
      const category = url.searchParams.get("category") as never;
      deps.sendJson(res, 200, { items: manager.listSettings(category || undefined) });
      return true;
    }
    if (url.pathname === "/api/admin/settings" && req.method === "POST") {
      const body = (await parseJsonBody(req, deps.readBody)) as { key?: string; value?: unknown };
      if (!body.key) {
        deps.sendJson(res, 400, { error: "Setting key is required" });
        return true;
      }
      const saved = await manager.updateSetting(body.key, body.value as never);
      deps.sendJson(res, 200, saved);
      return true;
    }

    // Usage (read-only foundation)
    if (url.pathname === "/api/admin/usage" && req.method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? 50);
      deps.sendJson(res, 200, { items: manager.listUsage(limit), note: "Usage ledger is empty until AI operations record costs" });
      return true;
    }

    // Health of the control plane itself
    if (url.pathname === "/api/admin/health" && req.method === "GET") {
      deps.sendJson(res, 200, {
        ok: true,
        initialized: manager.isInitialized(),
        providers: manager.listProviders().length,
        models: manager.listModels({ pageSize: 1 }).total,
        features: manager.listFeatureMappings().length,
        settings: manager.listSettings().length,
      });
      return true;
    }

    deps.sendJson(res, 404, { error: "Unknown admin API route", path: url.pathname });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Never echo secrets
    const safe = /secret|api[_-]?key|password|token|credential/i.test(message)
      ? "Admin request failed (details redacted)"
      : message;
    deps.sendJson(res, 400, { error: safe });
    return true;
  }
}
