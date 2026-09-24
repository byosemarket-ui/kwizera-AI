import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminControlPlaneManager } from "../../../../ai/admin-control-plane/admin-control-plane-manager.js";
import { AdminCredentialManager } from "../../../../ai/admin-control-plane/credential-manager.js";
import { createCapabilityRuntime } from "../../../../ai/admin-control-plane/capability-runtime.js";
import { FalImageToVideoAdapter } from "../../../../ai/admin-control-plane/fal-i2v-adapter.js";
import { createDefaultAdapterRegistry } from "../../../../ai/admin-control-plane/provider-adapters.js";
import { AiSecretsManager } from "../../../../ai/connector-management/secrets-manager.js";
import { AdminRuntimeImageToVideoProvider } from "../../../../ai/video-production/admin-runtime-image-to-video-provider.js";
import {
  buildI2vMotionPrompt,
  buildI2vNegativePrompt,
} from "../../../../ai/video-production/i2v-prompt.js";
import {
  cinematicProviderConfigured,
  setAdminOnlineImageToVideoAvailable,
} from "../../../../ai/video-production/production-mode-types.js";
import { resolveProductionRenderProfile } from "../../../../ai/video-production/production-render-profile.js";
import {
  getVideoGenerationProvider,
  setVideoGenerationProvider,
} from "../../../../ai/video-production/video-generation-provider.js";

const roots: string[] = [];
const originalEnv = { ...process.env };

