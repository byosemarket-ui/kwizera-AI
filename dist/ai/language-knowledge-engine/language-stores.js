import fs from "node:fs";
import path from "node:path";
export class LanguagePatternStore {
    storePath = "";
    patterns = [];
    initialize(langDir) {
        fs.mkdirSync(langDir, { recursive: true });
        this.storePath = path.join(langDir, "learned-patterns.json");
        if (fs.existsSync(this.storePath)) {
            this.patterns = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
        }
    }
    add(pattern) {
        if (this.patterns.some((p) => p.patternId === pattern.patternId))
            return;
        this.patterns.push(pattern);
        fs.writeFileSync(this.storePath, JSON.stringify(this.patterns, null, 2), "utf8");
    }
    getAll() {
        return [...this.patterns];
    }
    getCount() {
        return this.patterns.length;
    }
}
export class LanguageRecordStore {
    storePath = "";
    records = new Map();
    initialize(langDir) {
        fs.mkdirSync(langDir, { recursive: true });
        this.storePath = path.join(langDir, "language-analysis-records.json");
        if (fs.existsSync(this.storePath)) {
            const data = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
            for (const record of data) {
                this.records.set(record.languageId, record);
            }
        }
    }
    upsert(record) {
        this.records.set(record.languageId, record);
        fs.writeFileSync(this.storePath, JSON.stringify([...this.records.values()], null, 2), "utf8");
    }
    get(languageId) {
        return this.records.get(languageId);
    }
    getAll() {
        return [...this.records.values()];
    }
    getCount() {
        return this.records.size;
    }
}
//# sourceMappingURL=language-stores.js.map