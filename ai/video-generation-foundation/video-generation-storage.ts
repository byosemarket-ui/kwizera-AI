import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { PREPARED_VIDEO_GENERATION_MODULES } from "./video-generation-categories.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";

export class VideoGenerationStorageManager {
  private generationRoot = "";
  private registryDir = "";

  constructor(private readonly logger: VideoGenerationFoundationLogger) {}

  initialize(storageRoot: string): string {
    this.generationRoot = resolveStoragePath(storageRoot, "videoGeneration");
    this.registryDir = path.join(this.generationRoot, "registry");

    const dirs = [
      this.generationRoot,
      this.registryDir,
      path.join(this.generationRoot, "quality"),
      path.join(this.generationRoot, "history"),
      path.join(this.generationRoot, "blueprints"),
      path.join(this.generationRoot, "assets"),
      path.join(this.generationRoot, "projects"),
      path.join(this.generationRoot, "workflow"),
      path.join(this.generationRoot, "batch"),
      path.join(this.generationRoot, "distributed"),
      path.join(this.generationRoot, "cloud"),
      ...PREPARED_VIDEO_GENERATION_MODULES.map((m) => path.join(this.generationRoot, m.subdirectory)),
    ];

    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logger.log("info", "startup", "Video Generation storage directories ensured", {
      generationRoot: this.generationRoot,
      moduleCount: PREPARED_VIDEO_GENERATION_MODULES.length,
    });

    return this.generationRoot;
  }

  getGenerationRoot(): string {
    return this.generationRoot;
  }

  getRegistryPath(): string {
    return path.join(this.registryDir, "video-generation-registry.json");
  }

  getModulePath(subdirectory: string): string {
    return path.join(this.generationRoot, subdirectory);
  }

  getQualityPath(): string {
    return path.join(this.generationRoot, "quality");
  }

  getAssetsPath(): string {
    return path.join(this.generationRoot, "assets");
  }

  getProjectsPath(): string {
    return path.join(this.generationRoot, "projects");
  }

  getBlueprintsPath(): string {
    return path.join(this.generationRoot, "blueprints");
  }

  getWorkflowPath(): string {
    return path.join(this.generationRoot, "workflow");
  }

  verifyPersistence(): { passed: boolean; pathsVerified: number; detail: string } {
    const required = [
      this.generationRoot,
      this.registryDir,
      path.join(this.generationRoot, "assets"),
      path.join(this.generationRoot, "projects"),
      path.join(this.generationRoot, "blueprints"),
      path.join(this.generationRoot, "workflow"),
      ...PREPARED_VIDEO_GENERATION_MODULES.map((m) => path.join(this.generationRoot, m.subdirectory)),
    ];

    let verified = 0;
    for (const p of required) {
      if (fs.existsSync(p)) verified++;
    }

    const passed = verified === required.length;
    return {
      passed,
      pathsVerified: verified,
      detail: passed
        ? `All ${verified} video generation paths persist on disk`
        : `${verified}/${required.length} paths verified`,
    };
  }
}
