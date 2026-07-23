import fs from "node:fs";
import path from "node:path";
import { ImageGenerationSource, ImageGenerationVerificationStatus, } from "./types.js";
export class GenerationAssetRegistry {
    logger;
    assets = new Map();
    assetsPath = "";
    catalogPath = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storage) {
        this.assetsPath = storage.getAssetsPath();
        this.catalogPath = path.join(this.assetsPath, "image-generation-asset-catalog.json");
        fs.mkdirSync(this.assetsPath, { recursive: true });
        if (fs.existsSync(this.catalogPath)) {
            this.loadFromDisk();
        }
        else {
            this.persist();
        }
        this.logger.log("info", "asset", "Image generation asset registry initialized", {
            assetCount: this.assets.size,
        });
    }
    registerAsset(input) {
        const now = new Date().toISOString();
        const assetId = input.assetId ?? `img-asset-${input.assetType}-${Date.now()}`;
        const existing = this.assets.get(assetId);
        const asset = {
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
        this.logger.log("info", "asset", `Image generation asset registered: ${assetId}`, {
            assetType: asset.assetType,
            projectId: asset.projectId,
        });
        return asset;
    }
    getAsset(assetId) {
        return this.assets.get(assetId);
    }
    getAssetsByProject(projectId) {
        return [...this.assets.values()].filter((a) => a.projectId === projectId);
    }
    getAssetsByType(assetType) {
        return [...this.assets.values()].filter((a) => a.assetType === assetType);
    }
    searchAssets(query) {
        let results = [...this.assets.values()];
        if (query.projectId)
            results = results.filter((a) => a.projectId === query.projectId);
        if (query.assetType)
            results = results.filter((a) => a.assetType === query.assetType);
        if (query.text) {
            const q = query.text.toLowerCase();
            results = results.filter((a) => a.assetName.toLowerCase().includes(q) || a.assetId.toLowerCase().includes(q));
        }
        return results.slice(0, query.limit ?? 100);
    }
    getCount() {
        return this.assets.size;
    }
    getTypeCounts() {
        const counts = {};
        for (const asset of this.assets.values()) {
            counts[asset.assetType] = (counts[asset.assetType] ?? 0) + 1;
        }
        return counts;
    }
    verifyIntegrity() {
        const issues = [];
        if (!fs.existsSync(this.catalogPath)) {
            issues.push("Image generation asset catalog missing");
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
    repairSafeIssues() {
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
    loadFromDisk() {
        const data = JSON.parse(fs.readFileSync(this.catalogPath, "utf8"));
        this.assets.clear();
        for (const asset of data.assets ?? []) {
            this.assets.set(asset.assetId, asset);
        }
    }
    persist() {
        fs.writeFileSync(this.catalogPath, JSON.stringify({ assets: [...this.assets.values()] }, null, 2), "utf8");
    }
}
export function createDefaultGenerationAssetQuality(source = ImageGenerationSource.System) {
    return {
        qualityScore: 80,
        confidenceScore: 75,
        verificationStatus: ImageGenerationVerificationStatus.Pending,
        source,
        relationshipLinks: [],
        relatedProducts: [],
        relatedBrands: [],
        relatedCampaigns: [],
        relatedKnowledge: [],
        relatedProductionPlans: [],
        relatedVideos: [],
        relatedPrompts: [],
    };
}
export function createDefaultProjectQuality() {
    return { qualityScore: 85, confidenceScore: 80 };
}
//# sourceMappingURL=generation-asset-registry.js.map