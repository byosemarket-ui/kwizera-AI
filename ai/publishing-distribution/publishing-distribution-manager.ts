import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiConnectorManager } from "../connector-management/connector-manager.js";
import type { CreativeReviewManager } from "../creative-review/creative-review-manager.js";
import type { PublishingJob, PublishingOptimizationRecommendation, PublishingPackage, PublishingPlatform, PublishingPlatformProfile, PublishingRecurrence, PublishingStatus } from "./types.js";

interface PublishingStore { profiles: PublishingPlatformProfile[]; packages: PublishingPackage[]; jobs: PublishingJob[]; }
const EMPTY_STORE: PublishingStore = { profiles: [], packages: [], jobs: [] };
const MAX_DELIVERY_ATTEMPTS = 3;
const PLATFORM_TEMPLATES: Record<Exclude<PublishingPlatform, "custom">, Omit<PublishingPlatformProfile, "id" | "connectorId" | "deliveryPath" | "enabled">> = {
  facebook: { platform: "facebook", maxCaptionLength: 63206, supportedAspectRatios: ["1:1", "4:5", "16:9"], requiredPermissions: ["publishing.deliver"] },
  instagram: { platform: "instagram", maxCaptionLength: 2200, supportedAspectRatios: ["1:1", "4:5", "9:16"], requiredPermissions: ["publishing.deliver"] },
  tiktok: { platform: "tiktok", maxCaptionLength: 4000, supportedAspectRatios: ["9:16"], requiredPermissions: ["publishing.deliver"] },
  youtube: { platform: "youtube", maxCaptionLength: 5000, supportedAspectRatios: ["16:9", "9:16"], requiredPermissions: ["publishing.deliver"] },
  linkedin: { platform: "linkedin", maxCaptionLength: 3000, supportedAspectRatios: ["1:1", "4:5", "16:9"], requiredPermissions: ["publishing.deliver"] },
  x: { platform: "x", maxCaptionLength: 280, supportedAspectRatios: ["1:1", "16:9", "9:16"], requiredPermissions: ["publishing.deliver"] },
  pinterest: { platform: "pinterest", maxCaptionLength: 500, supportedAspectRatios: ["2:3", "1:1"], requiredPermissions: ["publishing.deliver"] },
  "whatsapp-business": { platform: "whatsapp-business", maxCaptionLength: 1024, supportedAspectRatios: ["1:1", "4:5", "16:9"], requiredPermissions: ["publishing.deliver"] },
  telegram: { platform: "telegram", maxCaptionLength: 1024, supportedAspectRatios: ["1:1", "4:5", "16:9"], requiredPermissions: ["publishing.deliver"] },
};

/** Offline-first publisher: local export packages are durable; connector delivery is optional and explicit. */
export class PublishingDistributionManager {
  private root = "";
  private statePath = "";
  private initialized = false;
  private store: PublishingStore = structuredClone(EMPTY_STORE);

  constructor(private readonly review: CreativeReviewManager, private readonly connectors: AiConnectorManager) {}

  async initialize(storageRoot: string): Promise<void> {
    this.root = path.join(storageRoot, "publishing-distribution");
    this.statePath = path.join(this.root, "publishing-state.json");
    await fs.mkdir(path.join(this.root, "packages"), { recursive: true });
    this.store = await this.readStore(); this.initialized = true; await this.persist();
  }

  listProfiles(): PublishingPlatformProfile[] { this.ensureReady(); return structuredClone(this.store.profiles); }
  listPackages(projectId?: string): PublishingPackage[] { this.ensureReady(); return this.store.packages.filter((item) => !projectId || item.projectId === projectId).map((item) => structuredClone(item)); }
  listJobs(): PublishingJob[] { this.ensureReady(); return structuredClone(this.store.jobs); }
  listCalendar(from: Date, to: Date): PublishingJob[] { this.ensureReady(); return this.store.jobs.filter((job) => new Date(job.scheduledFor) >= from && new Date(job.scheduledFor) <= to).map((job) => structuredClone(job)); }
  getPlatformTemplates(): PublishingPlatformProfile[] { return Object.values(PLATFORM_TEMPLATES).map((template) => ({ ...template, id: `template.${template.platform}`, enabled: false })); }

  async registerProfile(profile: PublishingPlatformProfile): Promise<PublishingPlatformProfile> {
    this.ensureReady(); this.validateProfile(profile);
    if (this.store.profiles.some((item) => item.id === profile.id)) throw new Error("Publishing profile already registered");
    this.store.profiles.push(structuredClone(profile)); await this.persist(); return structuredClone(profile);
  }

