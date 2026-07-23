import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  createDefaultGenerationAssetQuality,
  GenerationAssetType,
  GenerationPlatformTarget,
  VideoGenerationLifecycleState,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-vg-foundation-test-"));
}

describe("AiVideoGenerationFoundation", () => {
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

  it("initializes with AI Core after video intelligence", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("vg-foundation-test");

    const foundation = core.getManager().videoGenerationFoundation!;
    expect(foundation.isInitialized()).toBe(true);
    expect(foundation.isStartupComplete()).toBe(true);
    expect(foundation.getLifecycleState()).toBe(VideoGenerationLifecycleState.Ready);

    await core.stop();
  });

  it("registers generation assets and blueprint", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().videoGenerationFoundation!;
    const project = foundation.getProjectManager().createProject({
      projectId: "test-gen-project",
      projectName: "Test Generation Project",
      description: "Unit test project",
      languages: ["en"],
      platforms: [GenerationPlatformTarget.YouTube],
      qualityScore: 85,
      confidenceScore: 80,
    });

    const blueprint = foundation.getBlueprintManager().createBlueprint({
      projectId: project.projectId,
      name: "Test Blueprint",
    });
    foundation.getProjectManager().linkBlueprint(project.projectId, blueprint.blueprintId);

    foundation.getAssetRegistry().registerAsset({
      assetType: GenerationAssetType.Storyboard,
      assetName: "Test Storyboard",
      projectId: project.projectId,
      ...createDefaultGenerationAssetQuality(),
    });

    expect(foundation.getBlueprintManager().getCount()).toBeGreaterThanOrEqual(1);
    expect(foundation.getAssetRegistry().getCount()).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
