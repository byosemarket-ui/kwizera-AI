/**
 * Phase 2 — Apply precheck result to the broker-execution foundation lifecycle.
 * Never transitions to READY_TO_SUBMIT or any submit-adjacent state.
 */
import { getAtBrokerExecutionStore } from "./store.js";
import { runPreExecutionValidation } from "./precheck.js";
import type { AtPreExecutionValidationInput, AtPreExecutionValidationResult } from "./precheck-types.js";
import type { AtBrokerExecutionLifecycle } from "./types.js";

export interface ApplyPreExecutionValidationResult {
  validation: AtPreExecutionValidationResult;
  lifecycleBefore: AtBrokerExecutionLifecycle;
  lifecycleAfter: AtBrokerExecutionLifecycle;
  transition: {
    ok: boolean;
    code?: string;
    message?: string;
    correlationId?: string;
  };
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionAuthorized: false;
}

/**
 * Run pure validation then legally transition:
 * - domain hard fail → PRECHECK_BLOCKED
 * - otherwise → AUTHORIZATION_REQUIRED (still not executable; Master remains OFF)
 */
export function applyPreExecutionValidation(
  input: AtPreExecutionValidationInput & {
    storageRoot?: string;
    actor?: string;
    correlationId?: string;
  },
): ApplyPreExecutionValidationResult {
  const validation = runPreExecutionValidation(input);
  const store = getAtBrokerExecutionStore(input.storageRoot);
  const before = store.get().lifecycle;
  const target = validation.suggestedLifecycle;
  const actor = String(input.actor || "precheck").trim() || "precheck";

  store.bindActiveIds({
    handoffId: validation.handoffId,
    proposalId: validation.proposalId,
    actor,
  });

  const transitioned = store.transitionLifecycle(
    target,
    actor,
    `Phase 2 precheck ${validation.validationId} status=${validation.status} allowed=${validation.allowed}`,
    input.correlationId,
  );

  return {
    validation,
    lifecycleBefore: before,
    lifecycleAfter: store.get().lifecycle,
    transition: transitioned.ok
      ? { ok: true, correlationId: transitioned.correlationId }
      : {
        ok: false,
        code: transitioned.code,
        message: transitioned.message,
        correlationId: transitioned.correlationId,
      },
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
  };
}
