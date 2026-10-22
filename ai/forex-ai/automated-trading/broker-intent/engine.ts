/**
 * Phase 57.0 — Broker-intent engine (validate + persist, never submit).
 */
import { buildBrokerCapabilityMatrix } from "./capabilities.js";
import { evaluateBrokerIntentPreflight, type BrokerIntentPreflightInput } from "./preflight.js";
import {
  getAtBrokerIntentStore,
  type AtBrokerIntentStore,
} from "./store.js";
import type { BrokerIntentPublicStatus, BrokerIntentRecord } from "./types.js";
import { BROKER_INTENT_BANNER, BROKER_INTENT_PHASE } from "./types.js";

export class AtBrokerIntentEngine {
  private readonly store: AtBrokerIntentStore;

  constructor(deps?: { store?: AtBrokerIntentStore; storageRoot?: string }) {
    this.store = deps?.store ?? getAtBrokerIntentStore(deps?.storageRoot);
  }

  getPublicStatus(): BrokerIntentPublicStatus {
    const history = this.store.list(12);
    return {
      phase: BROKER_INTENT_PHASE,
      banner: BROKER_INTENT_BANNER,
      intentCount: history.length,
      latest: history[0] ?? null,
      history,
      capabilities: buildBrokerCapabilityMatrix(),
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      executionDisabled: true,
      note: "Broker intents are architecture-only. EXECUTION_FORBIDDEN. No broker mutation.",
    };
  }

  /**
   * Validate and optionally persist an intent. Never calls broker mutation.
   * Duplicate idempotency keys return the existing record without creating a second intent.
   */
  async validateAndPersist(
    input: BrokerIntentPreflightInput,
    opts?: { persist?: boolean },
  ): Promise<{
    ok: true;
    preflightPassed: boolean;
    maySubmitToBroker: false;
    intent: BrokerIntentRecord;
    duplicated: boolean;
    placesOrders: false;
    acceptsForExecution: false;
    mutatesBroker: false;
  }> {
    const existing = this.store.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return {
        ok: true,
        preflightPassed: false,
        maySubmitToBroker: false,
        intent: existing,
        duplicated: true,
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
      };
    }

    const result = evaluateBrokerIntentPreflight({
      ...input,
      duplicateIdempotencyKey: false,
      // Owner authorization is never granted in this phase.
      ownerExecutionAuthorized: false,
    });

    let intent = result.intent;
    const persist = opts?.persist !== false;
    if (persist) {
      intent = await this.store.append(intent);
    }

    return {
      ok: true,
      preflightPassed: result.preflightPassed,
      maySubmitToBroker: false,
      intent,
      duplicated: false,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
  }
}

let engineSingleton: AtBrokerIntentEngine | null = null;

export function getAtBrokerIntentEngine(storageRoot?: string): AtBrokerIntentEngine {
  if (storageRoot) return new AtBrokerIntentEngine({ storageRoot });
  if (!engineSingleton) engineSingleton = new AtBrokerIntentEngine();
  return engineSingleton;
}

export function resetAtBrokerIntentEngineForTests(): void {
  engineSingleton = null;
}