  async packageExport(projectId: string, exportFileName: string, input: { caption?: string; hashtags?: string[] } = {}): Promise<PublishingPackage> {
    this.ensureReady(); const source = await this.review.getAssetPath(projectId, exportFileName, true);
    if (!source) throw new Error("Approved local export was not found");
    const state = await this.review.getProjectState(projectId);
    const exported = state.exports.find((item) => item.fileName === exportFileName);
    if (!exported) throw new Error("Export is not registered in the local review history");
    const id = randomUUID(); const packageDir = path.join(this.root, "packages", id); const packagePath = path.join(packageDir, exportFileName);
    const caption = input.caption?.trim() || `Published from KWIZERA AI Studio: ${exportFileName}`;
    const hashtags = [...new Set((input.hashtags ?? []).map((tag) => tag.trim()).filter((tag) => /^#[A-Za-z0-9_]{1,80}$/.test(tag)))];
    await fs.mkdir(packageDir, { recursive: true }); await fs.copyFile(source, packagePath);
    const metadataPath = path.join(packageDir, "metadata.json");
    await fs.writeFile(metadataPath, `${JSON.stringify({ projectId, exportFileName, export: exported, caption, hashtags, optimization: { sourcePreserved: true, note: "Transcoding and compression remain owned by the rendering pipeline." } }, null, 2)}\n`, "utf8");
    const publishingPackage: PublishingPackage = { id, projectId, exportFileName, packagePath, metadataPath, caption, hashtags, createdAt: new Date().toISOString() };
    this.store.packages.unshift(publishingPackage); await this.persist(); return structuredClone(publishingPackage);
  }

  async schedule(packageId: string, profileId: string, scheduledFor: string, timeZone = "UTC", recurrence?: PublishingRecurrence): Promise<PublishingJob> {
    this.ensureReady(); this.requirePackage(packageId); const profile = this.requireProfile(profileId); if (!profile.enabled) throw new Error("Publishing profile is disabled");
    const when = new Date(scheduledFor); if (!Number.isFinite(when.getTime()) || !timeZone.trim()) throw new Error("Scheduled publishing time or time zone is invalid");
    const now = new Date().toISOString(); const job: PublishingJob = { id: randomUUID(), packageId, profileId, status: "scheduled", scheduledFor: when.toISOString(), timeZone, attempts: 0, recurrence, createdAt: now, updatedAt: now };
    this.store.jobs.unshift(job); await this.persist(); return structuredClone(job);
  }

  async scheduleNow(packageId: string, profileId: string, timeZone = "UTC"): Promise<PublishingJob> { return this.schedule(packageId, profileId, new Date().toISOString(), timeZone); }

  async scheduleBatch(packageId: string, profileIds: string[], scheduledFor: string, timeZone = "UTC", recurrence?: PublishingRecurrence): Promise<PublishingJob[]> {
    if (!profileIds.length || new Set(profileIds).size !== profileIds.length) throw new Error("At least one unique publishing profile is required");
    return Promise.all(profileIds.map((profileId) => this.schedule(packageId, profileId, scheduledFor, timeZone, recurrence)));
  }

  async processDue(now = new Date()): Promise<PublishingJob[]> {
    this.ensureReady(); const processed: PublishingJob[] = [];
    for (const job of this.store.jobs.filter((item) => item.status === "scheduled" && new Date(item.scheduledFor) <= now)) { await this.process(job); processed.push(structuredClone(job)); }
    return processed;
  }

  async retryFailed(jobId: string): Promise<PublishingJob> {
    this.ensureReady(); const job = this.store.jobs.find((item) => item.id === jobId);
    if (!job || job.status !== "failed") throw new Error("Failed publishing job not found");
    if (job.attempts >= MAX_DELIVERY_ATTEMPTS) throw new Error("Publishing job reached its delivery retry limit");
    job.status = "scheduled"; job.scheduledFor = new Date().toISOString(); job.updatedAt = job.scheduledFor; job.error = undefined;
    await this.process(job); return structuredClone(job);
  }

  getOptimizationRecommendation(packageId: string, profileId: string): PublishingOptimizationRecommendation {
    this.ensureReady(); const publishingPackage = this.requirePackage(packageId); const profile = this.requireProfile(profileId);
    return { captionLength: publishingPackage.caption.length, captionLimit: profile.maxCaptionLength, captionWillBeTruncated: publishingPackage.caption.length > profile.maxCaptionLength, supportedAspectRatios: [...profile.supportedAspectRatios], sourcePreserved: true, note: "Aspect-ratio conversion, resizing, compression, subtitles, and rendering remain owned by the rendering pipeline." };
  }

  getStatus(): PublishingStatus {
    this.ensureReady(); const jobs = this.store.jobs; const attempts = jobs.reduce((sum, item) => sum + item.attempts, 0); const published = jobs.filter((item) => item.status === "published").length;
    return { initialized: true, offlineFirst: true, packages: this.store.packages.length, jobs: { scheduled: jobs.filter((item) => item.status === "scheduled").length, readyLocal: jobs.filter((item) => item.status === "ready-local").length, published, failed: jobs.filter((item) => item.status === "failed").length }, profiles: { total: this.store.profiles.length, enabled: this.store.profiles.filter((item) => item.enabled).length, connected: this.store.profiles.filter((item) => item.enabled && item.connectorId && this.connectors.get(item.connectorId)?.status === "enabled").length }, analytics: { deliveryAttempts: attempts, successRatePercent: attempts ? Math.round(published / attempts * 100) : 0, exportPackages: this.store.packages.length } };
  }

  private async process(job: PublishingJob): Promise<void> {
    const profile = this.requireProfile(job.profileId); const publishingPackage = this.requirePackage(job.packageId); job.attempts++; job.updatedAt = new Date().toISOString();
    if (!profile.connectorId || !profile.deliveryPath || this.connectors.get(profile.connectorId)?.status !== "enabled") { job.status = "ready-local"; job.error = "External publishing is unavailable; the local package is ready for manual delivery"; await this.persist(); return; }
    const content = await fs.readFile(publishingPackage.packagePath); const result = await this.connectors.execute({ connectorId: profile.connectorId, path: profile.deliveryPath, method: "POST", body: { fileName: publishingPackage.exportFileName, dataBase64: content.toString("base64"), caption: optimizeCaption(publishingPackage.caption, profile.maxCaptionLength), hashtags: publishingPackage.hashtags }, permissions: profile.requiredPermissions });
    if (result.status === "succeeded" || result.status === "fallback-succeeded") { job.status = "published"; job.publishedAt = new Date().toISOString(); job.error = undefined; await this.scheduleRecurringJob(job); }
    else { job.status = "failed"; job.error = result.error ?? "Connector delivery failed"; }
    job.updatedAt = new Date().toISOString(); await this.persist();
  }

  private requireProfile(profileId: string): PublishingPlatformProfile { const profile = this.store.profiles.find((item) => item.id === profileId); if (!profile) throw new Error("Publishing profile not found"); return profile; }
  private requirePackage(packageId: string): PublishingPackage { const publishingPackage = this.store.packages.find((item) => item.id === packageId); if (!publishingPackage) throw new Error("Publishing package not found"); return publishingPackage; }
  private async scheduleRecurringJob(job: PublishingJob): Promise<void> {
    if (!job.recurrence) return;
    const next = new Date(job.scheduledFor);
    if (job.recurrence === "daily") next.setUTCDate(next.getUTCDate() + 1);
    if (job.recurrence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
    if (job.recurrence === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
    await this.schedule(job.packageId, job.profileId, next.toISOString(), job.timeZone, job.recurrence);
  }
  private validateProfile(profile: PublishingPlatformProfile): void { if (!/^[a-z0-9][a-z0-9.-]{2,100}$/i.test(profile.id) || !Number.isInteger(profile.maxCaptionLength) || profile.maxCaptionLength < 1 || profile.maxCaptionLength > 10000 || !profile.supportedAspectRatios.length) throw new Error("Publishing profile is invalid"); if (profile.connectorId && (!profile.deliveryPath || !profile.deliveryPath.startsWith("/"))) throw new Error("Connector publishing profile requires a relative delivery path"); }
  private async readStore(): Promise<PublishingStore> { try { const saved = JSON.parse(await fs.readFile(this.statePath, "utf8")) as Partial<PublishingStore>; return { profiles: saved.profiles ?? [], packages: saved.packages ?? [], jobs: saved.jobs ?? [] }; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_STORE); throw error; } }
  private async persist(): Promise<void> { const temporary = `${this.statePath}.${randomUUID()}.tmp`; await fs.writeFile(temporary, `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); await fs.rename(temporary, this.statePath); }
  private ensureReady(): void { if (!this.initialized) throw new Error("Publishing Distribution Manager is not initialized"); }
}

function optimizeCaption(caption: string, maximum: number): string { return caption.length <= maximum ? caption : caption.slice(0, Math.max(0, maximum - 1)).trimEnd() + "..."; }