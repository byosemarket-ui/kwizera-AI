import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { IndexType } from "./types.js";
const INDEX_VERSION = "0.1.0";
export class InvertedIndexStore {
    logger;
    indexesDir = "";
    caches = new Map();
    constructor(logger) {
        this.logger = logger;
    }
    initialize(indexesDir) {
        fs.mkdirSync(indexesDir, { recursive: true });
        this.indexesDir = indexesDir;
        for (const type of Object.values(IndexType)) {
            this.loadOrCreate(type);
        }
    }
    filePath(type) {
        return path.join(this.indexesDir, `${type}.json`);
    }
    loadOrCreate(type) {
        const file = this.filePath(type);
        if (fs.existsSync(file)) {
            const data = JSON.parse(fs.readFileSync(file, "utf8"));
            this.caches.set(type, data);
            return data;
        }
        const empty = {
            version: INDEX_VERSION,
            indexType: type,
            lastUpdated: new Date().toISOString(),
            entries: {},
            entryCount: 0,
        };
        this.caches.set(type, empty);
        this.persist(type);
        return empty;
    }
    addEntry(type, key, memoryId) {
        const normalized = key.toLowerCase().trim();
        if (!normalized)
            return;
        const index = this.caches.get(type) ?? this.loadOrCreate(type);
        const existing = index.entries[normalized] ?? [];
        if (!existing.includes(memoryId)) {
            index.entries[normalized] = [...existing, memoryId];
            index.entryCount = Object.keys(index.entries).length;
            index.lastUpdated = new Date().toISOString();
            this.persist(type);
        }
    }
    removeEntry(type, memoryId) {
        const index = this.caches.get(type);
        if (!index)
            return;
        let changed = false;
        for (const key of Object.keys(index.entries)) {
            const filtered = index.entries[key].filter((id) => id !== memoryId);
            if (filtered.length !== index.entries[key].length) {
                changed = true;
                if (filtered.length === 0) {
                    delete index.entries[key];
                }
                else {
                    index.entries[key] = filtered;
                }
            }
        }
        if (changed) {
            index.entryCount = Object.keys(index.entries).length;
            index.lastUpdated = new Date().toISOString();
            this.persist(type);
        }
    }
    lookup(type, key) {
        const index = this.caches.get(type) ?? this.loadOrCreate(type);
        return index.entries[key.toLowerCase().trim()] ?? [];
    }
    lookupAll(type) {
        const index = this.caches.get(type) ?? this.loadOrCreate(type);
        return index.entries;
    }
    getIndex(type) {
        return this.caches.get(type) ?? this.loadOrCreate(type);
    }
    clearType(type) {
        const empty = {
            version: INDEX_VERSION,
            indexType: type,
            lastUpdated: new Date().toISOString(),
            entries: {},
            entryCount: 0,
        };
        this.caches.set(type, empty);
        this.persist(type);
    }
    clearAll() {
        for (const type of Object.values(IndexType)) {
            this.clearType(type);
        }
    }
    persist(type) {
        const index = this.caches.get(type);
        if (!index)
            return;
        const file = this.filePath(type);
        const content = JSON.stringify(index, null, 2);
        fs.writeFileSync(file, content, "utf8");
        const hash = crypto.createHash("sha256").update(content).digest("hex");
        fs.writeFileSync(`${file}.sha256`, hash, "utf8");
    }
    verifyChecksum(type) {
        const file = this.filePath(type);
        const checksumFile = `${file}.sha256`;
        if (!fs.existsSync(file) || !fs.existsSync(checksumFile))
            return false;
        const content = fs.readFileSync(file, "utf8");
        const expected = fs.readFileSync(checksumFile, "utf8").trim();
        const actual = crypto.createHash("sha256").update(content).digest("hex");
        return expected === actual;
    }
    getIndexesDir() {
        return this.indexesDir;
    }
}
//# sourceMappingURL=inverted-index-store.js.map