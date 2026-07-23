import { BackupManifest, RetentionTier } from "./types.js";
import { BackupVersionStore } from "./backup-version-store.js";
import { MemoryBackupLogger } from "./backup-logger.js";

export class BackupRetentionManager {
  constructor(
    private readonly versionStore: BackupVersionStore,
    private readonly logger: MemoryBackupLogger
  ) {}

  assignRetentionTier(manifest: BackupManifest, isMilestone = false): RetentionTier {
    if (isMilestone) return RetentionTier.Milestone;

    const all = this.versionStore.getAll();
    const today = new Date().toISOString().slice(0, 10);
    const thisWeek = this.getWeekKey(new Date());
    const thisMonth = new Date().toISOString().slice(0, 7);

    const hasDailyToday = all.some(
      (m) => m.retentionTier === RetentionTier.Daily && m.createdAt.startsWith(today)
    );
    if (!hasDailyToday) return RetentionTier.Daily;

    const hasWeekly = all.some(
      (m) => m.retentionTier === RetentionTier.Weekly && this.getWeekKey(new Date(m.createdAt)) === thisWeek
    );
    if (!hasWeekly) return RetentionTier.Weekly;

    const hasMonthly = all.some(
      (m) => m.retentionTier === RetentionTier.Monthly && m.createdAt.startsWith(thisMonth)
    );
    if (!hasMonthly) return RetentionTier.Monthly;

    return RetentionTier.Latest;
  }

  organizeHistory(): { latest: number; daily: number; weekly: number; monthly: number; milestone: number } {
    const all = this.versionStore.getAll();
    const counts = {
      latest: 0,
      daily: 0,
      weekly: 0,
      monthly: 0,
      milestone: 0,
    };

    for (const m of all) {
      switch (m.retentionTier) {
        case RetentionTier.Latest:
          counts.latest++;
          break;
        case RetentionTier.Daily:
          counts.daily++;
          break;
        case RetentionTier.Weekly:
          counts.weekly++;
          break;
        case RetentionTier.Monthly:
          counts.monthly++;
          break;
        case RetentionTier.Milestone:
          counts.milestone++;
          break;
      }
    }

    this.logger.log("info", "retention", "Backup history organized", counts);
    return counts;
  }

  private getWeekKey(date: Date): string {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    return start.toISOString().slice(0, 10);
  }
}
