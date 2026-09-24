/**
 * Phase 7 — server wiring for image preparation (same Admin runtime getter as I2V/vision).
 */

import type { CapabilityRuntime } from "../admin-control-plane/capability-runtime.js";

type RuntimeGetter = () => CapabilityRuntime | null;

let getter: RuntimeGetter = () => null;

export function setImagePreparationRuntime(next: RuntimeGetter | null): void {
  getter = next ?? (() => null);
}

export function getImagePreparationRuntime(): CapabilityRuntime | null {
  try {
    return getter();
  } catch {
    return null;
  }
}
