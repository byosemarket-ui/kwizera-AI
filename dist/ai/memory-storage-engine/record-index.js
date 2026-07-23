import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const INDEX_VERSION = "0.1.0";
export class RecordIndex {
    logger;
    indexPath = "";
    index = {
        version: INDEX_VERSION,
        lastUpdated: new Date().toISOString(),
        recordCount: 0,
        entries: [],
    };
    constructor(logger) {
        this.logger = logger;
    }
    initialize(storageDir) {
        fs.mkdirSync(storageDir, { recursive: true });
        this.indexPath = path.join(storageDir, "record-index.json");
        if (fs.existsSync(this.indexPath)) {
            this.load();
        }
        else {
            this.persist();
        }
    }
    load() {
        const raw = fs.readFileSync(this.indexPath, "utf8");
        this.index = JSON.parse(raw);
    }
    persist() {
        this.index.lastUpdated = new Date().toISOString();
        this.index.recordCount = this.index.entries.length;
        fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), "utf8");
        const hash = crypto.createHash("sha256").update(JSON.stringify(this.index)).digest("hex");
        fs.writeFileSync(`${this.indexPath}.sha256`, hash, "utf8");
    }
    getIndex() {
        return this.index;
    }
    findById(memoryId) {
        return this.index.entries.find((e) => e.memoryId === memoryId);
    }
    searchMetadata(query) {
        const q = query.toLowerCase();
        return this.index.entries.filter((e) => e.searchableText.includes(q));
    }
    upsert(entry) {
        const idx = this.index.entries.findIndex((e) => e.memoryId === entry.memoryId);
        if (idx >= 0) {
            this.index.entries[idx] = entry;
        }
        else {
            this.index.entries.push(entry);
        }
        this.persist();
        this.logger.log("debug", "performance", "Index updated", { memoryId: entry.memoryId });
    }
    getIndexPath() {
        return this.indexPath;
    }
    getRecordCount() {
        return this.index.entries.length;
    }
}
//# sourceMappingURL=record-index.js.map