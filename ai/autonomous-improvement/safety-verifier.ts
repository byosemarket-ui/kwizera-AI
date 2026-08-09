import type {
  ImprovementSignalInput,
  ImprovementStrategy,
  ImprovementTargetModule,
  SafetyVerification,
} from "./types.js";

const MODULE_KEYWORDS: Array<{ module: ImprovementTargetModule; keywords: string[] }> = [
  { module: "ai-reasoning", keywords: ["reasoning", "decision", "infer"] },
  { module: "planning", keywords: ["planning", "plan", "schedule"] },
  { module: "workflow", keywords: ["workflow", "pipeline", "execution order"] },
  { module: "prompt-generation", keywords: ["prompt", "prompting"] },
  { module: "scene-planning", keywords: ["scene", "shot", "blocking"] },
  { module: "storyboard", keywords: ["storyboard", "story", "narrative"] },
  { module: "rendering", keywords: ["render", "export", "encode"] },
  { module: "resource-allocation", keywords: ["cpu", "gpu", "ram", "resource", "vram"] },
  { module: "ai-model-selection", keywords: ["model", "selection", "inference"] },
  { module: "knowledge-usage", keywords: ["knowledge", "search", "pack", "memory"] },
];

const STRATEGY_BY_MODULE: Record<ImprovementTargetModule, ImprovementStrategy> = {
  "ai-reasoning": "knowledge-optimization",
  planning: "scheduling-optimization",
  workflow: "workflow-refinement",
  "prompt-generation": "prompt-optimization",
  "scene-planning": "prompt-optimization",
  storyboard: "workflow-refinement",
  rendering: "resource-optimization",
  "resource-allocation": "resource-optimization",
  "ai-model-selection": "scheduling-optimization",
  "knowledge-usage": "search-optimization",
};

export function inferModule(signal: ImprovementSignalInput): ImprovementTargetModule {
  if (signal.moduleHint) return signal.moduleHint;
  const text = `${signal.label} ${signal.detail ?? ""}`.toLowerCase();
  for (const entry of MODULE_KEYWORDS) {
    if (entry.keywords.some((keyword) => text.includes(keyword))) return entry.module;
  }
  if (signal.source === "workflow-optimization") return "workflow";
  if (signal.source === "ai-model-analytics") return "ai-model-selection";
  if (signal.source === "knowledge-foundation" || signal.source === "learning-memory") return "knowledge-usage";
  if (signal.source === "performance-analytics") return "resource-allocation";
  return "planning";
}

export function inferStrategy(
  signal: ImprovementSignalInput,
  module: ImprovementTargetModule,
): ImprovementStrategy {
  if (signal.strategyHint) return signal.strategyHint;
  const text = `${signal.label} ${signal.detail ?? ""}`.toLowerCase();
  if (text.includes("cache")) return "cache-optimization";
  if (text.includes("search")) return "search-optimization";
  if (text.includes("memory")) return "memory-optimization";
  if (text.includes("schedule") || text.includes("scheduling")) return "scheduling-optimization";
  if (text.includes("prompt")) return "prompt-optimization";
  if (text.includes("knowledge")) return "knowledge-optimization";
  if (text.includes("resource") || text.includes("gpu") || text.includes("cpu")) return "resource-optimization";
  return STRATEGY_BY_MODULE[module];
}

export function verifySafety(options: {
  module: ImprovementTargetModule;
  strategy: ImprovementStrategy;
  touchesUserProjects?: boolean;
  breaksApi?: boolean;
  breaksWorkflow?: boolean;
  deletesUserData?: boolean;
  forceUnsafe?: boolean;
}): SafetyVerification {
  const failedChecks: string[] = [];
  const noFunctionalityBreak = !options.breaksWorkflow && !options.forceUnsafe;
  const apisCompatible = !options.breaksApi && !options.forceUnsafe;
  const workflowsFunctional = !options.breaksWorkflow && !options.forceUnsafe;
  const projectDataSafe = !options.touchesUserProjects && !options.deletesUserData && !options.forceUnsafe;

  if (!noFunctionalityBreak) failedChecks.push("Functionality break risk");
  if (!apisCompatible) failedChecks.push("API compatibility risk");
  if (!workflowsFunctional) failedChecks.push("Workflow functionality risk");
  if (!projectDataSafe) failedChecks.push("Project data safety risk");

  // Cache/search/memory/knowledge/resource/scheduling refinements are additive and safe by default.
  const strategySafe = [
    "workflow-refinement",
    "prompt-optimization",
    "resource-optimization",
    "cache-optimization",
    "search-optimization",
    "memory-optimization",
    "scheduling-optimization",
    "knowledge-optimization",
  ].includes(options.strategy);

  const safeToApply =
    strategySafe
    && noFunctionalityBreak
    && apisCompatible
    && workflowsFunctional
    && projectDataSafe;

  return {
    noFunctionalityBreak,
    apisCompatible,
    workflowsFunctional,
    projectDataSafe,
    safeToApply,
    failedChecks,
    notes: safeToApply
      ? `Safe to apply ${options.strategy} on ${options.module}; user projects untouched.`
      : `Automatic apply blocked for ${options.module}: ${failedChecks.join("; ") || "unsafe"}.`,
  };
}

export function scoreOpportunity(signal: ImprovementSignalInput, confidenceBase = 60): number {
  const score = typeof signal.score === "number" && Number.isFinite(signal.score) ? signal.score : 50;
  return Math.max(0, Math.min(100, Math.round(confidenceBase * 0.4 + score * 0.6)));
}
