import fs from "node:fs";

import path from "node:path";

import {

  VideoCacheOptimization,

  VideoIntelligenceOptimizationRecord,

  VideoIntelligenceRecoveryPoint,

} from "./types.js";



export class VideoIntelligenceOptimizationRecordStore {

  private storePath = "";

  private recoveryPath = "";

  private cachePath = "";

  private records = new Map<string, VideoIntelligenceOptimizationRecord>();

  private recoveryPoints = new Map<string, VideoIntelligenceRecoveryPoint>();

  private activeCache: VideoCacheOptimization = {

    videos: [],

    scenes: [],

    timelines: [],

    storyboards: [],

    brands: [],

    products: [],

    templates: [],

    campaigns: [],

    productionPlans: [],

    hitRate: 0,

  };



  initialize(engineDir: string): void {

    fs.mkdirSync(engineDir, { recursive: true });

    this.storePath = path.join(engineDir, "optimization-records.json");

    this.recoveryPath = path.join(engineDir, "recovery-points.json");

    this.cachePath = path.join(engineDir, "optimization-cache.json");



    if (fs.existsSync(this.storePath)) {

      const list = JSON.parse(fs.readFileSync(this.storePath, "utf8")) as VideoIntelligenceOptimizationRecord[];

      for (const record of list) {

        this.records.set(record.optimizationId, record);

      }

    }

    if (fs.existsSync(this.recoveryPath)) {

      const list = JSON.parse(fs.readFileSync(this.recoveryPath, "utf8")) as VideoIntelligenceRecoveryPoint[];

      for (const point of list) {

        this.recoveryPoints.set(point.recoveryId, point);

      }

    }

    if (fs.existsSync(this.cachePath)) {

      this.activeCache = JSON.parse(fs.readFileSync(this.cachePath, "utf8")) as VideoCacheOptimization;

    }

  }



  upsert(record: VideoIntelligenceOptimizationRecord): void {

    this.records.set(record.optimizationId, record);

    fs.writeFileSync(this.storePath, JSON.stringify(this.getAll(), null, 2), "utf8");

  }



  saveRecoveryPoint(point: VideoIntelligenceRecoveryPoint): void {

    this.recoveryPoints.set(point.recoveryId, point);

    fs.writeFileSync(this.recoveryPath, JSON.stringify([...this.recoveryPoints.values()], null, 2), "utf8");

  }



  getRecoveryPoint(recoveryId: string): VideoIntelligenceRecoveryPoint | undefined {

    return this.recoveryPoints.get(recoveryId);

  }



  updateCache(cache: VideoCacheOptimization): void {

    this.activeCache = cache;

    fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), "utf8");

  }



  getCache(): VideoCacheOptimization {

    return this.activeCache;

  }



  restoreCache(snapshot: VideoCacheOptimization): void {

    this.updateCache(snapshot);

  }



  get(optimizationId: string): VideoIntelligenceOptimizationRecord | undefined {

    return this.records.get(optimizationId);

  }



  getByVideo(videoId: string): VideoIntelligenceOptimizationRecord[] {

    return this.getAll().filter((r) => r.videoId === videoId);

  }



  getAll(): VideoIntelligenceOptimizationRecord[] {

    return [...this.records.values()];

  }



  getCount(): number {

    return this.records.size;

  }

}


