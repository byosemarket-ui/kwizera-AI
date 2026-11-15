/**
 * Fail-closed HFM MT5 Live activation gate.
 *
 * Live credential *storage* is allowed. Live login, authenticated connection
 * tests, terminal sessions, orders, and automation stay locked until a
 * separate explicit owner authorization lands in a future approved change.
 *
 * This module must never auto-enable Live from Demo state or env heuristics.
 */

export const MT5_HFM_LIVE_PASSWORD_SECRET_ID = "mt5-hfm:live:password";

export type Mt5HfmLiveLockedAction =
  | "login"
  | "connection_test"
  | "terminal_session"
  | "order_execution"
  | "automation"
  | "account_sync"
  | "credential_use";

/** Hard-coded fail-closed flags. Do not flip without separate owner approval. */
export const MT5_HFM_LIVE_GATE = {
  ownerAuthorized: false,
  loginEnabled: false,
  connectionTestEnabled: false,
  terminalSessionEnabled: false,
  orderExecutionEnabled: false,
  automationEnabled: false,
  credentialStorageEnabled: true,
  note:
    "Live credentials may be stored encrypted. Live login, connection testing, trading, and automation remain locked pending separate explicit owner authorization.",
} as const;

export interface Mt5HfmLiveGatePublic {
  ownerAuthorized: false;
  loginEnabled: false;
  connectionTestEnabled: false;
  terminalSessionEnabled: false;
  orderExecutionEnabled: false;
  automationEnabled: false;
  credentialStorageEnabled: true;
  note: string;
}

export function publicLiveGate(): Mt5HfmLiveGatePublic {
  return {
    ownerAuthorized: false,
    loginEnabled: false,
    connectionTestEnabled: false,
    terminalSessionEnabled: false,
    orderExecutionEnabled: false,
    automationEnabled: false,
    credentialStorageEnabled: true,
    note: MT5_HFM_LIVE_GATE.note,
  };
}

export class Mt5HfmLiveActivationLockedError extends Error {
  readonly code = "LIVE_ACTIVATION_LOCKED";
  readonly action: Mt5HfmLiveLockedAction;

  constructor(action: Mt5HfmLiveLockedAction) {
    super(
      `HFM Live ${action.replace(/_/g, " ")} is locked. Credentials may be stored, but Live activation requires separate explicit owner authorization.`,
    );
    this.name = "Mt5HfmLiveActivationLockedError";
    this.action = action;
  }
}

/** Throws unless a future owner gate explicitly enables the action. Currently always throws. */
export function assertLiveActivationAllowed(action: Mt5HfmLiveLockedAction): never {
  void action;
  // Fail closed — no path enables Live in this phase.
  throw new Mt5HfmLiveActivationLockedError(action);
}

export function isLiveActivationLocked(): boolean {
  return !MT5_HFM_LIVE_GATE.ownerAuthorized;
}
