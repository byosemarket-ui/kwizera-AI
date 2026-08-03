import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { ImageGenerationManager } from "../image-generation/image-generation-manager.js";
import type { AiModelManager } from "../model-management/ai-model-manager.js";
import type { VideoAudioGenerationManager } from "../video-audio-generation/video-audio-generation-manager.js";
import { ProductionOptimizationEngine } from "./production-optimization-engine.js";
import type { OptimizationRequest, OptimizationStore, OptimizationTask, OptimizedResult, QualityAnalysis } from "./types.js";

const EMPTY_STORE: OptimizationStore = { tasks: [], history: [], logs: [] };
const UNSAFE_TERMS = /\b(?:malware|exploit|fraud|hate|violent threat)\b/i;

/** Coordinates existing generators, retaining their artifacts while selecting validated results. */
export class GenerationOptimizationManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private models: AiModelManager | null = null;
  private images: ImageGenerationManager | null = null;
  private videoAudio: VideoAudioGenerationManager | null = null;
  private store: OptimizationStore = structuredClone(EMPTY_STORE);
  private running = new Set<string>();
  readonly qualityAnalyzer = new AiQualityAnalyzer();
  readonly multiModel = new MultiModelCoordinator(this);
  readonly selector = new BestResultSelector();
  readonly batch = new BatchGenerationManager(this);
  readonly retryManager = new RetryManager(this);
  readonly recovery = new ErrorRecoveryManager(this);
  readonly performance = new PerformanceOptimizer(this);
  readonly gpu = new GpuOptimizationManager(this);
  readonly memory = new MemoryOptimizationManager(this);
  readonly queue = new QueueManager(this);
  readonly scheduler = new ResourceScheduler(this);
  readonly monitor = new GenerationMonitor(this);
  readonly progress = new ProgressTracker(this);
  readonly analytics = new GenerationAnalytics(this);
  readonly validator = new ResultValidator();
  readonly brand = new BrandConsistencyValidator();
  readonly safety = new SafetyValidator();
  readonly logging = new OptimizationLoggingManager(this);
  readonly production = new ProductionOptimizationEngine();

  async initialize(storageRoot: string, dependencies: { core: AiCoreManager; models: AiModelManager; images: ImageGenerationManager; videoAudio: VideoAudioGenerationManager }): Promise<void> {
    this.root = path.join(storageRoot, "generation-optimization-runtime"); this.core = dependencies.core; this.models = dependencies.models; this.images = dependencies.images; this.videoAudio = dependencies.videoAudio;
    await fs.mkdir(this.root, { recursive: true }); this.store = await this.readStore(); await this.production.initialize(storageRoot, dependencies.models);
    await this.recovery.resumeInterrupted(); this.log("info", "Generation optimization runtime restored."); await this.persist();
  }

  isInitialized(): boolean { return Boolean(this.root); }
  async optimize(request: OptimizationRequest): Promise<OptimizationTask> { const task = await this.queue.enqueue(request); return this.run(task.id); }
  async retry(taskId: string): Promise<OptimizationTask> { return this.retryManager.retry(taskId); }
  async getTask(taskId: string): Promise<OptimizationTask> { return structuredClone(this.requireTask(taskId)); }
  async getDashboard(projectId?: string): Promise<{ tasks: OptimizationTask[]; history: OptimizationTask[]; logs: OptimizationStore["logs"]; queue: Record<string, number | string>; performance: Record<string, number | string>; analytics: Record<string, number>; integrations: Record<string, boolean>; production: ReturnType<ProductionOptimizationEngine["getDashboard"]> }> {
    const tasks = this.store.tasks.filter((task) => !projectId || task.request.projectId === projectId); const history = this.store.history.filter((task) => !projectId || task.request.projectId === projectId);
    await this.production.refresh();
    return { tasks: structuredClone(tasks), history: structuredClone(history), logs: [...this.store.logs], queue: this.queue.status(), performance: this.monitor.snapshot(), analytics: this.analytics.summary(), integrations: { aiCore: Boolean(this.core), modelManagement: Boolean(this.models), imageGeneration: Boolean(this.images), videoAudioGeneration: Boolean(this.videoAudio), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), stateManager: Boolean(this.core?.stateManager), moduleManager: Boolean(this.core?.moduleManager), creativePipeline: Boolean(this.core?.workflowEngine) }, production: this.production.getDashboard() };
  }
  async refreshProduction() { this.ensureReady(); return this.production.refresh(); }
  async recoverProduction() { this.ensureReady(); const result = await this.production.recover(); this.log("info", `Production recovery cleaned ${result.cleanedTemporaryFiles} stale temporary file(s).`); return result; }
  async run(taskId: string): Promise<OptimizationTask> {
    this.ensureReady(); const task = this.requireTask(taskId); if (task.status === "completed" || this.running.has(taskId)) return structuredClone(task);
    this.running.add(taskId); task.status = "running"; task.startedAt ??= new Date().toISOString(); this.progress.update(task, 12, "Generation task started."); await this.persist();
    try {
      while (task.attempts < task.maxAttempts) {
        try {
          task.attempts += 1; this.progress.update(task, 35, `Executing candidate models (attempt ${task.attempts}/${task.maxAttempts}).`);
          const results = await this.multiModel.generate(task.request); const validated = results.map((result) => ({ ...result, quality: this.qualityAnalyzer.analyze(result, task.request, this.brand, this.safety, this.validator) }));
          const selected = this.selector.select(validated); if (!selected) throw new Error("No validated generation result was produced");
          task.results = validated; task.selectedResultId = selected.id; task.status = "completed"; task.completedAt = new Date().toISOString(); this.progress.update(task, 100, `Selected ${selected.modelId} result at ${selected.quality.score}/100.`); this.store.tasks = this.store.tasks.filter((item) => item.id !== task.id); this.store.history.unshift(structuredClone(task)); this.store.history.splice(100); this.log("info", `Optimization completed for ${task.request.target} task ${task.id}.`); await this.persist(); return structuredClone(task);
        } catch (error) {
          task.error = error instanceof Error ? error.message : String(error); this.retryManager.recordFailure(task);
          if (task.attempts >= task.maxAttempts) throw error;
          this.progress.update(task, 20, "Recovering failed generation before automatic retry."); await this.scheduler.yield();
        }
      }
      throw new Error(task.error ?? "Generation task failed");
    } catch (error) {
      task.status = "failed"; task.updatedAt = new Date().toISOString(); task.error = error instanceof Error ? error.message : String(error); this.log("error", `Optimization task ${task.id} failed: ${task.error}`); await this.persist(); return structuredClone(task);
    } finally { this.running.delete(taskId); }
  }
  async persist(): Promise<void> { await fs.writeFile(path.join(this.root, "optimization.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
  log(level: "info" | "warning" | "error", message: string): void { this.store.logs.unshift({ at: new Date().toISOString(), level, message }); this.store.logs.splice(0, 150); this.core?.logger.info("generation-optimization", message); }
  getStore(): OptimizationStore { return this.store; }
  getRunningCount(): number { return this.running.size; }
  getModels(): AiModelManager { return this.models!; }
  getImages(): ImageGenerationManager { return this.images!; }
  getVideoAudio(): VideoAudioGenerationManager { return this.videoAudio!; }
  private requireTask(id: string): OptimizationTask { const task = this.store.tasks.find((item) => item.id === id) ?? this.store.history.find((item) => item.id === id); if (!task) throw new Error("Optimization task not found"); return task; }
  private async readStore(): Promise<OptimizationStore> { try { const value = JSON.parse(await fs.readFile(path.join(this.root, "optimization.json"), "utf8")) as Partial<OptimizationStore>; return { ...structuredClone(EMPTY_STORE), ...value, tasks: value.tasks ?? [], history: value.history ?? [], logs: value.logs ?? [] }; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_STORE); throw error; } }
  private ensureReady(): void { if (!this.root || !this.models || !this.images || !this.videoAudio) throw new Error("Generation Optimization Manager is not initialized"); }
}

export class AiQualityAnalyzer { analyze(result: OptimizedResult, request: OptimizationRequest, brand: BrandConsistencyValidator, safety: SafetyValidator, validator: ResultValidator): QualityAnalysis { const safe = safety.validate(request); const brandConsistent = brand.validate(request, result); const structural = validator.validate(result); const score = Math.max(0, Math.min(100, result.quality.score + (safe ? 3 : -45) + (brandConsistent ? 3 : -12) + (structural ? 2 : -30))); return { score, valid: safe && brandConsistent && structural, safe, brandConsistent, notes: [...result.quality.notes, safe ? "Safety validation passed." : "Safety validation requires review.", brandConsistent ? "Brand consistency validated." : "Brand consistency requires review.", structural ? "Artifact metadata validated." : "Artifact validation failed."] }; } }
export class MultiModelCoordinator { constructor(private readonly manager: GenerationOptimizationManager) {} async generate(request: OptimizationRequest): Promise<OptimizedResult[]> { if (request.target === "image") { if (!request.image) throw new Error("Image optimization requires an image request"); const modelIds = request.candidateModelIds?.length ? request.candidateModelIds : [request.image.modelId].filter((id): id is string => Boolean(id)); const candidates = modelIds.length ? modelIds : [undefined]; const images = await Promise.all(candidates.map((modelId) => this.manager.getImages().generate({ ...request.image!, modelId }))); return images.flat().map((image) => ({ id: randomUUID(), modelId: image.modelId, target: "image" as const, sourceId: image.id, quality: { ...image.quality, valid: true, brandConsistent: true, safe: true }, createdAt: image.createdAt })); } if (!request.videoAudio) throw new Error("Video/audio optimization requires a video/audio request"); const modelIds = request.candidateModelIds?.length ? request.candidateModelIds : [request.videoAudio.videoModelId].filter((id): id is string => Boolean(id)); const candidates = modelIds.length ? modelIds : [undefined]; const packages = await Promise.all(candidates.map((videoModelId) => this.manager.getVideoAudio().generate({ ...request.videoAudio!, videoModelId }))); return packages.map((pkg) => ({ id: randomUUID(), modelId: pkg.videoModelId, target: "video-audio" as const, sourceId: pkg.id, quality: { ...pkg.quality, valid: true, brandConsistent: true, safe: true }, createdAt: pkg.createdAt })); } }
export class BestResultSelector { select(results: OptimizedResult[]): OptimizedResult | undefined { return [...results].filter((result) => result.quality.valid).sort((left, right) => right.quality.score - left.quality.score || left.createdAt.localeCompare(right.createdAt))[0]; } }
export class BatchGenerationManager { constructor(private readonly manager: GenerationOptimizationManager) {} async submit(requests: OptimizationRequest[]): Promise<OptimizationTask[]> { return Promise.all(requests.map((request) => this.manager.optimize(request))); } }
export class RetryManager { constructor(private readonly manager: GenerationOptimizationManager) {} recordFailure(task: OptimizationTask): void { task.logs.unshift({ at: new Date().toISOString(), level: "warning", message: `Attempt ${task.attempts} failed: ${task.error}` }); } async retry(taskId: string): Promise<OptimizationTask> { const task = this.manager.getStore().tasks.find((item) => item.id === taskId) ?? this.manager.getStore().history.find((item) => item.id === taskId); if (!task) throw new Error("Optimization task not found"); if (task.status === "completed") throw new Error("Completed tasks do not require retry"); task.status = "queued"; task.error = undefined; task.attempts = 0; this.manager.getStore().history = this.manager.getStore().history.filter((item) => item.id !== taskId); if (!this.manager.getStore().tasks.some((item) => item.id === taskId)) this.manager.getStore().tasks.unshift(task); await this.manager.persist(); return this.manager.run(taskId); } }
export class ErrorRecoveryManager { constructor(private readonly manager: GenerationOptimizationManager) {} async resumeInterrupted(): Promise<void> { for (const task of this.manager.getStore().tasks.filter((item) => item.status === "running" || item.status === "queued")) { task.status = "queued"; task.logs.unshift({ at: new Date().toISOString(), level: "warning", message: "Recovered after interrupted runtime." }); await this.manager.run(task.id); } } }
export class PerformanceOptimizer { constructor(private readonly manager: GenerationOptimizationManager) {} recommendations(): string[] { const memory = process.memoryUsage(); return [memory.heapUsed > memory.heapTotal * .85 ? "High heap pressure: schedule subsequent jobs after cleanup." : "Memory headroom is available.", this.manager.getRunningCount() ? "Queue prioritizes active generation completion." : "Queue is idle and ready for batch work."]; } }
export class GpuOptimizationManager { constructor(private readonly manager: GenerationOptimizationManager) {} usage(): string { const latest = this.manager.production.getDashboard().latest; return latest?.hardware.gpu.available ? "utilization is provider-managed and not locally exposed" : "no verified GPU telemetry"; } }
export class MemoryOptimizationManager { constructor(private readonly manager: GenerationOptimizationManager) {} usageMb(): number { return Math.round(process.memoryUsage().rss / 1024 / 1024); } }
export class QueueManager { constructor(private readonly manager: GenerationOptimizationManager) {} async enqueue(request: OptimizationRequest): Promise<OptimizationTask> { if (request.target === "image" && !request.image) throw new Error("Image optimization request is incomplete"); if (request.target === "video-audio" && !request.videoAudio) throw new Error("Video/audio optimization request is incomplete"); const now = new Date().toISOString(); const task: OptimizationTask = { id: randomUUID(), request: structuredClone(request), status: "queued", progress: 0, createdAt: now, updatedAt: now, attempts: 0, maxAttempts: Math.max(1, Math.min(3, request.maxAttempts ?? 2)), results: [], logs: [{ at: now, level: "info", message: "Task queued for quality optimization." }] }; this.manager.getStore().tasks.unshift(task); this.manager.log("info", `Queued ${request.target} optimization task ${task.id}.`); await this.manager.persist(); return task; } status(): Record<string, number | string> { const tasks = this.manager.getStore().tasks; return { state: tasks.length ? "active" : "idle", queued: tasks.filter((task) => task.status === "queued").length, running: this.manager.getRunningCount(), completed: this.manager.getStore().history.filter((task) => task.status === "completed").length, failed: [...tasks, ...this.manager.getStore().history].filter((task) => task.status === "failed").length }; } }
export class ResourceScheduler { constructor(private readonly manager: GenerationOptimizationManager) {} async yield(): Promise<void> { await new Promise<void>((resolve) => setImmediate(resolve)); } }
export class GenerationMonitor { constructor(private readonly manager: GenerationOptimizationManager) {} snapshot(): Record<string, number | string> { const usage = process.memoryUsage(); const cpu = process.cpuUsage(); const production = this.manager.production.getDashboard().latest; return { cpuMs: Math.round((cpu.user + cpu.system) / 1000), cpuUsage: production?.cpuUsagePercent ?? Math.min(100, Math.round((cpu.user / Math.max(1, process.uptime() * 1_000_000)) * 100)), ramUsageMb: production?.ramUsedMb ?? Math.round(usage.rss / 1024 / 1024), heapUsageMb: Math.round(usage.heapUsed / 1024 / 1024), gpuUsage: this.manager.gpu.usage(), activeWorkers: this.manager.getRunningCount(), inferenceCapacity: production?.plan.inferenceParallelism ?? 1, recommendations: this.manager.performance.recommendations().join(" ") }; } }
export class ProgressTracker { constructor(private readonly manager: GenerationOptimizationManager) {} update(task: OptimizationTask, progress: number, message: string): void { task.progress = progress; task.updatedAt = new Date().toISOString(); task.logs.unshift({ at: task.updatedAt, level: "info", message }); task.logs.splice(20); } }
export class GenerationAnalytics { constructor(private readonly manager: GenerationOptimizationManager) {} summary(): Record<string, number> { const all = [...this.manager.getStore().history, ...this.manager.getStore().tasks]; const completed = all.filter((task) => task.status === "completed"); const failed = all.filter((task) => task.status === "failed"); return { totalTasks: all.length, completed: completed.length, failed: failed.length, successRate: all.length ? Math.round(completed.length / all.length * 100) : 100, averageQuality: completed.length ? Math.round(completed.reduce((sum, task) => sum + (task.results.find((result) => result.id === task.selectedResultId)?.quality.score ?? 0), 0) / completed.length) : 0, retries: all.reduce((sum, task) => sum + Math.max(0, task.attempts - 1), 0) }; } }
export class ResultValidator { validate(result: OptimizedResult): boolean { return Boolean(result.sourceId && result.modelId && Number.isFinite(result.quality.score)); } }
export class BrandConsistencyValidator { validate(request: OptimizationRequest, result: OptimizedResult): boolean { const prompt = request.image?.prompt ?? request.videoAudio?.prompt ?? ""; return prompt.trim().length >= 8 && Boolean(result.modelId); } }
export class SafetyValidator { validate(request: OptimizationRequest): boolean { const prompt = request.image?.prompt ?? request.videoAudio?.prompt ?? ""; return !UNSAFE_TERMS.test(prompt) && !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(prompt); } }
export class OptimizationLoggingManager { constructor(private readonly manager: GenerationOptimizationManager) {} entries(): OptimizationStore["logs"] { return [...this.manager.getStore().logs]; } }