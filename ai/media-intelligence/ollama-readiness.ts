/**
 * Assess Ollama readiness without installing models.
 * Reports honest capacity for concurrent FFmpeg + LLM workloads.
 */
import os from "node:os";
import {
  fetchOllamaTags,
  isOllamaDisabled,
  isSmallReasoningModel,
  ollamaBaseUrl,
  preferredReasoningModelId,
  selectPreferredReasoningModel,
  type OllamaServiceStatus,
} from "../ai-provider/ollama-client.js";

export type OllamaModelTier = "none" | "tiny" | "small" | "medium" | "large";

export interface OllamaModelStrategy {
  tier: OllamaModelTier;
  recommendedModelIds: string[];
  selectedInstalledModel: string | null;
  reason: string;
  /** Manual install may be appropriate — never means auto-install. */
  safeToInstall: boolean;
  maxConcurrent: number;
}

export interface OllamaReadinessReport {
  ready: boolean;
  status: OllamaServiceStatus;
  installationStatus:
    | "DISABLED"
    | "NOT_INSTALLED"
    | "INSTALLED_UNREACHABLE"
    | "SERVICE_UNAVAILABLE"
    | "MODEL_MISSING"
    | "MODEL_READY"
    | "READY"
    | "FALLBACK_ACTIVE";
  ollamaInstalled: boolean;
  ollamaReachable: boolean;
  disabled: boolean;
  baseUrl: string;
  installedModels: string[];
  selectedModel: string | null;
  recommendedAction: "defer" | "install-small-model" | "insufficient-resources" | "use-installed-model" | "disabled";
  modelStrategy: OllamaModelStrategy;
  cpuCores: number;
  totalMemoryGb: number;
  freeMemoryGb: number;
  loadAverage: number[];
  notes: string[];
  fallbackActive: boolean;
}

export async function assessOllamaReadiness(): Promise<OllamaReadinessReport> {
  const notes: string[] = [];
  const disabled = isOllamaDisabled();
  const baseUrl = ollamaBaseUrl();
  const cpuCores = os.cpus().length;
  const totalMemoryGb = Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10;
  const freeMemoryGb = Math.round((os.freemem() / (1024 ** 3)) * 10) / 10;
  const loadAverage = os.loadavg();

  if (disabled) {
    notes.push("Ollama disabled via KWIZERA_OLLAMA_DISABLED — deterministic Creative Director remains active.");
    return {
      ready: false,
      status: "DISABLED",
      installationStatus: "DISABLED",
      ollamaInstalled: false,
      ollamaReachable: false,
      disabled: true,
      baseUrl,
      installedModels: [],
      selectedModel: null,
      recommendedAction: "disabled",
      modelStrategy: {
        tier: "none",
        recommendedModelIds: [],
        selectedInstalledModel: null,
        reason: "Ollama explicitly disabled.",
        safeToInstall: false,
        maxConcurrent: 1,
      },
      cpuCores,
      totalMemoryGb,
      freeMemoryGb,
      loadAverage,
      notes,
      fallbackActive: true,
    };
  }

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
  const criticallyLowMemory = freeMemoryGb < 0.8;
  const preferred = preferredReasoningModelId();
  const selectedModel = selectPreferredReasoningModel(tags.models, preferred);
  const modelStrategy = buildModelStrategy({
    totalMemoryGb,
    freeMemoryGb,
    highLoad,
    selectedInstalledModel: selectedModel,
  });
  notes.push(modelStrategy.reason);

  let recommendedAction: OllamaReadinessReport["recommendedAction"] = "defer";
  if (!modelStrategy.safeToInstall && !selectedModel) {
    recommendedAction = "insufficient-resources";
  } else if (selectedModel) {
    recommendedAction = "use-installed-model";
  } else if (modelStrategy.safeToInstall) {
    recommendedAction = "install-small-model";
    notes.push("Architecture is ready for a small reasoning model when an operator installs Ollama manually.");
  }

  if (highLoad) {
    notes.push("System load is elevated — keep Ollama concurrency at 1 and avoid overlapping FFmpeg renders.");
  }
  if (criticallyLowMemory) {
    notes.push("Free memory is critically low — defer model inference until RAM recovers.");
  }

  const modelFitsHost = Boolean(
    selectedModel
    && (
      totalMemoryGb >= 8
      || isSmallReasoningModel(selectedModel)
    )
    && !criticallyLowMemory,
  );

  const ready = ollamaReachable && Boolean(selectedModel) && modelFitsHost;

  let status: OllamaServiceStatus = "UNAVAILABLE";
  if (!ollamaReachable) {
    status = ollamaInstalled ? "ERROR" : "UNAVAILABLE";
  } else if (selectedModel && ready) {
    status = "READY";
  } else if (ollamaReachable) {
    status = "AVAILABLE";
  }

  let installationStatus: OllamaReadinessReport["installationStatus"] = "NOT_INSTALLED";
  if (!ollamaInstalled && !ollamaReachable) {
    installationStatus = "NOT_INSTALLED";
  } else if (ollamaInstalled && !ollamaReachable) {
    installationStatus = "INSTALLED_UNREACHABLE";
  } else if (!ollamaReachable) {
    installationStatus = "SERVICE_UNAVAILABLE";
  } else if (!selectedModel) {
    installationStatus = "MODEL_MISSING";
  } else if (ready) {
    installationStatus = "READY";
  } else {
    installationStatus = "MODEL_READY";
  }

  return {
    ready,
    status,
    installationStatus: ready ? "READY" : (installationStatus === "READY" ? "FALLBACK_ACTIVE" : installationStatus),
    ollamaInstalled,
    ollamaReachable,
    disabled: false,
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
    fallbackActive: !ready,
  };
}

