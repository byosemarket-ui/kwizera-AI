import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ProductAssetPreparationManager } from "../product-asset-preparation/product-asset-preparation-manager.js";
import type { ProductAssetPreparationResult } from "../product-asset-preparation/types.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import type { ProductScenePlanningManager } from "../product-scene-planning/product-scene-planning-manager.js";
import type { ProductScenePlanResult } from "../product-scene-planning/types.js";
import type { ProductStoryboardManager } from "../product-storyboard/product-storyboard-manager.js";
import type { ProductStoryboardResult, StoryboardScenePanel } from "../product-storyboard/types.js";
import type {
  AiMeProductPromptOrchestrationAwareness,
  ConsistencyLocks,
  ExecutionPlan,
  ExecutionPlanTask,
  ModelRole,
  ModelSelection,
  ProductPromptOrchestrationExplainResult,
  ProductPromptOrchestrationHealthReport,
  ProductPromptOrchestrationResult,
  ProductPromptOrchestrationStore,
  PromptKind,
  PromptOrchestrationQuality,
  ScenePromptSet,
} from "./types.js";

const EMPTY: ProductPromptOrchestrationStore = { orchestrations: [], cache: {}, history: [], logs: [] };

const PROMPT_KINDS: PromptKind[] = [
  "image", "video", "animation", "camera", "lighting", "background", "audio", "voice", "subtitle", "rendering",
];

/** Model-agnostic catalog — IDs can be swapped without changing orchestration workflow. */
const MODEL_CATALOG: Record<ModelRole, { best: string; backup: string; output: string }> = {
  "image-generation": { best: "local-image-gen-primary", backup: "local-image-gen-fallback", output: "scene still / keyframe PNG" },
  "video-generation": { best: "local-video-gen-primary", backup: "local-video-gen-fallback", output: "scene motion clip" },
  "audio-generation": { best: "local-audio-gen-primary", backup: "local-audio-gen-fallback", output: "bed / SFX bed" },
  "voice-generation": { best: "local-voice-gen-primary", backup: "local-voice-gen-fallback", output: "narration WAV" },
  "background-removal": { best: "local-bg-removal-primary", backup: "product-asset-cutout-library", output: "transparent product asset" },
  upscaling: { best: "local-upscaler-primary", backup: "local-upscaler-fallback", output: "upscaled frame" },
  rendering: { best: "local-render-compose-primary", backup: "local-render-compose-fallback", output: "composed scene render" },
};

