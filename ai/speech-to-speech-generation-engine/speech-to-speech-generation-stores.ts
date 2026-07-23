import fs from "node:fs";
import path from "node:path";
import { SpeechToSpeechGenerationRecord } from "./types.js";

export class SpeechToSpeechGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, SpeechToSpeechGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "speech-to-speech-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as SpeechToSpeechGenerationRecord[];
      for (const record of list) {
        this.records.set(record.transformationId, record);
      }
    }
  }

  upsert(record: SpeechToSpeechGenerationRecord): void {
    this.records.set(record.transformationId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(transformationId: string): SpeechToSpeechGenerationRecord | undefined {
    return this.records.get(transformationId);
  }

  getBySourceAudio(sourceAudioId: string): SpeechToSpeechGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.sourceAudioId === sourceAudioId);
  }

  getByProduct(productId: string): SpeechToSpeechGenerationRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getByProject(projectId: string): SpeechToSpeechGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.projectId === projectId);
  }

  getByLanguage(language: string): SpeechToSpeechGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.language === language);
  }

  getAll(): SpeechToSpeechGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
