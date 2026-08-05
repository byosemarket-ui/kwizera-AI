import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";
import type { RegisteredKnowledgeSource } from "../knowledge-source-manager/types.js";
import { evaluateDownloadSafety } from "./download-safety.js";
import { KnowledgeCollectionWorkspace, WORKSPACE_TYPE_FOLDERS } from "./knowledge-collection-workspace.js";
import type {
  DownloadRecord,
  DownloadRequest,
  DownloadTransport,
  KnowledgeCollectionRepairResult,
  KnowledgeResearchStatusReport,
} from "./types.js";

/** Offline-first default: performs no real network access; real transports must be injected explicitly. */
export const offlineDownloadTransport: DownloadTransport = async () => {
  throw new Error("Offline-first default: no download transport is configured. Inject a network transport to enable real downloads.");
};

/** Downloads/collects approved knowledge resources into the Local Knowledge Workspace. */
export class KnowledgeDownloadEngine {
  private root = "";
  private initialized = false;
  private readonly downloads = new Map<string, DownloadRecord>();
  private readonly workspace = new KnowledgeCollectionWorkspace();
  private lastRepair: KnowledgeCollectionRepairResult | null = null;

  constructor(private readonly transport: DownloadTransport = offlineDownloadTransport) {}

  async initialize(root: string): Promise<void> {
    this.root = root;
    this.lastRepair = await this.workspace.initialize(root);
    for (const folder of WORKSPACE_TYPE_FOLDERS) {
      await fs.mkdir(path.join(this.root, folder), { recursive: true });
    }
    await this.restore();
    this.lastRepair = await this.repairWorkspace();
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getWorkspace(): KnowledgeCollectionWorkspace {
    return this.workspace;
  }

  getLastRepair(): KnowledgeCollectionRepairResult | null {
    return this.lastRepair;
  }

  async repairWorkspace(): Promise<KnowledgeCollectionRepairResult> {
    this.ensureReadyUnlessBootstrapping();
    const structure = await this.workspace.ensureStructure();
    const actions = [...structure.actions];
    const remainingIssues = [...structure.remainingIssues];

    for (const record of this.downloads.values()) {
      if (record.status !== "completed" || !record.filePath) continue;
      try {
        await fs.access(record.filePath);
      } catch {
        record.status = "failed";
        record.rejectionReason = `Collected file missing from workspace: ${record.filePath}`;
        actions.push(`Marked missing resource failed: ${record.id}`);
      }
      if (!record.metadataFingerprint) {
        record.metadataFingerprint = buildMetadataFingerprint(record);
        actions.push(`Repaired metadata fingerprint: ${record.id}`);
      }
      if (!record.collectionDate && record.completedAt) {
        record.collectionDate = record.completedAt;
        actions.push(`Repaired collection date: ${record.id}`);
      }
      if (record.localStoragePath === undefined && record.filePath) {
        record.localStoragePath = record.filePath;
      }
    }
    await this.persist();
    this.lastRepair = { repaired: remainingIssues.length === 0, actions, remainingIssues };
    return this.lastRepair;
  }

  getDownload(downloadId: string): DownloadRecord | null {
    const record = this.downloads.get(downloadId);
    return record ? structuredClone(record) : null;
  }

  getHistory(): DownloadRecord[] {
    return [...this.downloads.values()].map((record) => structuredClone(record));
  }

  listByDomain(domainId: string): DownloadRecord[] {
    return this.getHistory().filter((record) => record.domainId === domainId);
  }

  async requestDownload(
    request: DownloadRequest,
    source: RegisteredKnowledgeSource | null,
    policyDecision: "allow" | "block" | "review"
  ): Promise<DownloadRecord> {
    this.ensureReady();

    const fingerprint = buildRequestFingerprint(request, source);
    const duplicate = this.findDuplicate(request, fingerprint);
    const now = new Date().toISOString();

    if (duplicate) {
      const record = this.buildRecord(request, source, now, {
        status: "duplicate",
        rejectionReason: duplicate.reason,
        metadataFingerprint: fingerprint,
      });
      this.downloads.set(record.id, record);
      await this.persist();
      return structuredClone(record);
    }

    const safety = evaluateDownloadSafety(request, source, policyDecision);
    const record = this.buildRecord(request, source, now, {
      status: safety.allowed ? "pending-approval" : "rejected",
      rejectionReason: safety.allowed ? undefined : safety.reasons.join(" "),
      metadataFingerprint: fingerprint,
    });
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
      const result = record.url.startsWith("local://") || record.url.startsWith("file:")
        ? await readLocalContent(record.url)
        : await this.transport(record.url);
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

      const sameVersion = [...this.downloads.values()].find(
        (existing) =>
          existing.id !== record.id &&
          existing.status === "completed" &&
          existing.sourceId === record.sourceId &&
          existing.version &&
          record.version &&
          existing.version === record.version &&
          existing.fileName === record.fileName
      );
      if (sameVersion) {
        record.status = "duplicate";
        record.checksumSha256 = checksum;
        record.rejectionReason = `Same version "${record.version}" of "${record.fileName}" already collected (${sameVersion.id}).`;
        await this.persist();
        return structuredClone(record);
      }

      const filePath = this.workspace.resolveResourcePath(record.domainId, sourceType, record.resourceType, record.fileName);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, result.content);

      record.status = "completed";
      record.filePath = filePath;
      record.localStoragePath = filePath;
      record.checksumSha256 = checksum;
      record.fileSizeBytes = result.content.byteLength;
      record.completedAt = new Date().toISOString();
      record.collectionDate = record.completedAt;
      record.lastUpdated = record.completedAt;
      record.processingStatus = "queued-for-acquisition";
      record.metadataFingerprint = buildMetadataFingerprint(record);
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
    record.processingStatus = "understood";
    await this.persist();
    return structuredClone(record);
  }

