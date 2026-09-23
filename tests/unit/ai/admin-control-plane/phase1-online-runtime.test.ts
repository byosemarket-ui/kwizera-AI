import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminControlPlaneManager } from "../../../../ai/admin-control-plane/admin-control-plane-manager.js";
import { AdminCredentialManager } from "../../../../ai/admin-control-plane/credential-manager.js";
import {
  assertAdminAccess,
  resolveAdminAuthMode,
  adminTokenFromHeaders,
} from "../../../../ai/admin-control-plane/admin-auth-boundary.js";
import { createCapabilityRuntime } from "../../../../ai/admin-control-plane/capability-runtime.js";
import { createDefaultAdapterRegistry } from "../../../../ai/admin-control-plane/provider-adapters.js";
import { OpenAiProviderAdapter } from "../../../../ai/admin-control-plane/openai-adapter.js";
import { AiSecretsManager } from "../../../../ai/connector-management/secrets-manager.js";

const roots: string[] = [];
const originalEnv = { ...process.env };

afterEach(async () => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function boot() {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-phase1-"));
  roots.push(storageRoot);
  const secrets = new AiSecretsManager();
  await secrets.initialize(storageRoot, "test-passphrase-phase1-online");
  const credentials = new AdminCredentialManager();
  credentials.attach(secrets);
  const manager = new AdminControlPlaneManager();
  await manager.initialize(storageRoot, { credentials });
  return { storageRoot, manager, credentials };
}

describe("Admin auth boundary — production defaults", () => {
  it("defaults to development-open outside production", () => {
    delete process.env.KWIZERA_ADMIN_AUTH_MODE;
    delete process.env.KWIZERA_ENV;
    process.env.NODE_ENV = "test";
    expect(resolveAdminAuthMode()).toBe("development-open");
    expect(assertAdminAccess({
      roles: [],
      path: "/api/admin/providers",
      adminApi: true,
    }).allowed).toBe(true);
  });

  it("requires admin role or token in production", () => {
    delete process.env.KWIZERA_ADMIN_AUTH_MODE;
    process.env.KWIZERA_ENV = "production";
    delete process.env.KWIZERA_ADMIN_API_TOKEN;
    expect(resolveAdminAuthMode()).toBe("require-admin-token");
    expect(assertAdminAccess({
      roles: [],
      path: "/api/admin/providers",
      adminApi: true,
    }).allowed).toBe(false);
    expect(assertAdminAccess({
      roles: ["admin"],
      path: "/api/admin/providers",
      adminApi: true,
    }).allowed).toBe(false);
    expect(assertAdminAccess({
      roles: ["admin"],
      path: "/api/admin/providers",
      adminApi: true,
      adminToken: "anything",
    }).allowed).toBe(false);
  });

  it("accepts Admin API token in require-admin-token mode and rejects spoofed roles", () => {
    process.env.KWIZERA_ADMIN_AUTH_MODE = "require-admin-token";
    process.env.KWIZERA_ADMIN_API_TOKEN = "phase1-test-admin-token";
    expect(assertAdminAccess({
      roles: ["admin"],
      path: "/api/admin/providers",
      adminApi: true,
    }).allowed).toBe(false);
    expect(assertAdminAccess({
      roles: [],
      path: "/api/admin/providers",
      adminApi: true,
      adminToken: "wrong",
    }).allowed).toBe(false);
    expect(assertAdminAccess({
      roles: [],
      path: "/api/admin/providers",
      adminApi: true,
      adminToken: "phase1-test-admin-token",
    }).allowed).toBe(true);
    expect(adminTokenFromHeaders({
      authorization: "Bearer phase1-test-admin-token",
    })).toBe("phase1-test-admin-token");
  });
});

describe("Phase 1 online capability runtime", () => {
  it("seeds OpenAI model and ONLINE_API_PROBE feature mapping", async () => {
    const { manager } = await boot();
    expect(manager.getModel("model-openai-gpt-4o-mini")?.modelId).toBe("gpt-4o-mini");
    expect(manager.getFeatureMapping("ONLINE_API_PROBE")?.providerId).toBe("provider-openai");
    expect(manager.getFeatureMapping("ONLINE_API_PROBE")?.enabled).toBe(false);
  });

  it("registers executable OpenAI adapter in the default registry", () => {
    const registry = createDefaultAdapterRegistry();
    const adapter = registry.resolve({
      id: "provider-openai",
      name: "OpenAI",
      type: "openai",
      kind: "EXTERNAL_API",
      baseEndpoint: "https://api.openai.com",
      status: "active",
      enabled: true,
      healthStatus: "unchecked",
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(adapter).toBeInstanceOf(OpenAiProviderAdapter);
  });

  it("consumes getProviderSecret and performs a real HTTPS-shaped OpenAI call via mocked fetch", async () => {
    const { manager, credentials } = await boot();

    await manager.upsertProvider({
      id: "provider-openai",
      name: "OpenAI",
      type: "openai",
      kind: "EXTERNAL_API",
      baseEndpoint: "https://api.openai.com",
      enabled: true,
      status: "active",
    });
    await manager.setProviderSecret("provider-openai", "sk-test-phase1-secret-value-not-real");
    expect(credentials.getProviderSecret("provider-openai")).toBe("sk-test-phase1-secret-value-not-real");

    await manager.upsertFeatureMapping({
      feature: "ONLINE_API_PROBE",
      label: "Online API Probe",
      primaryModelId: "model-openai-gpt-4o-mini",
      providerId: "provider-openai",
      enabled: true,
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const auth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
      expect(auth).toBe("Bearer sk-test-phase1-secret-value-not-real");
      if (url.includes("/v1/models")) {
        return new Response(JSON.stringify({ data: [{ id: "gpt-4o-mini" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/v1/chat/completions")) {
        return new Response(JSON.stringify({
          id: "chatcmpl-phase1",
          model: "gpt-4o-mini",
          choices: [{ message: { role: "assistant", content: "OK" } }],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const runtime = createCapabilityRuntime(manager, credentials);
    const health = await runtime.healthCheckProvider("provider-openai");
    expect(health.code).toBe("HEALTHY");
    expect(health.endpointHost).toBe("api.openai.com");
    expect(JSON.stringify(health)).not.toContain("sk-test-phase1");

    const result = await runtime.execute("ONLINE_API_PROBE", { prompt: "Reply with exactly: OK" });
    expect(result.ok).toBe(true);
    expect(result.source).toBe("ONLINE");
    expect(result.providerId).toBe("provider-openai");
    expect(result.modelId).toBe("gpt-4o-mini");
    expect(result.adapterId).toBe("openai");
    expect(result.outputText).toBe("OK");
    expect(fetchMock).toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("sk-test-phase1");

    const describe = runtime.describe("ONLINE_API_PROBE");
    expect(describe.source).toBe("ONLINE");
    expect(describe.status).toBe("READY");
  });

  it("returns AUTHENTICATION_FAILED without inventing success when OpenAI rejects the key", async () => {
    const { manager, credentials } = await boot();
    await manager.upsertProvider({
      id: "provider-openai",
      name: "OpenAI",
      type: "openai",
      enabled: true,
      status: "active",
      baseEndpoint: "https://api.openai.com",
    });
    await manager.setProviderSecret("provider-openai", "sk-invalid-phase1");
    await manager.upsertFeatureMapping({
      feature: "ONLINE_API_PROBE",
      label: "Online API Probe",
      primaryModelId: "model-openai-gpt-4o-mini",
      providerId: "provider-openai",
      enabled: true,
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: { message: "Incorrect API key provided", type: "invalid_request_error" },
    }), { status: 401, headers: { "Content-Type": "application/json" } })));

    const runtime = createCapabilityRuntime(manager, credentials);
    const result = await runtime.execute("ONLINE_API_PROBE");
    expect(result.ok).toBe(false);
    expect(result.source).toBe("ONLINE");
    expect(result.errorCode).toBe("AUTHENTICATION_FAILED");
    expect(result.httpStatus).toBe(401);
    expect(JSON.stringify(result)).not.toContain("sk-invalid");
  });

  it("does not break local Ollama feature mapping for LLM_CHAT", async () => {
    const { manager } = await boot();
    const resolved = manager.resolveFeatureExecution("LLM_CHAT");
    expect(resolved.providerId).toBe("provider-ollama-local");
    expect(resolved.status).toBe("READY");
  });

  it("seeds the Phase 1 capability catalog without claiming fake online readiness", async () => {
    const { manager } = await boot();
    const features = manager.listFeatureMappings().map((item) => item.feature);
    for (const key of [
      "VISION_ANALYSIS",
      "LLM_REASONING",
      "IMAGE_GENERATION",
      "IMAGE_EDITING",
      "IMAGE_SEGMENTATION",
      "IMAGE_UPSCALE",
      "IMAGE_TO_VIDEO",
      "VIDEO_IMAGE_TO_VIDEO",
      "VIDEO_GENERATION",
      "MUSIC_GENERATION",
      "TEXT_TO_SPEECH",
      "SPEECH_TO_TEXT",
      "AUDIO_INTELLIGENCE",
      "VIDEO_QA",
      "IMAGE_QA",
      "ONLINE_API_PROBE",
    ]) {
      expect(features, key).toContain(key);
    }
    expect(manager.getFeatureMapping("ONLINE_API_PROBE")?.enabled).toBe(false);
    expect(manager.getFeatureMapping("IMAGE_GENERATION")?.enabled).toBe(false);
    expect(manager.getFeatureMapping("IMAGE_GENERATION")?.metadata.comingSoon).toBe(true);
    expect(manager.getFeatureMapping("VIDEO_QA")?.metadata.pendingProvider).toBe(true);
  });
});
