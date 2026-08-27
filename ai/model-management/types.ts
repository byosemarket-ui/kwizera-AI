export type AiModelCategory = "image" | "video" | "audio" | "voice" | "language" | "vision" | "embedding" | "future";
export type ModelStatus = "available" | "installed" | "loaded" | "unhealthy" | "updating" | "removed";

export interface ModelResourceRequirements { ramMb: number; vramMb?: number; storageMb: number; cpuCores?: number; }
export interface AiModel { id: string; name: string; category: AiModelCategory; version: string; description: string; status: ModelStatus; sourcePath?: string; artifactPath?: string; checksum?: string; /** Executable name at the local provider (e.g. Ollama tag). */ providerModelId?: string; installedAt?: string; loadedAt?: string; runtimeProviderId?: string; lastValidatedAt?: string; health: "healthy" | "warning" | "unhealthy"; requirements: ModelResourceRequirements; capabilities: string[]; usageCount: number; lastUsedAt?: string; }
export interface HardwareSnapshot { detectedAt: string; gpu: { available: boolean; name: string; memoryMb?: number; driver?: string }; cpu: { model: string; cores: number; load: number }; ram: { totalMb: number; freeMb: number; usedMb: number }; storage: { totalMb: number; freeMb: number; usedMb: number }; }
export interface ModelSettings { autoUnloadMinutes: number; cacheLimit: number; preferGpu: boolean; validateOnLoad: boolean; allowExternalArtifacts: boolean; }
export interface ModelLog { at: string; level: "info" | "warning" | "error"; event: string; detail: string; modelId?: string; }
export interface ModelStore { models: AiModel[]; settings: ModelSettings; logs: ModelLog[]; }

export type InferenceBackendKind = "automatic1111" | "comfyui-video" | "ollama" | "openai-compatible";
export interface LocalInferenceProvider {
	id: string;
	name: string;
	kind: InferenceBackendKind;
	endpoint: string;
	enabled: boolean;
	supportedCategories: AiModelCategory[];
	configuration?: Record<string, unknown>;
}
export interface ProviderValidationStatus extends LocalInferenceProvider {
	available: boolean;
	lastCheckedAt?: string;
	error?: string;
	version?: string;
	models: string[];
	components?: Record<string, string[]>;
	capabilities: string[];
	system?: { gpuName?: string; vramTotalMb?: number; vramFreeMb?: number; ramTotalMb?: number; ramFreeMb?: number };
}
export interface InferenceRequest {
	modelId: string;
	category: AiModelCategory;
	prompt: string;
	input?: Record<string, unknown>;
	priority?: "background" | "normal" | "high";
	signal?: AbortSignal;
}
export interface InferenceResult {
	modelId: string;
	providerId: string;
	backend: InferenceBackendKind;
	output: string | number[] | Record<string, unknown>;
	durationMs: number;
	createdAt: string;
}
export interface InferenceRuntimeStatus {
	providers: ProviderValidationStatus[];
	queued: number;
	running: number;
	maxParallel: number;
	completed: number;
	failed: number;
}
export interface ImageInferenceRequest {
	modelId: string;
	prompt: string;
	negativePrompt?: string;
	width: number;
	height: number;
	steps?: number;
	batchSize?: number;
	seed?: number;
	strength?: number;
	sourceImageBase64?: string;
	signal?: AbortSignal;
}
export interface ImageInferenceResult {
	modelId: string;
	providerId: string;
	backend: InferenceBackendKind;
	images: Array<{ bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" | "image/webp"; width?: number; height?: number }>;
	durationMs: number;
	createdAt: string;
}
export interface VideoInferenceRequest {
	modelId: string;
	prompt: string;
	durationSeconds: number;
	width: number;
	height: number;
	frameRate: number;
	sourceImageBase64?: string;
	signal?: AbortSignal;
}
export interface VideoInferenceResult {
	modelId: string;
	providerId: string;
	backend: InferenceBackendKind;
	bytes: Uint8Array;
	mimeType: "video/mp4" | "video/webm" | "video/quicktime" | "video/x-matroska";
	durationMs: number;
	createdAt: string;
}