afterEach(async () => {
  process.env = { ...originalEnv };
  setAdminOnlineImageToVideoAvailable(false);
  setVideoGenerationProvider(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function boot() {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-phase4-"));
  roots.push(storageRoot);
  const secrets = new AiSecretsManager();
  await secrets.initialize(storageRoot, "test-passphrase-phase4-i2v");
  const credentials = new AdminCredentialManager();
  credentials.attach(secrets);
  const manager = new AdminControlPlaneManager();
  await manager.initialize(storageRoot, { credentials });
  return { storageRoot, manager, credentials };
}

describe("Phase 4 — Admin-routed VIDEO_IMAGE_TO_VIDEO", () => {
  it("seeds VIDEO_IMAGE_TO_VIDEO and resolves to fal when credentialed", async () => {
    const { manager, credentials } = await boot();
    expect(manager.getFeatureMapping("VIDEO_IMAGE_TO_VIDEO")?.feature).toBe("VIDEO_IMAGE_TO_VIDEO");
    await manager.setProviderSecret("provider-fal", "fal-test-key-phase4-not-real", { enable: true });
    await manager.upsertFeatureMapping({
      feature: "VIDEO_IMAGE_TO_VIDEO",
      label: "Image to Video",
      primaryModelId: "model-fal-wan-i2v",
      fallbackModelId: "model-deterministic-video",
      providerId: "provider-fal",
      enabled: true,
    });
    const resolution = manager.resolveFeatureExecution("VIDEO_IMAGE_TO_VIDEO");
    expect(resolution.status).toBe("READY");
    expect(resolution.providerId).toBe("provider-fal");
    expect(resolution.selectedModel?.modelId).toBe("fal-ai/wan/v2.2-a14b/image-to-video");
    expect(credentials.getProviderSecret("provider-fal")).toBe("fal-test-key-phase4-not-real");
    expect(JSON.stringify(manager.getProvider("provider-fal"))).not.toContain("fal-test-key-phase4-not-real");
  });

  it("CapabilityRuntime describe reports ONLINE for fal mapping", async () => {
    const { manager, credentials } = await boot();
    await manager.setProviderSecret("provider-fal", "fal-desc-key", { enable: true });
    await manager.upsertFeatureMapping({
      feature: "VIDEO_IMAGE_TO_VIDEO",
      label: "Image to Video",
      primaryModelId: "model-fal-wan-i2v",
      fallbackModelId: "model-deterministic-video",
      providerId: "provider-fal",
      enabled: true,
    });
    const runtime = createCapabilityRuntime(manager, credentials);
    const view = runtime.describe("VIDEO_IMAGE_TO_VIDEO");
    expect(view.source).toBe("ONLINE");
    expect(view.providerId).toBe("provider-fal");
    expect(view.adapterId).toBe("fal-i2v");
    expect(JSON.stringify(view)).not.toContain("fal-desc-key");
  });

  it("fal adapter submits I2V job through HTTPS without exposing secrets", async () => {
    const adapter = new FalImageToVideoAdapter();
    const calls: Array<{ url: string; method?: string }> = [];
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-fal-out-"));
    roots.push(tmp);
    const outPath = path.join(tmp, "scene.mp4");

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: String(url), method });
      if (String(url).includes("/status")) {
        return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
      }
      if (String(url).includes("/requests/") && method === "GET" && !String(url).includes("/status")) {
        return new Response(JSON.stringify({
          video: { url: "https://cdn.example.test/out.mp4" },
        }), { status: 200 });
      }
      if (String(url).endsWith(".mp4")) {
        return new Response(Buffer.alloc(2048, 1), { status: 200 });
      }
      // submit
      return new Response(JSON.stringify({ request_id: "req-phase4-unit" }), { status: 200 });
    }));

    const result = await adapter.execute({
      provider: {
        id: "provider-fal",
        name: "fal.ai",
        type: "fal",
        kind: "EXTERNAL_API",
        baseEndpoint: "https://queue.fal.run",
        status: "active",
        enabled: true,
        healthStatus: "unchecked",
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      model: {
        id: "model-fal-wan-i2v",
        name: "fal Wan",
        providerId: "provider-fal",
        category: "VIDEO",
        capability: "image-to-video",
        modelId: "fal-ai/wan/v2.2-a14b/image-to-video",
        status: "active",
        priority: 90,
        inputType: "image",
        outputType: "video",
        currency: "USD",
        timeoutMs: 60_000,
        enabled: true,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      getSecret: () => "fal-unit-test-secret-do-not-log",
      input: {
        mode: "image-to-video",
        prompt: "PRODUCT:\nPreserve product.\n\nMOTION:\nSlow push-in.",
        negativePrompt: "do not change product shape",
        images: [{ mimeType: "image/png", base64: Buffer.from("fake-png").toString("base64") }],
        durationSeconds: 4,
        outputPath: outPath,
      },
      timeoutMs: 20_000,
      requestId: "phase4-unit",
    });

    expect(result.ok).toBe(true);
    expect(calls.some((c) => c.method === "POST")).toBe(true);
    expect(await fs.stat(outPath).then((s) => s.size)).toBeGreaterThan(1000);
    expect(JSON.stringify(result)).not.toContain("fal-unit-test-secret-do-not-log");
    expect(JSON.stringify(calls)).not.toContain("fal-unit-test-secret-do-not-log");
  });

  it("missing credential does not fabricate online success", async () => {
    const { manager, credentials } = await boot();
    // Enable fal provider without storing a secret — resolution must not claim ONLINE success.
    await manager.upsertProvider({
      id: "provider-fal",
      name: "fal.ai",
      type: "fal",
      kind: "EXTERNAL_API",
      baseEndpoint: "https://queue.fal.run",
      enabled: true,
      status: "active",
    });
    await manager.upsertFeatureMapping({
      feature: "VIDEO_IMAGE_TO_VIDEO",
      label: "Image to Video",
      primaryModelId: "model-fal-wan-i2v",
      fallbackModelId: "model-deterministic-video",
      providerId: "provider-fal",
      enabled: true,
    });
    const runtime = createCapabilityRuntime(manager, credentials);
    const view = runtime.describe("VIDEO_IMAGE_TO_VIDEO");
    // Without credential, primary fal is not READY ONLINE — may FALLBACK to local.
    expect(view.source === "ONLINE" && view.status === "READY").toBe(false);
    const result = await runtime.execute("VIDEO_IMAGE_TO_VIDEO", {
      mode: "probe",
      prompt: "probe",
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/Key |api[_-]?key/i);
  });

  it("AdminRuntimeImageToVideoProvider cannot see raw secrets and fails without online mapping", async () => {
    const { manager, credentials } = await boot();
    const provider = new AdminRuntimeImageToVideoProvider(() => {
      try {
        return createCapabilityRuntime(manager, credentials);
      } catch {
        return null;
      }
    });
    setVideoGenerationProvider(provider);
    expect(await provider.isAvailable()).toBe(false);
    expect(getVideoGenerationProvider().id).toBe("admin-runtime-i2v");
    const handle = await provider.generateVideoClip({
      projectId: "p1",
      sceneId: "s1",
      sourceAssetId: "a1",
      sourceImagePath: path.join(os.tmpdir(), "missing-phase4.png"),
      durationSeconds: 3,
    });
    expect(handle.status).toBe("failed");
    expect(JSON.stringify(handle)).not.toMatch(/api[_-]?key|Authorization/i);
  });

  it("I2V prompts preserve product identity lock constraints", () => {
    const prompt = buildI2vMotionPrompt({
      purpose: "HOOK",
      durationSeconds: 4,
      cameraHint: "push-in",
      motionHint: "slow-zoom",
      identity: {
        protectedAttributes: ["shape", "color", "logo", "sole"],
        allowedCreativeChanges: ["camera", "lighting"],
        productName: "Oak Boot",
      },
    });
    const negative = buildI2vNegativePrompt({
      protectedAttributes: ["shape", "color", "logo"],
    });
    expect(prompt).toContain("PRODUCT:");
    expect(prompt).toContain("MOTION:");
    expect(prompt).toContain("shape");
    expect(prompt).toContain("logo");
    expect(prompt).not.toMatch(/api[_-]?key|sk-|Authorization/i);
    expect(negative).toContain("do not change product shape");
    expect(negative).toContain("do not alter logo");
  });

  it("Exact Product profile never uses generative I2V", () => {
    setAdminOnlineImageToVideoAvailable(true);
    const exact = resolveProductionRenderProfile("AI_PRODUCT_MOTION");
    expect(exact.usesGenerativeVideo).toBe(false);
    const cinematic = resolveProductionRenderProfile("CINEMATIC_3D");
    expect(cinematic.usesGenerativeVideo).toBe(true);
    expect(cinematicProviderConfigured()).toBe(true);
  });

  it("default adapter registry resolves fal executable adapter", () => {
    const registry = createDefaultAdapterRegistry();
    const adapter = registry.resolve({
      id: "provider-fal",
      name: "fal.ai",
      type: "fal",
      kind: "EXTERNAL_API",
      baseEndpoint: "https://queue.fal.run",
      status: "active",
      enabled: true,
      healthStatus: "unchecked",
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(adapter?.id).toBe("fal-i2v");
  });

  it("malformed / auth-failed fal response falls back safely (no fake success)", async () => {
    const adapter = new FalImageToVideoAdapter();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "Unauthorized" }), { status: 401 })));
    await expect(adapter.execute({
      provider: {
        id: "provider-fal",
        name: "fal.ai",
        type: "fal",
        kind: "EXTERNAL_API",
        baseEndpoint: "https://queue.fal.run",
        status: "active",
        enabled: true,
        healthStatus: "unchecked",
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      model: {
        id: "model-fal-wan-i2v",
        name: "fal Wan",
        providerId: "provider-fal",
        category: "VIDEO",
        capability: "image-to-video",
        modelId: "fal-ai/wan/v2.2-a14b/image-to-video",
        status: "active",
        priority: 90,
        inputType: "image",
        outputType: "video",
        currency: "USD",
        timeoutMs: 30_000,
        enabled: true,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      getSecret: () => "bad-key",
      input: {
        mode: "image-to-video",
        prompt: "motion",
        images: [{ mimeType: "image/png", base64: "YWJj" }],
        durationSeconds: 3,
      },
      timeoutMs: 5_000,
      requestId: "phase4-auth-fail",
    })).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
  });
});
