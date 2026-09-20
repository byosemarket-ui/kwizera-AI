import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AdminControlPlaneManager } from "../../../../ai/admin-control-plane/admin-control-plane-manager.js";
import { handleAdminApi } from "../../../../dev/server/admin-control-center-api.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function withServer(manager: AdminControlPlaneManager) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    void handleAdminApi(req, res, url, {
      getManager: () => manager,
      sendJson: (response, status, data) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(data));
      },
      readBody: async (request) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        return Buffer.concat(chunks).toString("utf8");
      },
      dashboardHints: () => ({ aiCoreOnline: true, storageOk: true }),
    }).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end("not admin");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return { server, port: address.port };
}

async function boot() {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-admin-api-"));
  roots.push(storageRoot);
  const manager = new AdminControlPlaneManager();
  await manager.initialize(storageRoot);
  return { storageRoot, manager };
}

async function json(port: number, pathname: string, init?: RequestInit) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, init);
  const body = await response.json() as Record<string, unknown> & {
    ok?: boolean;
    error?: { code?: string; message?: string };
    items?: unknown[];
  };
  return { status: response.status, body };
}

describe("Admin API routes", () => {
  it("serves dashboard, models, providers, features, settings and never returns raw secrets", async () => {
    const { manager } = await boot();
    await manager.upsertProvider({
      name: "Secret Holder",
      type: "custom",
      credentialReference: "super-secret-value-do-not-leak",
      enabled: true,
      status: "active",
    });

    const { server, port } = await withServer(manager);
    try {
      const dashboard = await json(port, "/api/admin/dashboard");
      expect(dashboard.status).toBe(200);
      expect(dashboard.body.ok).toBe(true);
      expect(dashboard.body.system).toBeTruthy();
      expect((dashboard.body.cost as { today: string }).today).toBe("Not available yet");

      const providers = await json(port, "/api/admin/providers");
      const holder = (providers.body.items as Array<{ name: string; hasCredential: boolean; credentialReference?: string }>)
        .find((item) => item.name === "Secret Holder");
      expect(holder?.hasCredential).toBe(true);
      expect(holder?.credentialReference).toBeUndefined();
      expect(JSON.stringify(providers.body)).not.toContain("super-secret-value-do-not-leak");

      const models = await json(port, "/api/admin/models");
      expect(models.status).toBe(200);
      expect(Number(models.body.total)).toBeGreaterThan(0);

      const features = await json(port, "/api/admin/features");
      expect(features.status).toBe(200);
      expect((features.body.items as unknown[]).length).toBeGreaterThan(0);

      const settings = await json(port, "/api/admin/settings");
      expect(settings.status).toBe(200);
      expect((settings.body.items as unknown[]).length).toBeGreaterThan(0);

      const health = await json(port, "/api/admin/health");
      expect(health.status).toBe(200);
      expect(health.body.ok).toBe(true);
      expect(health.body.initialized).toBe(true);

      const usage = await json(port, "/api/admin/usage");
      expect(usage.status).toBe(200);
      expect(Array.isArray(usage.body.items)).toBe(true);

      const resolved = await json(port, "/api/admin/features/resolve/LLM_CHAT");
      expect(resolved.status).toBe(200);
      expect(resolved.body.ok).toBe(true);
      expect(["READY", "FALLBACK", "UNAVAILABLE"]).toContain(resolved.body.status);

      const leaked = await json(port, "/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bad", type: "custom", credentialReference: "sk-this-must-not-be-accepted-as-a-reference" }),
      });
      expect(leaked.status).toBe(400);
      expect(leaked.body.ok).toBe(false);
      expect(leaked.body.error).toMatchObject({ code: "CREDENTIAL_REQUIRED" });
      expect(JSON.stringify(leaked.body)).not.toContain("sk-this-must-not-be-accepted-as-a-reference");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it("does not handle public routes as Admin APIs", async () => {
    const { manager } = await boot();
    const handled = await handleAdminApi(
      { method: "GET", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as never,
      { writeHead() { /* unused */ }, end() { /* unused */ } } as never,
      new URL("http://127.0.0.1/api/health"),
      {
        getManager: () => manager,
        sendJson: () => undefined,
        readBody: async () => "",
      },
    );
    expect(handled).toBe(false);
  });

  it("rejects Admin APIs when KWIZERA_ADMIN_AUTH_MODE=deny-all and allows require-admin-role with a role header", async () => {
    const { manager } = await boot();
    const { server, port } = await withServer(manager);
    const previous = process.env.KWIZERA_ADMIN_AUTH_MODE;
    try {
      process.env.KWIZERA_ADMIN_AUTH_MODE = "deny-all";
      const denied = await json(port, "/api/admin/models");
      expect(denied.status).toBe(403);
      expect(denied.body.ok).toBe(false);
      expect(denied.body.error).toMatchObject({ code: "ADMIN_FORBIDDEN" });

      process.env.KWIZERA_ADMIN_AUTH_MODE = "require-admin-role";
      const missingRole = await json(port, "/api/admin/dashboard");
      expect(missingRole.status).toBe(403);

      const withRole = await json(port, "/api/admin/health", {
        headers: { "x-kwizera-admin-role": "admin" },
      });
      expect(withRole.status).toBe(200);
      expect(withRole.body.ok).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.KWIZERA_ADMIN_AUTH_MODE;
      else process.env.KWIZERA_ADMIN_AUTH_MODE = previous;
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it("validates model and settings mutations and persists across a manager re-init", async () => {
    const { storageRoot, manager } = await boot();
    const { server, port } = await withServer(manager);
    try {
      const providers = await json(port, "/api/admin/providers");
      const ollama = (providers.body.items as Array<{ id: string; type: string }>).find((item) => item.type === "ollama");
      expect(ollama).toBeTruthy();

      const created = await json(port, "/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Step C Probe",
          providerId: ollama!.id,
          category: "LLM",
          capability: "chat",
          modelId: "step-c-probe",
          enabled: true,
          status: "active",
          timeoutMs: 12_000,
          priority: 11,
        }),
      });
      expect(created.status).toBe(200);
      expect(created.body.ok).toBe(true);
      expect(created.body.name).toBe("Step C Probe");
      const modelId = String(created.body.id);

      const badProvider = await json(port, "/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ghost",
          providerId: "does-not-exist",
          category: "LLM",
          capability: "chat",
          modelId: "ghost",
        }),
      });
      expect(badProvider.status).toBe(400);
      expect(badProvider.body.error).toMatchObject({ code: "UNKNOWN_PROVIDER" });

      const badTimeout = await json(port, "/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Timeout",
          providerId: ollama!.id,
          category: "LLM",
          capability: "chat",
          modelId: "timeout-bad",
          timeoutMs: 0,
        }),
      });
      expect(badTimeout.body.error).toMatchObject({ code: "INVALID_TIMEOUT" });

      const badCategory = await json(port, "/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Cat",
          providerId: ollama!.id,
          category: "NOT_A_CATEGORY",
          capability: "chat",
          modelId: "cat-bad",
        }),
      });
      expect(badCategory.body.error).toMatchObject({ code: "INVALID_CATEGORY" });

      const badCost = await json(port, "/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Cost",
          providerId: ollama!.id,
          category: "LLM",
          capability: "chat",
          modelId: "cost-bad",
          estimatedCost: -1,
        }),
      });
      expect(badCost.body.error).toMatchObject({ code: "INVALID_COST" });

      const badPriority = await json(port, "/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Pri",
          providerId: ollama!.id,
          category: "LLM",
          capability: "chat",
          modelId: "pri-bad",
          priority: 5000,
        }),
      });
      expect(badPriority.body.error).toMatchObject({ code: "INVALID_PRIORITY" });

      const enabled = await json(port, `/api/admin/models/${encodeURIComponent(modelId)}/enabled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      expect(enabled.status).toBe(200);
      expect(enabled.body.enabled).toBe(false);

      const setting = await json(port, "/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "limits.queueConcurrency", value: 4 }),
      });
      expect(setting.status).toBe(200);
      expect(setting.body.value).toBe(4);

      const unknownSetting = await json(port, "/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "does.not.exist", value: true }),
      });
      expect(unknownSetting.status).toBe(400);
      expect(unknownSetting.body.error).toMatchObject({ code: "INVALID_SETTING" });

      const typeMismatch = await json(port, "/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "limits.queueConcurrency", value: "nope" }),
      });
      expect(typeMismatch.status).toBe(400);
      expect(typeMismatch.body.error).toMatchObject({ code: "INVALID_SETTING" });

      const range = await json(port, "/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "limits.queueConcurrency", value: 9999 }),
      });
      expect(range.status).toBe(400);

      const invalidJson = await json(port, "/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      expect(invalidJson.status).toBe(400);
      expect(invalidJson.body.error).toMatchObject({ code: "INVALID_JSON" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }

    const restored = new AdminControlPlaneManager();
    await restored.initialize(storageRoot);
    expect(restored.listModels({ search: "step-c-probe" }).items[0]?.name).toBe("Step C Probe");
    expect(restored.listModels({ search: "step-c-probe" }).items[0]?.enabled).toBe(false);
    expect(restored.getSetting("limits.queueConcurrency")?.value).toBe(4);

    const { server: server2, port: port2 } = await withServer(restored);
    try {
      const models = await json(port2, "/api/admin/models?search=step-c-probe");
      expect((models.body.items as Array<{ name: string; enabled: boolean }>)[0]).toMatchObject({
        name: "Step C Probe",
        enabled: false,
      });
      const settings = await json(port2, "/api/admin/settings");
      const concurrency = (settings.body.items as Array<{ key: string; value: unknown }>)
        .find((item) => item.key === "limits.queueConcurrency");
      expect(concurrency?.value).toBe(4);
    } finally {
      await new Promise<void>((resolve, reject) => server2.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it("resolves features over HTTP without exposing secrets or selecting an arbitrary model", async () => {
    const { manager } = await boot();
    const local = manager.listProviders().find((provider) => provider.type === "ollama")!;
    const primary = await manager.upsertModel({
      name: "API Primary",
      providerId: local.id,
      category: "LLM",
      capability: "chat",
      modelId: "api-primary",
      enabled: true,
      status: "active",
      metadata: {},
      currency: "USD",
      timeoutMs: 1000,
      inputType: "text",
      outputType: "text",
    });
    const secondary = await manager.upsertModel({
      name: "API Secondary",
      providerId: local.id,
      category: "LLM",
      capability: "chat",
      modelId: "api-secondary",
      enabled: true,
      status: "active",
      metadata: {},
      currency: "USD",
      timeoutMs: 1000,
      inputType: "text",
      outputType: "text",
    });
    await manager.upsertFeatureMapping({
      feature: "LLM_CHAT",
      label: "LLM Chat",
      primaryModelId: primary.id,
      secondaryModelId: secondary.id,
      providerId: local.id,
      enabled: true,
    });

    const { server, port } = await withServer(manager);
    try {
      const ready = await json(port, "/api/admin/features/resolve/LLM_CHAT");
      expect(ready.body.status).toBe("READY");
      expect(ready.body.source).toBe("PRIMARY");
      expect(ready.body.selectedModelId).toBe(primary.id);
      expect(JSON.stringify(ready.body)).not.toMatch(/sk-|passphrase|BEGIN /);

      await manager.setModelEnabled(primary.id, false);
      const fallback = await json(port, "/api/admin/features/resolve/LLM_CHAT");
      expect(fallback.body.status).toBe("FALLBACK");
      expect(fallback.body.source).toBe("SECONDARY");
      expect(fallback.body.selectedModelId).toBe(secondary.id);

      await manager.setModelEnabled(secondary.id, false);
      const none = await json(port, "/api/admin/features/resolve/LLM_CHAT");
      expect(none.body.status).toBe("UNAVAILABLE");
      expect(none.body.source).toBe("NONE");
      expect(none.body.selectedModelId).toBeNull();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
