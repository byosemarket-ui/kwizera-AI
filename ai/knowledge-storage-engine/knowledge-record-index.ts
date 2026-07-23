import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { KnowledgeStorageIndex, KnowledgeStorageIndexEntry } from "./types.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";

const INDEX_VERSION = "0.1.0";

export class KnowledgeRecordIndex {
  private indexPath = "";
  private index: KnowledgeStorageIndex = {
    version: INDEX_VERSION,
    lastUpdated: new Date().toISOString(),
    recordCount: 0,
    entries: [],
  };

  constructor(private readonly logger: KnowledgeStorageLogger) {}

  initialize(storageDir: string): void {
    fs.mkdirSync(storageDir, { recursive: true });
    this.indexPath = path.join(storageDir, "knowledge-record-index.json");
    if (fs.existsSync(this.indexPath)) {
      this.load();
    } else {
      this.persist();
    }
  }

  load(): void {
    const raw = fs.readFileSync(this.indexPath, "utf8");
    this.index = JSON.parse(raw) as KnowledgeStorageIndex;
  }

  persist(): void {
    this.index.lastUpdated = new Date().toISOString();
    this.index.recordCount = this.index.entries.length;
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), "utf8");
    const hash = crypto.createHash("sha256").update(JSON.stringify(this.index)).digest("hex");
    fs.writeFileSync(`${this.indexPath}.sha256`, hash, "utf8");
  }

  getIndex(): KnowledgeStorageIndex {
    return this.index;
  }

  findById(knowledgeId: string): KnowledgeStorageIndexEntry | undefined {
    return this.index.entries.find((e) => e.knowledgeId === knowledgeId);
  }

  searchMetadata(query: string): KnowledgeStorageIndexEntry[] {
    const q = query.toLowerCase();
    return this.index.entries.filter((e) => e.searchableText.includes(q));
  }

  findByCategory(category: string): KnowledgeStorageIndexEntry[] {
    const cat = category.toLowerCase();
    return this.index.entries.filter((e) => e.category.toLowerCase().includes(cat));
  }

  findByTopic(topic: string): KnowledgeStorageIndexEntry[] {
    const t = topic.toLowerCase();
    return this.index.entries.filter((e) => e.topic.toLowerCase().includes(t));
  }

  upsert(entry: KnowledgeStorageIndexEntry): void {
    const idx = this.index.entries.findIndex((e) => e.knowledgeId === entry.knowledgeId);
    if (idx >= 0) {
      this.index.entries[idx] = entry;
    } else {
      this.index.entries.push(entry);
    }
    this.persist();
    this.logger.log("debug", "performance", "Knowledge index updated", { knowledgeId: entry.knowledgeId });
  }

  getIndexPath(): string {
    return this.indexPath;
  }

  getRecordCount(): number {
    return this.index.entries.length;
  }
}
