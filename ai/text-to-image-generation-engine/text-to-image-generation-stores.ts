import fs from "node:fs";
import path from "node:path";
import { TextToImageGenerationRecord } from "./types.js";

export class TextToImageGenerationRecordStore {
  private storePath = "";
  private records = new Map<string, TextToImageGenerationRecord>();

  initialize(engineDir: string): void {
    fs.mkdirSync(engineDir, { recursive: true });
    this.storePath = path.join(engineDir, "text-to-image-generation-records.json");
    if (fs.existsSync(this.storePath)) {
      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as TextToImageGenerationRecord[];
      for (const record of list) {
        this.records.set(record.imagePlanId, record);
      }
    }
  }

  upsert(record: TextToImageGenerationRecord): void {
    this.records.set(record.imagePlanId, record);
    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");
  }

  get(imagePlanId: string): TextToImageGenerationRecord | undefined {
    return this.records.get(imagePlanId);
  }

  getByProduct(productId: string): TextToImageGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.productId === productId);
  }

  getByProject(projectId: string): TextToImageGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.projectId === projectId);
  }

  getByPrompt(promptId: string): TextToImageGenerationRecord[] {
    return this.getAll().filter((r) => r.profile.promptId === promptId);
  }

  getAll(): TextToImageGenerationRecord[] {
    return [...this.records.values()];
  }

  getCount(): number {
    return this.records.size;
  }
}
