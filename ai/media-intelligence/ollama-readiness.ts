/**
 * Assess Ollama readiness without installing. Does not expose sensitive server paths.
 */
import os from "node:os";

export interface OllamaReadinessReport {
  ready: boolean;
  ollamaInstalled: boolean;
  recommendedAction: "defer" | "install-small-model" | "insufficient-resources";
  cpuCores: number;
  totalMemoryGb: number;
  freeMemoryGb: number;
  loadAverage: number[];
  notes: string[];
}

export async function assessOllamaReadiness(): Promise<OllamaReadinessReport> {
  const notes: string[] = [];
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
    notes.push("Ollama not installed — defer installation until structured intelligence pipeline is verified.");
  }

  const highLoad = loadAverage[0] > cpuCores * 1.5;
  const lowMemory = freeMemoryGb < 2;
  const insufficientResources = totalMemoryGb < 8 || (lowMemory && highLoad);

  if (insufficientResources) {
    notes.push("VPS resources are constrained for concurrent FFmpeg + large LLM workloads.");
  }
  if (highLoad) {
    notes.push("System load is elevated — defer Ollama until idle window.");
  }

  let recommendedAction: OllamaReadinessReport["recommendedAction"] = "defer";
  if (!ollamaInstalled && !insufficientResources && totalMemoryGb >= 8) {
    recommendedAction = "install-small-model";
    notes.push("Architecture is ready for a small reasoning model when product chooses to enable Ollama.");
  } else if (insufficientResources) {
    recommendedAction = "insufficient-resources";
  }

  const ready = ollamaInstalled && !insufficientResources;

  return {
    ready,
    ollamaInstalled,
    recommendedAction,
    cpuCores,
    totalMemoryGb,
    freeMemoryGb,
    loadAverage,
    notes,
  };
}
