import fs from "node:fs";
import path from "node:path";
import type { ProfessionalSelfReviewMemoryRecord } from "./professional-self-review-types.js";

/**
 * Offline-first professional self-review memory for reuse and improvement tracking.
 */
export class ProfessionalSelfReviewMemoryStore {
  private memoryPath: string | null = null;
  private readonly records: ProfessionalSelfReviewMemoryRecord[] = [];
  private loaded = false;

  initialize(selfReviewDirectory: string): void {
    fs.mkdirSync(selfReviewDirectory, { recursive: true });
    this.memoryPath = path.join(selfReviewDirectory, "professional-self-review-memory.jsonl");
    this.loadFromDisk();
    this.loaded = true;
  }

  isReady(): boolean {
    return this.loaded && this.memoryPath !== null;
  }

  append(record: ProfessionalSelfReviewMemoryRecord): void {
    this.records.push(record);
    if (this.memoryPath) {
      fs.appendFileSync(this.memoryPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  update(record: ProfessionalSelfReviewMemoryRecord): void {
    const index = this.records.findIndex((item) => item.reviewId === record.reviewId);
    if (index >= 0) this.records[index] = record;
    else this.records.push(record);
    this.rewrite();
  }

  getAll(): ReadonlyArray<ProfessionalSelfReviewMemoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getById(reviewId: string): ProfessionalSelfReviewMemoryRecord | null {
    return this.records.find((record) => record.reviewId === reviewId) ?? null;
  }

  findByFingerprint(fingerprint: string): ProfessionalSelfReviewMemoryRecord | null {
    return (
      [...this.records].reverse().find((record) => record.fingerprint === fingerprint && record.grounded) ?? null
    );
  }

  findSimilar(objective: string, domains: string[], limit = 5): ProfessionalSelfReviewMemoryRecord[] {
    const tokens = tokenize(objective);
    const domainSet = new Set(domains.map((domain) => domain.toLowerCase()));
    return [...this.records]
      .filter((record) => record.grounded && record.confidenceScore >= 50)
      .map((record) => ({
        record,
        score:
          overlap(tokens, tokenize(objective)) * 2 +
          record.domainsUsed.filter((domain) => domainSet.has(domain.toLowerCase())).length * 3 +
          Math.round(record.confidenceScore / 25) +
          (record.reviewPassed ? 2 : 0),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.record);
  }

  getMemoryPath(): string | null {
    return this.memoryPath;
  }

  ensureWritable(): boolean {
    if (!this.memoryPath) return false;
    try {
      fs.mkdirSync(path.dirname(this.memoryPath), { recursive: true });
      fs.appendFileSync(this.memoryPath, "", "utf8");
      return true;
    } catch {
      return false;
    }
  }

  private rewrite(): void {
    if (!this.memoryPath) return;
    const body = this.records.map((record) => JSON.stringify(record)).join("\n");
    fs.writeFileSync(this.memoryPath, body ? `${body}\n` : "", "utf8");
  }

  private loadFromDisk(): void {
    if (!this.memoryPath || !fs.existsSync(this.memoryPath)) return;
    const lines = fs.readFileSync(this.memoryPath, "utf8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as ProfessionalSelfReviewMemoryRecord;
        if (parsed?.reviewId && parsed.timestamp) this.records.push(parsed);
      } catch {
        /* skip corrupt lines */
      }
    }
  }
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) if (b.has(token)) count += 1;
  return count;
}