function buildModelStrategy(input: {
  totalMemoryGb: number;
  freeMemoryGb: number;
  highLoad: boolean;
  selectedInstalledModel: string | null;
}): OllamaModelStrategy {
  const tinyIds = ["llama3.2:1b", "qwen2.5:0.5b", "tinyllama"];
  const smallIds = ["llama3.2:1b", "qwen2.5:1.5b", "phi3:mini", "gemma2:2b"];

  if (input.totalMemoryGb < 4) {
    return {
      tier: "tiny",
      recommendedModelIds: tinyIds,
      selectedInstalledModel: input.selectedInstalledModel,
      reason: "Limited RAM host — only tiny reasoning models are appropriate after manual install; keep concurrency=1 and never auto-pull.",
      safeToInstall: input.freeMemoryGb >= 1.0 && !input.highLoad,
      maxConcurrent: 1,
    };
  }
  if (input.totalMemoryGb < 8) {
    return {
      tier: "small",
      recommendedModelIds: smallIds,
      selectedInstalledModel: input.selectedInstalledModel,
      reason: "Small VPS — prefer 1B–3B reasoning models only; do not install vision or 7B+ models.",
      safeToInstall: input.freeMemoryGb >= 1.2,
      maxConcurrent: 1,
    };
  }
  if (input.totalMemoryGb < 12 || input.freeMemoryGb < 4) {
    return {
      tier: "small",
      recommendedModelIds: smallIds,
      selectedInstalledModel: input.selectedInstalledModel,
      reason: "Prefer a small VPS-friendly reasoning model if Ollama is enabled.",
      safeToInstall: true,
      maxConcurrent: 1,
    };
  }
  if (input.totalMemoryGb < 24) {
    return {
      tier: "medium",
      recommendedModelIds: ["llama3.2:3b", "phi3:mini", "qwen2.5:1.5b"],
      selectedInstalledModel: input.selectedInstalledModel,
      reason: "Medium models may be used carefully when FFmpeg is idle.",
      safeToInstall: true,
      maxConcurrent: 1,
    };
  }
  return {
    tier: "large",
    recommendedModelIds: ["llama3.1:8b", "mistral:7b", "qwen2.5:7b"],
    selectedInstalledModel: input.selectedInstalledModel,
    reason: "Host capacity may support larger reasoning models when configured deliberately.",
    safeToInstall: true,
    maxConcurrent: 2,
  };
}

/** Public API payload — omits host URLs, RAM, CPU, and load averages. */
export interface PublicOllamaReadiness {
  ready: boolean;
  status: OllamaServiceStatus;
  installationStatus: OllamaReadinessReport["installationStatus"];
  ollamaInstalled: boolean;
  ollamaReachable: boolean;
  disabled: boolean;
  fallbackActive: boolean;
  installedModelCount: number;
  selectedModel: string | null;
  recommendedAction: OllamaReadinessReport["recommendedAction"];
  modelStrategy: Pick<
    OllamaModelStrategy,
    "tier" | "safeToInstall" | "selectedInstalledModel" | "reason" | "recommendedModelIds" | "maxConcurrent"
  >;
  autoInstallDisabled: true;
  notes: string[];
}

export function toPublicOllamaReadiness(report: OllamaReadinessReport): PublicOllamaReadiness {
  return {
    ready: report.ready,
    status: report.status,
    installationStatus: report.installationStatus,
    ollamaInstalled: report.ollamaInstalled,
    ollamaReachable: report.ollamaReachable,
    disabled: report.disabled,
    fallbackActive: report.fallbackActive,
    installedModelCount: report.installedModels.length,
    selectedModel: report.selectedModel,
    recommendedAction: report.recommendedAction,
    modelStrategy: {
      tier: report.modelStrategy.tier,
      safeToInstall: report.modelStrategy.safeToInstall,
      selectedInstalledModel: report.modelStrategy.selectedInstalledModel,
      reason: report.modelStrategy.reason,
      recommendedModelIds: report.modelStrategy.recommendedModelIds,
      maxConcurrent: report.modelStrategy.maxConcurrent,
    },
    autoInstallDisabled: true,
    notes: report.notes,
  };
}
