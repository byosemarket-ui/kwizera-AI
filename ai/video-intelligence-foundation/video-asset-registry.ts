import fs from "node:fs";
import path from "node:path";
import {
  VideoAssetRegistration,
  VideoAssetType,
  VideoIntelligenceHealthLevel,
  VideoIntelligenceSource,
  VideoIntelligenceVerificationStatus,
} from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";

export class VideoAssetRegistry {
  private assets = new Map<string, VideoAssetRegistration>();
  private assetsPath = "";
  private catalogPath = "";

  constructor(private readonly logger: VideoIntelligenceFoundationLogger) {}

  initialize(storage: VideoIntelligenceStorageManager): void {
    this.assetsPath = storage.getAssetsPath();
    this.catalogPath = path.join(this.assetsPath, "video-asset-catalog.json");
    fs.mkdirSync(this.assetsPath, { recursive: true });

    if (fs.existsSync(this.catalogPath)) {
      this.loadFromDisk();
    } else {
      this.persist();
    }

    this.logger.log("info", "asset", "Video asset registry initialized", {
      assetsPath: this.assetsPath,
      assetCount: this.assets.size,
    });
  }

  registerAsset(
    input: Omit<VideoAssetRegistration, "assetId" | "version" | "createdAt" | "lastUpdated"> & {
      assetId?: string;
    }
  ): VideoAssetRegistration {
    const now = new Date().toISOString();
    const assetId = input.assetId ?? `asset-${input.assetType}-${Date.now()}`;
    const existing = this.assets.get(assetId);

    const asset: VideoAssetRegistration = {
      ...input,
      assetId,
      version: existing ? existing.version + 1 : 1,
      createdAt: existing?.createdAt ?? now,
      lastUpdated: now,
    };

    this.assets.set(assetId, asset);
    this.persist();
    this.logger.log("info", "asset", `Video asset registered: ${assetId}`, {
      assetType: asset.assetType,
      projectId: asset.projectId,
    });
    return asset;
  }

  getAsset(assetId: string): VideoAssetRegistration | undefined {
    return this.assets.get(assetId);
  }

  getAssetsByProject(projectId: string): VideoAssetRegistration[] {
    return [...this.assets.values()].filter((a) => a.projectId === projectId);
  }

  getAssetsByType(assetType: VideoAssetType): VideoAssetRegistration[] {
    return [...this.assets.values()].filter((a) => a.assetType === assetType);
  }

  getAssetsByVideo(videoId: string): VideoAssetRegistration[] {
    return [...this.assets.values()].filter((a) => a.videoId === videoId);
  }

  searchAssets(query: { projectId?: string; assetType?: VideoAssetType; text?: string; limit?: number }): VideoAssetRegistration[] {
    let results = [...this.assets.values()];
    if (query.projectId) results = results.filter((a) => a.projectId === query.projectId);
    if (query.assetType) results = results.filter((a) => a.assetType === query.assetType);
    if (query.text) {
      const q = query.text.toLowerCase();
      results = results.filter(
        (a) => a.assetName.toLowerCase().includes(q) || a.assetId.toLowerCase().includes(q)
      );
    }
    const limit = query.limit ?? 100;
    return results.slice(0, limit);
  }

  getCount(): number {
    return this.assets.size;
  }

  getTypeCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const asset of this.assets.values()) {
      counts[asset.assetType] = (counts[asset.assetType] ?? 0) + 1;
    }
    return counts;
  }

  verifyIntegrity(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!fs.existsSync(this.assetsPath)) {
      issues.push("Asset registry directory missing");
    }
    if (!fs.existsSync(this.catalogPath) && this.assets.size > 0) {
      issues.push("Asset catalog file missing");
    }
    for (const asset of this.assets.values()) {
      if (!asset.quality.versionHistory.length) {
        issues.push(`Asset ${asset.assetId} missing version history`);
      }
      if (asset.assetType === VideoAssetType.ProxyVideo && !asset.originalAssetId) {
        issues.push(`Proxy asset ${asset.assetId} missing original reference`);
      }
    }
    return { valid: issues.length === 0, issues };
  }

  repairSafeIssues(): string[] {
    const repairs: string[] = [];
    for (const asset of this.assets.values()) {
      if (!asset.quality.versionHistory.length) {
        asset.quality.versionHistory = [
          {
            version: 1,
            timestamp: asset.createdAt,
            changeSummary: "Auto-repaired version history",
            source: VideoIntelligenceSource.System,
          },
        ];
        asset.quality.verificationStatus = VideoIntelligenceVerificationStatus.Pending;
        asset.quality.healthStatus = VideoIntelligenceHealthLevel.Good;
        repairs.push(`Repaired version history for ${asset.assetId}`);
      }
    }
    if (repairs.length > 0) this.persist();
    return repairs;
  }

  private loadFromDisk(): void {
    const raw = fs.readFileSync(this.catalogPath, "utf8");
    const catalog = JSON.parse(raw) as { assets: VideoAssetRegistration[] };
    this.assets.clear();
    for (const asset of catalog.assets) {
      this.assets.set(asset.assetId, asset);
    }
  }

  private persist(): void {
    const catalog = {
      lastUpdated: new Date().toISOString(),
      assetCount: this.assets.size,
      assets: [...this.assets.values()],
    };
    fs.writeFileSync(this.catalogPath, JSON.stringify(catalog, null, 2), "utf8");
  }
}

export function createDefaultAssetQuality(): VideoAssetRegistration["quality"] {
  return {
    qualityScore: 80,
    confidenceScore: 78,
    verificationStatus: VideoIntelligenceVerificationStatus.Pending,
    source: VideoIntelligenceSource.System,
    versionHistory: [
      {
        version: 1,
        timestamp: new Date().toISOString(),
        changeSummary: "Initial registration",
        source: VideoIntelligenceSource.System,
      },
    ],
    relationshipLinks: [],
    healthStatus: VideoIntelligenceHealthLevel.Good,
  };
}
