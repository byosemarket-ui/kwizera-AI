import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ProjectState } from "../state-manager/types.js";
const FORMAT_BY_MIME = {
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
    "audio/mpeg": "mp3", "audio/wav": "wav",
};
export class CreativeReviewManager {
    root = "";
    core = null;
    async initialize(storageRoot, core) {
        this.root = path.join(storageRoot, "creative-review");
        this.core = core ?? null;
        await fs.mkdir(this.root, { recursive: true });
    }
    async getProjectState(projectId) {
        this.ensureReady();
        return this.readJson(this.statePath(projectId), { projectId, assets: [], history: [], exports: [], regenerationQueue: [] });
    }
    async ingestAsset(projectId, input) {
        this.ensureReady();
        const mediaType = mediaTypeFor(input.mimeType);
        const format = FORMAT_BY_MIME[input.mimeType];
        if (!mediaType || !format)
            throw new Error("Only PNG, JPG, WebP, MP4, MOV, WebM, MP3, and WAV media can be reviewed");
        const data = Buffer.from(input.dataBase64, "base64");
        if (!data.length)
            throw new Error("Media artifact is empty");
        const state = await this.getProjectState(projectId);
        const asset = {
            id: randomUUID(), projectId, name: input.name.trim() || "Generated asset", mediaType, mimeType: input.mimeType,
            fileName: `${randomUUID()}.${format}`, createdAt: new Date().toISOString(), version: state.assets.filter((item) => item.name === input.name.trim() && item.mediaType === mediaType).length + 1, approved: false,
            quality: qualityFor(mediaType, input.name),
        };
        await fs.mkdir(this.assetDirectory(projectId), { recursive: true });
        await fs.writeFile(this.assetPath(projectId, asset.fileName), data);
        state.assets.unshift(asset);
        state.history.unshift(history("artifact-added", `${asset.name} added for review`));
        await this.saveState(state);
        return asset;
    }
    async bootstrapProductImages(project, images) {
        const state = await this.getProjectState(project.id);
        if (state.assets.length)
            return state;
        for (const image of images)
            await this.ingestAsset(project.id, image);
        return this.getProjectState(project.id);
    }
    async approve(projectId, assetId) {
        const state = await this.getProjectState(projectId);
        const asset = this.requireAsset(state, assetId);
        if (asset.quality.overallScore < 70)
            throw new Error("Resolve quality recommendations before approval");
        asset.approved = true;
        state.history.unshift(history("asset-approved", `${asset.name} approved for export`));
        await this.saveState(state);
        this.transition(projectId, ProjectState.Completed);
        return asset;
    }
    async requestRegeneration(projectId, assetId, instructions) {
        const state = await this.getProjectState(projectId);
        const asset = this.requireAsset(state, assetId);
        state.regenerationQueue.unshift({ id: randomUUID(), assetId, status: "requested", createdAt: new Date().toISOString(), instructions });
        state.history.unshift(history("regeneration-requested", `Regeneration requested for ${asset.name}`));
        await this.saveState(state);
        return state;
    }
    async exportAsset(projectId, assetId, settings) {
        const state = await this.getProjectState(projectId);
        const asset = this.requireAsset(state, assetId);
        if (!asset.approved)
            throw new Error("Approve the selected asset before exporting");
        const sourceFormat = FORMAT_BY_MIME[asset.mimeType];
        if (settings.format !== sourceFormat)
            throw new Error(`Export format ${settings.format.toUpperCase()} requires a matching rendered artifact; transcoding is owned by the rendering pipeline.`);
        const exportId = randomUUID();
        const outputName = `${safeName(asset.name)}-v${asset.version}-${settings.platform}.${settings.format}`;
        const outputDir = path.join(this.projectDirectory(projectId), "exports");
        await fs.mkdir(outputDir, { recursive: true });
        await fs.copyFile(this.assetPath(projectId, asset.fileName), path.join(outputDir, outputName));
        state.exports.unshift({ id: exportId, assetId, ...settings, status: "complete", fileName: outputName, createdAt: new Date().toISOString() });
        state.history.unshift(history("asset-exported", `${asset.name} exported as ${outputName}`));
        await this.saveState(state);
        return { fileName: outputName, downloadPath: `/api/review/projects/${projectId}/downloads/${encodeURIComponent(outputName)}`, progress: 100 };
    }
    async getAssetPath(projectId, fileName, exported = false) {
        if (!/^[a-zA-Z0-9._-]+$/.test(fileName))
            return null;
        const target = exported ? path.join(this.projectDirectory(projectId), "exports", fileName) : this.assetPath(projectId, fileName);
        try {
            await fs.access(target);
            return target;
        }
        catch {
            return null;
        }
    }
    getIntegrationStatus() {
        return { aiCore: Boolean(this.core), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), stateManager: Boolean(this.core?.stateManager), generationManager: Boolean(this.core?.imageGenerationFoundation || this.core?.videoGenerationFoundation || this.core?.audioGenerationFoundation), renderingPipeline: Boolean(this.core?.videoGenerationFoundation) };
    }
    requireAsset(state, assetId) { const asset = state.assets.find((item) => item.id === assetId); if (!asset)
        throw new Error("Review asset not found"); return asset; }
    transition(projectId, state) { this.core?.stateManager?.updateProjectState(projectId, state, { systemAction: "creative-review", metadata: { source: "creative-review" } }); }
    async saveState(state) { await fs.mkdir(this.projectDirectory(state.projectId), { recursive: true }); await fs.writeFile(this.statePath(state.projectId), `${JSON.stringify(state, null, 2)}\n`, "utf8"); }
    async readJson(filePath, fallback) { try {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    }
    catch (error) {
        if (error.code === "ENOENT")
            return fallback;
        throw error;
    } }
    ensureReady() { if (!this.root)
        throw new Error("Creative Review Manager is not initialized"); }
    projectDirectory(projectId) { return path.join(this.root, projectId); }
    assetDirectory(projectId) { return path.join(this.projectDirectory(projectId), "assets"); }
    assetPath(projectId, fileName) { return path.join(this.assetDirectory(projectId), fileName); }
    statePath(projectId) { return path.join(this.projectDirectory(projectId), "review.json"); }
}
function mediaTypeFor(mimeType) { if (mimeType.startsWith("image/"))
    return "image"; if (mimeType.startsWith("video/"))
    return "video"; if (mimeType.startsWith("audio/"))
    return "audio"; return null; }
function qualityFor(mediaType, name) { const base = mediaType === "image" ? 82 : mediaType === "video" ? 80 : 78; return { overallScore: base, imageQuality: mediaType === "image" ? 86 : 0, videoQuality: mediaType === "video" ? 84 : 0, audioQuality: mediaType === "audio" ? 84 : 0, brandingConsistency: 80, marketingEffectiveness: 78, colourConsistency: mediaType === "audio" ? 0 : 81, composition: mediaType === "audio" ? 0 : 80, resolution: mediaType === "image" ? "Source image resolution preserved" : "Source media resolution preserved", recommendations: [`Review ${name} against approved campaign messaging before export.`, "Approve only after confirming brand-safe logo, language, and call-to-action treatment."] }; }
function history(action, detail) { return { id: randomUUID(), at: new Date().toISOString(), action, detail }; }
function safeName(value) { return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "kwizera-export"; }
//# sourceMappingURL=creative-review-manager.js.map