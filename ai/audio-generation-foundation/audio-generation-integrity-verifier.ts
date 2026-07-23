import fs from "node:fs";
import path from "node:path";
import { AudioGenerationIntegrityResult } from "./types.js";
import {
  AUDIO_GENERATION_BLUEPRINT_STAGES,
  PREPARED_AUDIO_GENERATION_MODULES,
  SUPPORTED_AUDIO_GENERATION_ASSET_TYPES,
} from "./audio-generation-categories.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationBlueprintManager } from "./audio-generation-blueprint-manager.js";
import { AudioGenerationRegistry } from "./audio-generation-registry.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";

export class AudioGenerationIntegrityVerifier {
  constructor(private readonly logger: AudioGenerationFoundationLogger) {}

  verify(
    storage: AudioGenerationStorageManager,
    registry: AudioGenerationRegistry,
    blueprintManager: AudioGenerationBlueprintManager
  ): AudioGenerationIntegrityResult {
    const issues: string[] = [];
    let checkedPaths = 0;

    const generationRoot = storage.getGenerationRoot();
    if (!fs.existsSync(generationRoot)) {
      issues.push(`Audio generation root missing: ${generationRoot}`);
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

    for (const module of PREPARED_AUDIO_GENERATION_MODULES) {
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
    this.logger.log(verified ? "info" : "warn", "integrity", "Audio generation integrity verification complete", {
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

  writeManifest(storage: AudioGenerationStorageManager, storageRoot: string): void {
    const manifest = {
      foundationVersion: "0.1.0",
      storageRoot,
      generationRoot: storage.getGenerationRoot(),
      modules: PREPARED_AUDIO_GENERATION_MODULES.map((m) => m.moduleId),
      assetTypes: SUPPORTED_AUDIO_GENERATION_ASSET_TYPES.length,
      blueprintStages: AUDIO_GENERATION_BLUEPRINT_STAGES.length,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(storage.getGenerationRoot(), "foundation-manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );
  }
}
