import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { PREPARED_IMAGE_INTELLIGENCE_MODULES } from "./image-intelligence-categories.js";
import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";

export class ImageIntelligenceStorageManager {
  private intelligenceRoot = "";
  private registryDir = "";

  constructor(private readonly logger: ImageIntelligenceFoundationLogger) {}

  initialize(storageRoot: string): string {
    this.intelligenceRoot = resolveStoragePath(storageRoot, "imageIntelligence");
    this.registryDir = path.join(this.intelligenceRoot, "registry");

    const dirs = [
      this.intelligenceRoot,
      this.registryDir,
      path.join(this.intelligenceRoot, "quality"),
      path.join(this.intelligenceRoot, "history"),
      path.join(this.intelligenceRoot, "plans"),
      ...PREPARED_IMAGE_INTELLIGENCE_MODULES.map((m) =>
        path.join(this.intelligenceRoot, m.subdirectory)
      ),
    ];

    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logger.log("info", "startup", "Image Intelligence storage directories ensured", {
      intelligenceRoot: this.intelligenceRoot,
      moduleCount: PREPARED_IMAGE_INTELLIGENCE_MODULES.length,
    });

    return this.intelligenceRoot;
  }

  getIntelligenceRoot(): string {
    return this.intelligenceRoot;
  }

  getRegistryPath(): string {
    return path.join(this.registryDir, "image-intelligence-registry.json");
  }

  getModulePath(subdirectory: string): string {
    return path.join(this.intelligenceRoot, subdirectory);
  }

  getQualityPath(): string {
    return path.join(this.intelligenceRoot, "quality");
  }

  verifyPersistence(): { passed: boolean; pathsVerified: number; detail: string } {
    const required = [
      this.intelligenceRoot,
      this.registryDir,
      ...PREPARED_IMAGE_INTELLIGENCE_MODULES.map((m) =>
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
        ? `All ${verified} image intelligence paths persist on disk`
        : `${verified}/${required.length} paths verified`,
    };
  }
}
