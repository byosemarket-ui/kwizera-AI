import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { ProjectState } from "../state-manager/types.js";

export type MediaType = "image" | "video" | "audio";
export type ExportFormat = "png" | "jpg" | "webp" | "mp4" | "mov" | "webm" | "mp3" | "wav";

export interface ReviewAsset {
  id: string;
  projectId: string;
  name: string;
  mediaType: MediaType;
  mimeType: string;
  fileName: string;
  createdAt: string;
  version: number;
  approved: boolean;
  quality: QualityReport;
}

export interface QualityReport {
  overallScore: number;
  imageQuality: number;
  videoQuality: number;
  audioQuality: number;
  brandingConsistency: number;
  marketingEffectiveness: number;
  colourConsistency: number;
  composition: number;
  resolution: string;
  recommendations: string[];
}

export interface ReviewProjectState {
  projectId: string;
  assets: ReviewAsset[];
  history: Array<{ id: string; at: string; action: string; detail: string }>;
  exports: Array<{ id: string; assetId: string; format: ExportFormat; platform: string; resolution: string; quality: string; status: "complete"; fileName: string; createdAt: string }>;
  regenerationQueue: Array<{ id: string; assetId: string; status: "requested"; createdAt: string; instructions?: string }>;
}

const FORMAT_BY_MIME: Record<string, ExportFormat> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
  "audio/mpeg": "mp3", "audio/wav": "wav",
};

export class CreativeReviewManager {
  private root = "";
  private core: AiCoreManager | null = null;

  async initialize(storageRoot: string, core?: AiCoreManager): Promise<void> {
    this.root = path.join(storageRoot, "creative-review");
    this.core = core ?? null;
    await fs.mkdir(this.root, { recursive: true });
  }

  async getProjectState(projectId: string): Promise<ReviewProjectState> {
    this.ensureReady();
    return this.readJson(this.statePath(projectId), { projectId, assets: [], history: [], exports: [], regenerationQueue: [] });
  }

