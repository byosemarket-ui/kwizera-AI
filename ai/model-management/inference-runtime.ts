import type { AiModelManager } from "./ai-model-manager.js";
import type { AiModelCategory, ImageInferenceRequest, ImageInferenceResult, InferenceRequest, InferenceResult, InferenceRuntimeStatus, LocalInferenceProvider, ProviderValidationStatus, VideoInferenceRequest, VideoInferenceResult } from "./types.js";

const DEFAULT_PROVIDERS: LocalInferenceProvider[] = [
  { id: "automatic1111-local", name: "Automatic1111 Local", kind: "automatic1111", endpoint: "http://127.0.0.1:7860", enabled: true, supportedCategories: ["image"] },
  { id: "comfyui-local", name: "ComfyUI Local", kind: "comfyui-video", endpoint: "http://127.0.0.1:8188", enabled: true, supportedCategories: ["video"] },
  { id: "ollama-local", name: "Ollama Local", kind: "ollama", endpoint: "http://127.0.0.1:11434", enabled: true, supportedCategories: ["language", "vision", "embedding"] },
];
const ADAPTER_CATEGORIES: Record<LocalInferenceProvider["kind"], AiModelCategory[]> = {
	automatic1111: ["image"],
  "comfyui-video": ["video"],
  ollama: ["language", "vision", "embedding"],
  "openai-compatible": ["language"],
};

type ProviderStatus = ProviderValidationStatus;
type QueuedInference = { request: InferenceRequest; provider: ProviderStatus; resolve: (result: InferenceResult) => void; reject: (error: Error) => void };
type QueuedDirectInference<T> = { work: () => Promise<T>; resolve: (result: T) => void; reject: (error: Error) => void };

/** Executes requests only through explicitly configured local inference services; it never fabricates a model response. */
export class AiInferenceRuntime {
  private readonly providers = new Map<string, ProviderStatus>();
  private readonly queue: QueuedInference[] = [];
  private readonly directQueue: QueuedDirectInference<unknown>[] = [];
  private running = 0;
  private directRunning = 0;
  private completed = 0;
  private failed = 0;
  private maxParallel = 2;

  constructor(private readonly models: AiModelManager) {
    for (const provider of DEFAULT_PROVIDERS) this.providers.set(provider.id, { ...provider, available: false, models: [], capabilities: [...provider.supportedCategories] });
  }

  configure(provider: LocalInferenceProvider): void {
    const endpoint = new URL(provider.endpoint);
    if (!/^https?:$/.test(endpoint.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)) throw new Error("Inference providers must use a loopback HTTP endpoint");
    if (provider.supportedCategories.some((category) => !ADAPTER_CATEGORIES[provider.kind].includes(category))) throw new Error(`${provider.kind} does not support one or more configured inference categories`);
    this.providers.set(provider.id, { ...provider, endpoint: endpoint.origin, available: false, models: [], capabilities: [...provider.supportedCategories] });
  }

  configuredProviders(): LocalInferenceProvider[] { return [...this.providers.values()].map(({ available: _available, lastCheckedAt: _lastCheckedAt, error: _error, version: _version, models: _models, capabilities: _capabilities, system: _system, ...provider }) => ({ ...provider, supportedCategories: [...provider.supportedCategories] })); }
  listProviders(): ProviderStatus[] { return [...this.providers.values()].map((provider) => ({ ...provider, supportedCategories: [...provider.supportedCategories], models: [...provider.models], components: provider.components ? Object.fromEntries(Object.entries(provider.components).map(([kind, entries]) => [kind, [...entries]])) : undefined, capabilities: [...provider.capabilities], system: provider.system ? { ...provider.system } : undefined })); }

  setMaxParallel(value: number): void {
    if (!Number.isInteger(value) || value < 1 || value > 8) throw new Error("Inference parallelism must be an integer between 1 and 8");
    this.maxParallel = value;
    this.drain();
  }

