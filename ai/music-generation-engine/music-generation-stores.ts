import fs from "node:fs";
import path from "node:path";
import { MusicGenerationRecord } from "./types.js";

export class MusicGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, MusicGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "music-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as MusicGenerationRecord[];
      for (const record of list) {
        this.records.set(record.musicPlanId, record);
      }
    }
  }

  upsert(record: MusicGenerationRecord): void {
    this.records.set(record.musicPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(musicPlanId: string): MusicGenerationRecord | undefined {
    return this.records.get(musicPlanId);
  }

  getByProduct(productId: string): MusicGenerationRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getByGenre(genre: string): MusicGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.genre === genre);
  }

  getByMood(mood: string): MusicGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.mood === mood);
  }

  getByProject(projectId: string): MusicGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.projectId === projectId);
  }

  getAll(): MusicGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
