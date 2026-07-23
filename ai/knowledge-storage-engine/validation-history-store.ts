import fs from "node:fs";
import path from "node:path";
import { KnowledgeValidationHistoryEntry } from "./types.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";

export class KnowledgeValidationHistoryStore {
  private historyPath = "";
  private entries: KnowledgeValidationHistoryEntry[] = [];

  constructor(private readonly logger: KnowledgeStorageLogger) {}

  initialize(storageDir: string): void {
    fs.mkdirSync(storageDir, { recursive: true });
    this.historyPath = path.join(storageDir, "validation-history.json");
    if (fs.existsSync(this.historyPath)) {
      const raw = fs.readFileSync(this.historyPath, "utf8");
      this.entries = JSON.parse(raw) as KnowledgeValidationHistoryEntry[];
    }
  }

  append(entry: KnowledgeValidationHistoryEntry): void {
    this.entries.push(entry);
    fs.writeFileSync(this.historyPath, JSON.stringify(this.entries, null, 2), "utf8");
    this.logger.log("debug", "validation", "Validation history recorded", {
      knowledgeId: entry.knowledgeId,
      valid: entry.valid,
    });
  }

  getAll(): KnowledgeValidationHistoryEntry[] {
    return [...this.entries];
  }

  getCount(): number {
    return this.entries.length;
  }
}
