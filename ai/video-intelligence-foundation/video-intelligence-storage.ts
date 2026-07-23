import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { PREPARED_VIDEO_INTELLIGENCE_MODULES } from "./video-intelligence-categories.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";

export class VideoIntelligenceStorageManager {
  private intelligenceRoot = "";
  private registryDir = "";

  constructor(private readonly logger: VideoIntelligenceFoundationLogger) {}

  initialize(storageRoot: string): string {
    this.intelligenceRoot = resolveStoragePath(storageRoot, "videoIntelligence");
    this.registryDir = path.join(this.intelligenceRoot, "registry");

    const dirs = [
      this.intelligenceRoot,
      this.registryDir,
      path.join(this.intelligenceRoot, "quality"),
      path.join(this.intelligenceRoot, "history"),
      path.join(this.intelligenceRoot, "plans"),
      path.join(this.intelligenceRoot, "assets"),
      path.join(this.intelligenceRoot, "indexes"),
      path.join(this.intelligenceRoot, "projects"),
      path.join(this.intelligenceRoot, "workflow"),
      path.join(this.intelligenceRoot, "timelines"),
      path.join(this.intelligenceRoot, "scenes"),
      path.join(this.intelligenceRoot, "batch"),
      ...PREPARED_VIDEO_INTELLIGENCE_MODULES.map((m) =>
        path.join(this.intelligenceRoot, m.subdirectory)
      ),
    ];

    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logger.log("info", "startup", "Video Intelligence storage directories ensured", {
      intelligenceRoot: this.intelligenceRoot,
      moduleCount: PREPARED_VIDEO_INTELLIGENCE_MODULES.length,
    });

    return this.intelligenceRoot;
  }

  getIntelligenceRoot(): string {
    return this.intelligenceRoot;
  }

  getRegistryPath(): string {
    return path.join(this.registryDir, "video-intelligence-registry.json");
  }

  getModulePath(subdirectory: string): string {
    return path.join(this.intelligenceRoot, subdirectory);
  }

  getQualityPath(): string {
    return path.join(this.intelligenceRoot, "quality");
  }

  getAssetsPath(): string {
    return path.join(this.intelligenceRoot, "assets");
  }

  getIndexesPath(): string {
    return path.join(this.intelligenceRoot, "indexes");
  }

  getProjectsPath(): string {
    return path.join(this.intelligenceRoot, "projects");
  }

  getWorkflowPath(): string {
    return path.join(this.intelligenceRoot, "workflow");
  }

  verifyPersistence(): { passed: boolean; pathsVerified: number; detail: string } {
    const required = [
      this.intelligenceRoot,
      this.registryDir,
      path.join(this.intelligenceRoot, "assets"),
      path.join(this.intelligenceRoot, "indexes"),
      path.join(this.intelligenceRoot, "projects"),
      path.join(this.intelligenceRoot, "workflow"),
      ...PREPARED_VIDEO_INTELLIGENCE_MODULES.map((m) =>
        path.join(this.intelligenceRoot, m.subdirectory)
      ),
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
        ? `All ${verified} video intelligence paths persist on disk`
        : `${verified}/${required.length} paths verified`,
    };
  }
}
