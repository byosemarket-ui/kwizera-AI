import type { PmvWorkflowOrchestrator } from "./engine.js";

let current: PmvWorkflowOrchestrator | null = null;

export function setPmvOrchestrator(next: PmvWorkflowOrchestrator | null): void {
  current = next;
}

export function getPmvOrchestrator(): PmvWorkflowOrchestrator | null {
  return current;
}
