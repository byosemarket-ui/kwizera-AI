import fs from "node:fs";
import path from "node:path";
import { BackupType } from "./types.js";
const DEFAULT_SCHEDULE = {
    enabled: true,
    intervalHours: 24,
    backupType: BackupType.Scheduled,
};
export class BackupScheduler {
    backupsRoot;
    logger;
    schedulePath = "";
    schedule = { ...DEFAULT_SCHEDULE };
    constructor(backupsRoot, logger) {
        this.backupsRoot = backupsRoot;
        this.logger = logger;
    }
    initialize() {
        this.schedulePath = path.join(this.backupsRoot, "schedule.json");
        if (fs.existsSync(this.schedulePath)) {
            this.schedule = { ...DEFAULT_SCHEDULE, ...JSON.parse(fs.readFileSync(this.schedulePath, "utf8")) };
        }
        else {
            this.persist();
        }
    }
    getSchedule() {
        return { ...this.schedule };
    }
    updateSchedule(updates) {
        this.schedule = { ...this.schedule, ...updates };
        this.persist();
        return this.getSchedule();
    }
    isDue() {
        if (!this.schedule.enabled)
            return false;
        if (!this.schedule.lastRun)
            return true;
        const last = new Date(this.schedule.lastRun).getTime();
        const intervalMs = this.schedule.intervalHours * 60 * 60 * 1000;
        return Date.now() - last >= intervalMs;
    }
    markRun() {
        const now = new Date();
        this.schedule.lastRun = now.toISOString();
        const next = new Date(now.getTime() + this.schedule.intervalHours * 60 * 60 * 1000);
        this.schedule.nextRun = next.toISOString();
        this.persist();
        this.logger.log("info", "schedule", "Scheduled backup run recorded", {
            lastRun: this.schedule.lastRun,
            nextRun: this.schedule.nextRun,
        });
    }
    persist() {
        fs.mkdirSync(path.dirname(this.schedulePath), { recursive: true });
        fs.writeFileSync(this.schedulePath, JSON.stringify(this.schedule, null, 2), "utf8");
    }
}
//# sourceMappingURL=backup-scheduler.js.map