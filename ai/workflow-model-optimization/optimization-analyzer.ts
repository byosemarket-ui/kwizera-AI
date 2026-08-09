import type {
  AnalyzedModel,
  AnalyzedWorkflow,
  ModelHistoryInput,
  OptimizationContextInput,
  WorkflowHistoryInput,
} from "./types.js";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function num(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function analyzeWorkflow(input: WorkflowHistoryInput): AnalyzedWorkflow {
  const success = Math.max(0, num(input.successCount, 0));
  const failure = Math.max(0, num(input.failureCount, 0));
  const total = success + failure;
  const successRate = total === 0 ? 50 : Math.round((success / total) * 100);
  const avgExecutionMs = Math.max(0, num(input.avgExecutionMs, 120_000));
  const avgQuality = clamp(num(input.avgQuality, 70));
  const userSatisfaction = clamp(num(input.userSatisfaction, 70));
  const cpu = clamp(num(input.avgCpuPercent, 50));
  const gpu = clamp(num(input.avgGpuPercent, 50));
  const ram = Math.max(0, num(input.avgRamMb, 8_000));
  const resourceScore = clamp(100 - (cpu * 0.35 + gpu * 0.35 + Math.min(40, ram / 500)));

  const classification: AnalyzedWorkflow["classification"] = [];
  if (avgExecutionMs > 180_000 || resourceScore < 45) classification.push("inefficient");
  if (avgExecutionMs > 150_000) classification.push("slow");
  const lastUsed = input.lastUsedAt ? Date.parse(input.lastUsedAt) : Date.now();
  const daysUnused = (Date.now() - lastUsed) / (1000 * 60 * 60 * 24);
  if (daysUnused > 45 || total === 0) classification.push("unused");
  if (successRate >= 80 && avgQuality >= 75) classification.push("reusable");
  if (!classification.length) classification.push("efficient");

  return {
    workflowId: input.workflowId,
    name: input.name || input.workflowId,
    version: Math.max(1, num(input.version, 1)),
    successRate,
    failureCount: failure,
    avgExecutionMs,
    resourceScore: Math.round(resourceScore),
    qualityResults: avgQuality,
    userSatisfaction,
    classification,
    active: input.active !== false,
    steps: input.steps?.length
      ? [...input.steps]
      : ["product-intelligence", "image-generation", "video-generation", "audio-generation", "rendering"],
  };
}

export function analyzeModel(input: ModelHistoryInput): AnalyzedModel {
  const outputQuality = clamp(num(input.outputQuality, 70));
  const renderingQuality = clamp(num(input.renderingQuality, outputQuality));
  const imageQuality = clamp(num(input.imageQuality, outputQuality));
  const videoQuality = clamp(num(input.videoQuality, outputQuality));
  const audioQuality = clamp(num(input.audioQuality, outputQuality));
  const processingSpeedScore = clamp(num(input.processingSpeedScore, 70));
  const gpuUsagePercent = clamp(num(input.gpuUsagePercent, 60));
  const ramUsageMb = Math.max(0, num(input.ramUsageMb, 4_000));
  const stabilityScore = clamp(num(input.stabilityScore, 75));
  const errorRate = clamp(num(input.errorRate, 5));
  const qualityAvg = (outputQuality + renderingQuality + imageQuality + videoQuality + audioQuality) / 5;
  const compositeScore = Math.round(
    qualityAvg * 0.45
      + processingSpeedScore * 0.15
      + stabilityScore * 0.2
      + (100 - errorRate) * 0.1
      + (100 - gpuUsagePercent) * 0.05
      + clamp(100 - ramUsageMb / 200) * 0.05,
  );
  return {
    modelId: input.modelId,
    task: String(input.task),
    outputQuality,
    renderingQuality,
    imageQuality,
    videoQuality,
    audioQuality,
    processingSpeedScore,
    gpuUsagePercent,
    ramUsageMb,
    stabilityScore,
    errorRate,
    compositeScore,
  };
}

export function optimizeStepOrder(steps: string[]): string[] {
  const preferred = [
    "product-intelligence",
    "product-assets",
    "scene-planning",
    "storyboard",
    "prompt-engine",
    "image-generation",
    "video-generation",
    "audio-generation",
    "rendering",
    "export",
  ];
  const unique = [...new Set(steps)];
  return unique.sort((a, b) => {
    const ia = preferred.indexOf(a);
    const ib = preferred.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

export function selectModelsForTask(
  task: string,
  models: AnalyzedModel[],
  context: OptimizationContextInput = {},
): { primary: AnalyzedModel; secondary: AnalyzedModel; backup: AnalyzedModel; rationale: string } | null {
  const pool = models
    .filter((m) => m.task === task || task === "full-pipeline")
    .sort((a, b) => b.compositeScore - a.compositeScore);
  const taskPool = pool.length
    ? pool
    : [...models].sort((a, b) => b.compositeScore - a.compositeScore);
  if (!taskPool.length) return null;

  const qualityFloor = clamp(num(context.qualityRequirement, 70));
  const allowTradeoff = context.allowQualityTradeoffForSpeed === true;
  const qualityFirst = taskPool.filter((m) => m.outputQuality >= qualityFloor);
  const ranked = (qualityFirst.length ? qualityFirst : taskPool).slice();

  if (!allowTradeoff) {
    ranked.sort((a, b) => {
      const qa = (a.outputQuality + a.stabilityScore) / 2;
      const qb = (b.outputQuality + b.stabilityScore) / 2;
      if (qb !== qa) return qb - qa;
      return b.compositeScore - a.compositeScore;
    });
  } else {
    ranked.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  const primary = ranked[0]!;
  const secondary = ranked[1] ?? ranked[0]!;
  const backup = ranked[2] ?? ranked[1] ?? ranked[0]!;
  const rationale =
    `Selected for task=${task}, product=${context.productType ?? "general"}, goal=${context.marketingGoal ?? "conversion"}, ` +
    `hardware=${context.hardwareTier ?? "medium"}, qualityFloor=${qualityFloor}` +
    (allowTradeoff ? " (speed tradeoff allowed)." : " (quality protected).");
  return { primary, secondary, backup, rationale };
}

export function estimateQuality(
  workflow: AnalyzedWorkflow,
  models: AnalyzedModel[],
): number {
  const modelAvg = models.length
    ? models.reduce((s, m) => s + m.outputQuality, 0) / models.length
    : workflow.qualityResults;
  return Math.round(clamp((workflow.qualityResults * 0.55) + (modelAvg * 0.45)));
}
