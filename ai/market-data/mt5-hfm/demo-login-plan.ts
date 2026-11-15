/**
 * PHASE 3 — Demo-only MT5 login + account sync plan (DESIGN ONLY — not implemented).
 *
 * Test Connection must NEVER treat a DNS/TCP probe as a successful MT5 login.
 */

import type { DemoProbeResult } from "./connection-probe.js";

export const MT5_HFM_DEMO_LOGIN_PLAN_STATUS = "design_only" as const;

/** Distinct stages for Test Connection / sync reporting. */
export type Mt5HfmConnectionStageId =
  | "dns_tcp"
  | "mt5_terminal"
  | "demo_login"
  | "market_data";

export interface Mt5HfmConnectionStageResult {
  stage: Mt5HfmConnectionStageId;
  status: "not_run" | "ok" | "failed" | "not_verified" | "locked";
  summary: string;
}

export interface Mt5HfmDemoLoginPlanAccountFields {
  loginHint: string | null;
  server: string | null;
  company: string | null;
  currency: string | null;
  balance: number | null;
  equity: number | null;
  freeMargin: number | null;
  usedMargin: number | null;
  marginLevel: number | null;
  leverage: string | null;
  symbols: string[] | null;
  quotesAvailable: boolean | null;
  syncedAt: string | null;
}

/**
 * Future agent Demo login sequence (secure):
 *
 * 1. Backend verifies Admin auth + Demo credentials configured + Live gate unused.
 * 2. Backend decrypts ONLY `mt5-hfm:demo:password` in-process (never Live id).
 * 3. Backend opens AF_UNIX `/run/kwizera/mt5-hfm-agent.sock`, authenticates with
 *    HMAC + agent token, sends framed `{ method: "demo.login", login, server, password }`.
 * 4. Agent verifies SO_PEERCRED, Demo server name, portable terminal path, then
 *    performs login against the existing Wine MT5 process (no argv secrets).
 * 5. Agent zeroizes password buffer; returns non-secret account JSON.
 * 6. Backend persists snapshot into `demo-profile.json` account fields only.
 * 7. Errors return codes (`AUTH_FAILED`, `SERVER_MISMATCH`, `TERMINAL_NOT_RUNNING`)
 *    without echoing credentials.
 */
export const MT5_HFM_DEMO_LOGIN_SEQUENCE = [
  "admin_auth",
  "demo_vault_read_only",
  "unix_socket_hmac",
  "peercred_check",
  "demo_server_validate",
  "terminal_attach",
  "demo_login",
  "account_snapshot",
  "quotes_snapshot",
  "password_zeroize",
] as const;

export function initialConnectionStagesFromProbe(
  probe: Pick<DemoProbeResult, "ok" | "summary" | "status">,
): Mt5HfmConnectionStageResult[] {
  return [
    {
      stage: "dns_tcp",
      status: probe.ok ? "ok" : "failed",
      summary: probe.summary,
    },
    {
      stage: "mt5_terminal",
      status: "not_verified",
      summary: "MT5 terminal connectivity requires approved local agent (not implemented).",
    },
    {
      stage: "demo_login",
      status: "not_verified",
      summary: "Authenticated Demo login requires approved local agent (not implemented).",
    },
    {
      stage: "market_data",
      status: "not_verified",
      summary: "Market quotes availability requires authenticated Demo session (not implemented).",
    },
  ];
}

export function demoLoginPlanSummary(): {
  status: typeof MT5_HFM_DEMO_LOGIN_PLAN_STATUS;
  stages: Mt5HfmConnectionStageId[];
  note: string;
} {
  return {
    status: MT5_HFM_DEMO_LOGIN_PLAN_STATUS,
    stages: ["dns_tcp", "mt5_terminal", "demo_login", "market_data"],
    note:
      "Demo login/account sync is designed with four distinct Test Connection stages. Only dns_tcp is implemented today.",
  };
}
