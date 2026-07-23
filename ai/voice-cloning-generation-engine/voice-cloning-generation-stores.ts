import fs from "node:fs";
import path from "node:path";
import { VoiceCloningGenerationRecord } from "./types.js";

export class VoiceCloningGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, VoiceCloningGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "voice-cloning-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as VoiceCloningGenerationRecord[];
      for (const record of list) {
        this.records.set(record.cloningPlanId, record);
      }
    }
  }

  upsert(record: VoiceCloningGenerationRecord): void {
    this.records.set(record.cloningPlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(cloningPlanId: string): VoiceCloningGenerationRecord | undefined {
    return this.records.get(cloningPlanId);
  }

  getByVoiceSample(voiceSampleId: string): VoiceCloningGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.sampleId === voiceSampleId);
  }

  getBySpeaker(speakerId: string): VoiceCloningGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.speakerId === speakerId);
  }

  getByProduct(productId: string): VoiceCloningGenerationRecord[] {
    return this.getAll().filter((r) => r.relationships.products.includes(productId));
  }

  getByProject(projectId: string): VoiceCloningGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.projectId === projectId);
  }

  getByLanguage(language: string): VoiceCloningGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.language === language);
  }

  getAll(): VoiceCloningGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