  async monitor(): Promise<InferenceRuntimeStatus> {
    await Promise.all([...this.providers.values()].filter((provider) => provider.enabled).map((provider) => this.check(provider)));
    return this.status();
  }

  async discover(): Promise<InferenceRuntimeStatus> {
    await this.monitor();
    return this.status();
  }

  status(): InferenceRuntimeStatus { return { providers: this.listProviders(), queued: this.queue.length + this.directQueue.length, running: this.running + this.directRunning, maxParallel: this.maxParallel, completed: this.completed, failed: this.failed }; }

  async infer(request: InferenceRequest): Promise<InferenceResult> {
    if (!request.prompt.trim()) throw new Error("Inference prompt is required");
    const model = this.models.getMutable(request.modelId);
    if (model.category !== request.category) throw new Error(`Model ${request.modelId} does not support ${request.category} inference`);
    const provider = await this.select(request.category, request.modelId);
    if (model.status !== "loaded" || model.runtimeProviderId !== provider.id) await this.models.activateForInference(request.modelId, provider.id);
    return new Promise<InferenceResult>((resolve, reject) => {
      const job = { request, provider, resolve, reject };
      if (request.priority === "high") this.queue.unshift(job); else this.queue.push(job);
      this.drain();
    });
  }

  async generateImage(request: ImageInferenceRequest): Promise<ImageInferenceResult> {
    if (!request.prompt.trim()) throw new Error("Image generation prompt is required");
    if (!Number.isInteger(request.width) || !Number.isInteger(request.height) || request.width < 64 || request.height < 64 || request.width > 2048 || request.height > 2048) throw new Error("Image dimensions must be whole numbers between 64 and 2048");
    if (!Number.isInteger(request.batchSize ?? 1) || (request.batchSize ?? 1) < 1 || (request.batchSize ?? 1) > 6) throw new Error("Image batch size must be between 1 and 6");
    const model = this.models.getMutable(request.modelId);
    if (model.category !== "image") throw new Error(`Model ${request.modelId} does not support image inference`);
    const provider = await this.select("image", request.modelId);
    if (provider.kind !== "automatic1111") throw new Error(`Provider ${provider.id} does not implement image inference`);
    if (model.status !== "loaded" || model.runtimeProviderId !== provider.id) await this.models.activateForInference(request.modelId, provider.id);
    const startedAt = performance.now();
    try {
      const images = await this.runBounded(() => this.executeAutomatic1111(provider, request));
      this.completed++;
      return { modelId: request.modelId, providerId: provider.id, backend: provider.kind, images, durationMs: Math.round(performance.now() - startedAt), createdAt: new Date().toISOString() };
    } catch (error) {
      this.failed++;
      throw error;
    }
  }

  async generateVideo(request: VideoInferenceRequest): Promise<VideoInferenceResult> {
    if (!request.prompt.trim()) throw new Error("Video generation prompt is required");
    if (!Number.isInteger(request.durationSeconds) || request.durationSeconds < 1 || request.durationSeconds > 60) throw new Error("Video duration must be between 1 and 60 seconds");
    if (!Number.isInteger(request.width) || !Number.isInteger(request.height) || request.width < 64 || request.height < 64 || request.width > 3840 || request.height > 2160) throw new Error("Video dimensions are outside the supported range");
    const model = this.models.getMutable(request.modelId);
    if (model.category !== "video") throw new Error(`Model ${request.modelId} does not support video inference`);
    const provider = await this.select("video", request.modelId);
    if (provider.kind !== "comfyui-video") throw new Error(`Provider ${provider.id} does not implement video inference`);
    if (model.status !== "loaded" || model.runtimeProviderId !== provider.id) await this.models.activateForInference(request.modelId, provider.id);
    const startedAt = performance.now();
    try {
      const output = await this.runBounded(() => this.executeComfyVideo(provider, request));
      this.completed++;
      return { modelId: request.modelId, providerId: provider.id, backend: provider.kind, bytes: output.bytes, mimeType: output.mimeType, durationMs: Math.round(performance.now() - startedAt), createdAt: new Date().toISOString() };
    } catch (error) {
      this.failed++;
      throw error;
    }
  }

