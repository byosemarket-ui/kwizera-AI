import fs from "node:fs";
import path from "node:path";
import { TextToSpeechGenerationRecord } from "./types.js";

export class TextToSpeechGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, TextToSpeechGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "text-to-speech-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as TextToSpeechGenerationRecord[];
      for (const record of list) {
        this.records.set(record.speechPlanId, record);
      }
    }
  }

  upsert(record: TextToSpeechGenerationRecord): void {
    this.records.set(record.speechPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(speechPlanId: string): TextToSpeechGenerationRecord | undefined {
    return this.records.get(speechPlanId);
  }

  getByProduct(productId: string): TextToSpeechGenerationRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getByProject(projectId: string): TextToSpeechGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.projectId === projectId);
  }

  getByLanguage(language: string): TextToSpeechGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.language === language);
  }

  getAll(): TextToSpeechGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
