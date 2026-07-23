import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { STORAGE_TYPE_DEFINITIONS } from "./storage-type-config.js";
export class RecordStore {
    logger;
    recordsRoot = "";
    storageDir = "";
    constructor(logger) {
        this.logger = logger;
    }
    initialize(memoryRoot) {
        this.recordsRoot = path.join(memoryRoot, "records");
        this.storageDir = path.join(memoryRoot, "storage");
        const dirs = [
            this.recordsRoot,
            this.storageDir,
            ...STORAGE_TYPE_DEFINITIONS.map((t) => path.join(this.recordsRoot, t.subdirectory)),
        ];
        for (const dir of dirs) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.logger.log("info", "startup", "Record store directories initialized", {
            recordsRoot: this.recordsRoot,
            typeCount: STORAGE_TYPE_DEFINITIONS.length,
        });
    }
    getRecordsRoot() {
        return this.recordsRoot;
    }
    getStorageDir() {
        return this.storageDir;
    }
    getRecordPath(memoryType, memoryId) {
        const def = STORAGE_TYPE_DEFINITIONS.find((d) => d.type === memoryType);
        const subdir = def?.subdirectory ?? "system";
        return path.join(this.recordsRoot, subdir, memoryId);
    }
    isStorageAvailable() {
        try {
            const testFile = path.join(this.storageDir, ".write-test");
            fs.writeFileSync(testFile, "ok", "utf8");
            fs.unlinkSync(testFile);
            return fs.existsSync(this.recordsRoot);
        }
        catch {
            return false;
        }
    }
    writeRecord(recordPath, record) {
        const start = Date.now();
        fs.mkdirSync(recordPath, { recursive: true });
        const currentPath = path.join(recordPath, "current.json");
        const content = JSON.stringify(record, null, 2);
        fs.writeFileSync(currentPath, content, "utf8");
        const hash = crypto.createHash("sha256").update(content).digest("hex");
        fs.writeFileSync(`${currentPath}.sha256`, hash, "utf8");
        return Date.now() - start;
    }
    readRecord(recordPath) {
        const start = Date.now();
        const currentPath = path.join(recordPath, "current.json");
        if (!fs.existsSync(currentPath)) {
            return { data: null, durationMs: Date.now() - start };
        }
        const raw = fs.readFileSync(currentPath, "utf8");
        return { data: JSON.parse(raw), durationMs: Date.now() - start };
    }
    verifyRecordChecksum(recordPath) {
        const currentPath = path.join(recordPath, "current.json");
        const checksumPath = `${currentPath}.sha256`;
        if (!fs.existsSync(currentPath) || !fs.existsSync(checksumPath)) {
            return false;
        }
        const content = fs.readFileSync(currentPath, "utf8");
        const expected = fs.readFileSync(checksumPath, "utf8").trim();
        const actual = crypto.createHash("sha256").update(content).digest("hex");
        return expected === actual;
    }
}
//# sourceMappingURL=record-store.js.map