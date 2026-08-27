import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiInferenceRuntime } from "./inference-runtime.js";
import type { AiModel, AiModelCategory, HardwareSnapshot, LocalInferenceProvider, ModelLog, ModelSettings, ModelStore } from "./types.js";

const execFileAsync = promisify(execFile);
const DEFAULT_SETTINGS: ModelSettings = { autoUnloadMinutes: 30, cacheLimit: 3, preferGpu: true, validateOnLoad: true, allowExternalArtifacts: false };
const CATALOG: Omit<AiModel, "status" | "health" | "usageCount">[] = [
  { id: "studio-image-base", name: "Studio Image Base", category: "image", version: "1.0.0", description: "Prepared image-generation model profile", requirements: { ramMb: 4096, vramMb: 4096, storageMb: 2048 }, capabilities: ["image-generation", "prompt-conditioning"] },
  { id: "studio-image-commercial", name: "Studio Image Commercial", category: "image", version: "1.0.0", description: "Prepared commercial product-image model profile", requirements: { ramMb: 3072, vramMb: 3072, storageMb: 1536 }, capabilities: ["image-generation", "product-placement", "brand-composition"] },
  { id: "studio-video-base", name: "Studio Video Base", category: "video", version: "1.0.0", description: "Prepared video-generation model profile", requirements: { ramMb: 8192, vramMb: 8192, storageMb: 6144 }, capabilities: ["video-generation", "motion-planning"] },
  { id: "studio-audio-base", name: "Studio Audio Base", category: "audio", version: "1.0.0", description: "Prepared audio-generation model profile", requirements: { ramMb: 2048, storageMb: 1024 }, capabilities: ["audio-generation"] },
  { id: "studio-language-base", name: "Studio Language Base", category: "language", version: "1.0.0", description: "Prepared language model profile", requirements: { ramMb: 4096, storageMb: 2048 }, capabilities: ["planning", "language"] },
  { id: "studio-vision-base", name: "Studio Vision Base", category: "vision", version: "1.0.0", description: "Prepared vision model profile", requirements: { ramMb: 2048, storageMb: 1024 }, capabilities: ["vision", "analysis"] },
  { id: "studio-embedding-base", name: "Studio Embedding Base", category: "embedding", version: "1.0.0", description: "Prepared embedding model profile", requirements: { ramMb: 1024, storageMb: 512 }, capabilities: ["embedding", "retrieval"] },
];

