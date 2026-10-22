/**
 * Phase 57.0 — Explicitly disabled broker mutation adapter.
 * Any call fails closed. No ForexConnect / sidecar mutation methods are invoked.
 */
export type DisabledMutationOp =
  | "SUBMIT"
  | "MODIFY"
  | "CANCEL"
  | "CLOSE_POSITION"
  | "ATTACH_PROTECTIVE"
  | "AMEND_PROTECTIVE"
  | "CANCEL_PROTECTIVE";

export interface DisabledMutationRejection {
  ok: false;
  code: "EXECUTION_FORBIDDEN";
  operation: DisabledMutationOp;
  message: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  tradingEnabled: false;
}

const MSG =
  "Phase 57.0 — broker mutation adapter is DISABLED. EXECUTION_FORBIDDEN. No broker request was sent.";

/**
 * Disabled mutation surface. Callers must never treat this as a successful trade path.
 */
export class DisabledBrokerMutationAdapter {
  readonly placesOrders = false as const;
  readonly acceptsForExecution = false as const;
  readonly mutatesBroker = false as const;
  readonly tradingEnabled = false as const;

  submit(_intent: unknown): DisabledMutationRejection {
    return reject("SUBMIT");
  }

  modify(_brokerOrderId: unknown, _patch: unknown): DisabledMutationRejection {
    return reject("MODIFY");
  }

  cancel(_brokerOrderId: unknown): DisabledMutationRejection {
    return reject("CANCEL");
  }

  closePosition(_brokerPositionId: unknown): DisabledMutationRejection {
    return reject("CLOSE_POSITION");
  }

  attachProtective(_args: unknown): DisabledMutationRejection {
    return reject("ATTACH_PROTECTIVE");
  }

  amendProtective(_args: unknown): DisabledMutationRejection {
    return reject("AMEND_PROTECTIVE");
  }

  cancelProtective(_args: unknown): DisabledMutationRejection {
    return reject("CANCEL_PROTECTIVE");
  }
}

function reject(operation: DisabledMutationOp): DisabledMutationRejection {
  return {
    ok: false,
    code: "EXECUTION_FORBIDDEN",
    operation,
    message: MSG,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    tradingEnabled: false,
  };
}

let singleton: DisabledBrokerMutationAdapter | null = null;

export function getDisabledBrokerMutationAdapter(): DisabledBrokerMutationAdapter {
  if (!singleton) singleton = new DisabledBrokerMutationAdapter();
  return singleton;
}

export function resetDisabledBrokerMutationAdapterForTests(): void {
  singleton = null;
}
