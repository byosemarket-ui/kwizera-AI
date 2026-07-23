import fs from "node:fs";

import path from "node:path";

import { CreativeImageIntelligenceRecord } from "./types.js";



export class CreativeImageIntelligenceRecordStore {

  private storePath = "";

  private records = new Map<string, CreativeImageIntelligenceRecord>();



  initialize(engineDir: string): void {

    fs.mkdirSync(engineDir, { recursive: true });

    this.storePath = path.join(engineDir, "creative-image-intelligence-records.json");

    if (fs.existsSync(this.storePath)) {

      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as CreativeImageIntelligenceRecord[];

      for (const record of list) {

        this.records.set(record.imageId, record);

      }

    }

  }



  upsert(record: CreativeImageIntelligenceRecord): void {

    this.records.set(record.imageId, record);

    this.persist();

  }



  get(imageId: string): CreativeImageIntelligenceRecord | undefined {

    return this.records.get(imageId);

  }



  getAll(): CreativeImageIntelligenceRecord[] {

    return [...this.records.values()];

  }



  getCount(): number {

    return this.records.size;

  }



  private persist(): void {

    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");

  }

}

