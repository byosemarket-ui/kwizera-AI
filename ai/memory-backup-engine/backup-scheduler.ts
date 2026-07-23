import fs from "node:fs";
import path from "node:path";
import { MemoryBackupLogger } from "./backup-logger.js";
import { BackupSchedule, BackupType } from "./types.js";

const DEFAULT_SCHEDULE: BackupSchedule = {
  enabled: true,
  intervalHours: 24,
  backupType: BackupType.Scheduled,
};

export class BackupScheduler {
  private schedulePath = "";
  private schedule: BackupSchedule = { ...DEFAULT_SCHEDULE };

  constructor(
    private readonly backupsRoot: string,
    private readonly logger: MemoryBackupLogger
  ) {}

  initialize(): void {
    this.schedulePath = path.join(this.backupsRoot, "schedule.json");
    if (fs.existsSync(this.schedulePath)) {
      this.schedule = { ...DEFAULT_SCHEDULE, ...JSON.parse(fs.readFileSync(this.schedulePath, "utf8")) };
    } else {
      this.persist();
    }
  }

  getSchedule(): BackupSchedule {
    return { ...this.schedule };
  }

  updateSchedule(updates: Partial<BackupSchedule>): BackupSchedule {
    this.schedule = { ...this.schedule, ...updates };
    this.persist();
    return this.getSchedule();
  }

  isDue(): boolean {
    if (!this.schedule.enabled) return false;
    if (!this.schedule.lastRun) return true;

    const last = new Date(this.schedule.lastRun).getTime();
    const intervalMs = this.schedule.intervalHours * 60 * 60 * 1000;
    return Date.now() - last >= intervalMs;
  }

  markRun(): void {
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

  private persist(): void {
    fs.mkdirSync(path.dirname(this.schedulePath), { recursive: true });
    fs.writeFileSync(this.schedulePath, JSON.stringify(this.schedule, null, 2), "utf8");
  }
}
