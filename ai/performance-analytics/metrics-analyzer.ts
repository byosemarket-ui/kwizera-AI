import type {
  DetectedBottleneck,
  ModelPerformanceInput,
  ModelPerformanceRecord,
  NormalizedPipelineMetrics,
  NormalizedQualityScores,
  NormalizedResourceMetrics,
  OptimizationRecommendation,
  PipelineTimingInput,
  QualityScoresInput,
  ResourceSnapshotInput,
} from "./types.js";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function num(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeTimings(input: PipelineTimingInput): NormalizedPipelineMetrics {
  const imageGenerationMs = Math.max(0, num(input.imageGenerationMs, 0));
  const videoGenerationMs = Math.max(0, num(input.videoGenerationMs, 0));
  const audioGenerationMs = Math.max(0, num(input.audioGenerationMs, 0));
  const renderingMs = Math.max(0, num(input.renderingMs, 0));
  const exportMs = Math.max(0, num(input.exportMs, 0));
  const sumStages = imageGenerationMs + videoGenerationMs + audioGenerationMs + renderingMs + exportMs;
  const overallPipelineMs = Math.max(0, num(input.overallPipelineMs, sumStages));
  const totalProductionMs = Math.max(0, num(input.totalProductionMs, overallPipelineMs));
  return {
    totalProductionMs,
    imageGenerationMs,
    videoGenerationMs,
    audioGenerationMs,
    renderingMs,
    exportMs,
    overallPipelineMs,
  };
}

export function normalizeResources(input: ResourceSnapshotInput): NormalizedResourceMetrics {
  return {
    cpuPercent: clamp(num(input.cpuPercent, 0)),
    gpuPercent: clamp(num(input.gpuPercent, 0)),
    ramMb: Math.max(0, num(input.ramMb, 0)),
    vramMb: Math.max(0, num(input.vramMb, 0)),
    storageMb: Math.max(0, num(input.storageMb, 0)),
    diskSpeedMBps: Math.max(0, num(input.diskSpeedMBps, 0)),
    networkMbps: Math.max(0, num(input.networkMbps, 0)),
  };
}

export function normalizeQuality(input: QualityScoresInput): NormalizedQualityScores {
  const scores = {
    imageQuality: clamp(num(input.imageQuality, 70)),
    videoQuality: clamp(num(input.videoQuality, 70)),
    audioQuality: clamp(num(input.audioQuality, 70)),
    storytellingQuality: clamp(num(input.storytellingQuality, 70)),
    cameraQuality: clamp(num(input.cameraQuality, 70)),
    lightingQuality: clamp(num(input.lightingQuality, 70)),
    editingQuality: clamp(num(input.editingQuality, 70)),
    renderingQuality: clamp(num(input.renderingQuality, 70)),
    marketingQuality: clamp(num(input.marketingQuality, 70)),
  };
  const values = Object.values(scores);
  const overallQuality = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return { ...scores, overallQuality };
}

export function evaluateModels(models: ModelPerformanceInput[] = []): ModelPerformanceRecord[] {
  return models.map((model) => {
    const speedScore = clamp(num(model.speedScore, 70));
    const accuracyScore = clamp(num(model.accuracyScore, 70));
    const stabilityScore = clamp(num(model.stabilityScore, 70));
    const memoryMb = Math.max(0, num(model.memoryMb, 1024));
    const resourceScore = clamp(num(model.resourceScore, 70));
    const failureRate = clamp(num(model.failureRate, 5));
    const outputQuality = clamp(num(model.outputQuality, 70));
    const compositeScore = Math.round(
      speedScore * 0.15
        + accuracyScore * 0.2
        + stabilityScore * 0.15
        + resourceScore * 0.1
        + outputQuality * 0.25
        + (100 - failureRate) * 0.15,
    );
    return {
      modelId: model.modelId,
      task: model.task,
      speedScore,
      accuracyScore,
      stabilityScore,
      memoryMb,
      resourceScore,
      failureRate,
      outputQuality,
      compositeScore,
    };
  });
}

export function recommendBestModels(models: ModelPerformanceRecord[]): Record<string, string> {
  const byTask = new Map<string, ModelPerformanceRecord>();
  for (const model of models) {
    const current = byTask.get(model.task);
    if (!current || model.compositeScore > current.compositeScore) {
      byTask.set(model.task, model);
    }
  }
  const result: Record<string, string> = {};
  for (const [task, model] of byTask) result[task] = model.modelId;
  return result;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function detectBottlenecks(
  timings: NormalizedPipelineMetrics,
  resources: NormalizedResourceMetrics,
  quality: NormalizedQualityScores,
): DetectedBottleneck[] {
  const found: DetectedBottleneck[] = [];
  const stageEntries: Array<{ module: string; ms: number; threshold: number }> = [
    { module: "image-generation", ms: timings.imageGenerationMs, threshold: 45_000 },
    { module: "video-generation", ms: timings.videoGenerationMs, threshold: 90_000 },
    { module: "audio-generation", ms: timings.audioGenerationMs, threshold: 30_000 },
    { module: "rendering", ms: timings.renderingMs, threshold: 60_000 },
    { module: "export", ms: timings.exportMs, threshold: 20_000 },
  ];

  for (const stage of stageEntries) {
    if (stage.ms > stage.threshold) {
      found.push({
        id: uid("bn"),
        kind: stage.module === "rendering" ? "rendering-bottleneck" : "slow-module",
        severity: stage.ms > stage.threshold * 1.5 ? "high" : "medium",
        module: stage.module,
        detail: `${stage.module} took ${stage.ms}ms (threshold ${stage.threshold}ms)`,
        metricValue: stage.ms,
        threshold: stage.threshold,
      });
    }
  }

  if (resources.cpuPercent >= 90) {
    found.push({
      id: uid("bn"),
      kind: "cpu-bottleneck",
      severity: resources.cpuPercent >= 95 ? "high" : "medium",
      module: "system-cpu",
      detail: `CPU at ${resources.cpuPercent}%`,
      metricValue: resources.cpuPercent,
      threshold: 90,
    });
  }
  if (resources.gpuPercent >= 92) {
    found.push({
      id: uid("bn"),
      kind: "gpu-bottleneck",
      severity: resources.gpuPercent >= 97 ? "high" : "medium",
      module: "system-gpu",
      detail: `GPU at ${resources.gpuPercent}%`,
      metricValue: resources.gpuPercent,
      threshold: 92,
    });
  }
  if (resources.ramMb >= 14_000 || resources.vramMb >= 10_000) {
    found.push({
      id: uid("bn"),
      kind: "memory-leak",
      severity: "high",
      module: resources.vramMb >= 10_000 ? "system-vram" : "system-ram",
      detail: `Elevated memory RAM=${resources.ramMb}MB VRAM=${resources.vramMb}MB`,
      metricValue: Math.max(resources.ramMb, resources.vramMb),
      threshold: resources.vramMb >= 10_000 ? 10_000 : 14_000,
    });
  }
  if (resources.diskSpeedMBps > 0 && resources.diskSpeedMBps < 80) {
    found.push({
      id: uid("bn"),
      kind: "storage-bottleneck",
      severity: resources.diskSpeedMBps < 40 ? "high" : "medium",
      module: "system-storage",
      detail: `Disk speed ${resources.diskSpeedMBps} MB/s`,
      metricValue: resources.diskSpeedMBps,
      threshold: 80,
    });
  }
  if (timings.overallPipelineMs > 180_000 && quality.overallQuality < 75) {
    found.push({
      id: uid("bn"),
      kind: "workflow-bottleneck",
      severity: "medium",
      module: "production-pipeline",
      detail: `Long pipeline (${timings.overallPipelineMs}ms) with quality ${quality.overallQuality}`,
      metricValue: timings.overallPipelineMs,
      threshold: 180_000,
    });
  }

  return found;
}

export function buildOptimizations(bottlenecks: DetectedBottleneck[]): OptimizationRecommendation[] {
  const recs: OptimizationRecommendation[] = [];
  for (const bottleneck of bottlenecks) {
    const map: Record<string, { target: OptimizationRecommendation["target"]; recommendation: string; impact: string }> = {
      "slow-module": {
        target: "speed",
        recommendation: `Optimize ${bottleneck.module}: reduce batch size, enable caching, or prefer a faster model.`,
        impact: "Lower stage latency and overall pipeline time",
      },
      "rendering-bottleneck": {
        target: "rendering",
        recommendation: "Lower intermediate resolution or use hardware-accelerated encode for final render.",
        impact: "Faster rendering and export",
      },
      "cpu-bottleneck": {
        target: "resource-allocation",
        recommendation: "Throttle concurrent CPU-bound stages; schedule image prep before heavy video encode.",
        impact: "Smoother CPU utilization",
      },
      "gpu-bottleneck": {
        target: "gpu-usage",
        recommendation: "Serialize GPU-heavy generation jobs and prefer lighter inference presets when quality allows.",
        impact: "Reduced GPU saturation",
      },
      "memory-leak": {
        target: "memory-usage",
        recommendation: "Clear intermediate tensors/assets between stages; verify model unload after generation.",
        impact: "Lower RAM/VRAM peaks",
      },
      "storage-bottleneck": {
        target: "workflow",
        recommendation: "Move working cache to faster disk and reduce intermediate frame dumps.",
        impact: "Higher I/O throughput",
      },
      "workflow-bottleneck": {
        target: "workflow",
        recommendation: "Parallelize independent asset prep; skip redundant review loops when quality gates pass.",
        impact: "Higher productivity without quality loss",
      },
    };
    const entry = map[bottleneck.kind] ?? {
      target: "quality" as const,
      recommendation: `Review ${bottleneck.module} for efficiency improvements.`,
      impact: "Incremental production efficiency",
    };
    recs.push({
      id: uid("opt"),
      target: entry.target,
      priority: bottleneck.severity,
      recommendation: entry.recommendation,
      expectedImpact: entry.impact,
      relatedBottleneckId: bottleneck.id,
    });
  }

  if (!recs.some((item) => item.target === "quality")) {
    recs.push({
      id: uid("opt"),
      target: "quality",
      priority: "low",
      recommendation: "Keep quality gates from self-review and feedback intelligence aligned with analytics thresholds.",
      expectedImpact: "Stable quality while optimizing speed",
    });
  }
  return recs;
}
