import fs from "node:fs";
import path from "node:path";
import type { ProfessionalPlanMemoryRecord } from "./professional-planning-types.js";

/**
 * Offline-first professional plan memory for reuse and review.
 * Separate from workflow PlanningHistoryStore.
 */
export class ProfessionalPlanMemoryStore {
  private memoryPath: string | null = null;
  private readonly records: ProfessionalPlanMemoryRecord[] = [];
  private loaded = false;

  initialize(plansDirectory: string): void {
    fs.mkdirSync(plansDirectory, { recursive: true });
    this.memoryPath = path.join(plansDirectory, "professional-plan-memory.jsonl");
    this.loadFromDisk();
    this.loaded = true;
  }

  isReady(): boolean {
    return this.loaded && this.memoryPath !== null;
  }

  append(record: ProfessionalPlanMemoryRecord): void {
    this.records.push(record);
    if (this.memoryPath) {
      fs.appendFileSync(this.memoryPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  update(record: ProfessionalPlanMemoryRecord): void {
    const index = this.records.findIndex((item) => item.planId === record.planId);
    if (index >= 0) this.records[index] = record;
    else this.records.push(record);
    this.rewrite();
  }

  getAll(): ReadonlyArray<ProfessionalPlanMemoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getById(planId: string): ProfessionalPlanMemoryRecord | null {
    return this.records.find((record) => record.planId === planId) ?? null;
  }

  findSimilar(goal: string, domains: string[], limit = 5): ProfessionalPlanMemoryRecord[] {
    const tokens = tokenize(goal);
    const domainSet = new Set(domains.map((domain) => domain.toLowerCase()));
    return [...this.records]
      .filter((record) => record.grounded && record.confidenceScore >= 50)
      .map((record) => ({
        record,
        score:
          overlap(tokens, tokenize(record.goal)) * 3 +
          record.domainsUsed.filter((domain) => domainSet.has(domain.toLowerCase())).length * 2 +
          Math.round(record.confidenceScore / 25),
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
        const parsed = JSON.parse(line) as ProfessionalPlanMemoryRecord;
        if (parsed?.planId && parsed.timestamp) this.records.push(parsed);
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
