import fs from "node:fs";
import path from "node:path";
import { AudioSynchronizationRecord } from "./types.js";

export class AudioSynchronizationRecordStore {
  private storePath = "";
  private records = new Map<string, AudioSynchronizationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "audio-synchronization-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as AudioSynchronizationRecord[];
      for (const record of list) {
        this.records.set(record.audioSynchronizationId, record);
      }
    }
  }

  upsert(record: AudioSynchronizationRecord): void {
    this.records.set(record.audioSynchronizationId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(audioSynchronizationId: string): AudioSynchronizationRecord | undefined {
    return this.records.get(audioSynchronizationId);
  }

  getByScene(sceneId: string): AudioSynchronizationRecord[] {
    return this.getAll().filter((r) => r.profile.sceneId === sceneId);
  }

  getByStoryboard(storyboardId: string): AudioSynchronizationRecord[] {
    return this.getAll().filter((r) => r.profile.storyboardId === storyboardId);
  }

  getAll(): AudioSynchronizationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
