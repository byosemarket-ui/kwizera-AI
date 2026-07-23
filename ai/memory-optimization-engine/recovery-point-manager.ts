import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { RecoveryPoint } from "./types.js";

export class RecoveryPointManager {
  private recoveryDir = "";
  private points: RecoveryPoint[] = [];

  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly logger: MemoryOptimizationLogger
  ) {}

  initialize(optimizationDir: string): void {
    this.recoveryDir = path.join(optimizationDir, "recovery-points");
    fs.mkdirSync(this.recoveryDir, { recursive: true });

    const manifestPath = path.join(optimizationDir, "recovery-manifest.json");
    if (fs.existsSync(manifestPath)) {
      this.points = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as RecoveryPoint[];
    }
  }

  createRecoveryPoint(label: string, filesToSnapshot: string[]): RecoveryPoint {
    const recoveryPointId = `rp-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const pointDir = path.join(this.recoveryDir, recoveryPointId);
    fs.mkdirSync(pointDir, { recursive: true });

    for (const filePath of filesToSnapshot) {
      if (fs.existsSync(filePath)) {
        const dest = path.join(pointDir, path.basename(filePath));
        fs.copyFileSync(filePath, dest);
      }
    }

    const storage = this.foundation.getStorageEngine();
    const relationshipGraph = this.foundation.getRelationshipMemoryEngine().getGraph();

    const manifest = {
      recoveryPointId,
      label,
      createdAt: new Date().toISOString(),
      recordCount: storage.getRecordCount(),
      edgeCount: relationshipGraph.edgeCount,
      files: filesToSnapshot.map((f) => path.basename(f)),
    };

    const manifestPath = path.join(pointDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    const point: RecoveryPoint = {
      recoveryPointId,
      createdAt: manifest.createdAt,
      label,
      recordCount: manifest.recordCount,
      edgeCount: manifest.edgeCount,
      manifestPath,
    };

    this.points.push(point);
    this.persistManifest();

    this.logger.log("info", "recovery", "Recovery point created", {
      recoveryPointId,
      label,
      recordCount: point.recordCount,
    });

    return point;
  }

  restore(recoveryPointId: string, targetFiles: Map<string, string>): boolean {
    const pointDir = path.join(this.recoveryDir, recoveryPointId);
    if (!fs.existsSync(pointDir)) {
      this.logger.log("error", "recovery", "Recovery point not found", { recoveryPointId });
      return false;
    }

    for (const [basename, targetPath] of targetFiles) {
      const source = path.join(pointDir, basename);
      if (fs.existsSync(source)) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(source, targetPath);
      }
    }

    this.logger.log("info", "recovery", "Recovery point restored", { recoveryPointId });
    return true;
  }

  getLatest(): RecoveryPoint | undefined {
    return this.points[this.points.length - 1];
  }

  list(): RecoveryPoint[] {
    return [...this.points];
  }

  private persistManifest(): void {
    const manifestPath = path.join(path.dirname(this.recoveryDir), "recovery-manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(this.points, null, 2), "utf8");
  }
}
