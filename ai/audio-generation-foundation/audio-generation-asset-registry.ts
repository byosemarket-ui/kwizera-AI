import fs from "node:fs";
import path from "node:path";
import {
  AudioGenerationAssetRegistration,
  AudioGenerationAssetType,
  AudioGenerationProjectRegistration,
  AudioGenerationSource,
  AudioGenerationVerificationStatus,
} from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";

export class GenerationAssetRegistry {
  private assets = new Map<string, AudioGenerationAssetRegistration>();
  private assetsPath = "";
  private catalogPath = "";

  constructor(private readonly logger: AudioGenerationFoundationLogger) {}

  initialize(storage: AudioGenerationStorageManager): void {
    this.assetsPath = storage.getAssetsPath();
    this.catalogPath = path.join(this.assetsPath, "audio-generation-asset-catalog.json");
    fs.mkdirSync(this.assetsPath, { recursive: true });

    if (fs.existsSync(this.catalogPath)) {
      this.loadFromDisk();
    } else {
      this.persist();
    }

    this.logger.log("info", "asset", "Audio generation asset registry initialized", {
      assetCount: this.assets.size,
    });
  }

  registerAsset(
    input: Omit<
      AudioGenerationAssetRegistration,
      "assetId" | "version" | "createdAt" | "lastUpdated"
    > & { assetId?: string }
  ): AudioGenerationAssetRegistration {
    const now = new Date().toISOString();
    const assetId = input.assetId ?? `aud-asset-${input.assetType}-${Date.now()}`;
    const existing = this.assets.get(assetId);

    const asset: AudioGenerationAssetRegistration = {
      relatedImages: [],
      relatedVideos: [],
      relatedPrompts: [],
      ...input,
      assetId,
      version: existing ? existing.version + 1 : 1,
      createdAt: existing?.createdAt ?? now,
      lastUpdated: now,
    };

    this.assets.set(assetId, asset);
    this.persist();
    this.logger.log("info", "asset", `Audio generation asset registered: ${assetId}`, {
      assetType: asset.assetType,
      projectId: asset.projectId,
    });
    return asset;
  }

  getAsset(assetId: string): AudioGenerationAssetRegistration | undefined {
    return this.assets.get(assetId);
  }

  getAssetsByProject(projectId: string): AudioGenerationAssetRegistration[] {
    return [...this.assets.values()].filter((a) => a.projectId === projectId);
  }

  getAssetsByType(assetType: AudioGenerationAssetType): AudioGenerationAssetRegistration[] {
    return [...this.assets.values()].filter((a) => a.assetType === assetType);
  }

  searchAssets(query: {
    projectId?: string;
    assetType?: AudioGenerationAssetType;
    text?: string;
    limit?: number;
  }): AudioGenerationAssetRegistration[] {
    let results = [...this.assets.values()];
    if (query.projectId) results = results.filter((a) => a.projectId === query.projectId);
    if (query.assetType) results = results.filter((a) => a.assetType === query.assetType);
    if (query.text) {
      const q = query.text.toLowerCase();
      results = results.filter(
        (a) => a.assetName.toLowerCase().includes(q) || a.assetId.toLowerCase().includes(q)
      );
    }
    return results.slice(0, query.limit ?? 100);
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
    if (!fs.existsSync(this.catalogPath)) {
      issues.push("Audio generation asset catalog missing");
    }
    for (const asset of this.assets.values()) {
      if (asset.qualityScore < 0 || asset.qualityScore > 100) {
        issues.push(`Invalid quality score on ${asset.assetId}`);
      }
      if (!asset.projectId) {
        issues.push(`Missing projectId on ${asset.assetId}`);
      }
    }
    return { valid: issues.length === 0, issues };
  }

  repairSafeIssues(): void {
    for (const [id, asset] of this.assets.entries()) {
      let changed = false;
      if (asset.qualityScore < 0) {
        asset.qualityScore = 0;
        changed = true;
      }
      if (asset.qualityScore > 100) {
        asset.qualityScore = 100;
        changed = true;
      }
      if (asset.confidenceScore < 0) {
        asset.confidenceScore = 0;
        changed = true;
      }
      if (asset.confidenceScore > 100) {
        asset.confidenceScore = 100;
        changed = true;
      }
      if (changed) {
        asset.lastUpdated = new Date().toISOString();
        this.assets.set(id, asset);
      }
    }
    this.persist();
  }

  private loadFromDisk(): void {
    const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8")) as {
      assets: AudioGenerationAssetRegistration[];
    };
    this.assets.clear();
    for (const asset of data.assets ?? []) {
      this.assets.set(asset.assetId, asset);
    }
  }

  private persist(): void {
    fs.writeFileSync(
      this.catalogPath,
      JSON.stringify({ assets: [...this.assets.values()] }, null, 2),
      "utf8"
    );
  }
}

export function createDefaultGenerationAssetQuality(
  source: AudioGenerationSource = AudioGenerationSource.System
): Pick<
  AudioGenerationAssetRegistration,
  | "qualityScore"
  | "confidenceScore"
  | "verificationStatus"
  | "source"
  | "relationshipLinks"
  | "relatedProducts"
  | "relatedBrands"
  | "relatedCampaigns"
  | "relatedKnowledge"
  | "relatedProductionPlans"
  | "relatedImages"
  | "relatedVideos"
  | "relatedPrompts"
> {
  return {
    qualityScore: 80,
    confidenceScore: 75,
    verificationStatus: AudioGenerationVerificationStatus.Pending,
    source,
    relationshipLinks: [],
    relatedProducts: [],
    relatedBrands: [],
    relatedCampaigns: [],
    relatedKnowledge: [],
    relatedProductionPlans: [],
    relatedImages: [],
    relatedVideos: [],
    relatedPrompts: [],
  };
}

export function createDefaultProjectQuality(): Pick<
  AudioGenerationProjectRegistration,
  "qualityScore" | "confidenceScore"
> {
  return { qualityScore: 85, confidenceScore: 80 };
}
