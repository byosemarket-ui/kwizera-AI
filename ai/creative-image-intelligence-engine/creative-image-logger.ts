import fs from "node:fs";

import path from "node:path";

import { CreativeImageLogEntry, CreativeImageLogLevel } from "./creative-image-log-types.js";



export class CreativeImageLogger {

  private logFilePath: string | null = null;

  private readonly entries: CreativeImageLogEntry[] = [];



  initialize(logDirectory: string): void {

    fs.mkdirSync(logDirectory, { recursive: true });

    const date = new Date().toISOString().slice(0, 10);

    this.logFilePath = path.join(logDirectory, `creative-image-intelligence-${date}.jsonl`);

  }



  log(

    level: CreativeImageLogLevel,

    event: CreativeImageLogEntry["event"],

    message: string,

    data?: Record<string, unknown>

  ): void {

    const entry: CreativeImageLogEntry = {

      timestamp: new Date().toISOString(),

      level,

      event,

      message,

      data,

    };

    this.entries.push(entry);

    if (this.logFilePath) {

      fs.appendFileSync(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");

    }

  }



  getLogFilePath(): string | null {

    return this.logFilePath;

  }

}

