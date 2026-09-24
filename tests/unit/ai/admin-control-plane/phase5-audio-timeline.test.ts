import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminControlPlaneManager } from "../../../../ai/admin-control-plane/admin-control-plane-manager.js";
import { AdminCredentialManager } from "../../../../ai/admin-control-plane/credential-manager.js";
import { createCapabilityRuntime } from "../../../../ai/admin-control-plane/capability-runtime.js";
import { OpenAiProviderAdapter } from "../../../../ai/admin-control-plane/openai-adapter.js";
import { FalProviderAdapter } from "../../../../ai/admin-control-plane/fal-music-adapter.js";
import { createDefaultAdapterRegistry } from "../../../../ai/admin-control-plane/provider-adapters.js";
import { AiSecretsManager } from "../../../../ai/connector-management/secrets-manager.js";
import { AdminRuntimeMusicGenerationProvider } from "../../../../ai/ai-sound/admin-runtime-music-provider.js";
import {
  buildVoiceScriptFromPlan,
  AdminRuntimeTtsProvider,
} from "../../../../ai/video-production/admin-runtime-tts-provider.js";
import { buildMusicGenerationSpec } from "../../../../ai/ai-sound/music-generation-spec.js";
import { normalizeProjectAudio } from "../../../../ai/creative-workspace/audio-asset.js";

const roots: string[] = [];
const originalEnv = { ...process.env };

