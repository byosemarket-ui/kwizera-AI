import fs from "node:fs";

import path from "node:path";

import { VideoQualityPredictionRecord } from "./types.js";



export class VideoQualityPredictionRecordStore {

  private storePath = "";

  private records = new Map<string, VideoQualityPredictionRecord>();



  initialize(engineDir: string): void {

    fs.mkdirSync(engineDir, { recursive: true });

    this.storePath = path.join(engineDir, "video-quality-predictions.json");

    if (fs.existsSync(this.storePath)) {

      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as VideoQualityPredictionRecord[];

      for (const record of list) this.records.set(record.videoId, record);

    }

  }



  upsert(record: VideoQualityPredictionRecord): void {

    this.records.set(record.videoId, record);

    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");

  }



  get(videoId: string): VideoQualityPredictionRecord | undefined {

    return this.records.get(videoId);

  }



  getAll(): VideoQualityPredictionRecord[] {

    return [...this.records.values()];

  }



  getCount(): number {

    return this.records.size;

  }

}


