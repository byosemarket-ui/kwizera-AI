import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export class RestorePointManager {
    backupsRoot;
    logger;
    pointsPath = "";
    points = [];
    constructor(backupsRoot, logger) {
        this.backupsRoot = backupsRoot;
        this.logger = logger;
    }
    initialize() {
        this.pointsPath = path.join(this.backupsRoot, "restore-points.json");
        if (fs.existsSync(this.pointsPath)) {
            this.points = JSON.parse(fs.readFileSync(this.pointsPath, "utf8"));
        }
    }
    create(trigger, backupId, projectId) {
        const point = {
            restorePointId: `rp-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
            trigger,
            backupId,
            projectId,
            createdAt: new Date().toISOString(),
        };
        this.points.push(point);
        this.persist();
        this.logger.log("info", "restore-point", "Restore point created", {
            restorePointId: point.restorePointId,
            trigger,
            backupId,
        });
        return point;
    }
    list() {
        return [...this.points];
    }
    getLatest() {
        return this.points[this.points.length - 1];
    }
    persist() {
        fs.mkdirSync(path.dirname(this.pointsPath), { recursive: true });
        fs.writeFileSync(this.pointsPath, JSON.stringify(this.points, null, 2), "utf8");
    }
}
//# sourceMappingURL=restore-point-manager.js.map