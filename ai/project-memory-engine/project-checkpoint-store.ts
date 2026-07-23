import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ProjectCheckpoint } from "./types.js";

export class ProjectCheckpointStore {
  private checkpointsDir: string | null = null;
  private readonly checkpoints: ProjectCheckpoint[] = [];

  initialize(projectDir: string): void {
    this.checkpointsDir = path.join(projectDir, "checkpoints");
    fs.mkdirSync(this.checkpointsDir, { recursive: true });

    const manifestPath = path.join(this.checkpointsDir, "manifest.jsonl");
    if (fs.existsSync(manifestPath)) {
      const lines = fs.readFileSync(manifestPath, "utf8").trim().split("\n").filter(Boolean);
      for (const line of lines) {
        this.checkpoints.push(JSON.parse(line) as ProjectCheckpoint);
      }
    }
  }

  create(
    projectId: string,
    data: Omit<ProjectCheckpoint, "checkpointId" | "projectId" | "timestamp">
  ): ProjectCheckpoint {
    const checkpoint: ProjectCheckpoint = {
      checkpointId: `chk-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      projectId,
      timestamp: new Date().toISOString(),
      ...data,
    };

    this.checkpoints.push(checkpoint);
    const filePath = path.join(this.checkpointsDir!, `${checkpoint.checkpointId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2), "utf8");

    const manifestPath = path.join(this.checkpointsDir!, "manifest.jsonl");
    fs.appendFileSync(manifestPath, `${JSON.stringify(checkpoint)}\n`, "utf8");

    return checkpoint;
  }

  getLatest(projectId: string): ProjectCheckpoint | undefined {
    const projectCheckpoints = this.checkpoints
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return projectCheckpoints[0];
  }

  getById(checkpointId: string): ProjectCheckpoint | undefined {
    const inMemory = this.checkpoints.find((c) => c.checkpointId === checkpointId);
    if (inMemory) return inMemory;

    const filePath = path.join(this.checkpointsDir!, `${checkpointId}.json`);
    if (!fs.existsSync(filePath)) return undefined;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ProjectCheckpoint;
  }

  getCount(): number {
    return this.checkpoints.length;
  }
}
