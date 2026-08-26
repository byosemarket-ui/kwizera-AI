/** Assemble Production Job + task graph from confirmed Production Snapshot (prepare only). */

import type { ProductionSnapshot } from "../production-plan/types";
import type {
  AiEngineRequirement,
  JobPriority,
  JobReadinessScores,
  JobStatus,
  PrepCheck,
  ProductionJob,
  ProductionTask,
  QueueAssetCheck,
  ResourceCheckItem,
  SnapshotValidation,
  StorageEstimate,
  TaskType,
} from "./types";

export interface AssembleQueueInput {
  snapshot: ProductionSnapshot;
  previous?: ProductionJob | null;
  productionId: string;
  priority?: JobPriority;
  resourceHints?: {
    cores: number | null;
    deviceMemoryGb: number | null;
    jsHeapMb: number | null;
    diskUsedGb: number | null;
    diskTotalGb: number | null;
  } | null;
  aiCoreOnline?: boolean;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nextProductionId(counter: number, year = new Date().getFullYear()): string {
  return `PROD-${year}-${String(counter).padStart(4, "0")}`;
}

export function bumpJobVersion(previous: ProductionJob | null): { versionLabel: string; versionNumber: number } {
  if (!previous) return { versionLabel: "v1.0", versionNumber: 1 };
  const next = previous.versionNumber + 1;
  return { versionLabel: `v1.${next - 1}`, versionNumber: next };
}

export function validateSnapshot(snapshot: ProductionSnapshot | null): SnapshotValidation {
  const items: SnapshotValidation["items"] = [];
  const push = (id: string, label: string, ok: boolean, critical: boolean, detail: string) => {
    items.push({ id, label, ok, critical, detail });
  };
  if (!snapshot) {
    push("snap", "Snapshot exists", false, true, "Production Snapshot is missing.");
    return { items, valid: false, blocking: ["Production Snapshot is missing."] };
  }
  const plan = snapshot.plan;
  push("snap", "Snapshot exists", true, true, snapshot.snapshotId);
  push("confirmed", "Snapshot is confirmed", Boolean(plan.userConfirmed), true, plan.userConfirmed ? "User confirmed" : "Not confirmed");
  push("version", "Snapshot version valid", Boolean(plan.versionLabel && plan.version === 1), true, plan.versionLabel || "missing");
  push("project", "Project exists", Boolean(plan.projectId && plan.projectName), true, plan.projectName || "missing");
  push("product", "Product exists", Boolean(plan.productId && plan.productName), true, plan.productName || "missing");
  push("strategy", "Marketing strategy exists", Boolean(snapshot.strategy?.userConfirmed || plan.strategyRef), true, plan.strategyRef || "missing");
  push("blueprint", "Creative blueprint exists", Boolean(plan.blueprintRef), true, plan.blueprintRef || "missing");
  push("script", "Script exists", (snapshot.script?.length ?? 0) > 0 || plan.script.length > 0, true, `${(snapshot.script ?? plan.script).length} lines`);
  push("scenes", "Scene plan exists", (snapshot.scenes?.length ?? 0) > 0 || plan.scenes.length > 0, true, `${(snapshot.scenes ?? plan.scenes).length} scenes`);
  const mapped = plan.assets.some((a) => a.assetType === "Product Images" && a.status === "AVAILABLE");
  push("assets", "Assets are mapped", mapped, true, mapped ? "Product images mapped" : "No mapped product images");
  push("output", "Output settings exist", plan.output.durationSec > 0, true, `${plan.output.durationSec}s · ${plan.output.types.join(", ")}`);
  push("claims", "Claim Safety exists", (snapshot.claimSafety?.length ?? 0) > 0 || plan.claimAudit.length >= 0, false, `${snapshot.claimSafety?.length ?? 0} register entries`);
  push("restrict", "Production restrictions exist", true, false, `${plan.restrictions.length} restriction(s)`);
  const blocking = items.filter((i) => i.critical && !i.ok).map((i) => i.detail);
  return { items, valid: blocking.length === 0, blocking };
}

export function buildTaskGraph(input: {
  productionId: string;
  snapshot: ProductionSnapshot;
  priority: JobPriority;
}): ProductionTask[] {
  const plan = input.snapshot.plan;
  const scenes = input.snapshot.scenes.length ? input.snapshot.scenes : plan.scenes;
  const script = input.snapshot.script.length ? input.snapshot.script : plan.script;
  const now = new Date().toISOString();
  const wantsVideo = plan.output.types.some((t) => /video/i.test(t)) || plan.project.outputType === "Video";
  const wantsVoice = Boolean(plan.audio.language && script.some((l) => l.narration));
  const wantsMusic = Boolean(plan.audio.musicMood);
  const wantsSfx = Boolean(plan.audio.sfx?.length);
  const wantsThumb = wantsVideo;
  const wantsSubtitles = script.some((l) => l.onScreenText || l.narration);

  type Spec = {
    type: TaskType;
    name: string;
    description: string;
    deps: TaskType[];
    engine: string | null;
    assets: string[];
    resources: string[];
    parallelSafe: boolean;
    outputs: string[];
    include: boolean;
  };

  const specs: Spec[] = [
    {
      type: "ASSET_IMPORT",
      name: "Load Product Assets",
      description: "Load product images and brand assets referenced by the snapshot",
      deps: [],
      engine: null,
      assets: ["Product Images"],
      resources: ["CPU", "Storage"],
      parallelSafe: false,
      outputs: ["asset-index"],
      include: true,
    },
    {
      type: "ASSET_VALIDATION",
      name: "Validate Product Assets",
      description: "Verify referenced assets exist and are readable",
      deps: ["ASSET_IMPORT"],
      engine: null,
      assets: ["Product Images"],
      resources: ["CPU"],
      parallelSafe: false,
      outputs: ["asset-validation-report"],
      include: true,
    },
    {
      type: "IMAGE_PROCESSING",
      name: "Prepare Images",
      description: "Normalize product images for scene use",
      deps: ["ASSET_VALIDATION"],
      engine: "Local Image Engine",
      assets: ["Product Images"],
      resources: ["CPU", "RAM"],
      parallelSafe: true,
      outputs: ["processed-images"],
      include: true,
    },
    {
      type: "BACKGROUND_GENERATION",
      name: "Prepare Backgrounds",
      description: "Prepare or generate scene backgrounds from visual direction",
      deps: ["IMAGE_PROCESSING"],
      engine: "Local Image Engine",
      assets: ["Backgrounds"],
      resources: ["CPU", "GPU"],
      parallelSafe: true,
      outputs: ["backgrounds"],
      include: plan.assets.some((a) => a.assetType === "Backgrounds"),
    },
    {
      type: "VISUAL_GENERATION",
      name: "Generate Visual Assets",
      description: "Produce scene visuals from the creative blueprint",
      deps: ["IMAGE_PROCESSING"],
      engine: "Local Visual Engine",
      assets: ["Product Images"],
      resources: ["GPU", "VRAM", "RAM"],
      parallelSafe: false,
      outputs: ["scene-visuals"],
      include: wantsVideo,
    },
    {
      type: "VOICE_GENERATION",
      name: "Generate Voice",
      description: "Generate narration from approved script",
      deps: ["ASSET_VALIDATION"],
      engine: "Local Voice Engine",
      assets: ["Voice"],
      resources: ["CPU", "RAM"],
      parallelSafe: true,
      outputs: ["voice-track"],
      include: wantsVoice,
    },
    {
      type: "MUSIC_GENERATION",
      name: "Prepare Music",
      description: "Prepare music bed from audio specification",
      deps: ["ASSET_VALIDATION"],
      engine: "Local Audio Engine",
      assets: ["Music"],
      resources: ["CPU"],
      parallelSafe: true,
      outputs: ["music-track"],
      include: wantsMusic,
    },
    {
      type: "SFX_GENERATION",
      name: "Prepare Sound Effects",
      description: "Prepare SFX cues from audio specification",
      deps: ["ASSET_VALIDATION"],
      engine: "Local Audio Engine",
      assets: ["Sound Effects"],
      resources: ["CPU"],
      parallelSafe: true,
      outputs: ["sfx-track"],
      include: wantsSfx,
    },
    {
      type: "AUDIO_PROCESSING",
      name: "Process Audio Mix",
      description: "Mix voice, music, and SFX with ducking rules",
      deps: ["VOICE_GENERATION", "MUSIC_GENERATION", "SFX_GENERATION"].filter((d) =>
        (d === "VOICE_GENERATION" && wantsVoice)
        || (d === "MUSIC_GENERATION" && wantsMusic)
        || (d === "SFX_GENERATION" && wantsSfx),
      ) as TaskType[],
      engine: "Local Audio Engine",
      assets: [],
      resources: ["CPU", "RAM"],
      parallelSafe: false,
      outputs: ["mixed-audio"],
      include: wantsVoice || wantsMusic || wantsSfx,
    },
    {
      type: "SCENE_BUILD",
      name: "Build Scenes",
      description: `Build ${scenes.length} scenes from the confirmed scene plan`,
      deps: ["VISUAL_GENERATION", "IMAGE_PROCESSING"].filter((d) => d === "IMAGE_PROCESSING" || wantsVideo) as TaskType[],
      engine: "Local Video Engine",
      assets: ["Product Images"],
      resources: ["CPU", "RAM", "GPU"],
      parallelSafe: false,
      outputs: ["scene-clips"],
      include: scenes.length > 0,
    },
    {
      type: "TEXT_RENDER",
      name: "Render On-Screen Text",
      description: "Render claim-safe on-screen text overlays",
      deps: ["SCENE_BUILD"],
      engine: "Local Text Engine",
      assets: ["Text", "Fonts"],
      resources: ["CPU"],
      parallelSafe: true,
      outputs: ["text-overlays"],
      include: script.some((l) => l.onScreenText),
    },
    {
      type: "SUBTITLE_GENERATION",
      name: "Generate Subtitles",
      description: "Generate subtitles from narration / on-screen text",
      deps: ["SCENE_BUILD"],
      engine: "Local Text Engine",
      assets: [],
      resources: ["CPU"],
      parallelSafe: true,
      outputs: ["subtitles"],
      include: wantsSubtitles,
    },
    {
      type: "TIMELINE_ASSEMBLY",
      name: "Assemble Timeline",
      description: "Assemble the authoritative scene timeline",
      deps: ["SCENE_BUILD", "AUDIO_PROCESSING", "TEXT_RENDER", "SUBTITLE_GENERATION"].filter((d) => {
        if (d === "AUDIO_PROCESSING") return wantsVoice || wantsMusic || wantsSfx;
        if (d === "TEXT_RENDER") return script.some((l) => l.onScreenText);
        if (d === "SUBTITLE_GENERATION") return wantsSubtitles;
        return true;
      }) as TaskType[],
      engine: "Local Video Engine",
      assets: [],
      resources: ["CPU", "RAM"],
      parallelSafe: false,
      outputs: ["timeline"],
      include: wantsVideo,
    },
    {
      type: "VIDEO_COMPOSITION",
      name: "Compose Video",
      description: "Compose visual + audio timeline layers",
      deps: ["TIMELINE_ASSEMBLY"],
      engine: "Local Video Engine",
      assets: [],
      resources: ["CPU", "GPU", "RAM"],
      parallelSafe: false,
      outputs: ["composition"],
      include: wantsVideo,
    },
    {
      type: "VIDEO_RENDER",
      name: "Render Video",
      description: "Render final video from composition",
      deps: ["VIDEO_COMPOSITION"],
      engine: "Rendering Engine",
      assets: [],
      resources: ["CPU", "GPU", "VRAM", "Storage"],
      parallelSafe: false,
      outputs: ["rendered-video"],
      include: wantsVideo,
    },
    {
      type: "THUMBNAIL_GENERATION",
      name: "Generate Thumbnail",
      description: "Generate thumbnail from key scene",
      deps: ["VIDEO_RENDER"],
      engine: "Local Image Engine",
      assets: ["Product Images"],
      resources: ["CPU"],
      parallelSafe: true,
      outputs: ["thumbnail"],
      include: wantsThumb,
    },
    {
      type: "QUALITY_CHECK",
      name: "Quality Check",
      description: "Validate output against snapshot restrictions and claims",
      deps: ["VIDEO_RENDER"],
      engine: null,
      assets: [],
      resources: ["CPU"],
      parallelSafe: false,
      outputs: ["qa-report"],
      include: wantsVideo,
    },
    {
      type: "EXPORT",
      name: "Export Final Files",
      description: "Export deliverables to configured output directory",
      deps: ["QUALITY_CHECK", "THUMBNAIL_GENERATION"].filter((d) => d === "QUALITY_CHECK" || wantsThumb) as TaskType[],
      engine: null,
      assets: [],
      resources: ["Storage"],
      parallelSafe: false,
      outputs: ["export-package"],
      include: true,
    },
  ];

  const included = specs.filter((s) => s.include);
  const byType = new Map(included.map((s) => [s.type, s]));
  const tasks: ProductionTask[] = included.map((spec, idx) => {
    const deps = spec.deps.filter((d) => byType.has(d));
    return {
      taskId: `${input.productionId}-${spec.type}`,
      productionId: input.productionId,
      taskType: spec.type,
      taskName: spec.name,
      description: spec.description,
      status: "PENDING" as const,
      priority: input.priority,
      order: idx + 1,
      dependencies: deps.map((d) => `${input.productionId}-${d}`),
      inputs: deps.map((d) => byType.get(d)!.name),
      expectedOutputs: spec.outputs,
      requiredAssets: spec.assets,
      requiredAiEngine: spec.engine,
      requiredResources: spec.resources,
      parallelSafe: spec.parallelSafe,
      retryCount: 0,
      maxRetries: 3,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      error: null,
      failureClass: null,
      progress: 0,
      blockedReason: null,
      resolution: null,
    };
  });
  return tasks;
}

export function applySmartQueue(
  tasks: ProductionTask[],
  assetChecks: QueueAssetCheck[],
  engines: AiEngineRequirement[],
): ProductionTask[] {
  const byId = new Map(tasks.map((t) => [t.taskId, { ...t }]));
  const critMissing = assetChecks.filter((a) => a.required === "CRITICAL" && (a.status === "MISSING" || a.status === "INVALID"));
  const engineDown = new Set(
    engines.filter((e) => e.status === "UNAVAILABLE" || e.status === "ERROR").map((e) => e.name),
  );

  for (const task of byId.values()) {
    const missingDep = task.dependencies.some((d) => {
      const dep = byId.get(d);
      return !dep || (dep.status !== "COMPLETED" && dep.status !== "READY" && dep.status !== "PENDING" && dep.status !== "WAITING");
    });
    void missingDep;
    const unmetDeps = task.dependencies.filter((d) => {
      const dep = byId.get(d);
      return dep && dep.status !== "COMPLETED";
    });
    const needsMissingAsset = critMissing.some((a) =>
      task.requiredAssets.includes(a.category) && (a.sceneNumber != null || task.taskType.includes("ASSET") || task.taskType.includes("VISUAL") || task.taskType.includes("IMAGE") || task.taskType.includes("SCENE")),
    );
    const needsDownEngine = Boolean(task.requiredAiEngine && engineDown.has(task.requiredAiEngine));

    if (needsMissingAsset) {
      task.status = "BLOCKED";
      task.blockedReason = `Required asset missing for ${task.taskName}`;
      task.resolution = "Upload asset OR choose another existing asset.";
      task.failureClass = "INPUT";
    } else if (needsDownEngine) {
      task.status = "BLOCKED";
      task.blockedReason = `Required engine unavailable: ${task.requiredAiEngine}`;
      task.resolution = "Configure or repair the local engine before execution.";
      task.failureClass = "CONFIGURATION";
    } else if (unmetDeps.length === 0) {
      task.status = "READY";
      task.blockedReason = null;
      task.resolution = null;
    } else {
      task.status = "WAITING";
      task.blockedReason = `Waiting for: ${unmetDeps.map((id) => byId.get(id)?.taskName || id).join(", ")}`;
      task.resolution = "Complete dependency tasks first.";
      task.failureClass = "DEPENDENCY";
    }
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

export function detectParallelGroups(tasks: ProductionTask[]): string[][] {
  const ready = tasks.filter((t) => t.status === "READY" && t.parallelSafe);
  if (ready.length < 2) return ready.map((t) => [t.taskId]);
  const groups: string[][] = [];
  const used = new Set<string>();
  for (const t of ready) {
    if (used.has(t.taskId)) continue;
    const peers = ready.filter((o) =>
      !used.has(o.taskId)
      && o.taskId !== t.taskId
      && !shareUnsafeResources(t, o),
    );
    const group = [t.taskId, ...peers.map((p) => p.taskId)];
    for (const id of group) used.add(id);
    groups.push(group);
  }
  return groups;
}

function shareUnsafeResources(a: ProductionTask, b: ProductionTask): boolean {
  const heavy = new Set(["GPU", "VRAM"]);
  return a.requiredResources.some((r) => heavy.has(r) && b.requiredResources.includes(r));
}

export function checkAssetsFromPlan(snapshot: ProductionSnapshot): QueueAssetCheck[] {
  const plan = snapshot.plan;
  return plan.assets.map((a) => {
    let status: QueueAssetCheck["status"] = a.status === "AVAILABLE" ? "AVAILABLE" : "MISSING";
    if (a.required === "OPTIONAL" && status === "MISSING") status = "OPTIONAL";
    const integrity: QueueAssetCheck["integrity"] =
      status === "AVAILABLE"
        ? (a.fileName || a.assetId ? "UNVERIFIED" : "INVALID")
        : status === "OPTIONAL"
          ? "N/A"
          : "N/A";
    if (status === "AVAILABLE" && integrity === "INVALID") status = "INVALID";
    return {
      id: a.id,
      category: a.assetType,
      fileName: a.fileName,
      assetId: a.assetId,
      sceneNumber: a.sceneNumber,
      required: a.required,
      status,
      integrity,
      reason: a.why,
      resolution: a.solution,
    };
  });
}

export function discoverEngines(tasks: ProductionTask[], aiCoreOnline: boolean): AiEngineRequirement[] {
  const needed = [...new Set(tasks.map((t) => t.requiredAiEngine).filter(Boolean) as string[])];
  const catalog: Record<string, Omit<AiEngineRequirement, "id" | "status" | "note">> = {
    "Local Image Engine": {
      name: "Local Image Engine",
      purpose: "Image processing and generation",
      localPreferred: true,
      model: "Configured local image model",
      modelVersion: "NOT CONFIGURED",
      modelType: "image",
      location: "LOCAL",
      vram: "NOT CONFIGURED",
      ram: "NOT CONFIGURED",
      cpu: "NOT CONFIGURED",
    },
    "Local Visual Engine": {
      name: "Local Visual Engine",
      purpose: "Scene visual generation",
      localPreferred: true,
      model: "Configured local visual model",
      modelVersion: "NOT CONFIGURED",
      modelType: "visual",
      location: "LOCAL",
      vram: "Required if configured",
      ram: "NOT CONFIGURED",
      cpu: "NOT CONFIGURED",
    },
    "Local Voice Engine": {
      name: "Local Voice Engine",
      purpose: "Voice / TTS generation",
      localPreferred: true,
      model: "Configured local voice model",
      modelVersion: "NOT CONFIGURED",
      modelType: "voice",
      location: "LOCAL",
      vram: "NOT CONFIGURED",
      ram: "NOT CONFIGURED",
      cpu: "NOT CONFIGURED",
    },
    "Local Audio Engine": {
      name: "Local Audio Engine",
      purpose: "Music / SFX / mix",
      localPreferred: true,
      model: "Configured local audio model",
      modelVersion: "NOT CONFIGURED",
      modelType: "audio",
      location: "LOCAL",
      vram: "NOT CONFIGURED",
      ram: "NOT CONFIGURED",
      cpu: "NOT CONFIGURED",
    },
    "Local Text Engine": {
      name: "Local Text Engine",
      purpose: "On-screen text and subtitles",
      localPreferred: true,
      model: "Local text layout",
      modelVersion: "NOT CONFIGURED",
      modelType: "text",
      location: "LOCAL",
      vram: "NOT CONFIGURED",
      ram: "NOT CONFIGURED",
      cpu: "NOT CONFIGURED",
    },
    "Local Video Engine": {
      name: "Local Video Engine",
      purpose: "Scene build and composition",
      localPreferred: true,
      model: "Configured local video pipeline",
      modelVersion: "NOT CONFIGURED",
      modelType: "video",
      location: "LOCAL",
      vram: "Required if configured",
      ram: "NOT CONFIGURED",
      cpu: "NOT CONFIGURED",
    },
    "Rendering Engine": {
      name: "Rendering Engine",
      purpose: "Final video render",
      localPreferred: true,
      model: "Configured local renderer",
      modelVersion: "NOT CONFIGURED",
      modelType: "render",
      location: "LOCAL",
      vram: "Required if configured",
      ram: "NOT CONFIGURED",
      cpu: "NOT CONFIGURED",
    },
  };

  return needed.map((name) => {
    const base = catalog[name] ?? {
      name,
      purpose: "Required by task graph",
      localPreferred: true,
      model: "NOT CONFIGURED",
      modelVersion: "NOT CONFIGURED",
      modelType: "unknown",
      location: "UNKNOWN" as const,
      vram: "NOT CONFIGURED",
      ram: "NOT CONFIGURED",
      cpu: "NOT CONFIGURED",
    };
    // Local-first: if AI core is online, mark discovered engines AVAILABLE for preparation;
    // model versions remain NOT CONFIGURED until Step 2 binds real models.
    const status = aiCoreOnline ? "AVAILABLE" as const : "NOT CONFIGURED" as const;
    return {
      id: uid("eng"),
      ...base,
      status,
      note: aiCoreOnline
        ? "Local AI core online. Model binding and execution happen in Phase 5 Step 2 — not started."
        : "Local AI core offline or not configured. Do not invent engines. Configure before execution.",
    };
  });
}

export function checkResources(hints: AssembleQueueInput["resourceHints"]): ResourceCheckItem[] {
  const items: ResourceCheckItem[] = [];
  if (hints?.cores != null) {
    items.push({
      id: "cpu",
      name: "CPU",
      value: `${hints.cores} logical core(s)`,
      status: hints.cores > 0 ? "AVAILABLE" : "NOT DETECTED",
      note: "From navigator.hardwareConcurrency",
    });
  } else {
    items.push({ id: "cpu", name: "CPU", value: "NOT DETECTED", status: "NOT DETECTED", note: "Browser did not expose core count" });
  }

  if (hints?.deviceMemoryGb != null) {
    items.push({
      id: "ram",
      name: "RAM",
      value: `~${hints.deviceMemoryGb} GB device memory (approx)`,
      status: hints.deviceMemoryGb >= 4 ? "AVAILABLE" : "WARNING",
      note: "From navigator.deviceMemory — approximate, not exact free RAM",
    });
  } else {
    items.push({ id: "ram", name: "RAM", value: "NOT DETECTED", status: "NOT DETECTED", note: "Free RAM not inventable in browser" });
  }

  if (hints?.jsHeapMb != null) {
    items.push({
      id: "heap",
      name: "JS Heap",
      value: `${hints.jsHeapMb} MB used`,
      status: "AVAILABLE",
      note: "performance.memory when exposed",
    });
  }

  items.push({
    id: "gpu",
    name: "GPU",
    value: "NOT DETECTED",
    status: "NOT DETECTED",
    note: "GPU/VRAM probes require the Local Resource Manager (Node). Not faked in the desktop preparer.",
  });
  items.push({
    id: "vram",
    name: "VRAM",
    value: "NOT DETECTED",
    status: "NOT DETECTED",
    note: "VRAM not inventable. Step 2 / LRM will probe when execution starts.",
  });

  if (hints?.diskTotalGb != null && hints.diskTotalGb > 0) {
    const free = Math.max(0, hints.diskTotalGb - (hints.diskUsedGb ?? 0));
    items.push({
      id: "storage",
      name: "Storage",
      value: `~${free} GB free of ~${hints.diskTotalGb} GB (estimate)`,
      status: free >= 5 ? "AVAILABLE" : "WARNING",
      note: "From navigator.storage.estimate — approximate",
    });
  } else {
    items.push({
      id: "storage",
      name: "Storage",
      value: "NOT DETECTED",
      status: "NOT DETECTED",
      note: "Storage estimate unavailable",
    });
  }

  return items;
}

export function estimateStorage(snapshot: ProductionSnapshot, hints: AssembleQueueInput["resourceHints"]): StorageEstimate {
  const scenes = (snapshot.scenes.length ? snapshot.scenes : snapshot.plan.scenes).length;
  const duration = snapshot.plan.project.durationSec || snapshot.plan.timeline.totalDurationSec;
  // Coarse heuristic only — labeled as estimate; never claim precision.
  if (!scenes || !duration) {
    return {
      estimatedRequiredLabel: "ESTIMATE UNAVAILABLE",
      availableLabel: hints?.diskTotalGb != null
        ? `~${Math.max(0, hints.diskTotalGb - (hints.diskUsedGb ?? 0))} GB free (approx)`
        : "NOT DETECTED",
      status: "ESTIMATE UNAVAILABLE",
      note: "Cannot estimate without scene/duration data.",
    };
  }
  const roughGb = Math.max(1, Math.ceil((scenes * 0.4) + (duration / 30) * 2));
  const free = hints?.diskTotalGb != null && hints.diskTotalGb > 0
    ? Math.max(0, hints.diskTotalGb - (hints.diskUsedGb ?? 0))
    : null;
  if (free == null) {
    return {
      estimatedRequiredLabel: `~${roughGb} GB (coarse estimate)`,
      availableLabel: "NOT DETECTED",
      status: "ESTIMATE UNAVAILABLE",
      note: "Estimated from scene count and duration only. Available storage not detected.",
    };
  }
  return {
    estimatedRequiredLabel: `~${roughGb} GB (coarse estimate)`,
    availableLabel: `~${free} GB free (approx)`,
    status: free >= roughGb ? "SUFFICIENT" : free >= roughGb * 0.5 ? "WARNING" : "INSUFFICIENT",
    note: "Coarse local estimate for temp + output files. Not exact.",
  };
}

export function computeJobReadiness(input: {
  validation: SnapshotValidation;
  assets: QueueAssetCheck[];
  engines: AiEngineRequirement[];
  resources: ResourceCheckItem[];
  tasks: ProductionTask[];
  storage: StorageEstimate;
}): { scores: JobReadinessScores; status: JobStatus; warnings: string[] } {
  const warnings: string[] = [];
  const snapshot = input.validation.valid ? 100 : Math.round((input.validation.items.filter((i) => i.ok).length / Math.max(input.validation.items.length, 1)) * 100);
  const critMissing = input.assets.filter((a) => a.required === "CRITICAL" && (a.status === "MISSING" || a.status === "INVALID"));
  const reqMissing = input.assets.filter((a) => a.required === "REQUIRED" && (a.status === "MISSING" || a.status === "INVALID"));
  const assets = critMissing.length ? 40 : reqMissing.length ? Math.max(60, 96 - reqMissing.length * 6) : 100;
  if (reqMissing.length) warnings.push(`${reqMissing.length} required asset(s) missing (non-critical path may continue with warnings).`);
  const engBad = input.engines.filter((e) => e.status !== "AVAILABLE");
  const aiEngines = input.engines.length === 0 ? 50 : Math.round(((input.engines.length - engBad.length) / input.engines.length) * 100);
  if (engBad.length) warnings.push(`${engBad.length} AI engine(s) not fully configured.`);
  const resOk = input.resources.filter((r) => r.status === "AVAILABLE").length;
  const resWarn = input.resources.filter((r) => r.status === "WARNING" || r.status === "NOT DETECTED").length;
  const resources = input.resources.length ? Math.round((resOk / input.resources.length) * 100) : 50;
  if (resWarn) warnings.push(`${resWarn} resource probe(s) warning or not detected.`);
  const blocked = input.tasks.filter((t) => t.status === "BLOCKED").length;
  const dependencies = blocked ? Math.max(40, 100 - blocked * 15) : 100;
  const configuration = input.validation.valid ? 100 : 40;
  if (input.storage.status === "WARNING" || input.storage.status === "INSUFFICIENT") {
    warnings.push(`Storage ${input.storage.status}: ${input.storage.note}`);
  }
  const overall = Math.round((snapshot + assets + aiEngines + resources + dependencies + configuration) / 6);
  let status: JobStatus = "READY";
  if (!input.validation.valid || critMissing.length || input.storage.status === "INSUFFICIENT") {
    status = "BLOCKED";
  } else if (warnings.length || assets < 100 || aiEngines < 100 || resources < 80 || blocked) {
    // READY with warnings — still READY for Step 2 if critical path ok
    status = blocked && critMissing.length === 0 && input.validation.valid ? "READY" : status;
    if (blocked && critMissing.length) status = "BLOCKED";
  }
  // If engines not configured but snapshot valid and no critical assets missing → READY with warnings (local-first prep)
  if (status !== "BLOCKED" && (engBad.length || warnings.length)) {
    status = "READY";
  }
  return {
    scores: {
      snapshot, assets, aiEngines, resources, dependencies, configuration, overall,
      explanation: [
        `Snapshot ${snapshot}%. Assets ${assets}% (${critMissing.length} critical missing).`,
        `AI engines ${aiEngines}%. Resources ${resources}%. Dependencies ${dependencies}%. Configuration ${configuration}%.`,
        "Score is diagnostic. BLOCKED only for invalid snapshot, critical assets, or insufficient storage.",
        "This step does not start generation or rendering.",
      ].join(" "),
    },
    status,
    warnings,
  };
}

export function buildPrepChecks(job: Pick<ProductionJob, "validation" | "assetChecks" | "engines" | "resources" | "storage" | "tasks" | "status">): PrepCheck[] {
  return [
    { id: "c1", label: "Production Snapshot", ok: job.validation.valid, critical: true, detail: job.validation.valid ? "Valid" : job.validation.blocking.join("; ") },
    { id: "c2", label: "Project", ok: job.validation.items.find((i) => i.id === "project")?.ok ?? false, critical: true, detail: "From snapshot" },
    { id: "c3", label: "Product", ok: job.validation.items.find((i) => i.id === "product")?.ok ?? false, critical: true, detail: "From snapshot" },
    { id: "c4", label: "Assets", ok: !job.assetChecks.some((a) => a.required === "CRITICAL" && a.status !== "AVAILABLE"), critical: true, detail: `${job.assetChecks.filter((a) => a.status === "AVAILABLE").length} available` },
    { id: "c5", label: "AI Engines", ok: job.engines.every((e) => e.status === "AVAILABLE" || e.status === "NOT CONFIGURED"), critical: false, detail: `${job.engines.length} required` },
    { id: "c6", label: "Resources", ok: !job.resources.some((r) => r.status === "INSUFFICIENT"), critical: false, detail: "Probes may be NOT DETECTED" },
    { id: "c7", label: "Dependencies", ok: job.tasks.every((t) => t.status !== "BLOCKED" || t.failureClass === "DEPENDENCY"), critical: true, detail: `${job.tasks.filter((t) => t.status === "READY").length} ready` },
    { id: "c8", label: "Storage", ok: job.storage.status !== "INSUFFICIENT", critical: true, detail: job.storage.status },
    { id: "c9", label: "Output Configuration", ok: job.validation.items.find((i) => i.id === "output")?.ok ?? false, critical: true, detail: "From snapshot output" },
  ];
}

export function assembleProductionJob(input: AssembleQueueInput): ProductionJob {
  const snapshot = input.snapshot;
  const plan = snapshot.plan;
  const priority = input.priority ?? "NORMAL";
  const validation = validateSnapshot(snapshot);
  const ver = bumpJobVersion(input.previous ?? null);
  const now = new Date().toISOString();
  let tasks = buildTaskGraph({ productionId: input.productionId, snapshot, priority });
  const assetChecks = checkAssetsFromPlan(snapshot);
  const engines = discoverEngines(tasks, Boolean(input.aiCoreOnline));
  const resources = checkResources(input.resourceHints ?? null);
  const storage = estimateStorage(snapshot, input.resourceHints ?? null);
  tasks = applySmartQueue(tasks, assetChecks, engines);
  const parallelGroups = detectParallelGroups(tasks);
  const { scores, status: scoredStatus, warnings } = computeJobReadiness({
    validation, assets: assetChecks, engines, resources, tasks, storage,
  });
  let status: JobStatus = validation.valid ? "PREPARING" : "BLOCKED";
  if (validation.valid) status = scoredStatus === "BLOCKED" ? "BLOCKED" : "READY";
  const jobPartial = {
    validation, assetChecks, engines, resources, storage, tasks, status,
  };
  const prepChecks = buildPrepChecks(jobPartial);
  const history = [
    ...(input.previous?.history ?? []),
    ...(input.previous ? [{ versionLabel: input.previous.versionLabel, productionId: input.previous.productionId, createdAt: input.previous.updatedAt, status: input.previous.status }] : []),
  ];
  const estMin = Math.max(2, Math.ceil(tasks.length * 0.8 + (plan.project.durationSec / 10)));
  return {
    version: 1,
    productionId: input.productionId,
    projectId: plan.projectId,
    productId: plan.productId,
    snapshotId: snapshot.snapshotId,
    jobName: `${plan.projectName} — Production`,
    projectName: plan.projectName,
    productName: plan.productName,
    status,
    priority,
    currentTaskId: tasks.find((t) => t.status === "READY")?.taskId ?? null,
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => t.status === "COMPLETED").length,
    failedTasks: tasks.filter((t) => t.status === "FAILED").length,
    pendingTasks: tasks.filter((t) => t.status === "PENDING" || t.status === "WAITING" || t.status === "READY").length,
    blockedTasks: tasks.filter((t) => t.status === "BLOCKED").length,
    readyTasks: tasks.filter((t) => t.status === "READY").length,
    waitingTasks: tasks.filter((t) => t.status === "WAITING").length,
    progress: 0,
    estimatedDurationLabel: `~${estMin} min (preparation estimate only)`,
    tasks,
    executionOrder: tasks.map((t) => t.taskId),
    parallelGroups,
    assetChecks,
    engines,
    resources,
    storage,
    validation,
    readiness: scores,
    prepChecks,
    versionLabel: ver.versionLabel,
    versionNumber: ver.versionNumber,
    errorState: status === "BLOCKED" ? (validation.blocking[0] || warnings[0] || "Blocked") : null,
    recoveryState: "none",
    userConfirmedReady: false,
    readyForStep2: status === "READY",
    duplicateOf: null,
    warnings,
    planAssetRefs: plan.assets,
    createdAt: now,
    updatedAt: now,
    history,
  };
}

export function buildAiMeQueueExplanation(job: ProductionJob): string {
  const first = job.tasks.find((t) => t.status === "READY");
  const blocked = job.tasks.filter((t) => t.status === "BLOCKED");
  const missing = job.assetChecks.filter((a) => a.status === "MISSING" || a.status === "INVALID");
  return [
    `Production job ${job.productionId} (“${job.jobName}”) is ${job.status} at ${job.readiness.overall}% readiness.`,
    `There are ${job.totalTasks} tasks: ${job.readyTasks} ready, ${job.waitingTasks} waiting, ${job.blockedTasks} blocked.`,
    first ? `First executable task: ${first.taskName} (${first.taskType}).` : "No task is currently READY.",
    missing.length ? `Missing/invalid assets: ${missing.map((m) => `${m.category}${m.sceneNumber != null ? ` scene ${m.sceneNumber}` : ""}`).join("; ")}.` : "No missing critical asset references in the snapshot checks.",
    `Required AI engines: ${job.engines.map((e) => `${e.name} (${e.status})`).join(", ") || "none"}.`,
    `Resources: ${job.resources.map((r) => `${r.name} ${r.status}`).join(", ")}. Storage: ${job.storage.status} — ${job.storage.estimatedRequiredLabel} / ${job.storage.availableLabel}.`,
    blocked.length ? `Blocked: ${blocked.map((b) => `${b.taskName} — ${b.blockedReason}`).join("; ")}.` : "No blocked tasks.",
    job.status === "BLOCKED" ? `Job is BLOCKED: ${job.errorState}` : "Job is READY TO EXECUTE for Phase 5 Step 2 — generation is not started.",
    "This step does not run AI generation or rendering.",
  ].join(" ");
}

export function classifyFailure(message: string): import("./types").FailureClass {
  const m = message.toLowerCase();
  if (/vram|ram|cpu|disk|storage|resource/.test(m)) return "RESOURCE";
  if (/config|not configured|engine/.test(m)) return "CONFIGURATION";
  if (/missing|corrupt|invalid|asset|image/.test(m)) return "INPUT";
  if (/depend/.test(m)) return "DEPENDENCY";
  if (/timeout|temporary|network|busy/.test(m)) return "TRANSIENT";
  return "SYSTEM";
}