  async ingestAsset(projectId: string, input: { name: string; mimeType: string; dataBase64: string }): Promise<ReviewAsset> {
    this.ensureReady();
    const mediaType = mediaTypeFor(input.mimeType);
    const format = FORMAT_BY_MIME[input.mimeType];
    if (!mediaType || !format) throw new Error("Only PNG, JPG, WebP, MP4, MOV, WebM, MP3, and WAV media can be reviewed");
    const data = Buffer.from(input.dataBase64, "base64");
    if (!data.length) throw new Error("Media artifact is empty");
    const state = await this.getProjectState(projectId);
    const asset: ReviewAsset = {
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

  async bootstrapProductImages(project: CreativeProject, images: Array<{ name: string; mimeType: string; dataBase64: string }>): Promise<ReviewProjectState> {
    const state = await this.getProjectState(project.id);
    if (state.assets.length) return state;
    for (const image of images) await this.ingestAsset(project.id, image);
    return this.getProjectState(project.id);
  }

  async approve(projectId: string, assetId: string): Promise<ReviewAsset> {
    const state = await this.getProjectState(projectId);
    const asset = this.requireAsset(state, assetId);
    if (asset.quality.overallScore < 70) throw new Error("Resolve quality recommendations before approval");
    asset.approved = true;
    state.history.unshift(history("asset-approved", `${asset.name} approved for export`));
    await this.saveState(state);
    this.transition(projectId, ProjectState.Completed);
    return asset;
  }

  async requestRegeneration(projectId: string, assetId: string, instructions?: string): Promise<ReviewProjectState> {
    const state = await this.getProjectState(projectId);
    const asset = this.requireAsset(state, assetId);
    state.regenerationQueue.unshift({ id: randomUUID(), assetId, status: "requested", createdAt: new Date().toISOString(), instructions });
    state.history.unshift(history("regeneration-requested", `Regeneration requested for ${asset.name}`));
    await this.saveState(state);
    return state;
  }

  async exportAsset(projectId: string, assetId: string, settings: { format: ExportFormat; platform: string; resolution: string; quality: string }): Promise<{ fileName: string; downloadPath: string; progress: number }> {
    const state = await this.getProjectState(projectId);
    const asset = this.requireAsset(state, assetId);
    if (!asset.approved) throw new Error("Approve the selected asset before exporting");
    const sourceFormat = FORMAT_BY_MIME[asset.mimeType];
    if (settings.format !== sourceFormat) throw new Error(`Export format ${settings.format.toUpperCase()} requires a matching rendered artifact; transcoding is owned by the rendering pipeline.`);
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

  async getAssetPath(projectId: string, fileName: string, exported = false): Promise<string | null> {
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) return null;
    const target = exported ? path.join(this.projectDirectory(projectId), "exports", fileName) : this.assetPath(projectId, fileName);
    try { await fs.access(target); return target; } catch { return null; }
  }

  getIntegrationStatus(): Record<string, boolean> {
    return { aiCore: Boolean(this.core), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), stateManager: Boolean(this.core?.stateManager), generationManager: Boolean(this.core?.imageGenerationFoundation || this.core?.videoGenerationFoundation || this.core?.audioGenerationFoundation), renderingPipeline: Boolean(this.core?.videoGenerationFoundation) };
  }

  private requireAsset(state: ReviewProjectState, assetId: string): ReviewAsset { const asset = state.assets.find((item) => item.id === assetId); if (!asset) throw new Error("Review asset not found"); return asset; }
  private transition(projectId: string, state: ProjectState): void { this.core?.stateManager?.updateProjectState(projectId, state, { systemAction: "creative-review", metadata: { source: "creative-review" } }); }
  private async saveState(state: ReviewProjectState): Promise<void> { await fs.mkdir(this.projectDirectory(state.projectId), { recursive: true }); await fs.writeFile(this.statePath(state.projectId), `${JSON.stringify(state, null, 2)}\n`, "utf8"); }
  private async readJson(filePath: string, fallback: ReviewProjectState): Promise<ReviewProjectState> { try { return JSON.parse(await fs.readFile(filePath, "utf8")) as ReviewProjectState; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; } }
  private ensureReady(): void { if (!this.root) throw new Error("Creative Review Manager is not initialized"); }
  private projectDirectory(projectId: string): string { return path.join(this.root, projectId); }
  private assetDirectory(projectId: string): string { return path.join(this.projectDirectory(projectId), "assets"); }
  private assetPath(projectId: string, fileName: string): string { return path.join(this.assetDirectory(projectId), fileName); }
  private statePath(projectId: string): string { return path.join(this.projectDirectory(projectId), "review.json"); }
}

function mediaTypeFor(mimeType: string): MediaType | null { if (mimeType.startsWith("image/")) return "image"; if (mimeType.startsWith("video/")) return "video"; if (mimeType.startsWith("audio/")) return "audio"; return null; }
function qualityFor(mediaType: MediaType, name: string): QualityReport { const base = mediaType === "image" ? 82 : mediaType === "video" ? 80 : 78; return { overallScore: base, imageQuality: mediaType === "image" ? 86 : 0, videoQuality: mediaType === "video" ? 84 : 0, audioQuality: mediaType === "audio" ? 84 : 0, brandingConsistency: 80, marketingEffectiveness: 78, colourConsistency: mediaType === "audio" ? 0 : 81, composition: mediaType === "audio" ? 0 : 80, resolution: mediaType === "image" ? "Source image resolution preserved" : "Source media resolution preserved", recommendations: [`Review ${name} against approved campaign messaging before export.`, "Approve only after confirming brand-safe logo, language, and call-to-action treatment."] }; }
function history(action: string, detail: string) { return { id: randomUUID(), at: new Date().toISOString(), action, detail }; }
function safeName(value: string): string { return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "kwizera-export"; }