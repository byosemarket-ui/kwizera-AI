import crypto from "node:crypto";
import type { MemoryRecord } from "../memory-storage-engine/types.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { VideoHistoryStore } from "./video-history-store.js";
import { VideoLearner } from "./video-learner.js";
import { VideoMemoryLogger } from "./video-logger.js";
import { VideoPatternDetector } from "./video-pattern-detector.js";
import { VideoRelationshipLinker } from "./video-relationship-linker.js";
import { VideoScorer } from "./video-scorer.js";
import {
  AudioMemory,
  MarketingMemory,
  SceneMemory,
  VideoCreateInput,
  VideoLearningResult,
  VideoProcessResult,
  VideoRecord,
  VideoStatus,
  VideoUpdateInput,
  VideoVersionInfo,
  VisualMemory,
} from "./types.js";

function defaultAudio(): AudioMemory {
  return {
    backgroundMusic: "",
    voiceStyle: "",
    voiceLanguage: "",
    narration: "",
    soundEffects: [],
    audioTiming: "",
    audioQuality: "",
  };
}

function defaultMarketing(): MarketingMemory {
  return {
    hook: "",
    callToAction: "",
    sellingPoints: [],
    emotionalStrategy: "",
    brandingStyle: "",
    productPresentationStyle: "",
    marketingStructure: "",
  };
}

function defaultVisual(): VisualMemory {
  return {
    productPosition: "",
    lightingStyle: "",
    colorPalette: [],
    typography: "",
    iconStyle: "",
    motionStyle: "",
    introStyle: "",
    outroStyle: "",
    logoAnimation: "",
  };
}

export function recordFromMemory(record: MemoryRecord): VideoRecord {
  const payload = (record.payload ?? {}) as Record<string, unknown>;
  return {
    videoId: (payload.videoId as string) ?? record.memoryId,
    memoryId: record.memoryId,
    projectId: record.relatedProject ?? (payload.projectId as string) ?? "",
    videoName: record.title,
    productType: (payload.productType as string) ?? "",
    brand: (payload.brand as string) ?? "",
    category: record.category,
    targetAudience: (payload.targetAudience as string) ?? "",
    marketingGoal: (payload.marketingGoal as string) ?? "",
    language: (payload.language as string) ?? "en",
    duration: (payload.duration as number) ?? 0,
    resolution: (payload.resolution as string) ?? "",
    aspectRatio: (payload.aspectRatio as string) ?? "",
    exportFormat: (payload.exportFormat as string) ?? "",
    status: (payload.status as VideoStatus) ?? VideoStatus.Draft,
    creationDate: record.creationTime,
    lastModified: record.lastUpdate,
    scenes: (payload.scenes as SceneMemory[]) ?? [],
    audio: (payload.audio as AudioMemory) ?? defaultAudio(),
    marketing: (payload.marketing as MarketingMemory) ?? defaultMarketing(),
    visual: (payload.visual as VisualMemory) ?? defaultVisual(),
    scores: (payload.scores as VideoRecord["scores"]) ?? {
      videoQualityScore: record.qualityScore,
      marketingScore: 0,
      aiConfidenceScore: record.qualityScore,
      learningScore: 0,
      userSatisfaction: 0,
      exportQuality: 0,
    },
    exportHistory: (payload.exportHistory as VideoRecord["exportHistory"]) ?? [],
    patterns: (payload.patterns as VideoRecord["patterns"]) ?? [],
    relatedMemories: (payload.relatedMemories as string[]) ?? [],
    lessonsLearned: (payload.lessonsLearned as string[]) ?? [],
    strengths: (payload.strengths as string[]) ?? [],
    weaknesses: (payload.weaknesses as string[]) ?? [],
    versions: (payload.versions as VideoVersionInfo[]) ?? [],
    tags: record.tags,
    keywords: record.keywords,
  };
}

