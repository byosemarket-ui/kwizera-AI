/**
 * Assess Ollama readiness without installing models.
 * Reports honest capacity for concurrent FFmpeg + LLM workloads.
 */
import os from "node:os";
import {
  fetchOllamaTags,
  ollamaBaseUrl,
  selectPreferredReasoningModel,
  type OllamaServiceStatus,
} from "../ai-provider/ollama-client.js";

export interface OllamaModelStrategy {
  tier: "none" | "small" | "medium" | "large";
  recommendedModelIds: string[];
  selectedInstalledModel: string | null;
  reason: string;
  safeToInstall: boolean;
}

export interface OllamaReadinessReport {
  ready: boolean;
  status: OllamaServiceStatus;
  ollamaInstalled: boolean;
  ollamaReachable: boolean;
  baseUrl: string;
  installedModels: string[];
  selectedModel: string | null;
  recommendedAction: "defer" | "install-small-model" | "insufficient-resources" | "use-installed-model";
  modelStrategy: OllamaModelStrategy;
  cpuCores: number;
  totalMemoryGb: number;
  freeMemoryGb: number;
  loadAverage: number[];
  notes: string[];
}

export async function assessOllamaReadiness(): Promise<OllamaReadinessReport> {
  const notes: string[] = [];
  const baseUrl = ollamaBaseUrl();
  const cpuCores = os.cpus().length;
  const totalMemoryGb = Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10;
  const freeMemoryGb = Math.round((os.freemem() / (1024 ** 3)) * 10) / 10;
  const loadAverage = os.loadavg();

  let ollamaInstalled = false;
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);
    await exec(process.platform === "win32" ? "where" : "which", ["ollama"], { timeout: 3000 });
    ollamaInstalled = true;
    notes.push("Ollama binary found on PATH.");
  } catch {
    notes.push("Ollama not installed — deterministic creative planning remains available.");
  }

  const tags = await fetchOllamaTags({ baseUrl });
  const ollamaReachable = tags.ok;
  const installedModels = tags.models.map((m) => m.name);
  if (ollamaReachable) {
    notes.push(
      installedModels.length
        ? `Ollama reachable with ${installedModels.length} model(s).`
        : "Ollama reachable but no models are installed.",
    );
  } else if (tags.error) {
    notes.push(tags.error);
  }

  const highLoad = loadAverage[0] > cpuCores * 1.5;
  const lowMemory = freeMemoryGb < 2;
  const insufficientResources = totalMemoryGb < 8 || (lowMemory && highLoad);

  if (insufficientResources) {
    notes.push("Host resources are constrained for concurrent FFmpeg + large LLM workloads.");
  }
  if (highLoad) {
    notes.push("System load is elevated — defer heavy model work until idle.");
  }

  const preferred = process.env.KWIZERA_OLLAMA_REASONING_MODEL ?? "llama3.2:1b";
  const selectedModel = selectPreferredReasoningModel(tags.models, preferred);
  const modelStrategy = buildModelStrategy({
    totalMemoryGb,
    freeMemoryGb,
    insufficientResources,
    selectedInstalledModel: selectedModel,
  });
  notes.push(modelStrategy.reason);

  let recommendedAction: OllamaReadinessReport["recommendedAction"] = "defer";
  if (insufficientResources) {
    recommendedAction = "insufficient-resources";
  } else if (selectedModel) {
    recommendedAction = "use-installed-model";
  } else if (!ollamaInstalled && totalMemoryGb >= 8) {
    recommendedAction = "install-small-model";
    notes.push("Architecture is ready for a small reasoning model when product chooses to enable Ollama.");
  } else if (ollamaInstalled && ollamaReachable && !selectedModel) {
    recommendedAction = "install-small-model";
    notes.push("Install a small model only when free RAM stays safe for FFmpeg rendering.");
  }

  const status: OllamaServiceStatus = !ollamaReachable
    ? (ollamaInstalled ? "ERROR" : "UNAVAILABLE")
    : selectedModel
      ? "READY"
      : "AVAILABLE";

  const ready = ollamaReachable && Boolean(selectedModel) && !insufficientResources;

  return {
    ready,
    status,
    ollamaInstalled,
    ollamaReachable,
    baseUrl,
    installedModels,
    selectedModel,
    recommendedAction,
    modelStrategy,
    cpuCores,
    totalMemoryGb,
    freeMemoryGb,
    loadAverage,
    notes,
  };
}

function buildModelStrategy(input: {
  totalMemoryGb: number;
  freeMemoryGb: number;
  insufficientResources: boolean;
  selectedInstalledModel: string | null;
}): OllamaModelStrategy {
  if (input.insufficientResources || input.totalMemoryGb < 8) {
    return {
      tier: "none",
      recommendedModelIds: [],
      selectedInstalledModel: input.selectedInstalledModel,
      reason: "Do not install Ollama models on this host — keep deterministic Creative Director fallback.",
      safeToInstall: false,
    };
  }
  if (input.totalMemoryGb < 12 || input.freeMemoryGb < 4) {
    return {
      tier: "small",
      recommendedModelIds: ["llama3.2:1b", "qwen2.5:0.5b", "tinyllama"],
      selectedInstalledModel: input.selectedInstalledModel,
      reason: "Prefer a small VPS-friendly reasoning model if Ollama is enabled.",
      safeToInstall: true,
    };
  }
  if (input.totalMemoryGb < 24) {
    return {
      tier: "medium",
      recommendedModelIds: ["llama3.2:3b", "phi3:mini", "qwen2.5:1.5b"],
      selectedInstalledModel: input.selectedInstalledModel,
      reason: "Medium models may be used carefully when FFmpeg is idle.",
      safeToInstall: true,
    };
  }
  return {
    tier: "large",
    recommendedModelIds: ["llama3.1:8b", "mistral:7b", "qwen2.5:7b"],
    selectedInstalledModel: input.selectedInstalledModel,
    reason: "Host capacity may support larger reasoning models when configured deliberately.",
    safeToInstall: true,
  };
}
