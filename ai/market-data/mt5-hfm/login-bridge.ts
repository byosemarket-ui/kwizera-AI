/**
 * HFM MT5 Demo login bridge — ARCHITECTURE ONLY (not implemented).
 *
 * Full Unix-socket security requirements: `./bridge-security-audit.ts`
 * Demo login sequence + Test Connection stages: `./demo-login-plan.ts`
 * Systemd proposal: `./systemd-proposal.ts`
 *
 * Goal: KWIZERA Node (`kwizera`) requests Demo login against Wine/MT5 under
 * Linux user `mt5`, then returns non-secret account fields.
 *
 * Hard rules while Live gate is locked:
 * - Demo only — never read `mt5-hfm:live:password` on this path.
 * - No order placement, EA attach, or AT submit.
 * - Never put passwords in argv, shell, environment dumps, or logs.
 * - No public unauthenticated TCP ports.
 * - Browser never talks to Wine/MT5 directly.
 */

import {
  MT5_HFM_BRIDGE_SECURITY_STATUS,
  mt5HfmBridgeSecurityAuditSummary,
} from "./bridge-security-audit.js";
import { assertLiveActivationAllowed } from "./live-gate.js";

export const MT5_HFM_LOGIN_BRIDGE_STATUS = "not_implemented" as const;

export interface Mt5HfmLoginBridgeAccountSnapshot {
  loginHint: string | null;
  server: string | null;
  currency: string | null;
  balance: number | null;
  equity: number | null;
  freeMargin: number | null;
  usedMargin: number | null;
  marginLevel: number | null;
  leverage: string | null;
  company: string | null;
  symbols: string[] | null;
  quotesAvailable: boolean | null;
  syncedAt: string;
}

export interface Mt5HfmLoginBridgeResult {
  ok: boolean;
  status: typeof MT5_HFM_LOGIN_BRIDGE_STATUS;
  environment: "demo";
  account: Mt5HfmLoginBridgeAccountSnapshot | null;
  security: ReturnType<typeof mt5HfmBridgeSecurityAuditSummary>;
  note: string;
}

/** Reject Live environment before any vault read in a future bridge client. */
export function assertBridgeEnvironmentIsDemo(environment: string): asserts environment is "demo" {
  if (environment !== "demo") {
    assertLiveActivationAllowed("login");
  }
}

/** Placeholder — always returns not_implemented. Never touches Live vault. */
export async function requestMt5HfmDemoLoginBridge(): Promise<Mt5HfmLoginBridgeResult> {
  // Demo-only path: do not call getLivePassword / getLivePasswordForActivation.
  assertBridgeEnvironmentIsDemo("demo");
  return {
    ok: false,
    status: MT5_HFM_LOGIN_BRIDGE_STATUS,
    environment: "demo",
    account: null,
    security: mt5HfmBridgeSecurityAuditSummary(),
    note:
      `MT5 terminal login bridge is ${MT5_HFM_LOGIN_BRIDGE_STATUS}. ` +
      `Security design status: ${MT5_HFM_BRIDGE_SECURITY_STATUS}. ` +
      "Test Connection DNS/TCP probe is not an authenticated Demo login.",
  };
}
