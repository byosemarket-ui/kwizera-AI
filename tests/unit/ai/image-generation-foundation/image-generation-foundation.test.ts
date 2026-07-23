import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  ImageGenerationAssetType,
  ImageGenerationPlatformTarget,
  ImageGenerationCategory,
  ImageGenerationLifecycleState,
  ImageGenerationModuleStatus,
  ImageGenerationResolutionTarget,
  ImageGenerationSource,
  ImageGenerationWorkflowActionType,
  PREPARED_IMAGE_GENERATION_MODULES,
} from "@ai";
import {
  createDefaultGenerationAssetQuality,
  createDefaultProjectQuality,
} from "@ai/image-generation-foundation/generation-asset-registry.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-ig-foundation-test-"));
}

describe("AiImageGenerationFoundation", () => {
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
    await core.start("ig-foundation-test");

    const foundation = core.getManager().imageGenerationFoundation!;
    expect(foundation.isInitialized()).toBe(true);
    expect(foundation.isStartupComplete()).toBe(true);
    expect(foundation.getLifecycleState()).toBe(ImageGenerationLifecycleState.Ready);

    const pluginEntry = core.getManager().registry.getEntry("image-generation-engine");
    expect(pluginEntry?.status).toBe("initialized");

    await core.stop();
  });

  it("registry has PREPARED_IMAGE_GENERATION_MODULES count", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageGenerationFoundation!;
    const modules = foundation.getRegistry().getAllModules();
    expect(modules.length).toBe(PREPARED_IMAGE_GENERATION_MODULES.length);

    foundation.registerImageGenerationModule({
      moduleId: "text-to-image-generation-engine",
      moduleName: "Text-to-Image Generation Engine",
      version: "0.1.0",
      status: ImageGenerationModuleStatus.Registered,
      dependencies: ["image-generation-engine", "knowledge-engine", "image-intelligence-engine"],
      qualityScore: 88,
      confidenceScore: 85,
      accessPermissions: modules.find((m) => m.moduleId === "text-to-image-generation-engine")!.accessPermissions,
      category: ImageGenerationCategory.TextToImage,
      storageLocation: modules.find((m) => m.moduleId === "text-to-image-generation-engine")!.storageLocation,
      implemented: false,
    });

    expect(foundation.getRegistry().getRegisteredCount()).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("sample project and assets", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageGenerationFoundation!;
    const project = foundation.getProjectManager().createProject({
      projectId: "test-img-project",
      projectName: "Test Image Generation Project",
      description: "Unit test project",
      languages: ["en"],
      platforms: [ImageGenerationPlatformTarget.Instagram],
      resolutions: [ImageGenerationResolutionTarget.Standard, ImageGenerationResolutionTarget.High],
      ...createDefaultProjectQuality(),
    });

    const blueprint = foundation.getBlueprintManager().createBlueprint({
      projectId: project.projectId,
      name: "Test Image Blueprint",
    });
    foundation.getProjectManager().linkBlueprint(project.projectId, blueprint.blueprintId);

    const imageId = "test-hero-image";
    foundation.getProjectManager().registerImage(project.projectId, imageId);

    const prompt = foundation.getAssetRegistry().registerAsset({
      assetType: ImageGenerationAssetType.Prompt,
      assetName: "Test Prompt",
      projectId: project.projectId,
      imageId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.Prompt),
    });
    foundation.getProjectManager().registerPrompt(project.projectId, prompt.assetId);

    foundation.getAssetRegistry().registerAsset({
      assetType: ImageGenerationAssetType.ProductImage,
      assetName: "Test Product Image",
      projectId: project.projectId,
      imageId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductIntelligenceEngine),
    });

    foundation.getAssetRegistry().registerAsset({
      assetType: ImageGenerationAssetType.Style,
      assetName: "Test Style",
      projectId: project.projectId,
      imageId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.ProductionPlan),
    });

    foundation.getAssetRegistry().registerAsset({
      assetType: ImageGenerationAssetType.Background,
      assetName: "Test Background",
      projectId: project.projectId,
      imageId,
      ...createDefaultGenerationAssetQuality(ImageGenerationSource.ImageIntelligenceEngine),
    });

    expect(foundation.getBlueprintManager().getCount()).toBeGreaterThanOrEqual(1);
    expect(foundation.getAssetRegistry().getCount()).toBeGreaterThanOrEqual(4);
    expect(foundation.getProjectManager().getProject(project.projectId)?.promptIds.length).toBeGreaterThanOrEqual(1);
    expect(foundation.getProjectManager().getProject(project.projectId)?.imageIds).toContain(imageId);

    await core.stop();
  });

  it("non-destructive workflow undo/redo", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().imageGenerationFoundation!;
    const projectId = "workflow-test-project";
    const imageId = "workflow-test-image";

    foundation.getWorkflow().initializeProject(projectId, imageId);
    const edit = foundation.getWorkflow().recordEdit(
      projectId,
      ImageGenerationWorkflowActionType.Edit,
      "Adjust composition",
      "state-v1",
      "state-v2",
      imageId
    );

    const undoEdit = foundation.getWorkflow().undo(projectId, imageId);
    const redoEdit = foundation.getWorkflow().redo(projectId, imageId);
    const integrity = foundation.getWorkflow().verifyIntegrity();

    expect(edit.reversible).toBe(true);
    expect(undoEdit).toBeTruthy();
    expect(redoEdit).toBeTruthy();
    expect(integrity.valid).toBe(true);

    await core.stop();
  });
});
