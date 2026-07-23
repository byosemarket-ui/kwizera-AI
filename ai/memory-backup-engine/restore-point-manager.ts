import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { MemoryBackupLogger } from "./backup-logger.js";
import { RestorePoint, RestorePointTrigger } from "./types.js";

export class RestorePointManager {
  private pointsPath = "";
  private points: RestorePoint[] = [];

  constructor(
    private readonly backupsRoot: string,
    private readonly logger: MemoryBackupLogger
  ) {}

  initialize(): void {
    this.pointsPath = path.join(this.backupsRoot, "restore-points.json");
    if (fs.existsSync(this.pointsPath)) {
      this.points = JSON.parse(fs.readFileSync(this.pointsPath, "utf8")) as RestorePoint[];
    }
  }

  create(trigger: RestorePointTrigger, backupId: string, projectId?: string): RestorePoint {
    const point: RestorePoint = {
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

  list(): RestorePoint[] {
    return [...this.points];
  }

  getLatest(): RestorePoint | undefined {
    return this.points[this.points.length - 1];
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.pointsPath), { recursive: true });
    fs.writeFileSync(this.pointsPath, JSON.stringify(this.points, null, 2), "utf8");
  }
}