export class VideoProcessor {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly history: VideoHistoryStore,
    private readonly scorer: VideoScorer,
    private readonly patternDetector: VideoPatternDetector,
    private readonly linker: VideoRelationshipLinker,
    private readonly learner: VideoLearner,
    private readonly logger: VideoMemoryLogger,
    private readonly videos: Map<string, VideoRecord>
  ) {}

  async create(input: VideoCreateInput): Promise<VideoProcessResult> {
    const start = Date.now();
    const videoId = input.videoId ?? `vid-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const now = new Date().toISOString();

    const draft: VideoRecord = {
      videoId,
      memoryId: videoId,
      projectId: input.projectId,
      videoName: input.videoName,
      productType: input.productType ?? "",
      brand: input.brand ?? "",
      category: input.category ?? "promotional",
      targetAudience: input.targetAudience ?? "",
      marketingGoal: input.marketingGoal ?? "",
      language: input.language ?? "en",
      duration: input.duration ?? 0,
      resolution: input.resolution ?? "1920x1080",
      aspectRatio: input.aspectRatio ?? "16:9",
      exportFormat: input.exportFormat ?? "mp4",
      status: VideoStatus.Draft,
      creationDate: now,
      lastModified: now,
      scenes: input.scenes ?? [],
      audio: { ...defaultAudio(), ...input.audio },
      marketing: { ...defaultMarketing(), ...input.marketing },
      visual: { ...defaultVisual(), ...input.visual },
      scores: {
        videoQualityScore: 0,
        marketingScore: 0,
        aiConfidenceScore: 0,
        learningScore: 0,
        userSatisfaction: 0,
        exportQuality: 0,
      },
      exportHistory: [],
      patterns: [],
      relatedMemories: [],
      lessonsLearned: [],
      strengths: [],
      weaknesses: [],
      versions: [{ version: 1, timestamp: now, changeSummary: "Video created", memoryVersion: 1 }],
      tags: input.tags ?? [],
      keywords: input.keywords ?? [input.videoName.toLowerCase(), input.brand ?? ""].filter(Boolean),
    };

    draft.scores = this.scorer.computeScores(draft);
    const relationships = this.linker.link(
      videoId,
      input.projectId,
      draft.brand,
      draft.category,
      draft.tags
    );
    draft.relatedMemories = relationships.relatedMemories;

    const storeResult = await this.foundation.getStorageEngine().storeRecord(
      this.toMemoryInput(draft),
      "video-memory-engine"
    );

    if (!storeResult.success || !storeResult.record) {
      return this.fail(videoId, start, "Failed to store video memory");
    }

    this.videos.set(videoId, draft);
    this.history.append({
      timestamp: now,
      event: "create",
      videoId,
      projectId: input.projectId,
      detail: `Created video: ${input.videoName}`,
      version: 1,
    });

    this.logger.log("info", "video-create", "Video memory created", { videoId });

    return {
      success: true,
      videoId,
      memoryId: storeResult.record.memoryId,
      version: 1,
      durationMs: Date.now() - start,
      patternsDetected: 0,
    };
  }

  async update(videoId: string, input: VideoUpdateInput): Promise<VideoProcessResult> {
    const start = Date.now();
    const existing = await this.loadVideo(videoId);
    if (!existing) return this.fail(videoId, start, "Video not found");

    const now = new Date().toISOString();
    const updated: VideoRecord = {
      ...existing,
      videoName: input.videoName ?? existing.videoName,
      status: input.status ?? existing.status,
      productType: input.productType ?? existing.productType,
      brand: input.brand ?? existing.brand,
      category: input.category ?? existing.category,
      targetAudience: input.targetAudience ?? existing.targetAudience,
      marketingGoal: input.marketingGoal ?? existing.marketingGoal,
      language: input.language ?? existing.language,
      duration: input.duration ?? existing.duration,
      resolution: input.resolution ?? existing.resolution,
      aspectRatio: input.aspectRatio ?? existing.aspectRatio,
      exportFormat: input.exportFormat ?? existing.exportFormat,
      scenes: input.scenes ?? (input.scenesAppend ? [...existing.scenes, ...input.scenesAppend] : existing.scenes),
      audio: input.audio ? { ...existing.audio, ...input.audio } : existing.audio,
      marketing: input.marketing ? { ...existing.marketing, ...input.marketing } : existing.marketing,
      visual: input.visual ? { ...existing.visual, ...input.visual } : existing.visual,
      tags: input.tags ?? existing.tags,
      keywords: input.keywords ?? existing.keywords,
      lessonsLearned: input.lessonsLearned
        ? [...existing.lessonsLearned, ...input.lessonsLearned]
        : existing.lessonsLearned,
      strengths: input.strengths ? [...existing.strengths, ...input.strengths] : existing.strengths,
      weaknesses: input.weaknesses
        ? [...existing.weaknesses, ...input.weaknesses]
        : existing.weaknesses,
      lastModified: now,
    };

    if (input.userSatisfaction !== undefined) {
      updated.scores = { ...updated.scores, userSatisfaction: input.userSatisfaction };
    }

    if (input.exportRecord) {
      updated.exportHistory = [...updated.exportHistory, input.exportRecord];
      updated.status = VideoStatus.Exported;
    }

    const relationships = this.linker.link(
      videoId,
      updated.projectId,
      updated.brand,
      updated.category,
      updated.tags
    );
    updated.relatedMemories = [
      ...new Set([...updated.relatedMemories, ...relationships.relatedMemories]),
    ];

    updated.scores = this.scorer.computeScores(updated);

    const memoryRead = await this.foundation.getStorageEngine().getRecord(videoId);
    const memoryVersion = (memoryRead.record?.version ?? existing.versions.length) + 1;

    const versionInfo: VideoVersionInfo = {
      version: existing.versions.length + 1,
      timestamp: now,
      changeSummary: this.summarizeChanges(input),
      memoryVersion,
    };
    updated.versions = [...existing.versions, versionInfo];

    const updateResult = await this.foundation.getStorageEngine().updateRecord(
      videoId,
      {
        title: updated.videoName,
        category: updated.category,
        tags: updated.tags,
        keywords: updated.keywords,
        qualityScore: updated.scores.videoQualityScore,
        payload: this.toPayload(updated),
      },
      "video-memory-engine"
    );

    if (!updateResult.success) {
      return this.fail(videoId, start, "Failed to update video memory");
    }

    let patternsDetected = 0;
    if (updated.scenes.length >= 2) {
      const patterns = this.patternDetector.detect(updated);
      updated.patterns = [...updated.patterns, ...patterns];
      patternsDetected = patterns.length;

      if (patterns.length > 0) {
        await this.foundation.getStorageEngine().updateRecord(
          videoId,
          { payload: this.toPayload(updated) },
          "video-memory-engine"
        );
      }
    }

    this.videos.set(videoId, updated);
    this.history.append({
      timestamp: now,
      event: patternsDetected > 0 ? "pattern" : "update",
      videoId,
      projectId: updated.projectId,
      detail: versionInfo.changeSummary,
      version: versionInfo.version,
    });

    this.logger.log("info", "video-update", "Video memory updated", {
      videoId,
      patterns: patternsDetected,
    });

    return {
      success: true,
      videoId,
      memoryId: videoId,
      version: versionInfo.version,
      durationMs: Date.now() - start,
      patternsDetected,
    };
  }

  async complete(videoId: string, userSatisfaction?: number): Promise<VideoLearningResult> {
    const existing = await this.loadVideo(videoId);
    if (!existing) {
      return {
        success: false,
        videoId,
        patternsStored: 0,
        strengths: [],
        weaknesses: [],
      };
    }

    await this.update(videoId, {
      status: VideoStatus.Completed,
      userSatisfaction,
    });

    const video = (await this.loadVideo(videoId))!;
    const patterns = this.patternDetector.detect(video);
    video.patterns = [...video.patterns, ...patterns];

    await this.foundation.getStorageEngine().updateRecord(
      videoId,
      { payload: this.toPayload(video) },
      "video-memory-engine"
    );
    this.videos.set(videoId, video);

    const learning = await this.learner.learnFromCompletedVideo(video, patterns.length);

    this.history.append({
      timestamp: new Date().toISOString(),
      event: "complete",
      videoId,
      projectId: video.projectId,
      detail: `Video completed with ${patterns.length} pattern(s)`,
    });

    this.logger.log("info", "video-complete", "Video completed and learned", { videoId });

    return learning;
  }

  async loadVideo(videoId: string): Promise<VideoRecord | null> {
    const cached = this.videos.get(videoId);
    if (cached) return cached;

    const read = await this.foundation.getStorageEngine().getRecord(videoId);
    if (!read.success || !read.record) return null;

    const record = recordFromMemory(read.record);
    this.videos.set(videoId, record);
    return record;
  }

  private toMemoryInput(video: VideoRecord) {
    return {
      memoryId: video.videoId,
      memoryType: MemoryStorageType.Video,
      category: video.category,
      title: video.videoName,
      description: `${video.brand} promotional video - ${video.marketingGoal}`,
      source: "video-memory-engine",
      tags: video.tags,
      keywords: video.keywords,
      relatedProject: video.projectId,
      qualityScore: video.scores.videoQualityScore,
      payload: this.toPayload(video),
    };
  }

  private toPayload(video: VideoRecord): Record<string, unknown> {
    return {
      videoId: video.videoId,
      projectId: video.projectId,
      productType: video.productType,
      brand: video.brand,
      status: video.status,
      targetAudience: video.targetAudience,
      marketingGoal: video.marketingGoal,
      language: video.language,
      duration: video.duration,
      resolution: video.resolution,
      aspectRatio: video.aspectRatio,
      exportFormat: video.exportFormat,
      scenes: video.scenes,
      audio: video.audio,
      marketing: video.marketing,
      visual: video.visual,
      scores: video.scores,
      exportHistory: video.exportHistory,
      patterns: video.patterns,
      relatedMemories: video.relatedMemories,
      lessonsLearned: video.lessonsLearned,
      strengths: video.strengths,
      weaknesses: video.weaknesses,
      versions: video.versions,
    };
  }

  private summarizeChanges(input: VideoUpdateInput): string {
    const parts: string[] = [];
    if (input.status) parts.push(`status→${input.status}`);
    if (input.scenes) parts.push(`${input.scenes.length} scene(s)`);
    if (input.scenesAppend) parts.push(`+${input.scenesAppend.length} scene(s)`);
    if (input.marketing) parts.push("marketing updated");
    if (input.audio) parts.push("audio updated");
    if (input.visual) parts.push("visual updated");
    if (input.exportRecord) parts.push("export recorded");
    return parts.length > 0 ? parts.join(", ") : "Video updated";
  }

  private fail(videoId: string, start: number, reason: string): VideoProcessResult {
    this.logger.log("error", "error", reason, { videoId });
    return {
      success: false,
      videoId,
      memoryId: videoId,
      version: 0,
      durationMs: Date.now() - start,
      patternsDetected: 0,
      reason,
    };
  }
}
