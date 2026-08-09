/**
 * Temporary review staging for downloaded resources before Knowledge Foundation import.
 * Step 1 only — never imports into the Knowledge Foundation.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { DownloadRecord, ReviewStagingRecord } from "./types.js";

export class KnowledgeReviewStagingArea {
  private root = "";
  private readonly records = new Map<string, ReviewStagingRecord>();

  async initialize(workspaceRoot: string): Promise<void> {
    this.root = path.join(workspaceRoot, "review");
    await fs.mkdir(this.root, { recursive: true });
    await fs.mkdir(path.join(this.root, "pending"), { recursive: true });
    await fs.mkdir(path.join(this.root, "accepted"), { recursive: true });
    await fs.mkdir(path.join(this.root, "rejected"), { recursive: true });
    await this.restore();
  }

  getRoot(): string {
    return this.root;
  }

  list(): ReviewStagingRecord[] {
    return [...this.records.values()].map((record) => structuredClone(record));
  }

  get(downloadId: string): ReviewStagingRecord | null {
    const record = this.records.get(downloadId);
    return record ? structuredClone(record) : null;
  }

  async stageCompletedDownload(download: DownloadRecord): Promise<ReviewStagingRecord> {
    if (!this.root) throw new Error("Review staging area is not initialized");
    if (download.status !== "completed" || !download.filePath) {
      throw new Error("Only completed downloads with a local file can enter the review area.");
    }

    const pendingDir = path.join(this.root, "pending", download.id);
    await fs.mkdir(pendingDir, { recursive: true });
    const stagedPath = path.join(pendingDir, download.fileName);
    await fs.copyFile(download.filePath, stagedPath);

    const record: ReviewStagingRecord = {
      downloadId: download.id,
      topic: download.topic,
      sourceId: download.sourceId,
      fileName: download.fileName,
      stagedPath,
      status: "pending-review",
      stagedAt: new Date().toISOString(),
      notes: "Staged for review. Not imported into the Knowledge Foundation.",
    };
    this.records.set(download.id, record);
    await this.persist();
    return structuredClone(record);
  }

  async acceptForLaterIntegration(downloadId: string, note?: string): Promise<ReviewStagingRecord> {
    return this.move(downloadId, "accepted", note ?? "Accepted into review queue for future validation (Step 2).");
  }

  async rejectFromReview(downloadId: string, reason: string): Promise<ReviewStagingRecord> {
    return this.move(downloadId, "rejected", reason);
  }

  private async move(
    downloadId: string,
    status: "accepted" | "rejected",
    notes: string,
  ): Promise<ReviewStagingRecord> {
    const record = this.records.get(downloadId);
    if (!record) throw new Error(`Review record not found: ${downloadId}`);
    const targetDir = path.join(this.root, status, downloadId);
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, record.fileName);
    try {
      await fs.rename(record.stagedPath, targetPath);
    } catch {
      await fs.copyFile(record.stagedPath, targetPath);
    }
    record.status = status === "accepted" ? "accepted-for-later-integration" : "rejected-from-review";
    record.stagedPath = targetPath;
    record.notes = notes;
    record.reviewedAt = new Date().toISOString();
    await this.persist();
    return structuredClone(record);
  }

  private async persist(): Promise<void> {
    await fs.writeFile(
      path.join(this.root, "review-index.json"),
      `${JSON.stringify({ records: [...this.records.values()] }, null, 2)}\n`,
      "utf8",
    );
  }

  private async restore(): Promise<void> {
    try {
      const raw = await fs.readFile(path.join(this.root, "review-index.json"), "utf8");
      const parsed = JSON.parse(raw) as { records?: ReviewStagingRecord[] };
      this.records.clear();
      for (const record of parsed.records ?? []) this.records.set(record.downloadId, record);
    } catch {
      this.records.clear();
    }
  }
}
