import fs from "node:fs";
import path from "node:path";
import { ObjectDetectionRecord } from "./types.js";

export class ObjectDetectionRecordStore {
  private storePath = "";
  private records = new Map<string, ObjectDetectionRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "object-detection-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as ObjectDetectionRecord[];
      for (const record of list) {
        this.records.set(record.imageId, record);
      }
    }
  }

  upsert(record: ObjectDetectionRecord): void {
    this.records.set(record.imageId, record);
    this.persist();
  }

  get(imageId: string): ObjectDetectionRecord | undefined {
    return this.records.get(imageId);
  }

  getAll(): ObjectDetectionRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }

  getTotalObjects(): number {
    return this.getAll().reduce((sum, r) => sum + r.objects.length, 0);
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }
}