  private drain(): void {
    while (this.running + this.directRunning < this.maxParallel && this.queue.length) {
      const job = this.queue.shift()!;
      this.running++;
      void this.execute(job).finally(() => { this.running--; this.drain(); this.drainDirect(); });
    }
  }

  private runBounded<T>(work: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.directQueue.push({ work, resolve, reject });
      this.drainDirect();
    });
  }

  private drainDirect(): void {
    while (this.running + this.directRunning < this.maxParallel && this.directQueue.length) {
      const job = this.directQueue.shift()!;
      this.directRunning++;
      void job.work().then(job.resolve, (error) => job.reject(error instanceof Error ? error : new Error(String(error)))).finally(() => {
        this.directRunning--;
        this.drain();
        this.drainDirect();
      });
    }
  }

  private async execute(job: QueuedInference): Promise<void> {
    const startedAt = performance.now();
    try {
      const output = job.provider.kind === "ollama" ? await this.executeOllama(job.provider, job.request) : await this.executeOpenAiCompatible(job.provider, job.request);
      this.completed++;
      job.resolve({ modelId: job.request.modelId, providerId: job.provider.id, backend: job.provider.kind, output, durationMs: Math.round(performance.now() - startedAt), createdAt: new Date().toISOString() });
    } catch (error) {
      this.failed++;
      job.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async select(category: AiModelCategory, modelId: string): Promise<ProviderStatus> {
    const model = this.models.getMutable(modelId);
    const providerModelId = model.providerModelId?.trim() || modelId;
    const candidates = [...this.providers.values()].filter((provider) => provider.enabled && provider.supportedCategories.includes(category));
    let hasAvailableProvider = false;
    for (const provider of candidates) {
      await this.check(provider);
      if (!provider.available) continue;
      hasAvailableProvider = true;
      if (provider.models.includes(modelId) || provider.models.includes(providerModelId)) return provider;
    }
    if (hasAvailableProvider) throw new Error(`No available local inference provider has validated model ${modelId} for ${category} inference.`);
    throw new Error(`No available local inference provider supports ${category}. Configure a compatible loopback runtime first.`);
  }

  resolveProviderModelId(modelId: string): string {
    const model = this.models.getMutable(modelId);
    return model.providerModelId?.trim() || modelId;
  }

  private async check(provider: ProviderStatus): Promise<void> {
    try {
      const healthPath = provider.kind === "ollama" ? "/api/tags" : provider.kind === "automatic1111" ? "/sdapi/v1/options" : provider.kind === "comfyui-video" ? "/system_stats" : "/v1/models";
      const response = await fetch(`${provider.endpoint}${healthPath}`, { signal: AbortSignal.timeout(1_500) });
      if (!response.ok) throw new Error(`Health endpoint returned ${response.status}`);
      const health = await response.json().catch(() => ({})) as Record<string, unknown>;
      const details = await this.discoverProviderDetails(provider, health);
      provider.available = true; provider.error = undefined; provider.version = details.version; provider.models = details.models; provider.components = details.components; provider.capabilities = details.capabilities; provider.system = details.system;
    } catch (error) {
      provider.available = false; provider.error = error instanceof Error ? error.message : String(error);
    }
    provider.lastCheckedAt = new Date().toISOString();
  }

  private async discoverProviderDetails(provider: ProviderStatus, health: Record<string, unknown>): Promise<Pick<ProviderStatus, "version" | "models" | "components" | "capabilities" | "system">> {
    if (provider.kind === "ollama") {
      const models = Array.isArray(health.models) ? health.models.flatMap((item) => typeof item === "object" && item && typeof (item as { name?: unknown }).name === "string" ? [(item as { name: string }).name] : []) : [];
      return { models, version: typeof health.version === "string" ? health.version : undefined, capabilities: ["language", "vision", "embedding"] };
    }
    if (provider.kind === "automatic1111") {
      const [version, models, loras, vaes, upscalers] = await Promise.all([
        this.fetchJson(provider.endpoint, "/sdapi/v1/version"), this.fetchJson(provider.endpoint, "/sdapi/v1/sd-models"), this.fetchJson(provider.endpoint, "/sdapi/v1/loras"), this.fetchJson(provider.endpoint, "/sdapi/v1/sd-vae"), this.fetchJson(provider.endpoint, "/sdapi/v1/upscalers"),
      ]);
      const names = (items: unknown) => Array.isArray(items) ? items.flatMap((item) => typeof item === "object" && item ? [String((item as { title?: unknown; name?: unknown; model_name?: unknown }).title ?? (item as { name?: unknown }).name ?? (item as { model_name?: unknown }).model_name ?? "")] : []).filter(Boolean) : [];
      return { version: typeof version?.version === "string" ? version.version : undefined, models: names(models), components: { loras: names(loras), vaes: names(vaes), upscalers: names(upscalers) }, capabilities: ["image", "checkpoints", "lora", "vae", "upscalers"] };
    }
    if (provider.kind === "comfyui-video") {
      const system = health.system && typeof health.system === "object" ? health.system as { os?: string; ram_total?: number; ram_free?: number; devices?: Array<{ name?: string; vram_total?: number; vram_free?: number }> } : undefined;
      const device = system?.devices?.[0];
      const objectInfo = await this.fetchJson(provider.endpoint, "/object_info");
      const nodeNames = objectInfo && typeof objectInfo === "object" ? Object.keys(objectInfo).filter((name) => /video|animate|image.?to.?video|checkpoint|lora/i.test(name)) : [];
      const modelIds = Array.isArray((provider.configuration as { modelIds?: unknown } | undefined)?.modelIds) ? (provider.configuration as { modelIds: unknown[] }).modelIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : [];
      return { version: typeof health.version === "string" ? health.version : undefined, models: modelIds, components: { workflowNodes: nodeNames }, capabilities: ["video", "workflow", "image-to-video"], system: { gpuName: device?.name, vramTotalMb: bytesToMb(device?.vram_total), vramFreeMb: bytesToMb(device?.vram_free), ramTotalMb: bytesToMb(system?.ram_total), ramFreeMb: bytesToMb(system?.ram_free) } };
    }
    const models = await this.fetchJson(provider.endpoint, "/v1/models");
    return { models: Array.isArray(models?.data) ? models.data.flatMap((item: unknown) => typeof item === "object" && item && typeof (item as { id?: unknown }).id === "string" ? [(item as { id: string }).id] : []) : [], capabilities: [...provider.supportedCategories] };
  }

  private async fetchJson(endpoint: string, pathname: string): Promise<Record<string, unknown> | unknown[] | null> {
    try { const response = await fetch(`${endpoint}${pathname}`, { signal: AbortSignal.timeout(1_500) }); return response.ok ? await response.json() as Record<string, unknown> | unknown[] : null; } catch { return null; }
  }

  private async executeOllama(provider: ProviderStatus, request: InferenceRequest): Promise<string | number[] | Record<string, unknown>> {
    const runtimeModel = this.resolveProviderModelId(request.modelId);
    const path = request.category === "embedding" ? "/api/embed" : "/api/generate";
    const body = request.category === "embedding" ? { model: runtimeModel, input: request.prompt } : { ...(request.input ?? {}), model: runtimeModel, prompt: request.prompt, stream: false };
    const response = await fetch(`${provider.endpoint}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: request.signal ?? AbortSignal.timeout(300_000) });
    if (!response.ok) throw new Error(`Ollama inference failed with ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { response?: string; embeddings?: number[][]; embedding?: number[] };
    if (request.category === "embedding") return payload.embeddings?.[0] ?? payload.embedding ?? (() => { throw new Error("Ollama returned no embedding"); })();
    if (!payload.response) throw new Error("Ollama returned no inference response");
    return payload.response;
  }

  private async executeOpenAiCompatible(provider: ProviderStatus, request: InferenceRequest): Promise<string | number[] | Record<string, unknown>> {
    const runtimeModel = this.resolveProviderModelId(request.modelId);
    const response = await fetch(`${provider.endpoint}/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(request.input ?? {}), model: runtimeModel, messages: [{ role: "user", content: request.prompt }] }), signal: request.signal ?? AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Local OpenAI-compatible inference failed with ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Local OpenAI-compatible provider returned no inference response");
    return content;
  }

  private async executeAutomatic1111(provider: ProviderStatus, request: ImageInferenceRequest): Promise<ImageInferenceResult["images"]> {
    const imageToImage = Boolean(request.sourceImageBase64);
    const body = {
      prompt: request.prompt,
      negative_prompt: request.negativePrompt ?? "",
      width: request.width,
      height: request.height,
      steps: request.steps ?? 28,
      batch_size: request.batchSize ?? 1,
      seed: request.seed ?? -1,
      override_settings: { sd_model_checkpoint: request.modelId },
      ...(imageToImage ? { init_images: [request.sourceImageBase64], denoising_strength: request.strength ?? 0.55 } : {}),
    };
    const response = await fetch(`${provider.endpoint}/sdapi/v1/${imageToImage ? "img2img" : "txt2img"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: request.signal ?? AbortSignal.timeout(300_000) });
    if (!response.ok) throw new Error(`Automatic1111 image inference failed with ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { images?: string[] };
    if (!payload.images?.length) throw new Error("Automatic1111 returned no generated images");
    return payload.images.map((encoded) => decodeGeneratedImage(encoded));
  }

  private async executeComfyVideo(provider: ProviderStatus, request: VideoInferenceRequest): Promise<{ bytes: Uint8Array; mimeType: VideoInferenceResult["mimeType"] }> {
    const sourceImageName = request.sourceImageBase64 ? await this.uploadComfySourceImage(provider, request.sourceImageBase64, request.signal) : undefined;
    const workflow = createComfyWorkflow(provider.configuration, request, sourceImageName);
    const queued = await fetch(`${provider.endpoint}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: workflow }), signal: request.signal ?? AbortSignal.timeout(30_000) });
    if (!queued.ok) throw new Error(`ComfyUI video workflow submission failed with ${queued.status}: ${await queued.text()}`);
    const queuedPayload = await queued.json() as { prompt_id?: string };
    if (!queuedPayload.prompt_id) throw new Error("ComfyUI did not return a video workflow prompt ID");
    const deadline = Date.now() + 15 * 60_000;
    while (Date.now() < deadline) {
      const history = await fetch(`${provider.endpoint}/history/${encodeURIComponent(queuedPayload.prompt_id)}`, { signal: request.signal ?? AbortSignal.timeout(15_000) });
      if (!history.ok) throw new Error(`ComfyUI video workflow status failed with ${history.status}`);
      const record = (await history.json() as Record<string, { status?: { status_str?: string }; outputs?: Record<string, { videos?: Array<{ filename: string; subfolder?: string; type?: string }>; gifs?: Array<{ filename: string; subfolder?: string; type?: string }> }> }>)[queuedPayload.prompt_id];
      if (record?.status?.status_str === "error") throw new Error("ComfyUI video workflow failed");
      const artifact = Object.values(record?.outputs ?? {}).flatMap((output) => [...(output.videos ?? []), ...(output.gifs ?? [])])[0];
      if (artifact) {
        const query = new URLSearchParams({ filename: artifact.filename, subfolder: artifact.subfolder ?? "", type: artifact.type ?? "output" });
        const response = await fetch(`${provider.endpoint}/view?${query}`, { signal: request.signal ?? AbortSignal.timeout(120_000) });
        if (!response.ok) throw new Error(`ComfyUI encoded video download failed with ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        return decodeGeneratedVideo(bytes);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
    }
    throw new Error("ComfyUI video workflow timed out after 15 minutes");
  }

  private async uploadComfySourceImage(provider: ProviderStatus, encoded: string, signal?: AbortSignal): Promise<string> {
    const bytes = Buffer.from(encoded.replace(/^data:image\/[a-z]+;base64,/i, ""), "base64");
    if (!bytes.length || bytes.length > 15 * 1024 * 1024) throw new Error("Video source image is empty or exceeds 15 MB");
    const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png" : bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "image/jpeg" : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" ? "image/webp" : null;
    if (!mimeType) throw new Error("Video source image must be PNG, JPEG, or WebP");
    const form = new FormData(); form.append("image", new Blob([bytes], { type: mimeType }), `kwizera-source.${mimeType.split("/")[1]}`);
    const response = await fetch(`${provider.endpoint}/upload/image`, { method: "POST", body: form, signal: signal ?? AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`ComfyUI source image upload failed with ${response.status}: ${await response.text()}`);
    const result = await response.json() as { name?: string; subfolder?: string };
    if (!result.name) throw new Error("ComfyUI source image upload returned no filename");
    return result.subfolder ? `${result.subfolder}/${result.name}` : result.name;
  }
}

function decodeGeneratedImage(encoded: string): { bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" | "image/webp"; width?: number; height?: number } {
  const value = encoded.replace(/^data:image\/(png|jpeg|webp);base64,/i, "");
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new Error("Generated image payload is empty or exceeds 50 MB");
  const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png" : bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "image/jpeg" : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" ? "image/webp" : null;
  if (!mimeType) throw new Error("Generated image payload has an unsupported format");
  const width = mimeType === "image/png" && bytes.length >= 24 ? bytes.readUInt32BE(16) : undefined;
  const height = mimeType === "image/png" && bytes.length >= 24 ? bytes.readUInt32BE(20) : undefined;
  return { bytes, mimeType, width, height };
}

function createComfyWorkflow(configuration: Record<string, unknown> | undefined, request: VideoInferenceRequest, sourceImageName?: string): Record<string, unknown> {
  const config = configuration as { workflow?: Record<string, { inputs?: Record<string, unknown> }>; promptNodeId?: string; imageNodeId?: string; durationNodeId?: string; frameRateNodeId?: string; widthNodeId?: string; heightNodeId?: string } | undefined;
  if (!config?.workflow || !config.promptNodeId) throw new Error("ComfyUI video provider requires configuration.workflow and configuration.promptNodeId");
  const workflow = structuredClone(config.workflow);
  const setInput = (nodeId: string | undefined, key: string, value: unknown) => { if (!nodeId) return; const node = workflow[nodeId]; if (!node) throw new Error(`ComfyUI workflow node ${nodeId} is missing`); node.inputs ??= {}; node.inputs[key] = value; };
  setInput(config.promptNodeId, "text", request.prompt);
  setInput(config.durationNodeId, "value", request.durationSeconds);
  setInput(config.frameRateNodeId, "value", request.frameRate);
  setInput(config.widthNodeId, "width", request.width);
  setInput(config.heightNodeId, "height", request.height);
  if (sourceImageName) setInput(config.imageNodeId, "image", sourceImageName);
  return workflow;
}

function decodeGeneratedVideo(bytes: Uint8Array): { bytes: Uint8Array; mimeType: VideoInferenceResult["mimeType"] } {
  if (!bytes.length || bytes.length > 2 * 1024 * 1024 * 1024) throw new Error("Generated video payload is empty or exceeds 2 GB");
  const header = Buffer.from(bytes.subarray(0, 16));
  const mimeType = header.subarray(4, 8).toString("ascii") === "ftyp" ? "video/mp4" : header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) ? "video/webm" : null;
  if (!mimeType) throw new Error("ComfyUI returned an unsupported encoded video format");
  return { bytes, mimeType };
}

function bytesToMb(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value / 1024 / 1024) : undefined;
}