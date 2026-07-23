import fs from "node:fs";
import path from "node:path";
import { ImageGenerationIntegrityResult } from "./types.js";
import {
  IMAGE_GENERATION_BLUEPRINT_STAGES,
  PREPARED_IMAGE_GENERATION_MODULES,
  SUPPORTED_IMAGE_GENERATION_ASSET_TYPES,
} from "./image-generation-categories.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationBlueprintManager } from "./generation-blueprint-manager.js";
import { ImageGenerationRegistry } from "./image-generation-registry.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";

export class ImageGenerationIntegrityVerifier {
  constructor(private readonly logger: ImageGenerationFoundationLogger) {}

  verify(
    storage: ImageGenerationStorageManager,
    registry: ImageGenerationRegistry,
    blueprintManager: ImageGenerationBlueprintManager
  ): ImageGenerationIntegrityResult {
    const issues: string[] = [];
    let checkedPaths = 0;

    const generationRoot = storage.getGenerationRoot();
    if (!fs.existsSync(generationRoot)) {
      issues.push(`Image generation root missing: ${generationRoot}`);
    } else {
      checkedPaths++;
    }

    for (const extra of ["assets", "projects", "blueprints", "workflow"]) {
      const extraPath = path.join(generationRoot, extra);
      checkedPaths++;
      if (!fs.existsSync(extraPath)) {
        issues.push(`Foundation directory missing: ${extraPath}`);
      }
    }

    for (const module of PREPARED_IMAGE_GENERATION_MODULES) {
      const modulePath = storage.getModulePath(module.subdirectory);
      checkedPaths++;
      if (!fs.existsSync(modulePath)) {
        issues.push(`Module directory missing: ${modulePath}`);
      }
    }

    const registryPath = storage.getRegistryPath();
    checkedPaths++;
    if (!fs.existsSync(registryPath)) {
      issues.push(`Registry file missing: ${registryPath}`);
    }

    const checksumVerified = registry.verifyChecksum();
    if (!checksumVerified && fs.existsSync(registryPath)) {
      issues.push("Registry checksum verification failed");
    }

    const blueprintHealth = blueprintManager.verifyIntegrity();
    if (!blueprintHealth.valid) {
      issues.push(...blueprintHealth.issues);
    }

    const manifestPath = path.join(generationRoot, "foundation-manifest.json");
    if (!fs.existsSync(manifestPath)) {
      issues.push("Foundation manifest missing — will be created on next persist");
    } else {
      checkedPaths++;
    }

    const verified = issues.length === 0;
    this.logger.log(verified ? "info" : "warn", "integrity", "Image generation integrity verification complete", {
      verified,
      checkedPaths,
      issues: issues.length,
    });

    return {
      verified,
      checkedPaths,
      issues,
      checksumVerified,
      blueprintIntegrity: blueprintHealth.valid,
      timestamp: new Date().toISOString(),
    };
  }

  writeManifest(storage: ImageGenerationStorageManager, storageRoot: string): void {
    const manifest = {
      foundationVersion: "0.1.0",
      storageRoot,
      generationRoot: storage.getGenerationRoot(),
      modules: PREPARED_IMAGE_GENERATION_MODULES.map((m) => m.moduleId),
      assetTypes: SUPPORTED_IMAGE_GENERATION_ASSET_TYPES.length,
      blueprintStages: IMAGE_GENERATION_BLUEPRINT_STAGES.length,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(storage.getGenerationRoot(), "foundation-manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );
  }
}
