/**
 * Phase 56.2 / 56.2.2 — Simulation-only risk engine public exports.
 */
export * from "./types.js";
export * from "./allowlist.js";
export * from "./allocation-3r.js";
export * from "./capital-budget.js";
export * from "./profit-protection.js";
export {
  validateSimulationDraft,
  normalizeSimRiskPolicy,
} from "./engine.js";
export { assembleSimDraftInput, type AssembleSimDraftParams } from "./assemble.js";
export {
  AtSimRiskStore,
  getAtSimRiskStore,
  resetAtSimRiskStoreForTests,
} from "./store.js";

import { AT_INSTRUMENT_ALLOWLIST } from "./allowlist.js";
import { validateSimulationDraft, normalizeSimRiskPolicy } from "./engine.js";
import { assembleSimDraftInput, type AssembleSimDraftParams } from "./assemble.js";
import {
  getAtSimRiskStore,
  resetAtSimRiskStoreForTests,
  type AtSimRiskStore,
} from "./store.js";
import {
  AT_SIM_RISK_BANNER,
  type AtSimDraftInput,
  type AtSimDraftResult,
  type AtSimRiskPolicy,
  type AtSimRiskPublicStatus,
} from "./types.js";

export class AtSimRiskEngine {
  private readonly store: AtSimRiskStore;

  constructor(deps?: { store?: AtSimRiskStore; storageRoot?: string }) {
    this.store = deps?.store ?? getAtSimRiskStore(deps?.storageRoot);
  }

  getPolicy(): AtSimRiskPolicy {
    return this.store.getPolicy();
  }

  async updatePolicy(raw: unknown): Promise<AtSimRiskPolicy> {
    const next = normalizeSimRiskPolicy({
      ...this.store.getPolicy(),
      ...(raw && typeof raw === "object" ? raw : {}),
      updatedAtUtc: new Date().toISOString(),
      updatedBy: "admin",
    });
    return this.store.setPolicy(next);
  }

  getLatest(): AtSimDraftResult | null {
    return this.store.getLatest();
  }

  listHistory(limit = 12): AtSimDraftResult[] {
    return this.store.listHistory(limit);
  }

  sumActiveReserved(environment: string, excludeDraftId?: string | null): number {
    return this.store.sumActiveReserved(environment, excludeDraftId);
  }

  /** Pure validate without persistence. */
  validate(input: AtSimDraftInput): AtSimDraftResult {
    return validateSimulationDraft(input);
  }

  async validateAndPersist(input: AtSimDraftInput): Promise<AtSimDraftResult> {
    const result = validateSimulationDraft(input);
    await this.store.append(result);
    return result;
  }

  async validateFromContext(
    params: Omit<AssembleSimDraftParams, "policy"> & { persist?: boolean },
  ): Promise<AtSimDraftResult> {
    const input = assembleSimDraftInput({
      ...params,
      policy: this.store.getPolicy(),
    });
    if (params.persist === false) return this.validate(input);
    return this.validateAndPersist(input);
  }

  publicStatus(): AtSimRiskPublicStatus {
    return {
      phase: "56.2.3",
      schemaVersion: "at-simulation-risk-draft-v1",
      policy: this.store.getPolicy(),
      allowlist: [...AT_INSTRUMENT_ALLOWLIST],
      latest: this.store.getLatest(),
      historyCount: this.store.historyCount(),
      simulationOnly: true,
      placesOrders: false,
      acceptsForExecution: false,
      note: AT_SIM_RISK_BANNER,
    };
  }
}

let engineSingleton: AtSimRiskEngine | null = null;

export function getAtSimRiskEngine(storageRoot?: string): AtSimRiskEngine {
  if (storageRoot) return new AtSimRiskEngine({ storageRoot });
  if (!engineSingleton) engineSingleton = new AtSimRiskEngine();
  return engineSingleton;
}

export function resetAtSimRiskEngineForTests(): void {
  engineSingleton = null;
  resetAtSimRiskStoreForTests();
}
