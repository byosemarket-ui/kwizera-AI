import type { PmvWorkflowOrchestrator } from "./engine.js";
import type { ModeReadinessProbe } from "./mode-readiness.js";

let current: PmvWorkflowOrchestrator | null = null;
let modeReadiness: ModeReadinessProbe | null = null;

export function setPmvOrchestrator(next: PmvWorkflowOrchestrator | null): void {
  current = next;
}

export function getPmvOrchestrator(): PmvWorkflowOrchestrator | null {
  return current;
}

export function setPmvModeReadiness(next: ModeReadinessProbe | null): void {
  modeReadiness = next;
}

export function getPmvModeReadiness(): ModeReadinessProbe | null {
  return modeReadiness;
}
