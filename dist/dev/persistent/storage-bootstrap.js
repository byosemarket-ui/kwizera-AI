import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
const REQUIRED_DIRS = [
    "config",
    "database",
    "projects",
    "uploads",
    "exports",
    "media",
    "memory",
    "knowledge",
    "productIntelligence",
    "imageIntelligence",
    "videoIntelligence",
    "videoGeneration",
    "imageGeneration",
    "audioGeneration",
    "learning",
    "logs",
    "backups",
    "cache",
    "temp",
];
export function bootstrapPersistentStorage(storageRoot) {
    const created = [];
    const existing = [];
    fs.mkdirSync(storageRoot, { recursive: true });
    for (const segment of REQUIRED_DIRS) {
        const dir = resolveStoragePath(storageRoot, segment);
        if (fs.existsSync(dir)) {
            existing.push(dir);
        }
        else {
            fs.mkdirSync(dir, { recursive: true });
            created.push(dir);
        }
    }
    const stateDir = path.join(storageRoot, "state");
    if (fs.existsSync(stateDir)) {
        existing.push(stateDir);
    }
    else {
        fs.mkdirSync(stateDir, { recursive: true });
        created.push(stateDir);
    }
    const devDir = path.join(storageRoot, "config", "dev");
    if (fs.existsSync(devDir)) {
        existing.push(devDir);
    }
    else {
        fs.mkdirSync(devDir, { recursive: true });
        created.push(devDir);
    }
    return { storageRoot, created, existing };
}
//# sourceMappingURL=storage-bootstrap.js.map