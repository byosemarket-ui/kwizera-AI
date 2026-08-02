import type { ImageGenerationRequest } from "../image-generation/types.js";
import type { VideoGenerationRequest } from "../video-audio-generation/types.js";

export type OptimizationTarget = "image" | "video-audio";
export type OptimizationTaskStatus = "queued" | "running" | "completed" | "failed";
export interface OptimizationRequest { target: OptimizationTarget; projectId?: string; image?: ImageGenerationRequest; videoAudio?: VideoGenerationRequest; candidateModelIds?: string[]; maxAttempts?: number; }
export interface QualityAnalysis { score: number; valid: boolean; brandConsistent: boolean; safe: boolean; notes: string[]; }
export interface OptimizedResult { id: string; modelId: string; target: OptimizationTarget; sourceId: string; quality: QualityAnalysis; createdAt: string; }
export interface OptimizationTask { id: string; request: OptimizationRequest; status: OptimizationTaskStatus; progress: number; createdAt: string; updatedAt: string; startedAt?: string; completedAt?: string; attempts: number; maxAttempts: number; error?: string; results: OptimizedResult[]; selectedResultId?: string; logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>; }
export interface OptimizationStore { tasks: OptimizationTask[]; history: OptimizationTask[]; logs: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>; }