/** Step 5 runtime: optimized prompts + model-agnostic execution plans from Steps 1–4. Does not generate images/videos. */
export class ProductPromptOrchestrationManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private products: ProductIntelligenceManager | null = null;
  private assets: ProductAssetPreparationManager | null = null;
  private scenes: ProductScenePlanningManager | null = null;
  private storyboards: ProductStoryboardManager | null = null;
  private store: ProductPromptOrchestrationStore = structuredClone(EMPTY);

  readonly prompts = new PromptIntelligenceEngine();
  readonly models = new ModelOrchestrationEngine();
  readonly planner = new ExecutionPlanEngine();
  readonly consistency = new ConsistencyManager();
  readonly quality = new PromptOrchestrationQualityEngine();
  readonly health = new ProductPromptOrchestrationHealthManager(this);

  async initialize(
    storageRoot: string,
    dependencies: {
      core: AiCoreManager;
      workspace: CreativeWorkspaceManager;
      products: ProductIntelligenceManager;
      assets: ProductAssetPreparationManager;
      scenes: ProductScenePlanningManager;
      storyboards: ProductStoryboardManager;
    },
  ): Promise<void> {
    this.root = path.join(storageRoot, "product-prompt-orchestration-runtime");
    this.core = dependencies.core;
    this.workspace = dependencies.workspace;
    this.products = dependencies.products;
    this.assets = dependencies.assets;
    this.scenes = dependencies.scenes;
    this.storyboards = dependencies.storyboards;
    await fs.mkdir(this.root, { recursive: true });
    this.store = await this.readStore();
    this.log("info", "Product prompt orchestration runtime restored.");
    await this.persist();
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace && this.products && this.assets && this.scenes && this.storyboards);
  }

  async orchestratePromptsAndModels(projectId: string): Promise<ProductPromptOrchestrationResult> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");

    const product = (await this.products!.getProfile(projectId))
      ?? (await this.products!.analyzeProductIntelligence(projectId));
    const prepared = (await this.assets!.getResult(projectId))
      ?? (await this.assets!.prepareProductAssets(projectId));
    if (!prepared.assets.length) throw new Error("Prepare product assets before prompt orchestration.");
    const scenePlan = (await this.scenes!.getPlan(projectId))
      ?? (await this.scenes!.planProductScenes(projectId));
    const storyboard = (await this.storyboards!.getStoryboard(projectId))
      ?? (await this.storyboards!.generateStoryboardAndScript(projectId));
    if (!storyboard.panels.length) throw new Error("Generate storyboard before prompt orchestration.");

    const cacheKey = this.cacheKey(project, product, prepared, scenePlan, storyboard);
    const cachedId = this.store.cache[cacheKey];
    const cached = cachedId ? this.store.orchestrations.find((item) => item.orchestrationId === cachedId) : undefined;
    if (cached) return { ...cached, cached: true };

    const locks = this.consistency.build(product, prepared, storyboard);
    let scenePromptSets = this.prompts.generateAll(storyboard, product, project, locks);
    scenePromptSets = this.prompts.optimizeAll(scenePromptSets, locks, product);
    let modelSelections = this.models.selectForStoryboard(storyboard, prepared);
    let executionPlan = this.planner.build(storyboard, modelSelections);
    let promptConflicts = this.prompts.detectConflicts(scenePromptSets, locks);
    let orchestrationFailures = this.models.detectFailures(modelSelections, executionPlan);
    let quality = this.quality.evaluate(scenePromptSets, modelSelections, executionPlan, promptConflicts, orchestrationFailures);
    const repairs: string[] = [];

    if (quality.issues.length) {
      const repaired = this.applyQualityRepairs(scenePromptSets, modelSelections, executionPlan, locks, product, storyboard, prepared, quality.issues);
      scenePromptSets = repaired.scenePromptSets;
      modelSelections = repaired.modelSelections;
      executionPlan = repaired.executionPlan;
      promptConflicts = this.prompts.detectConflicts(scenePromptSets, locks);
      orchestrationFailures = this.models.detectFailures(modelSelections, executionPlan);
      repairs.push(...repaired.repairs);
      quality = this.quality.evaluate(scenePromptSets, modelSelections, executionPlan, promptConflicts, orchestrationFailures);
      quality.repairs = repairs;
    }

    const now = new Date().toISOString();
    const result: ProductPromptOrchestrationResult = {
      orchestrationId: randomUUID(),
      projectId,
      productId: product.id,
      storyboardId: storyboard.storyboardId,
      scenePromptSets,
      modelSelections,
      executionPlan,
      consistency: locks,
      promptConflicts,
      orchestrationFailures,
      improvementRecommendations: this.buildImprovements(scenePromptSets, promptConflicts, orchestrationFailures, quality),
      quality,
      creativePipelineStep: 5,
      imageGenerationDeferred: true,
      videoGenerationDeferred: true,
      createdAt: now,
      updatedAt: now,
      cached: false,
    };

    this.store.orchestrations = this.store.orchestrations.filter((item) => item.projectId !== projectId);
    this.store.orchestrations.unshift(result);
    this.store.cache[cacheKey] = result.orchestrationId;
    this.history(projectId, "orchestrate", `Orchestrated ${result.scenePromptSets.length} scene prompt set(s) with ${result.modelSelections.length} model selection(s).`);
    this.log("info", `Prompt orchestration ready for ${project.name}.`);
    await this.persist();
    return structuredClone(result);
  }

  async getOrchestration(projectId: string): Promise<ProductPromptOrchestrationResult | null> {
    return this.store.orchestrations.find((item) => item.projectId === projectId) ?? null;
  }

  async explainOrchestration(projectId: string): Promise<ProductPromptOrchestrationExplainResult> {
    const result = (await this.getOrchestration(projectId)) ?? (await this.orchestratePromptsAndModels(projectId));
    const promptExplanations = result.scenePromptSets.flatMap((set) =>
      (["image", "video", "voice"] as PromptKind[]).map((kind) => ({
        sceneNumber: set.sceneNumber,
        kind,
        prompt: set.prompts[kind],
        why: `Scene ${set.sceneNumber} ${kind} prompt locked to product "${set.productName}" and asset ${set.assetId || "n/a"}.`,
      })),
    );
    return {
      orchestrationId: result.orchestrationId,
      productName: result.consistency.productName,
      summary: `Prompt orchestration for ${result.consistency.productName}: ${result.scenePromptSets.length} scene(s), ${result.modelSelections.length} model task(s). Image/video generation deferred.`,
      modelExplanations: result.modelSelections.map((selection) => ({
        taskId: selection.taskId,
        why: selection.whySelected,
      })),
      promptExplanations,
      improvementRecommendations: result.improvementRecommendations,
      promptConflicts: result.promptConflicts,
      orchestrationFailures: result.orchestrationFailures,
      readyForImageGeneration: result.quality.overall >= 70 && result.promptConflicts.length === 0,
    };
  }

  async recommendPromptImprovements(projectId: string): Promise<string[]> {
    const result = (await this.getOrchestration(projectId)) ?? (await this.orchestratePromptsAndModels(projectId));
    return [...result.improvementRecommendations];
  }

  async detectPromptConflicts(projectId: string): Promise<string[]> {
    const result = (await this.getOrchestration(projectId)) ?? (await this.orchestratePromptsAndModels(projectId));
    return [...result.promptConflicts];
  }

  async detectOrchestrationFailures(projectId: string): Promise<string[]> {
    const result = (await this.getOrchestration(projectId)) ?? (await this.orchestratePromptsAndModels(projectId));
    return [...result.orchestrationFailures];
  }

  getAiMeProductPromptOrchestrationAwareness(): AiMeProductPromptOrchestrationAwareness {
    const available = this.isInitialized();
    return {
      available,
      enabled: available,
      offlineFirst: true,
      canExplainModelSelection: available,
      canExplainPrompts: available,
      canRecommendPromptImprovements: available,
      canDetectPromptConflicts: available,
      canDetectOrchestrationFailures: available,
      imageGenerationDeferred: true,
      videoGenerationDeferred: true,
      summary: available
        ? "AI Me Prompt Intelligence is online: explain model selection and prompts, recommend improvements, detect conflicts and orchestration failures. Image and video generation remain deferred."
        : "Product Prompt Orchestration runtime is not initialized.",
    };
  }

  async runHealthCheck(projectId?: string): Promise<ProductPromptOrchestrationHealthReport> {
    return this.health.check(projectId);
  }

  async repair(projectId?: string): Promise<ProductPromptOrchestrationHealthReport> {
    return this.health.repair(projectId);
  }

  async getDashboard(projectId?: string): Promise<{
    orchestrations: ProductPromptOrchestrationResult[];
    history: ProductPromptOrchestrationStore["history"];
    logs: ProductPromptOrchestrationStore["logs"];
    awareness: AiMeProductPromptOrchestrationAwareness;
    analytics: Record<string, number>;
  }> {
    const orchestrations = this.store.orchestrations.filter((item) => !projectId || item.projectId === projectId);
    return {
      orchestrations: structuredClone(orchestrations),
      history: this.store.history.filter((item) => !projectId || item.projectId === projectId),
      logs: [...this.store.logs],
      awareness: this.getAiMeProductPromptOrchestrationAwareness(),
      analytics: {
        orchestrations: orchestrations.length,
        averageScenes: orchestrations.length
          ? Math.round(orchestrations.reduce((sum, item) => sum + item.scenePromptSets.length, 0) / orchestrations.length)
          : 0,
        averageQuality: orchestrations.length
          ? Math.round(orchestrations.reduce((sum, item) => sum + item.quality.overall, 0) / orchestrations.length)
          : 0,
        cached: Object.keys(this.store.cache).length,
      },
    };
  }

  async persist(): Promise<void> {
    await fs.writeFile(path.join(this.root, "orchestrations.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
  }

  log(level: "info" | "warning" | "error", message: string): void {
    this.store.logs.unshift({ at: new Date().toISOString(), level, message });
    this.store.logs.splice(100);
    this.core?.logger.info("product-prompt-orchestration", message);
  }

  history(projectId: string, event: string, detail: string): void {
    this.store.history.unshift({ id: randomUUID(), at: new Date().toISOString(), projectId, event, detail });
    this.store.history.splice(100);
  }

  private cacheKey(
    project: CreativeProject,
    product: ProductIntelligenceProfile,
    prepared: ProductAssetPreparationResult,
    scenePlan: ProductScenePlanResult,
    storyboard: ProductStoryboardResult,
  ): string {
    return createHash("sha256")
      .update(JSON.stringify({
        projectId: project.id,
        productId: product.id,
        storyboardId: storyboard.storyboardId,
        planId: scenePlan.planId,
        assets: prepared.assets.map((asset) => [asset.assetId, asset.fingerprint]),
        panels: storyboard.panels.map((panel) => [panel.sceneId, panel.assetId]),
      }))
      .digest("hex");
  }

  private applyQualityRepairs(
    scenePromptSets: ScenePromptSet[],
    modelSelections: ModelSelection[],
    executionPlan: ExecutionPlan,
    locks: ConsistencyLocks,
    product: ProductIntelligenceProfile,
    storyboard: ProductStoryboardResult,
    prepared: ProductAssetPreparationResult,
    issues: string[],
  ): {
    scenePromptSets: ScenePromptSet[];
    modelSelections: ModelSelection[];
    executionPlan: ExecutionPlan;
    repairs: string[];
  } {
    const repairs: string[] = [];
    let nextPrompts = [...scenePromptSets];
    let nextModels = [...modelSelections];
    let nextPlan = executionPlan;

    if (issues.some((issue) => issue.includes("duplicate prompts"))) {
      nextPrompts = this.prompts.dedupe(nextPrompts);
      repairs.push("deduplicated-prompts");
    }
    if (issues.some((issue) => issue.includes("consistency"))) {
      nextPrompts = this.prompts.optimizeAll(nextPrompts, locks, product);
      repairs.push("reapplied-consistency-locks");
    }
    if (issues.some((issue) => issue.includes("missing prompt"))) {
      nextPrompts = this.prompts.generateAll(storyboard, product, {
        targetAudience: locks.brandIdentity,
        productInformation: { name: product.productName, category: product.category, description: product.description },
        brandInformation: { name: locks.logo === "unconfirmed" ? "" : locks.logo },
        campaignInformation: { name: "", objective: storyboard.marketingObjective },
      } as CreativeProject, locks);
      nextPrompts = this.prompts.optimizeAll(nextPrompts, locks, product);
      repairs.push("regenerated-missing-prompts");
    }
    if (issues.some((issue) => issue.includes("model selection"))) {
      nextModels = this.models.selectForStoryboard(storyboard, prepared);
      repairs.push("reselected-models");
    }
    if (issues.some((issue) => issue.includes("execution plan"))) {
      nextPlan = this.planner.build(storyboard, nextModels);
      repairs.push("rebuilt-execution-plan");
    }
    return { scenePromptSets: nextPrompts, modelSelections: nextModels, executionPlan: nextPlan, repairs };
  }

  private buildImprovements(
    sets: ScenePromptSet[],
    conflicts: string[],
    failures: string[],
    quality: PromptOrchestrationQuality,
  ): string[] {
    const tips: string[] = [];
    if (conflicts.length) tips.push(...conflicts.slice(0, 3));
    if (failures.length) tips.push(...failures.slice(0, 3));
    if (quality.promptConsistencyScore < 85) tips.push("Strengthen shared brand/camera/lighting locks across scene prompts.");
    if (sets.some((set) => set.optimizationNotes.length === 0)) tips.push("Add explicit product-accuracy constraints to every image/video prompt.");
    if (!tips.length) tips.push("Prompt orchestration is ready for the Image Generation Pipeline.");
    return tips;
  }

  private async readStore(): Promise<ProductPromptOrchestrationStore> {
    try {
      const value = JSON.parse(await fs.readFile(path.join(this.root, "orchestrations.json"), "utf8")) as Partial<ProductPromptOrchestrationStore>;
      return {
        ...structuredClone(EMPTY),
        ...value,
        orchestrations: value.orchestrations ?? [],
        cache: value.cache ?? {},
        history: value.history ?? [],
        logs: value.logs ?? [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY);
      throw error;
    }
  }

  private ensureReady(): void {
    if (!this.isInitialized()) throw new Error("Product Prompt Orchestration Manager is not initialized");
  }
}

export class PromptIntelligenceEngine {
  generateAll(
    storyboard: ProductStoryboardResult,
    product: ProductIntelligenceProfile,
    project: CreativeProject,
    locks: ConsistencyLocks,
  ): ScenePromptSet[] {
    return storyboard.panels.map((panel) => this.generateForPanel(panel, product, project, locks, storyboard.marketingScript.fullNarration));
  }

  generateForPanel(
    panel: StoryboardScenePanel,
    product: ProductIntelligenceProfile,
    project: CreativeProject,
    locks: ConsistencyLocks,
    fullNarration: string,
  ): ScenePromptSet {
    const colors = locks.colors.join(", ") || "as in source product photos";
    const brand = locks.logo !== "unconfirmed" ? locks.logo : "";
    const productLock = `exact product "${product.productName}" from uploaded asset ${panel.assetId}, view ${panel.productView}, do not invent specifications`;
    const prompts: Record<PromptKind, string> = {
      image: `Professional product still of ${productLock}. Position: ${panel.productPosition}. ${panel.sceneDescription} Colors: ${colors}. Style: ${locks.style}. Brand: ${brand || "no invented logo"}.`,
      video: `Cinematic product motion for ${productLock}. Duration ${panel.durationSeconds}s. Camera ${panel.cameraAngle} with ${panel.cameraMovement}. ${panel.visual.motionInstructions}. Keep product identity locked.`,
      animation: `Animation: ${panel.animationInstructions}. Product remains ${product.productName}; no morphing away from uploaded silhouette.`,
      camera: `Camera plan: ${panel.visual.cameraInstructions}. Language: ${locks.cameraLanguage}.`,
      lighting: `Lighting plan: ${panel.visual.lightingInstructions}. Lock lighting language: ${locks.lightingStyle}.`,
      background: `Background: ${panel.visual.backgroundInstructions}. Do not replace the product; product cutout stays primary.`,
      audio: `Audio bed supporting ${panel.marketingBeat} beat for ${product.productName}. Keep mix clear for narration.`,
      voice: `Voiceover: "${panel.voice.narration}" Pace ${panel.voice.speakingPace}, tone ${panel.voice.tone}, emotion ${panel.voice.emotion}, emphasize ${panel.voice.emphasis.join(", ")}.`,
      subtitle: `On-screen text: "${panel.onScreenText}". CTA placement: ${panel.ctaPlacement}. Price placement: ${panel.productPricePlacement}.`,
      rendering: `Render compose scene ${panel.sceneNumber} with prepared cutout ${panel.assetId}, transition ${panel.transition}, brand lock ${locks.brandIdentity}.`,
    };
    // Touch fullNarration lightly for voice continuity without inventing copy.
    if (fullNarration && panel.sceneNumber === 1) {
      prompts.voice = `${prompts.voice} Continuity with campaign narration arc.`;
    }
    const promptIds = Object.fromEntries(PROMPT_KINDS.map((kind) => [kind, createHash("sha256").update(`${panel.sceneId}:${kind}:${prompts[kind]}`).digest("hex").slice(0, 16)])) as Record<PromptKind, string>;
    return {
      sceneNumber: panel.sceneNumber,
      sceneId: panel.sceneId,
      prompts,
      promptIds,
      assetId: panel.assetId,
      sourceImageId: panel.sourceImageId,
      productName: product.productName,
      optimizationNotes: [],
      conflicts: [],
    };
  }

  optimizeAll(sets: ScenePromptSet[], locks: ConsistencyLocks, product: ProductIntelligenceProfile): ScenePromptSet[] {
    return sets.map((set) => {
      const notes = [
        "professional-quality",
        "product-accuracy",
        "marketing-quality",
        "camera-consistency",
        "lighting-consistency",
        "product-consistency",
        "background-consistency",
      ];
      const prompts = { ...set.prompts };
      for (const kind of PROMPT_KINDS) {
        prompts[kind] = `${prompts[kind]} Consistency locks: product=${locks.productName}; colors=${locks.colors.join("/") || "source"}; style=${locks.style}; camera=${locks.cameraLanguage}; lighting=${locks.lightingStyle}; brand=${locks.brandIdentity}. No invented ${product.productName} specs.`;
      }
      return { ...set, prompts, optimizationNotes: notes, promptIds: rehash(set.sceneId, prompts) };
    });
  }

  dedupe(sets: ScenePromptSet[]): ScenePromptSet[] {
    const seen = new Set<string>();
    return sets.map((set) => {
      const prompts = { ...set.prompts };
      for (const kind of PROMPT_KINDS) {
        const key = `${kind}:${prompts[kind]}`;
        if (seen.has(key)) {
          prompts[kind] = `${prompts[kind]} [scene-${set.sceneNumber}-unique]`;
        }
        seen.add(`${kind}:${prompts[kind]}`);
      }
      return { ...set, prompts, promptIds: rehash(set.sceneId, prompts) };
    });
  }

  detectConflicts(sets: ScenePromptSet[], locks: ConsistencyLocks): string[] {
    const conflicts: string[] = [];
    for (const set of sets) {
      if (!set.prompts.image.includes(locks.productName)) conflicts.push(`Scene ${set.sceneNumber} image prompt missing product name lock.`);
      if (set.assetId && !set.prompts.image.includes(set.assetId)) conflicts.push(`Scene ${set.sceneNumber} image prompt missing asset id.`);
      if (risksInventedProductContent(set.prompts.image) || risksInventedProductContent(set.prompts.video)) {
        conflicts.push(`Scene ${set.sceneNumber} prompt risks invented product content.`);
      }
    }
    const idCounts = new Map<string, number>();
    for (const set of sets) {
      for (const kind of PROMPT_KINDS) {
        const id = set.promptIds[kind];
        idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
      }
    }
    for (const [id, count] of idCounts) {
      if (count > 1) conflicts.push(`Duplicate prompt fingerprint ${id} detected.`);
    }
    return conflicts;
  }
}

export class ModelOrchestrationEngine {
  selectForStoryboard(storyboard: ProductStoryboardResult, prepared: ProductAssetPreparationResult): ModelSelection[] {
    const selections: ModelSelection[] = [];
    for (const panel of storyboard.panels) {
      const roles: ModelRole[] = ["image-generation", "video-generation", "voice-generation", "audio-generation", "upscaling", "rendering"];
      if (!panel.assetId || prepared.assets.every((asset) => asset.assetId !== panel.assetId)) {
        roles.unshift("background-removal");
      }
      for (const role of roles) {
        const catalog = MODEL_CATALOG[role];
        selections.push({
          taskId: `${panel.sceneNumber}-${role}`,
          sceneNumber: panel.sceneNumber,
          role,
          bestModelId: catalog.best,
          backupModelId: catalog.backup,
          expectedOutput: catalog.output,
          requiredInput: requiredInputs(role, panel),
          qualityTarget: "professional marketing quality",
          performanceTarget: "offline-first local execution",
          whySelected: `${role} best=${catalog.best} for scene ${panel.sceneNumber}; backup=${catalog.backup}; swappable without workflow change.`,
          swappable: true,
        });
      }
    }
    return selections;
  }

  detectFailures(selections: ModelSelection[], plan: ExecutionPlan): string[] {
    const failures: string[] = [];
    if (!selections.length) failures.push("No model selections produced.");
    if (!plan.tasks.length) failures.push("Execution plan has no tasks.");
    if (selections.some((item) => !item.bestModelId || !item.backupModelId)) failures.push("Model selection incomplete.");
    const roles = new Set(selections.map((item) => item.role));
    for (const required of ["image-generation", "video-generation", "voice-generation", "rendering"] as ModelRole[]) {
      if (!roles.has(required)) failures.push(`Missing orchestration role: ${required}`);
    }
    return failures;
  }
}

export class ExecutionPlanEngine {
  build(storyboard: ProductStoryboardResult, selections: ModelSelection[]): ExecutionPlan {
    const roleOrder: ModelRole[] = ["background-removal", "image-generation", "upscaling", "voice-generation", "audio-generation", "video-generation", "rendering"];
    const tasks: ExecutionPlanTask[] = [];
    let order = 1;
    for (const panel of storyboard.panels) {
      const sceneSelections = selections.filter((item) => item.sceneNumber === panel.sceneNumber);
      for (const role of roleOrder) {
        const selection = sceneSelections.find((item) => item.role === role);
        if (!selection) continue;
        const dependsOn = dependencyFor(role, panel.sceneNumber, tasks);
        tasks.push({
          taskId: selection.taskId,
          sceneNumber: panel.sceneNumber,
          role,
          modelId: selection.bestModelId,
          dependsOn,
          parallelGroup: parallelGroupFor(role, panel.sceneNumber),
          order: order++,
          failureRecovery: `Switch to backup model ${selection.backupModelId} and continue scene ${panel.sceneNumber}.`,
          retryStrategy: "retry-once-then-backup",
        });
      }
    }
    const dependencies = tasks.flatMap((task) => task.dependsOn.map((from) => ({ from, to: task.taskId })));
    const parallelTasks = tasks.filter((task) => task.role === "voice-generation" || task.role === "audio-generation").map((task) => task.taskId);
    return {
      planId: randomUUID(),
      modelExecutionOrder: roleOrder,
      sceneExecutionOrder: storyboard.panels.map((panel) => panel.sceneNumber),
      parallelTasks,
      dependencies,
      tasks,
      failureRecovery: "Per-task backup model swap; do not modify original product assets.",
      retryStrategy: "retry-once-then-backup; skip non-critical audio if both models unavailable",
    };
  }
}

export class ConsistencyManager {
  build(
    product: ProductIntelligenceProfile,
    prepared: ProductAssetPreparationResult,
    storyboard: ProductStoryboardResult,
  ): ConsistencyLocks {
    const colourList = (product.colours ?? []).filter((item) => !String(item).includes("verification"));
    return {
      productName: product.productName,
      colors: colourList,
      logo: product.brand && !product.brand.includes("requires") ? product.brand : "unconfirmed",
      style: "professional product marketing",
      cameraLanguage: majority(storyboard.panels.map((panel) => panel.cameraAngle)) || "product-centric framing",
      lightingStyle: majority(storyboard.panels.map((panel) => panel.lightingStyle)) || "commercial product lighting",
      brandIdentity: product.brand && !product.brand.includes("requires")
        ? `${product.brand} / ${product.productName}`
        : product.productName,
      assetIds: prepared.assets.map((asset) => asset.assetId),
    };
  }
}

export class PromptOrchestrationQualityEngine {
  evaluate(
    sets: ScenePromptSet[],
    selections: ModelSelection[],
    plan: ExecutionPlan,
    conflicts: string[],
    failures: string[],
  ): PromptOrchestrationQuality {
    const issues: string[] = [];
    if (!sets.length) issues.push("missing prompt sets");
    for (const set of sets) {
      for (const kind of PROMPT_KINDS) {
        if (!set.prompts[kind]?.trim()) issues.push("missing prompt");
      }
    }
    if (conflicts.some((item) => item.includes("Duplicate"))) issues.push("duplicate prompts");
    if (conflicts.some((item) => item.includes("missing product") || item.includes("missing asset"))) issues.push("consistency");
    if (!selections.length || failures.some((item) => item.includes("Missing orchestration"))) issues.push("model selection");
    if (!plan.tasks.length || plan.sceneExecutionOrder.length === 0) issues.push("execution plan");

    const promptGenerationScore = Math.min(100, sets.length * 8 + PROMPT_KINDS.length * 2);
    const promptQualityScore = sets.every((set) => set.optimizationNotes.length >= 5) ? 92 : 65;
    const promptConsistencyScore = conflicts.length === 0 ? 94 : Math.max(40, 90 - conflicts.length * 10);
    const modelSelectionScore = selections.length >= sets.length * 4 ? 90 : 60;
    const executionPlanScore = plan.tasks.length >= sets.length * 4 ? 90 : 55;
    const orchestrationScore = failures.length === 0 ? 92 : Math.max(40, 85 - failures.length * 12);
    const overall = Math.round(
      (promptGenerationScore + promptQualityScore + promptConsistencyScore + modelSelectionScore + executionPlanScore + orchestrationScore) / 6,
    );
    return {
      promptGenerationScore: Math.min(100, promptGenerationScore),
      promptQualityScore,
      promptConsistencyScore,
      modelSelectionScore,
      executionPlanScore,
      orchestrationScore,
      overall,
      issues,
      repairs: [],
    };
  }
}

export class ProductPromptOrchestrationHealthManager {
  constructor(private readonly manager: ProductPromptOrchestrationManager) {}

  async check(projectId?: string): Promise<ProductPromptOrchestrationHealthReport> {
    const checks: ProductPromptOrchestrationHealthReport["checks"] = [];
    checks.push({
      name: "runtime-initialized",
      passed: this.manager.isInitialized(),
      detail: this.manager.isInitialized() ? "ready" : "not initialized",
    });
    const awareness = this.manager.getAiMeProductPromptOrchestrationAwareness();
    checks.push({
      name: "ai-me-awareness",
      passed: awareness.available && awareness.canExplainPrompts && awareness.imageGenerationDeferred,
      detail: awareness.summary,
    });
    if (projectId) {
      try {
        const result = await this.manager.orchestratePromptsAndModels(projectId);
        checks.push({
          name: "prompt-generation",
          passed: result.scenePromptSets.length >= 4 && result.scenePromptSets.every((set) => PROMPT_KINDS.every((kind) => set.prompts[kind])),
          detail: `scenes=${result.scenePromptSets.length}; score=${result.quality.promptGenerationScore}`,
        });
        checks.push({
          name: "prompt-quality",
          passed: result.quality.promptQualityScore >= 70,
          detail: `quality=${result.quality.promptQualityScore}`,
        });
        checks.push({
          name: "prompt-consistency",
          passed: result.quality.promptConsistencyScore >= 70 && result.promptConflicts.length === 0,
          detail: `consistency=${result.quality.promptConsistencyScore}; conflicts=${result.promptConflicts.length}`,
        });
        checks.push({
          name: "model-selection",
          passed: result.quality.modelSelectionScore >= 70 && result.modelSelections.every((item) => item.swappable),
          detail: `models=${result.modelSelections.length}`,
        });
        checks.push({
          name: "execution-plan",
          passed: result.quality.executionPlanScore >= 70 && result.executionPlan.tasks.length > 0,
          detail: `tasks=${result.executionPlan.tasks.length}`,
        });
        checks.push({
          name: "orchestration-logic",
          passed: result.quality.orchestrationScore >= 70 && result.orchestrationFailures.length === 0,
          detail: `orchestration=${result.quality.orchestrationScore}`,
        });
        checks.push({
          name: "no-image-video-gen",
          passed: result.imageGenerationDeferred && result.videoGenerationDeferred,
          detail: "image/video generation deferred",
        });
      } catch (error) {
        checks.push({
          name: "prompt-generation",
          passed: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const criticalIssues = checks.filter((check) => !check.passed).map((check) => `${check.name}: ${check.detail}`);
    return { healthy: criticalIssues.length === 0, checks, repaired: [], criticalIssues };
  }

  async repair(projectId?: string): Promise<ProductPromptOrchestrationHealthReport> {
    const repaired: string[] = [];
    if (!this.manager.isInitialized()) {
      return {
        healthy: false,
        checks: [{ name: "runtime-initialized", passed: false, detail: "Cannot repair uninitialized runtime" }],
        repaired,
        criticalIssues: ["runtime-initialized"],
      };
    }
    if (projectId) {
      this.manager["store"].orchestrations = this.manager["store"].orchestrations.filter((item) => item.projectId !== projectId);
      for (const [key, id] of Object.entries(this.manager["store"].cache)) {
        if (!this.manager["store"].orchestrations.some((item) => item.orchestrationId === id)) delete this.manager["store"].cache[key];
      }
      repaired.push("cleared-project-orchestration-cache");
      await this.manager.orchestratePromptsAndModels(projectId);
      repaired.push("re-orchestrated-prompts-and-models");
    }
    await this.manager.persist();
    repaired.push("persisted-orchestrations");
    const report = await this.check(projectId);
    return { ...report, repaired };
  }
}

function rehash(sceneId: string, prompts: Record<PromptKind, string>): Record<PromptKind, string> {
  return Object.fromEntries(
    PROMPT_KINDS.map((kind) => [kind, createHash("sha256").update(`${sceneId}:${kind}:${prompts[kind]}`).digest("hex").slice(0, 16)]),
  ) as Record<PromptKind, string>;
}

function requiredInputs(role: ModelRole, panel: StoryboardScenePanel): string[] {
  if (role === "background-removal") return ["original product image"];
  if (role === "image-generation") return ["image prompt", `asset:${panel.assetId}`];
  if (role === "video-generation") return ["video prompt", "image keyframe"];
  if (role === "voice-generation") return ["voice prompt", panel.voice.narration];
  if (role === "audio-generation") return ["audio prompt"];
  if (role === "upscaling") return ["generated frame"];
  return ["composed layers", "rendering prompt"];
}

function dependencyFor(role: ModelRole, sceneNumber: number, tasks: ExecutionPlanTask[]): string[] {
  if (role === "image-generation") {
    const bg = tasks.find((task) => task.sceneNumber === sceneNumber && task.role === "background-removal");
    return bg ? [bg.taskId] : [];
  }
  if (role === "upscaling") {
    const image = tasks.find((task) => task.sceneNumber === sceneNumber && task.role === "image-generation");
    return image ? [image.taskId] : [];
  }
  if (role === "video-generation") {
    const image = tasks.find((task) => task.sceneNumber === sceneNumber && task.role === "image-generation");
    return image ? [image.taskId] : [];
  }
  if (role === "rendering") {
    return tasks
      .filter((task) => task.sceneNumber === sceneNumber && ["video-generation", "voice-generation", "audio-generation", "upscaling"].includes(task.role))
      .map((task) => task.taskId);
  }
  return [];
}

function parallelGroupFor(role: ModelRole, sceneNumber: number): string {
  if (role === "voice-generation" || role === "audio-generation") return `scene-${sceneNumber}-av`;
  return `scene-${sceneNumber}-${role}`;
}

/** True when prompt invents product content; ignores safe phrases like "do not invent". */
function risksInventedProductContent(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  if (/\bimaginary\b/.test(lower)) return true;
  if (/\bfictional\b/.test(lower)) return true;
  if (/\binvent(?:ed|ing)?\b/.test(lower) && !/\b(?:do\s+not|don't|never|no)\s+invent(?:ed|ing)?\b/.test(lower)) {
    return true;
  }
  return false;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function majority(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}