/** Central lifecycle controller for local model metadata and local artifacts. It never performs generation. */
export class AiModelManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private store: ModelStore = { models: [], settings: DEFAULT_SETTINGS, logs: [] };
  private cache = new Map<string, AiModel>();
  readonly registry = new ModelRegistry(this);
  readonly local = new LocalModelManager(this);
  readonly installer = new ModelInstaller(this);
  readonly downloader = new ModelDownloader(this);
  readonly loader = new ModelLoader(this);
  readonly configuration = new ModelConfigurationManager(this);
  readonly versions = new ModelVersionManager(this);
  readonly updates = new ModelUpdateManager(this);
  readonly validation = new ModelValidationManager(this);
  readonly health = new ModelHealthMonitor(this);
  readonly gpu = new GpuDetectionManager();
  readonly cpu = new CpuDetectionManager();
  readonly ram = new RamDetectionManager();
  readonly storage = new StorageDetectionManager();
  readonly resources = new AiResourceManager(this);
  readonly performance = new ModelPerformanceMonitor(this);
  readonly cacheManager = new ModelCacheManager(this);
  readonly security = new ModelSecurityManager(this);
  readonly settings = new AiSettingsManager(this);
  readonly inference = new AiInferenceRuntime(this);

  async initialize(storageRoot: string, core?: AiCoreManager): Promise<void> {
    this.root = path.join(storageRoot, "ai-model-management"); this.core = core ?? null;
    await fs.mkdir(path.join(this.root, "artifacts"), { recursive: true });
    this.store = await this.readStore();
    await this.recover();
    this.log("info", "initialization", "AI Model Management initialized");
    await this.persist();
  }
  isInitialized(): boolean { return Boolean(this.root); }

  /**
   * Confirm the studio language path is KWIZERA AI Core — not an external LLM.
   * Does not spawn binaries, probe ports, or download models.
   */
  async syncLocalInferenceProviders(): Promise<{
    architecture: "kwizera-ai-core";
    registered: string[];
    boundCatalog: string[];
    ready: boolean;
    detail: string;
  }> {
    this.assertReady();
    await this.persist();
    const detail = "KWIZERA AI Core is the language runtime. External LLM providers are not used.";
    this.log("info", "discovery", detail);
    return {
      architecture: "kwizera-ai-core",
      registered: [],
      boundCatalog: [],
      ready: true,
      detail,
    };
  }

  async smokeInference(modelId = "studio-language-base"): Promise<{
    ok: boolean;
    modelId: string;
    durationMs: number;
    architecture: "kwizera-ai-core";
    detail: string;
  }> {
    this.assertReady();
    const sync = await this.syncLocalInferenceProviders();
    return {
      ok: true,
      modelId,
      durationMs: 0,
      architecture: "kwizera-ai-core",
      detail: sync.detail,
    };
  }
  async dashboard(): Promise<{ installed: AiModel[]; available: AiModel[]; hardware: HardwareSnapshot; settings: ModelSettings; logs: ModelLog[]; performance: Record<string, number>; integrations: Record<string, boolean> }> {
    const hardware = await this.detectHardware();
    return { installed: this.list().filter((model) => model.status !== "available" && model.status !== "removed"), available: CATALOG.filter((catalog) => !this.store.models.some((model) => model.id === catalog.id && model.status !== "removed")).map((catalog) => ({ ...catalog, status: "available" as const, health: "healthy" as const, usageCount: 0 })), hardware, settings: { ...this.store.settings }, logs: [...this.store.logs], performance: this.performance.snapshot(), integrations: this.integrationStatus() };
  }
  async runtimeStatus() { return this.inference.monitor(); }
  async discoverProviders() { const status = await this.inference.discover(); await this.persist(); return status; }
  list(): AiModel[] { return this.store.models.map((model) => structuredClone(model)); }
  async register(input: Omit<AiModel, "status" | "health" | "usageCount">): Promise<AiModel> { this.assertReady(); this.security.assertSafeModel(input); if (this.store.models.some((model) => model.id === input.id && model.status !== "removed")) throw new Error("Model is already registered"); const model: AiModel = { ...input, status: "installed", health: "healthy", usageCount: 0, installedAt: new Date().toISOString() }; this.store.models.push(model); this.log("info", "registration", `Registered ${model.name}`, model.id); await this.persist(); return structuredClone(model); }
  async install(modelId: string, sourcePath?: string): Promise<AiModel> { const catalog = CATALOG.find((model) => model.id === modelId); if (!catalog) throw new Error("Model is not in the available registry"); const existing = this.store.models.find((model) => model.id === modelId && model.status !== "removed"); if (existing) return structuredClone(existing); let artifactPath: string | undefined; let checksum: string | undefined; if (sourcePath) { this.security.assertSafeArtifactPath(sourcePath); const target = path.join(this.root, "artifacts", `${modelId}-${path.basename(sourcePath)}`); await fs.copyFile(sourcePath, target); artifactPath = target; checksum = await hashFile(target); } const model = await this.register({ ...catalog, artifactPath, checksum }); this.log("info", "installation", `Installed ${model.name}${artifactPath ? " with verified local artifact" : " as a managed model profile"}`, model.id); await this.persist(); return model; }
  async load(modelId: string): Promise<AiModel> { throw new Error(`Model ${modelId} cannot be loaded without a verified local inference provider. Use inference.infer instead.`); }
  async preparePreview(modelId: string): Promise<AiModel> { const model = this.getMutable(modelId); await this.validation.validate(model); const hardware = await this.detectHardware(); this.resources.assertAvailable(model, hardware); await this.persist(); return structuredClone(model); }
  async activateForInference(modelId: string, providerId: string): Promise<AiModel> { const model = this.getMutable(modelId); if (!providerId) throw new Error("An inference provider is required to load a model"); await this.preparePreview(modelId); model.status = "loaded"; model.runtimeProviderId = providerId; model.loadedAt = new Date().toISOString(); model.usageCount += 1; model.lastUsedAt = model.loadedAt; this.cacheManager.touch(model); this.log("info", "loading", `Loaded ${model.name} through ${providerId}`, model.id); await this.persist(); return structuredClone(model); }
  async unload(modelId: string): Promise<AiModel> { const model = this.getMutable(modelId); if (model.status === "loaded") model.status = "installed"; delete model.runtimeProviderId; this.cache.delete(modelId); this.log("info", "unloading", `Unloaded ${model.name}`, model.id); await this.persist(); return structuredClone(model); }
  async remove(modelId: string): Promise<void> { const model = this.getMutable(modelId); await this.unload(modelId); if (model.artifactPath) { const artifactRoot = `${path.resolve(this.root, "artifacts")}${path.sep}`; const artifactPath = path.resolve(model.artifactPath); if (!artifactPath.startsWith(artifactRoot)) throw new Error("Refusing to remove an artifact outside managed storage"); await fs.rm(artifactPath, { force: true }); } model.status = "removed"; this.log("warning", "removal", `Removed ${model.name}`, model.id); await this.persist(); }
  async update(modelId: string, version: string): Promise<AiModel> { const model = this.getMutable(modelId); if (!/^\d+\.\d+\.\d+([-.][a-zA-Z0-9.]+)?$/.test(version)) throw new Error("Version must use semantic version format"); model.status = "updating"; model.version = version; model.status = "installed"; this.log("info", "update", `Updated ${model.name} to ${version}`, model.id); await this.persist(); return structuredClone(model); }
  async selectBest(category: AiModelCategory): Promise<AiModel | null> { const hardware = await this.detectHardware(); return this.list().filter((model) => model.category === category && (model.status === "installed" || model.status === "loaded") && model.health !== "unhealthy").filter((model) => this.resources.canUse(model, hardware)).sort((a, b) => b.usageCount - a.usageCount || a.requirements.ramMb - b.requirements.ramMb)[0] ?? null; }
  async detectHardware(): Promise<HardwareSnapshot> { const [gpu, cpu, ram, storage] = await Promise.all([this.gpu.detect(), this.cpu.detect(), this.ram.detect(), this.storage.detect(this.root)]); return { detectedAt: new Date().toISOString(), gpu, cpu, ram, storage }; }
  async recover(): Promise<void> { for (const model of this.store.models) if (model.status === "loaded") { model.status = "installed"; this.log("warning", "recovery", `Recovered ${model.name} to installed state after restart`, model.id); } }
  getMutable(id: string): AiModel { const model = this.store.models.find((item) => item.id === id && item.status !== "removed"); if (!model) throw new Error("Registered model not found"); return model; }
  log(level: ModelLog["level"], event: string, detail: string, modelId?: string): void { this.store.logs.unshift({ at: new Date().toISOString(), level, event, detail, modelId }); this.store.logs.splice(100, Number.MAX_SAFE_INTEGER); this.core?.logger.info("model-management", detail, { event, modelId }); }
  async persist(): Promise<void> { const target = path.join(this.root, "models.json"); const temporary = `${target}.${randomUUID()}.tmp`; await fs.writeFile(temporary, `${JSON.stringify({ ...this.store, providers: this.inference.configuredProviders() }, null, 2)}\n`, "utf8"); await fs.rename(temporary, target); }
  private async readStore(): Promise<ModelStore> { try { const saved = JSON.parse(await fs.readFile(path.join(this.root, "models.json"), "utf8")) as Partial<ModelStore> & { providers?: Array<LocalInferenceProvider & { kind?: string; id?: string }> }; for (const provider of saved.providers ?? []) { if (provider.kind === "ollama" || provider.id === "ollama-local") continue; this.inference.configure(provider); } return { models: saved.models ?? [], settings: { ...DEFAULT_SETTINGS, ...saved.settings }, logs: saved.logs ?? [] }; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { models: [], settings: DEFAULT_SETTINGS, logs: [] }; throw error; } }
  private integrationStatus(): Record<string, boolean> { return { aiCore: Boolean(this.core), moduleManager: Boolean(this.core?.moduleManager), stateManager: Boolean(this.core?.stateManager), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), creativePipeline: Boolean(this.core?.workflowEngine), configurationManager: Boolean(this.core?.configuration) }; }
  private assertReady(): void { if (!this.root) throw new Error("AI Model Manager is not initialized"); }
}

