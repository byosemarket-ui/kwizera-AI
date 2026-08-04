import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";
import type { RegisteredKnowledgeSource } from "../knowledge-source-manager/types.js";
import { evaluateDownloadSafety, resolveDownloadFolder } from "./download-safety.js";
import type {
  DownloadRecord,
  DownloadRequest,
  DownloadTransport,
  KnowledgeResearchStatusReport,
} from "./types.js";

const DOWNLOAD_SUBFOLDERS = ["official-docs", "pdf", "books", "manuals", "research", "examples", "api", "images", "metadata"];

/** Offline-first default: performs no real network access; real transports must be injected explicitly. */
export const offlineDownloadTransport: DownloadTransport = async () => {
  throw new Error("Offline-first default: no download transport is configured. Inject a network transport to enable real downloads.");
};

/** Downloads approved knowledge resources into the local Knowledge Workspace, enforcing safety and duplicate protection. */
export class KnowledgeDownloadEngine {
  private root = "";
  private initialized = false;
  private readonly downloads = new Map<string, DownloadRecord>();

  constructor(private readonly transport: DownloadTransport = offlineDownloadTransport) {}

  async initialize(root: string): Promise<void> {
    this.root = root;
    for (const folder of DOWNLOAD_SUBFOLDERS) {
      await fs.mkdir(path.join(this.root, folder), { recursive: true });
    }
    await this.restore();
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getDownload(downloadId: string): DownloadRecord | null {
    const record = this.downloads.get(downloadId);
    return record ? structuredClone(record) : null;
  }

  getHistory(): DownloadRecord[] {
    return [...this.downloads.values()].map((record) => structuredClone(record));
  }

  async requestDownload(
    request: DownloadRequest,
    source: RegisteredKnowledgeSource | null,
    policyDecision: "allow" | "block" | "review"
  ): Promise<DownloadRecord> {
    this.ensureReady();

    const duplicateOfSameFile = [...this.downloads.values()].find(
      (existing) =>
        existing.sourceId === request.sourceId &&
        existing.fileName === request.fileName &&
        (existing.status === "completed" || existing.status === "pending-approval" || existing.status === "approved")
    );

    const now = new Date().toISOString();
    if (duplicateOfSameFile) {
      const record: DownloadRecord = {
        id: randomUUID(),
        topic: request.topic,
        sourceId: request.sourceId,
        resourceType: request.resourceType,
        url: request.url,
        fileName: request.fileName,
        filePath: null,
        status: "duplicate",
        userApproved: false,
        processingStatus: "unprocessed",
        license: source?.license,
        version: source?.version,
        checksumSha256: null,
        fileSizeBytes: null,
        requestedAt: now,
        rejectionReason: `A download of "${request.fileName}" from this source already exists (status: ${duplicateOfSameFile.status}).`,
      };
      this.downloads.set(record.id, record);
      await this.persist();
      return structuredClone(record);
    }

    const safety = evaluateDownloadSafety(request, source, policyDecision);
    const record: DownloadRecord = {
      id: randomUUID(),
      topic: request.topic,
      sourceId: request.sourceId,
      resourceType: request.resourceType,
      url: request.url,
      fileName: request.fileName,
      filePath: null,
      status: safety.allowed ? "pending-approval" : "rejected",
      userApproved: false,
      processingStatus: "unprocessed",
      license: source?.license,
      version: source?.version,
      checksumSha256: null,
      fileSizeBytes: null,
      requestedAt: now,
      rejectionReason: safety.allowed ? undefined : safety.reasons.join(" "),
    };
    this.downloads.set(record.id, record);
    await this.persist();
    return structuredClone(record);
  }

  async approveDownload(downloadId: string, sourceType: KnowledgeAcquisitionSourceType): Promise<DownloadRecord> {
    this.ensureReady();
    const record = this.require(downloadId);
    if (record.status !== "pending-approval") {
      throw new Error(`Download ${downloadId} cannot be approved from status "${record.status}".`);
    }
    record.userApproved = true;
    record.status = "approved";

    try {
      const result = await this.transport(record.url);
      const checksum = createHash("sha256").update(result.content).digest("hex");

      const duplicateContent = [...this.downloads.values()].find(
        (existing) => existing.id !== record.id && existing.checksumSha256 === checksum && existing.status === "completed"
      );
      if (duplicateContent) {
        record.status = "duplicate";
        record.checksumSha256 = checksum;
        record.rejectionReason = `Identical content already downloaded as "${duplicateContent.fileName}" (${duplicateContent.id}).`;
        await this.persist();
        return structuredClone(record);
      }

      const folder = resolveDownloadFolder(sourceType, record.resourceType);
      const filePath = path.join(this.root, folder, record.fileName);
      await fs.writeFile(filePath, result.content);

      record.status = "completed";
      record.filePath = filePath;
      record.checksumSha256 = checksum;
      record.fileSizeBytes = result.content.byteLength;
      record.completedAt = new Date().toISOString();
      record.processingStatus = "queued-for-acquisition";
    } catch (error) {
      record.status = "failed";
      record.rejectionReason = error instanceof Error ? error.message : String(error);
    }

    await this.persist();
    return structuredClone(record);
  }

  async rejectDownload(downloadId: string, reason: string): Promise<DownloadRecord> {
    this.ensureReady();
    const record = this.require(downloadId);
    record.status = "rejected";
    record.rejectionReason = reason;
    await this.persist();
    return structuredClone(record);
  }

  async markProcessed(downloadId: string): Promise<DownloadRecord> {
    this.ensureReady();
    const record = this.require(downloadId);
    record.processingStatus = "processed";
    await this.persist();
    return structuredClone(record);
  }

  getStatusReport(): Omit<KnowledgeResearchStatusReport, "totalPlans"> {
    const all = [...this.downloads.values()];
    return {
      totalDownloads: all.length,
      completedDownloads: all.filter((record) => record.status === "completed").length,
      pendingApprovalDownloads: all.filter((record) => record.status === "pending-approval").length,
      rejectedDownloads: all.filter((record) => record.status === "rejected").length,
      duplicateDownloadsBlocked: all.filter((record) => record.status === "duplicate").length,
      failedDownloads: all.filter((record) => record.status === "failed").length,
      totalStorageBytes: all.reduce((total, record) => total + (record.fileSizeBytes ?? 0), 0),
    };
  }

  private require(downloadId: string): DownloadRecord {
    const record = this.downloads.get(downloadId);
    if (!record) throw new Error(`Download not found: ${downloadId}`);
    return record;
  }

  private async restore(): Promise<void> {
    try {
      const saved = JSON.parse(
        await fs.readFile(path.join(this.root, "metadata", "downloads-index.json"), "utf8")
      ) as DownloadRecord[];
      for (const record of saved) this.downloads.set(record.id, record);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private async persist(): Promise<void> {
    const target = path.join(this.root, "metadata", "downloads-index.json");
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify([...this.downloads.values()], null, 2)}\n`, "utf8");
    await fs.rename(temporary, target);
  }

  private ensureReady(): void {
    if (!this.initialized) throw new Error("Knowledge Download Engine is not initialized");
  }
}
