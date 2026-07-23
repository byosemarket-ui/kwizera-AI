import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  AudioGenerationAssetType,
  AudioGenerationPlatformTarget,
  AudioGenerationCategory,
  AudioGenerationLifecycleState,
  AudioGenerationModuleStatus,
  AudioGenerationQualityTarget,
  AudioGenerationSource,
  AudioGenerationWorkflowActionType,
  PREPARED_AUDIO_GENERATION_MODULES,
} from "@ai";
import {
  createDefaultGenerationAssetQuality,
  createDefaultProjectQuality,
} from "@ai/audio-generation-foundation/audio-generation-asset-registry.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-audio-foundation-test-"));
}

describe("AiAudioGenerationFoundation", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("initializes and registers plugin", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("audio-foundation-test");

    const foundation = core.getManager().audioGenerationFoundation!;
    expect(foundation.isInitialized()).toBe(true);
    expect(foundation.isStartupComplete()).toBe(true);
    expect(foundation.getLifecycleState()).toBe(AudioGenerationLifecycleState.Ready);

    const pluginEntry = core.getManager().registry.getEntry("audio-generation-engine");
    expect(pluginEntry?.status).toBe("initialized");

    await core.stop();
  });

  it("registry has PREPARED_AUDIO_GENERATION_MODULES count", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().audioGenerationFoundation!;
    const modules = foundation.getRegistry().getAllModules();
    expect(modules.length).toBe(PREPARED_AUDIO_GENERATION_MODULES.length);

    foundation.registerAudioGenerationModule({
      moduleId: "text-to-speech-generation-engine",
      moduleName: "Text-to-Speech Generation Engine",
      version: "0.1.0",
      status: AudioGenerationModuleStatus.Registered,
      dependencies: ["audio-generation-engine", "knowledge-engine", "product-intelligence-engine"],
      qualityScore: 88,
      confidenceScore: 85,
      accessPermissions: modules.find((m) => m.moduleId === "text-to-speech-generation-engine")!.accessPermissions,
      category: AudioGenerationCategory.TextToSpeech,
      storageLocation: modules.find((m) => m.moduleId === "text-to-speech-generation-engine")!.storageLocation,
      implemented: false,
    });

    expect(foundation.getRegistry().getRegisteredCount()).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("sample project and assets", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().audioGenerationFoundation!;
    const project = foundation.getProjectManager().createProject({
      projectId: "test-audio-project",
      projectName: "Test Audio Generation Project",
      description: "Unit test project",
      languages: ["en"],
      speakers: ["narrator"],
      platforms: [AudioGenerationPlatformTarget.Podcast],
      qualities: [AudioGenerationQualityTarget.Standard, AudioGenerationQualityTarget.High],
      ...createDefaultProjectQuality(),
    });

    const blueprint = foundation.getBlueprintManager().createBlueprint({
      projectId: project.projectId,
      name: "Test Audio Blueprint",
    });
    foundation.getProjectManager().linkBlueprint(project.projectId, blueprint.blueprintId);

    const trackId = "test-main-track";
    foundation.getProjectManager().registerTrack(project.projectId, trackId);

    const voice = foundation.getAssetRegistry().registerAsset({
      assetType: AudioGenerationAssetType.Voice,
      assetName: "Test Voice",
      projectId: project.projectId,
      trackId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.Voice),
    });
    foundation.getProjectManager().registerVoice(project.projectId, voice.assetId);

    foundation.getAssetRegistry().registerAsset({
      assetType: AudioGenerationAssetType.Music,
      assetName: "Test Music",
      projectId: project.projectId,
      trackId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.ProductionPlan),
    });

    foundation.getAssetRegistry().registerAsset({
      assetType: AudioGenerationAssetType.SoundEffect,
      assetName: "Test SFX",
      projectId: project.projectId,
      trackId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.Prompt),
    });

    foundation.getAssetRegistry().registerAsset({
      assetType: AudioGenerationAssetType.AmbientSound,
      assetName: "Test Ambient",
      projectId: project.projectId,
      trackId,
      ...createDefaultGenerationAssetQuality(AudioGenerationSource.System),
    });

    expect(foundation.getBlueprintManager().getCount()).toBeGreaterThanOrEqual(1);
    expect(foundation.getAssetRegistry().getCount()).toBeGreaterThanOrEqual(4);
    expect(foundation.getProjectManager().getProject(project.projectId)?.voiceIds.length).toBeGreaterThanOrEqual(1);
    expect(foundation.getProjectManager().getProject(project.projectId)?.trackIds).toContain(trackId);

    await core.stop();
  });

  it("non-destructive workflow undo/redo", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().audioGenerationFoundation!;
    const projectId = "workflow-test-project";
    const trackId = "workflow-test-track";

    foundation.getWorkflow().initializeProject(projectId, trackId);
    const edit = foundation.getWorkflow().recordEdit(
      projectId,
      AudioGenerationWorkflowActionType.Edit,
      "Adjust narration timing",
      "state-v1",
      "state-v2",
      trackId
    );

    const undoEdit = foundation.getWorkflow().undo(projectId, trackId);
    const redoEdit = foundation.getWorkflow().redo(projectId, trackId);
    const integrity = foundation.getWorkflow().verifyIntegrity();

    expect(edit.reversible).toBe(true);
    expect(undoEdit).toBeTruthy();
    expect(redoEdit).toBeTruthy();
    expect(integrity.valid).toBe(true);

    await core.stop();
  });
});