  async markExtracted(downloadId: string): Promise<DownloadRecord> {
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

  private findDuplicate(
    request: DownloadRequest,
    fingerprint: string
  ): { reason: string } | null {
    const sameFile = [...this.downloads.values()].find(
      (existing) =>
        existing.sourceId === request.sourceId &&
        existing.fileName === request.fileName &&
        (existing.status === "completed" || existing.status === "pending-approval" || existing.status === "approved")
    );
    if (sameFile) {
      return { reason: `A download of "${request.fileName}" from this source already exists (status: ${sameFile.status}).` };
    }

    const sameMeta = [...this.downloads.values()].find(
      (existing) =>
        existing.metadataFingerprint === fingerprint &&
        (existing.status === "completed" || existing.status === "pending-approval" || existing.status === "approved")
    );
    if (sameMeta) {
      return { reason: `Same document metadata already collected (${sameMeta.id}).` };
    }
    return null;
  }

  private buildRecord(
    request: DownloadRequest,
    source: RegisteredKnowledgeSource | null,
    now: string,
    extras: Partial<DownloadRecord>
  ): DownloadRecord {
    return {
      id: randomUUID(),
      topic: request.topic,
      sourceId: request.sourceId,
      resourceType: request.resourceType,
      url: request.localSourcePath ? `local://${request.localSourcePath.replace(/\\/g, "/")}` : request.url,
      fileName: request.fileName,
      filePath: null,
      status: extras.status ?? "pending-approval",
      userApproved: false,
      processingStatus: "unprocessed",
      license: source?.license,
      version: source?.version,
      checksumSha256: null,
      fileSizeBytes: null,
      requestedAt: now,
      rejectionReason: extras.rejectionReason,
      domainId: request.domainId,
      title: request.title ?? request.fileName,
      knowledgeDomain: request.domainId,
      sourceName: source?.name,
      language: request.language ?? source?.language ?? "en",
      trustScore: source?.verification.trustScore ?? source?.quality?.trustScore,
      qualityScore: source?.quality?.qualityScore,
      collectionDate: undefined,
      lastUpdated: source?.lastUpdated ?? now,
      metadataFingerprint: extras.metadataFingerprint,
      localStoragePath: null,
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

  private ensureReadyUnlessBootstrapping(): void {
    if (!this.root) throw new Error("Knowledge Download Engine is not initialized");
  }
}

function buildRequestFingerprint(request: DownloadRequest, source: RegisteredKnowledgeSource | null): string {
  const raw = [
    request.sourceId,
    request.url,
    request.fileName,
    request.domainId ?? "",
    source?.version ?? "",
    request.title ?? "",
    request.resourceType,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

function buildMetadataFingerprint(record: DownloadRecord): string {
  const raw = [
    record.sourceId,
    record.url,
    record.fileName,
    record.domainId ?? "",
    record.version ?? "",
    record.title ?? "",
    record.resourceType,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

async function readLocalContent(url: string): Promise<{ content: Uint8Array; contentType?: string }> {
  const localPath = url.replace(/^local:\/\//, "").replace(/^file:\/\//, "");
  const content = await fs.readFile(localPath);
  return { content };
}
