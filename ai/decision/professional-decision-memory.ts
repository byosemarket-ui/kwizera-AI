import fs from "node:fs";
import path from "node:path";
import type { ProfessionalDecisionMemoryRecord } from "./professional-decision-types.js";

/**
 * Offline-first professional decision memory for learning and review.
 * Separate from workflow DecisionHistoryStore to avoid mixing authorities.
 */
export class ProfessionalDecisionMemoryStore {
  private memoryPath: string | null = null;
  private readonly records: ProfessionalDecisionMemoryRecord[] = [];
  private loaded = false;

  initialize(decisionsDirectory: string): void {
    fs.mkdirSync(decisionsDirectory, { recursive: true });
    this.memoryPath = path.join(decisionsDirectory, "professional-decision-memory.jsonl");
    this.loadFromDisk();
    this.loaded = true;
  }

  isReady(): boolean {
    return this.loaded && this.memoryPath !== null;
  }

  append(record: ProfessionalDecisionMemoryRecord): void {
    this.records.push(record);
    if (this.memoryPath) {
      fs.appendFileSync(this.memoryPath, `${JSON.stringify(record)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<ProfessionalDecisionMemoryRecord> {
    return this.records;
  }

  getCount(): number {
    return this.records.length;
  }

  getById(decisionId: string): ProfessionalDecisionMemoryRecord | null {
    return this.records.find((record) => record.decisionId === decisionId) ?? null;
  }

  findSimilar(objective: string, domains: string[], limit = 5): ProfessionalDecisionMemoryRecord[] {
    const tokens = tokenize(objective);
    const domainSet = new Set(domains.map((domain) => domain.toLowerCase()));
    return [...this.records]
      .filter((record) => record.grounded && record.confidenceScore >= 50)
      .map((record) => ({
        record,
        score:
          overlap(tokens, tokenize(record.context.objective)) * 3 +
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

  private loadFromDisk(): void {
    if (!this.memoryPath || !fs.existsSync(this.memoryPath)) return;
    const lines = fs.readFileSync(this.memoryPath, "utf8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as ProfessionalDecisionMemoryRecord;
        if (parsed?.decisionId && parsed.timestamp) this.records.push(parsed);
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
