import fs from "node:fs";
import path from "node:path";
import { CameraDirectorRecord } from "./types.js";

export class CameraDirectorRecordStore {
  private storePath = "";
  private records = new Map<string, CameraDirectorRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "camera-director-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as CameraDirectorRecord[];
      for (const record of list) {
        this.records.set(record.cameraPlanId, record);
      }
    }
  }

  upsert(record: CameraDirectorRecord): void {
    this.records.set(record.cameraPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(cameraPlanId: string): CameraDirectorRecord | undefined {
    return this.records.get(cameraPlanId);
  }

  getByScene(sceneId: string): CameraDirectorRecord[] {
    return this.getAll().filter((r) => r.profile.sceneId === sceneId);
  }

  getByStoryboard(storyboardId: string): CameraDirectorRecord[] {
    return this.getAll().filter((r) => r.profile.storyboardId === storyboardId);
  }

  getByProduct(productId: string): CameraDirectorRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getAll(): CameraDirectorRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