afterEach(async () => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function boot() {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-phase5-"));
  roots.push(storageRoot);
  const secrets = new AiSecretsManager();
  await secrets.initialize(storageRoot, "test-passphrase-phase5-audio");
  const credentials = new AdminCredentialManager();
  credentials.attach(secrets);
  const manager = new AdminControlPlaneManager();
  await manager.initialize(storageRoot, { credentials });
  return { storageRoot, manager, credentials };
}

describe("Phase 5 — Admin-routed music + TTS + audio plan", () => {
  it("seeds MUSIC_GENERATION and TEXT_TO_SPEECH with Admin models", async () => {
    const { manager } = await boot();
    expect(manager.getFeatureMapping("MUSIC_GENERATION")?.primaryModelId).toBe("model-fal-stable-audio");
    expect(manager.getFeatureMapping("TEXT_TO_SPEECH")?.primaryModelId).toBe("model-openai-tts-1");
    expect(manager.getModel("model-fal-stable-audio")?.modelId).toContain("stable-audio");
    expect(manager.getModel("model-openai-tts-1")?.modelId).toBe("tts-1");
  });

  it("routes MUSIC_GENERATION through CapabilityRuntime when fal is credentialed", async () => {
    const { manager, credentials } = await boot();
    await manager.setProviderSecret("provider-fal", "fal-phase5-music-key", { enable: true });
    await manager.upsertFeatureMapping({
      feature: "MUSIC_GENERATION",
      label: "Music Generation",
      primaryModelId: "model-fal-stable-audio",
      providerId: "provider-fal",
      enabled: true,
    });
    const resolution = manager.resolveFeatureExecution("MUSIC_GENERATION");
    expect(resolution.status).toBe("READY");
    expect(resolution.providerId).toBe("provider-fal");
    const runtime = createCapabilityRuntime(manager, credentials);
    const view = runtime.describe("MUSIC_GENERATION");
    expect(view.source).toBe("ONLINE");
    expect(view.adapterId).toBe("fal");
    expect(JSON.stringify(view)).not.toContain("fal-phase5-music-key");
  });

  it("routes TEXT_TO_SPEECH through CapabilityRuntime when OpenAI is credentialed", async () => {
    const { manager, credentials } = await boot();
    await manager.setProviderSecret("provider-openai", "sk-phase5-tts-key", { enable: true });
    await manager.upsertFeatureMapping({
      feature: "TEXT_TO_SPEECH",
      label: "Text to Speech",
      primaryModelId: "model-openai-tts-1",
      providerId: "provider-openai",
      enabled: true,
    });
    const runtime = createCapabilityRuntime(manager, credentials);
    const view = runtime.describe("TEXT_TO_SPEECH");
    expect(view.source).toBe("ONLINE");
    expect(view.providerId).toBe("provider-openai");
    expect(JSON.stringify(view)).not.toContain("sk-phase5-tts-key");
  });

  it("OpenAI adapter TTS mode writes audio without exposing secrets", async () => {
    const adapter = new OpenAiProviderAdapter();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-tts-"));
    roots.push(tmp);
    const outPath = path.join(tmp, "voice.mp3");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(Buffer.alloc(2048, 7), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    })));

    const result = await adapter.execute({
      provider: {
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
      },
      model: {
        id: "model-openai-tts-1",
        name: "TTS",
        providerId: "provider-openai",
        category: "TTS",
        capability: "text-to-speech",
        modelId: "tts-1",
        status: "active",
        priority: 80,
        inputType: "text",
        outputType: "audio",
        currency: "USD",
        timeoutMs: 30_000,
        enabled: true,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      getSecret: () => "sk-tts-secret-do-not-log",
      input: {
        mode: "tts",
        prompt: "Shop the Oak Boot today.",
        outputPath: outPath,
        voice: "alloy",
      },
      timeoutMs: 10_000,
      requestId: "phase5-tts",
    });

    expect(result.ok).toBe(true);
    expect(await fs.stat(outPath).then((s) => s.size)).toBeGreaterThan(100);
    expect(JSON.stringify(result)).not.toContain("sk-tts-secret-do-not-log");
  });

  it("fal music adapter submits through HTTPS without exposing secrets", async () => {
    const adapter = new FalProviderAdapter();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-music-"));
    roots.push(tmp);
    const outPath = path.join(tmp, "bed.mp3");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (String(url).includes("/status")) {
        return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
      }
      if (String(url).includes("/requests/") && method === "GET" && !String(url).includes("/status")) {
        return new Response(JSON.stringify({
          audio_file: { url: "https://cdn.example.test/bed.mp3" },
        }), { status: 200 });
      }
      if (String(url).endsWith(".mp3")) {
        return new Response(Buffer.alloc(1024, 2), { status: 200 });
      }
      return new Response(JSON.stringify({ request_id: "music-req-1" }), { status: 200 });
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
        id: "model-fal-stable-audio",
        name: "Stable Audio",
        providerId: "provider-fal",
        category: "MUSIC",
        capability: "music-generation",
        modelId: "fal-ai/stable-audio-25/text-to-audio",
        status: "active",
        priority: 80,
        inputType: "text",
        outputType: "audio",
        currency: "USD",
        timeoutMs: 60_000,
        enabled: true,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      getSecret: () => "fal-music-secret-do-not-log",
      input: {
        mode: "music-generation",
        prompt: "Instrumental amapiano bed, medium energy",
        durationSeconds: 12,
        outputPath: outPath,
      },
      timeoutMs: 20_000,
      requestId: "phase5-music",
    });

    expect(result.ok).toBe(true);
    expect(await fs.stat(outPath).then((s) => s.size)).toBeGreaterThan(100);
    expect(JSON.stringify(result)).not.toContain("fal-music-secret-do-not-log");
  });

  it("missing music credential does not fabricate online success", async () => {
    const { manager, credentials } = await boot();
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
      feature: "MUSIC_GENERATION",
      label: "Music Generation",
      primaryModelId: "model-fal-stable-audio",
      providerId: "provider-fal",
      enabled: true,
    });
    const runtime = createCapabilityRuntime(manager, credentials);
    const view = runtime.describe("MUSIC_GENERATION");
    expect(view.source === "ONLINE" && view.status === "READY").toBe(false);
    const provider = new AdminRuntimeMusicGenerationProvider(() => runtime);
    expect(await provider.isAvailable()).toBe(false);
  });

  it("voice script builder uses plan narration and CTA only — never invents prices", () => {
    const script = buildVoiceScriptFromPlan({
      scenes: [
        { narration: "Meet the Oak Boot.", purpose: "HOOK" },
        { narration: "Crafted for everyday comfort.", purpose: "FEATURE" },
      ],
      callToAction: "Shop now",
      productName: "Oak Boot",
    });
    expect(script).toContain("Oak Boot");
    expect(script).toContain("Shop now");
    expect(script).not.toMatch(/\$|RWF|warranty|guarantee/i);
    expect(buildVoiceScriptFromPlan({ scenes: [] })).toBe("");
  });

  it("existing audio selection normalization preserves voice fields without breaking legacy projects", () => {
    const legacy = normalizeProjectAudio({
      selectedAudioAssetId: "audio-1",
      enabled: true,
      volume: 0.8,
    });
    expect(legacy.enabled).toBe(true);
    expect(legacy.selectedVoiceAssetId).toBeNull();
    expect(legacy.voiceEnabled).toBe(false);

    const withVoice = normalizeProjectAudio({
      selectedAudioAssetId: "audio-1",
      enabled: true,
      volume: 0.7,
      selectedVoiceAssetId: "voice-1",
      voiceEnabled: true,
      voiceVolume: 0.9,
      beatSyncMode: "SMART",
    });
    expect(withVoice.voiceEnabled).toBe(true);
    expect(withVoice.selectedVoiceAssetId).toBe("voice-1");
    expect(withVoice.voiceVolume).toBe(0.9);
  });

  it("music generation spec stays instrumental commercial-purpose", () => {
    const spec = buildMusicGenerationSpec({
      durationSeconds: 15,
      productCategory: "Footwear",
      mood: "MODERN",
      energy: "MEDIUM",
    });
    expect(spec.instrumentalOnly).toBe(true);
    expect(spec.vocalMode).toBe("none");
    expect(spec.purpose).toBe("commercial_product_video");
  });

  it("AdminRuntimeTtsProvider fails honestly without online mapping", async () => {
    const { manager, credentials } = await boot();
    const provider = new AdminRuntimeTtsProvider(() => createCapabilityRuntime(manager, credentials));
    expect(await provider.isAvailable()).toBe(false);
    const result = await provider.generate({
      projectId: "p1",
      script: "Hello",
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/sk-|api[_-]?key/i);
  });

  it("default adapter registry resolves unified fal adapter", () => {
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
    expect(adapter?.id).toBe("fal");
  });
});
