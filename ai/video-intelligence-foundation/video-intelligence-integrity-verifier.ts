import fs from "node:fs";
import path from "node:path";
import { VideoIntelligenceIntegrityResult } from "./types.js";
import { PREPARED_VIDEO_INTELLIGENCE_MODULES } from "./video-intelligence-categories.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceRegistry } from "./video-intelligence-registry.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";

export class VideoIntelligenceIntegrityVerifier {
  constructor(private readonly logger: VideoIntelligenceFoundationLogger) {}

  verify(
    storage: VideoIntelligenceStorageManager,
    registry: VideoIntelligenceRegistry
  ): VideoIntelligenceIntegrityResult {
    const issues: string[] = [];
    let checkedPaths = 0;

    const intelligenceRoot = storage.getIntelligenceRoot();
    if (!fs.existsSync(intelligenceRoot)) {
      issues.push(`Video intelligence root missing: ${intelligenceRoot}`);
    } else {
      checkedPaths++;
    }

    for (const extra of ["assets", "indexes", "projects", "workflow"]) {
      const extraPath = path.join(intelligenceRoot, extra);
      checkedPaths++;
      if (!fs.existsSync(extraPath)) {
        issues.push(`Foundation directory missing: ${extraPath}`);
      }
    }

    for (const module of PREPARED_VIDEO_INTELLIGENCE_MODULES) {
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

    const manifestPath = path.join(intelligenceRoot, "foundation-manifest.json");
    if (!fs.existsSync(manifestPath)) {
      issues.push("Foundation manifest missing — will be created on next persist");
    } else {
      checkedPaths++;
    }

    const verified = issues.length === 0;
    this.logger.log(verified ? "info" : "warn", "integrity", "Video intelligence integrity verification complete", {
      verified,
      checkedPaths,
      issues: issues.length,
    });

    return {
      verified,
      checkedPaths,
      issues,
      checksumVerified,
      timestamp: new Date().toISOString(),
    };
  }

  writeManifest(storage: VideoIntelligenceStorageManager, storageRoot: string): void {
    const manifest = {
      foundationVersion: "0.1.0",
      storageRoot,
      intelligenceRoot: storage.getIntelligenceRoot(),
      modules: PREPARED_VIDEO_INTELLIGENCE_MODULES.map((m) => m.moduleId),
      assetTypes: 17,
      indexTypes: 6,
      createdAt: new Date().toISOString(),
    };
    const manifestPath = path.join(storage.getIntelligenceRoot(), "foundation-manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  }
}
