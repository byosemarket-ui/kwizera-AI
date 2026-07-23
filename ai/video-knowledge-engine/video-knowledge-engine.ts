import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import {
  KnowledgeAccessPermission,
  KnowledgeCategory,
  KnowledgeModuleStatus,
  KnowledgeSource,
} from "../knowledge-foundation/types.js";
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
import { VideoAnalyzer } from "./video-analyzer.js";
import { VideoLearner } from "./video-learner.js";
import { VideoKnowledgeLogger } from "./video-logger.js";
import { VideoProcessor } from "./video-processor.js";
import { VideoRelationshipLinker, VideoRecommender } from "./video-recommender.js";
import { VideoScorer } from "./video-scorer.js";
import { VideoPatternStore, VideoRecordStore } from "./video-stores.js";
import {
  VideoAnalysisInput,
  VideoAnalysisRecord,
  VideoAnalysisResult,
  VideoKnowledgeEngineError,
  VideoKnowledgeStatusReport,
  VideoLearningPattern,
  VideoRecommendation,
  VideoSearchQuery,
} from "./types.js";

/**
 * Video Knowledge Engine — understands, analyzes and learns from promotional video knowledge.
 */
export class AiVideoKnowledgeEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageRoot = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new VideoKnowledgeLogger();
  readonly patterns = new VideoPatternStore();
  readonly records = new VideoRecordStore();

  private readonly analyzer = new VideoAnalyzer();
  private readonly scorer = new VideoScorer();
  private readonly recommender = new VideoRecommender();
  private readonly linker = new VideoRelationshipLinker();
  private processor: VideoProcessor | null = null;
  private learner: VideoLearner | null = null;

  private analysisTimes: number[] = [];
  private searchTimes: number[] = [];
  private recommendationTimes: number[] = [];

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;

    const logDir = path.join(storageRoot, "logs");
    const videoDir = path.join(storageRoot, "knowledge", "videos", "engine");
    this.logger.initialize(logDir);
    this.patterns.initialize(videoDir);
    this.records.initialize(videoDir);

    this.learner = new VideoLearner(this.patterns, this.logger);
    this.processor = new VideoProcessor(
      foundation,
      this.analyzer,
      this.scorer,
      this.recommender,
      this.linker,
      this.learner,
      this.records,
      this.logger
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Video Knowledge Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    const entries = this.foundation!
      .getStorageEngine()
      .getIndexEntries()
      .filter((e) => e.knowledgeType === KnowledgeStorageType.Video);

    for (const entry of entries) {
      const read = await this.foundation!.getStorageEngine().getRecord(entry.knowledgeId);
      if (read.success && read.record?.payload) {
        const payload = read.record.payload as unknown as VideoAnalysisRecord;
        if (payload.videoId) this.records.upsert(payload);
      }
    }

    this.foundation!.registerKnowledgeModule({
      knowledgeId: "video-knowledge",
      knowledgeName: "Video Knowledge",
      category: KnowledgeCategory.Video,
      version: "0.1.0",
      status: KnowledgeModuleStatus.Active,
      dependencies: ["knowledge-engine", "memory-engine"],
      source: KnowledgeSource.Video,
      qualityScore: 90,
      confidenceScore: 88,
      storageLocation: path.join(this.storageRoot, "knowledge", "videos"),
      accessPermissions: [
        KnowledgeAccessPermission.Read,
        KnowledgeAccessPermission.Write,
        KnowledgeAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Video Knowledge Engine startup complete", {
      videosLoaded: this.records.getCount(),
      patternsLoaded: this.patterns.getCount(),
      durationMs: Date.now() - start,
    });
  }

  async analyzeVideo(input: VideoAnalysisInput): Promise<VideoAnalysisResult> {
    this.ensureReady();
    const result = await this.processor!.analyze(input);
    if (result.success) this.analysisTimes.push(result.durationMs);
    return result;
  }

  getVideo(videoId: string): VideoAnalysisRecord | null {
    this.ensureReady();
    return this.records.get(videoId) ?? null;
  }

  async searchVideos(query: VideoSearchQuery): Promise<VideoAnalysisRecord[]> {
    this.ensureReady();
    const start = Date.now();
    const results = await this.processor!.search(query);
    this.searchTimes.push(Date.now() - start);
    return results;
  }

  getRecommendations(videoId: string): VideoRecommendation[] {
    this.ensureReady();
    const start = Date.now();
    const record = this.records.get(videoId);
    if (!record) return [];
    const recs = this.recommender.recommend(record);
    this.recommendationTimes.push(Date.now() - start);
    return recs;
  }

  detectRelationships(videoId: string) {
    this.ensureReady();
    const record = this.records.get(videoId);
    if (!record) return null;
    return this.linker.detectSimilar(record, this.records.getAll());
  }

  getLearnedPatterns(): VideoLearningPattern[] {
    this.ensureReady();
    return this.patterns.getAll();
  }

  buildStatusReport(): VideoKnowledgeStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    const all = this.records.getAll();
    const avgStory =
      all.length > 0
        ? Math.round(all.reduce((s, r) => s + r.scores.storytellingScore, 0) / all.length)
        : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      sceneAnalysisStatus: "per-scene analysis active for all video records",
      editingKnowledgeStatus: "editing rhythm, transitions and continuity tracked",
      marketingKnowledgeStatus: "hook timing, CTA and emotional flow analyzed",
      relationshipStatus: `${all.length} videos indexed for relationship detection`,
      videosAnalyzed: all.length,
      patternsLearned: this.patterns.getCount(),
      averageStorytellingScore: avgStory,
      performance: {
        averageAnalysisMs: avg(this.analysisTimes),
        averageSearchMs: avg(this.searchTimes),
        averageRecommendationMs: avg(this.recommendationTimes),
      },
      knownIssues: [],
      readinessScore: Math.max(0, readinessScore),
      timestamp: new Date().toISOString(),
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new VideoKnowledgeEngineError("Video Knowledge Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