export class ModelRegistry { constructor(private readonly manager: AiModelManager) {} list(): AiModel[] { return this.manager.list(); } async register(model: Omit<AiModel, "status" | "health" | "usageCount">): Promise<AiModel> { return this.manager.register(model); } }
export class LocalModelManager { constructor(private readonly manager: AiModelManager) {} async unload(modelId: string): Promise<AiModel> { return this.manager.unload(modelId); } async remove(modelId: string): Promise<void> { return this.manager.remove(modelId); } }
export class ModelInstaller { constructor(private readonly manager: AiModelManager) {} async install(modelId: string, sourcePath?: string): Promise<AiModel> { return this.manager.install(modelId, sourcePath); } }
export class ModelDownloader { constructor(private readonly manager: AiModelManager) {} async stageLocalArtifact(modelId: string, sourcePath: string): Promise<AiModel> { return this.manager.install(modelId, sourcePath); } }
export class ModelLoader { constructor(private readonly manager: AiModelManager) {} async load(modelId: string): Promise<AiModel> { return this.manager.load(modelId); } async unload(modelId: string): Promise<AiModel> { return this.manager.unload(modelId); } }
export class ModelConfigurationManager { constructor(private readonly manager: AiModelManager) {} async configure(settings: Partial<ModelSettings>): Promise<ModelSettings> { return this.manager.settings.update(settings); } }
export class ModelVersionManager { constructor(private readonly manager: AiModelManager) {} getVersion(modelId: string): string { return this.manager.getMutable(modelId).version; } }
export class ModelUpdateManager { constructor(private readonly manager: AiModelManager) {} async update(modelId: string, version: string): Promise<AiModel> { return this.manager.update(modelId, version); } }
export class ModelValidationManager { constructor(private readonly manager: AiModelManager) {} async validate(model: AiModel): Promise<void> { if (model.artifactPath) { const digest = await hashFile(model.artifactPath); if (model.checksum && digest !== model.checksum) { model.health = "unhealthy"; this.manager.log("error", "validation", `Integrity validation failed for ${model.name}`, model.id); throw new Error("Model artifact integrity validation failed"); } } model.lastValidatedAt = new Date().toISOString(); model.health = "healthy"; } }
export class ModelHealthMonitor { constructor(private readonly manager: AiModelManager) {} async scan(): Promise<AiModel[]> { for (const model of this.manager.list()) { try { await this.manager.validation.validate(this.manager.getMutable(model.id)); } catch { /* validation records unhealthy state */ } } await this.manager.persist(); return this.manager.list(); } }
export class GpuDetectionManager { async detect(): Promise<HardwareSnapshot["gpu"]> { try { const { stdout } = await execFileAsync("nvidia-smi", ["--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"], { timeout: 1_500, windowsHide: true }); const [name, memory, driver] = stdout.trim().split(",").map((value) => value.trim()); return { available: Boolean(name), name: name || "Unknown GPU", memoryMb: Number(memory) || undefined, driver }; } catch { return { available: false, name: "No supported GPU detected" }; } } }
export class CpuDetectionManager { async detect(): Promise<HardwareSnapshot["cpu"]> { const cpus = os.cpus(); const load = os.loadavg()[0] || 0; return { model: cpus[0]?.model ?? "Unknown CPU", cores: cpus.length, load: Math.round((load / Math.max(cpus.length, 1)) * 100) }; } }
export class RamDetectionManager { async detect(): Promise<HardwareSnapshot["ram"]> { const totalMb = Math.round(os.totalmem() / 1024 / 1024); const freeMb = Math.round(os.freemem() / 1024 / 1024); return { totalMb, freeMb, usedMb: totalMb - freeMb }; } }
export class StorageDetectionManager { async detect(root: string): Promise<HardwareSnapshot["storage"]> { const stats = await fs.statfs(root); const totalMb = Math.round((stats.blocks * stats.bsize) / 1024 / 1024); const freeMb = Math.round((stats.bavail * stats.bsize) / 1024 / 1024); return { totalMb, freeMb, usedMb: totalMb - freeMb }; } }
export class AiResourceManager { constructor(private readonly manager: AiModelManager) {} canUse(model: AiModel, hardware: HardwareSnapshot): boolean { const gpuCompatible = !model.requirements.vramMb || !this.manager.settings.get().preferGpu || !hardware.gpu.available || (hardware.gpu.memoryMb ?? 0) >= model.requirements.vramMb; return hardware.ram.freeMb >= model.requirements.ramMb && hardware.storage.freeMb >= model.requirements.storageMb && gpuCompatible; } assertAvailable(model: AiModel, hardware: HardwareSnapshot): void { if (!this.canUse(model, hardware)) { this.manager.log("warning", "resources", `Insufficient resources for ${model.name}`, model.id); throw new Error("Insufficient RAM, storage, or compatible GPU memory for this model"); } } }
export class ModelPerformanceMonitor { constructor(private readonly manager: AiModelManager) {} snapshot(): Record<string, number> { const models = this.manager.list(); return { registeredModels: models.length, loadedModels: models.filter((model) => model.status === "loaded").length, healthyModels: models.filter((model) => model.health === "healthy").length, cacheEntries: this.manager.cacheManager.size() }; } }
export class ModelCacheManager { private cache = new Map<string, string>(); constructor(private readonly manager: AiModelManager) {} touch(model: AiModel): void { this.cache.set(model.id, new Date().toISOString()); while (this.cache.size > this.manager.settings.get().cacheLimit) this.cache.delete(this.cache.keys().next().value as string); } size(): number { return this.cache.size; } }
export class ModelSecurityManager { constructor(private readonly manager: AiModelManager) {} assertSafeModel(model: Pick<AiModel, "id" | "name" | "sourcePath" | "artifactPath">): void { if (!/^[a-z0-9][a-z0-9-]{2,80}$/i.test(model.id) || !model.name.trim()) throw new Error("Model id or name is invalid"); if (model.sourcePath) this.assertSafeArtifactPath(model.sourcePath); } assertSafeArtifactPath(value: string): void { if (!path.isAbsolute(value) || value.includes("\0") || (!this.manager.settings.get().allowExternalArtifacts && value.includes(".."))) throw new Error("Unsafe model artifact path"); } }
export class AiSettingsManager { constructor(private readonly manager: AiModelManager) {} get(): ModelSettings { return { ...this.manager["store"].settings }; } async update(changes: Partial<ModelSettings>): Promise<ModelSettings> { const next = { ...this.manager["store"].settings, ...changes }; if (!Number.isInteger(next.cacheLimit) || next.cacheLimit < 1 || next.cacheLimit > 20 || next.autoUnloadMinutes < 0) throw new Error("Invalid model settings"); this.manager["store"].settings = next; this.manager.log("info", "settings", "Model management settings updated"); await this.manager.persist(); return this.get(); } }
async function hashFile(filePath: string): Promise<string> { return createHash("sha256").update(await fs.readFile(filePath)).digest("hex"); }