import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiSoundManager,
  AudioStyleProfileStore,
  TestFixtureMusicGenerationProvider,
  UnavailableMusicGenerationProvider,
  buildMusicGenerationSpec,
  generatedAudioTitle,
  resolveProductionMusicProvider,
} from "../../../../ai/ai-sound/index.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { AudioIntelligenceManager } from "../../../../ai/audio-intelligence/audio-intelligence-manager.js";
import { ffmpegAvailable, ffprobeAvailable, probeAudio } from "../../../../ai/video-production/ffmpeg-renderer.js";
import { normalizeProjectAudio } from "../../../../ai/creative-workspace/audio-asset.js";

async function waitForJob(
  sound: AiSoundManager,
  jobId: string,
  timeoutMs = 45_000,
) {
  const started = Date.now();
  let job = await sound.getJob(jobId);
  while (
    job
    && !["READY", "FAILED", "CANCELLED", "TIMEOUT"].includes(job.status)
    && Date.now() - started < timeoutMs
  ) {
    await new Promise((r) => setTimeout(r, 150));
    job = await sound.getJob(jobId);
  }
  return job;
}

describe("STEP 2E MusicGenerationSpec / Sound Director", () => {
  it("builds structured product-context specs for luxury vs sport categories", () => {
    const luxury = buildMusicGenerationSpec({
      productCategory: "Luxury Watch",
      campaignObjective: "Brand Awareness",
      durationSeconds: 15,
      platform: "instagram-reels",
    });
    expect(luxury.version).toBe("music-generation-spec-v1");
    expect(luxury.purpose).toBe("commercial_product_video");
    expect(luxury.instrumentalOnly).toBe(true);
    expect(luxury.vocalMode).toBe("none");
    expect(luxury.mood).toBe("PREMIUM");
    expect(luxury.structure.map((s) => s.label)).toContain("climax");
    expect(luxury.durationSeconds).toBe(15);

    const sport = buildMusicGenerationSpec({
      productCategory: "Running Shoes",
      campaignObjective: "Promote Sale",
      durationSeconds: 30,
    });
    expect(sport.mood).toBe("ENERGETIC");
    expect(sport.energy).toBe("HIGH");
    expect(sport.tempoRange[0]).toBeGreaterThanOrEqual(115);
    expect(sport.structure.some((s) => s.label === "main")).toBe(true);
  });

  it("applies style profile BPM and energy preferences", () => {
    const spec = buildMusicGenerationSpec({
      productCategory: "Bakery",
      durationSeconds: 20,
      mode: "STYLE_PROFILE",
      styleProfile: {
        profileId: "p1",
        version: "audio-style-profile-v1",
        name: "Test Style",
        projectId: "proj-a",
        preferences: {
          bpmMin: 110,
          bpmMax: 125,
          preferredEnergy: "high",
          rhythmDensity: "dense",
          instrumentationHints: ["punchy drums"],
          introPreference: "short",
          climaxPreference: "late",
          outroPreference: "strong",
          advertisingIntensity: "high",
          moods: ["ENERGETIC"],
        },
        sourceAudioAssetIds: ["a1"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    expect(spec.mode).toBe("STYLE_PROFILE");
    expect(spec.tempoRange).toEqual([110, 125]);
    expect(spec.energy).toBe("HIGH");
    expect(spec.mood).toBe("ENERGETIC");
    expect(spec.instrumentation).toContain("punchy drums");
  });

  it("names generated assets with mood and date, not UUID titles", () => {
    const spec = buildMusicGenerationSpec({ productCategory: "tech", durationSeconds: 15 });
    const title = generatedAudioTitle(spec, new Date("2026-09-05T12:00:00Z"));
    expect(title).toMatch(/^AI Beat — .+ Product Ad — 2026-09-05$/);
    expect(title).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });
});

describe("STEP 2E provider abstraction", () => {
  it("production resolver defaults to unavailable (no fake READY)", async () => {
    const prev = process.env.KWIZERA_AI_SOUND_TEST_PROVIDER;
    delete process.env.KWIZERA_AI_SOUND_TEST_PROVIDER;
    try {
      const provider = resolveProductionMusicProvider();
      expect(provider.id).toBe("music-provider-unavailable");
      const health = await provider.healthCheck();
      expect(health.available).toBe(false);
      expect(health.status).toBe("UNAVAILABLE");
      await expect(provider.generate({
        projectId: "x",
        spec: buildMusicGenerationSpec({ durationSeconds: 10 }),
      })).rejects.toBeTruthy();
    } finally {
      if (prev !== undefined) process.env.KWIZERA_AI_SOUND_TEST_PROVIDER = prev;
    }
  });

  it("test fixture provider writes a real non-empty WAV", async () => {
    const provider = new TestFixtureMusicGenerationProvider();
    expect(await provider.isAvailable()).toBe(true);
    const result = await provider.generate({
      projectId: "test",
      spec: buildMusicGenerationSpec({ durationSeconds: 3, energy: "HIGH", tempo: "FAST" }),
    });
    const buf = await fs.readFile(result.filePath);
    expect(buf.length).toBeGreaterThan(1000);
    expect(result.mimeType).toBe("audio/wav");
    expect(result.durationMs).toBeGreaterThan(0);
    if (await ffmpegAvailable()) {
      const probed = await probeAudio(result.filePath);
      expect(probed.durationMs).toBeGreaterThan(500);
    }
    await fs.rm(path.dirname(result.filePath), { recursive: true, force: true });
  });
});

describe("STEP 2E style profile store", () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-2e-style-"));
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("creates and isolates project style profiles", async () => {
    const store = new AudioStyleProfileStore();
    await store.initialize(root);
    const prefs = store.preferencesFromAnalyses([
      { bpm: 118, meanEnergy: 0.7, beatDensity: [{ density: "dense" }] },
      { bpm: 122, meanEnergy: 0.72, beatDensity: [{ density: "dense" }] },
    ]);
    expect(prefs.bpmMin).toBeLessThanOrEqual(118);
    expect(prefs.bpmMax).toBeGreaterThanOrEqual(122);
    expect(prefs.preferredEnergy).toBe("high");
    expect(prefs.rhythmDensity).toBe("dense");

    const a = await store.upsert({
      name: "Project A Style",
      projectId: "proj-a",
      preferences: prefs,
      sourceAudioAssetIds: ["a1", "a2"],
    });
    const b = await store.upsert({
      name: "Project B Style",
      projectId: "proj-b",
      preferences: { ...prefs, preferredEnergy: "low" },
      sourceAudioAssetIds: ["b1"],
    });
    const listA = await store.list("proj-a");
    const listB = await store.list("proj-b");
    expect(listA.some((p) => p.profileId === a.profileId)).toBe(true);
    expect(listA.every((p) => p.projectId === "proj-a" || p.projectId == null)).toBe(true);
    expect(listB.some((p) => p.profileId === b.profileId)).toBe(true);
    expect(listA.find((p) => p.profileId === b.profileId)).toBeUndefined();

    const signal = await store.recordPreferenceSignal({
      projectId: "proj-a",
      audioAssetId: "gen-1",
      signal: "like_style",
    });
    expect(signal.signal).toBe("like_style");
    const signals = await store.listPreferenceSignals("proj-a");
    expect(signals).toHaveLength(1);
  });
});

describe("STEP 2E generation lifecycle", () => {
  let root: string;
  let workspace: CreativeWorkspaceManager;
  let intelligence: AudioIntelligenceManager;
  let sound: AiSoundManager;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-2e-mgr-"));
    workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    intelligence = new AudioIntelligenceManager();
    await intelligence.initialize(root, { workspace });
    sound = new AiSoundManager();
    await sound.initialize(root, { workspace, audioIntelligence: intelligence });
  });

  afterEach(async () => {
    for (let i = 0; i < 50 && sound.hasActiveJobs(); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    await new Promise((r) => setTimeout(r, 50));
    await fs.rm(root, { recursive: true, force: true });
  });

  async function makeProject(name: string) {
    return workspace.createProject(name);
  }

  it("refuses generation when provider unavailable — no READY asset", async () => {
    sound.setProviderForTests(new UnavailableMusicGenerationProvider());
    const project = await makeProject("No Provider");
    await expect(sound.startGeneration({ projectId: project.id })).rejects.toMatchObject({
      code: "MUSIC_GENERATION_UNAVAILABLE",
    });
    const lib = await workspace.listAudioLibrary();
    expect(lib.filter((a) => a.sourceType === "AI_GENERATED")).toHaveLength(0);
  });

  it("test fixture → AI_GENERATED asset → selectedAudioAssetId (project isolation)", async () => {
    if (!(await ffprobeAvailable())) return;
    sound.setProviderForTests(new TestFixtureMusicGenerationProvider());
    const projectA = await makeProject("Proj A");
    const projectB = await makeProject("Proj B");

    const jobA = await sound.startGeneration({
      projectId: projectA.id,
      mood: "ENERGETIC",
      energy: "HIGH",
      durationSeconds: 4,
      titleHint: "AI Beat 01",
    });
    expect(jobA.status).toBe("QUEUED");

    const readyA = await waitForJob(sound, jobA.jobId);
    expect(readyA?.status, readyA?.error ?? readyA?.stageMessage ?? "").toBe("READY");
    expect(readyA?.audioAssetId).toBeTruthy();

    const assetA = await workspace.getAudioAsset(readyA!.audioAssetId!);
    expect(assetA?.sourceType).toBe("AI_GENERATED");
    expect(assetA?.title).toContain("AI Beat");
    expect(assetA?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(assetA?.durationMs).toBeGreaterThan(0);
    expect(assetA?.metadata?.providerId).toBe("music-provider-test-fixture");
    expect(assetA?.metadata?.generationSpec).toBeTruthy();

    const refreshedA = await workspace.getProject(projectA.id);
    expect(refreshedA?.selectedAudioAssetId).toBe(readyA!.audioAssetId);

    const jobB = await sound.startGeneration({
      projectId: projectB.id,
      mood: "WARM",
      durationSeconds: 3,
      titleHint: "AI Beat 02",
    });
    const readyB = await waitForJob(sound, jobB.jobId);
    expect(readyB?.status, readyB?.error ?? "").toBe("READY");
    expect(readyB?.audioAssetId).not.toBe(readyA?.audioAssetId);

    const refreshedB = await workspace.getProject(projectB.id);
    const stillA = await workspace.getProject(projectA.id);
    expect(refreshedB?.selectedAudioAssetId).toBe(readyB!.audioAssetId);
    expect(stillA?.selectedAudioAssetId).toBe(readyA!.audioAssetId);
    expect(stillA?.selectedAudioAssetId).not.toBe(refreshedB?.selectedAudioAssetId);

    const lib = await workspace.listAudioLibrary();
    expect(lib.filter((a) => a.sourceType === "AI_GENERATED").length).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it("regeneration creates a second selectable asset without replacing the first", async () => {
    if (!(await ffprobeAvailable())) return;
    sound.setProviderForTests(new TestFixtureMusicGenerationProvider());
    const project = await makeProject("Regen");
    const first = await sound.startGeneration({ projectId: project.id, durationSeconds: 3, titleHint: "AI Beat 01" });
    const job1 = await waitForJob(sound, first.jobId);
    expect(job1?.status, job1?.error ?? "").toBe("READY");
    const id1 = job1!.audioAssetId!;

    const second = await sound.startGeneration({ projectId: project.id, durationSeconds: 3, titleHint: "AI Beat 02" });
    const job2 = await waitForJob(sound, second.jobId);
    expect(job2?.status, job2?.error ?? "").toBe("READY");
    const id2 = job2!.audioAssetId!;
    expect(id2).not.toBe(id1);
    const a1 = await workspace.getAudioAsset(id1);
    const a2 = await workspace.getAudioAsset(id2);
    expect(a1?.status).toBe("READY");
    expect(a2?.status).toBe("READY");
  }, 60_000);

  it("style isolation blocks cross-project style profile use", async () => {
    sound.setProviderForTests(new TestFixtureMusicGenerationProvider());
    const projectA = await makeProject("Style A");
    const projectB = await makeProject("Style B");
    const profile = await sound.getStyleStore().upsert({
      name: "A Only",
      projectId: projectA.id,
      preferences: {
        bpmMin: 100,
        bpmMax: 110,
        preferredEnergy: "medium",
        rhythmDensity: "normal",
        instrumentationHints: [],
        introPreference: "short",
        climaxPreference: "mid",
        outroPreference: "strong",
        advertisingIntensity: "medium",
        moods: [],
      },
      sourceAudioAssetIds: [],
    });
    await expect(
      sound.buildSpecPreview({ projectId: projectB.id, styleProfileId: profile.profileId }),
    ).rejects.toMatchObject({ code: "STYLE_ISOLATION" });
  });

  it("preserves STEP 2B project audio defaults", () => {
    expect(normalizeProjectAudio(null).selectedAudioAssetId).toBeNull();
    expect(normalizeProjectAudio({ selectedAudioAssetId: "x", enabled: true, volume: 1 }).beatSyncMode).toBe("SMART");
  });
});
