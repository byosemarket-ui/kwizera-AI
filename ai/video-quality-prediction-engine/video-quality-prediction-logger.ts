import fs from "node:fs";

import path from "node:path";

import { VideoQualityPredictionLogEntry, VideoQualityPredictionLogLevel } from "./video-quality-prediction-log-types.js";



export class VideoQualityPredictionLogger {

  private logFilePath: string | null = null;



  initialize(logDirectory: string): void {

    fs.mkdirSync(logDirectory, { recursive: true });

    const date = new Date().toISOString().slice(0, 10);

    this.logFilePath = path.join(logDirectory, `video-quality-prediction-engine-${date}.jsonl`);

  }



  log(

    level: VideoQualityPredictionLogLevel,

    event: VideoQualityPredictionLogEntry["event"],

    message: string,

    data?: Record<string, unknown>

  ): void {

    const entry: VideoQualityPredictionLogEntry = {

      timestamp: new Date().toISOString(),

      level,

      event,

      message,

      data,

    };

    if (this.logFilePath) {

      fs.appendFileSync(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");

    }

  }

}


