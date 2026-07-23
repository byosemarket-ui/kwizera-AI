import fs from "node:fs";
import path from "node:path";
import { CameraMovementRecord } from "./types.js";

export class CameraMovementRecordStore {
  private storePath = "";
  private records = new Map<string, CameraMovementRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "camera-movement-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as CameraMovementRecord[];
      for (const record of list) this.records.set(record.videoId, record);
    }
  }

  upsert(record: CameraMovementRecord): void {
    this.records.set(record.videoId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(videoId: string): CameraMovementRecord | undefined {
    return this.records.get(videoId);
  }

  getAll(): CameraMovementRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
