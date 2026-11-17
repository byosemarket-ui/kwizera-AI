/**
 * HFM MT5 Demo login bridge — talks to local AF_UNIX agent when available.
 *
 * Security design: `./bridge-security-audit.ts`
 * Threat model: `./threat-model.ts`
 * Demo stages: `./demo-login-plan.ts`
 *
 * Demo-only. Never reads Live vault. Never returns passwords.
 */

import {
  MT5_HFM_BRIDGE_SECURITY_STATUS,
  mt5HfmBridgeSecurityAuditSummary,
} from "./bridge-security-audit.js";
import { callMt5HfmAgent } from "./agent-client.js";
import { getMt5HfmDemoProfileManager } from "./demo-profile.js";
import { redactAgentPayload } from "./agent-protocol.js";
import { assertBridgeEnvironmentIsDemo } from "./bridge-guards.js";

export { assertBridgeEnvironmentIsDemo } from "./bridge-guards.js";

export const MT5_HFM_LOGIN_BRIDGE_STATUS = "implemented_agent_optional" as const;

export interface Mt5HfmLoginBridgeAccountSnapshot {
  loginHint: string | null;
  server: string | null;
  currency: string | null;
  balance: number | null;
  equity: number | null;
  credit: number | null;
  profit: number | null;
  freeMargin: number | null;
  usedMargin: number | null;
  marginLevel: number | null;
  leverage: string | null;
  company: string | null;
  tradePermissions: string | null;
  symbols: string[] | null;
  quotesAvailable: boolean | null;
  syncedAt: string | null;
  note: string | null;
  source: string | null;
}

export interface Mt5HfmLoginBridgeResult {
  ok: boolean;
  status: typeof MT5_HFM_LOGIN_BRIDGE_STATUS | "agent_unavailable" | "auth_failed" | "error";
  environment: "demo";
  authenticatedLogin: boolean;
  terminalConnected: boolean | null;
  account: Mt5HfmLoginBridgeAccountSnapshot | null;
  agent: Record<string, unknown> | null;
  security: ReturnType<typeof mt5HfmBridgeSecurityAuditSummary>;
  note: string;
}

function asAccount(raw: unknown, server: string | null): Mt5HfmLoginBridgeAccountSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  return {
    loginHint: a.loginHint != null ? String(a.loginHint) : null,
    server: a.server != null ? String(a.server) : server,
    currency: a.currency != null ? String(a.currency) : null,
    balance: typeof a.balance === "number" ? a.balance : null,
    equity: typeof a.equity === "number" ? a.equity : null,
    credit: typeof a.credit === "number" ? a.credit : null,
    profit: typeof a.profit === "number" ? a.profit : null,
    freeMargin: typeof a.freeMargin === "number" ? a.freeMargin : null,
    usedMargin: typeof a.usedMargin === "number" ? a.usedMargin : null,
    marginLevel: typeof a.marginLevel === "number" ? a.marginLevel : null,
    leverage: a.leverage != null ? String(a.leverage) : null,
    company: a.company != null ? String(a.company) : null,
    tradePermissions: a.tradePermissions != null ? String(a.tradePermissions) : null,
    symbols: Array.isArray(a.symbols) ? a.symbols.map(String) : null,
    quotesAvailable: typeof a.quotesAvailable === "boolean" ? a.quotesAvailable : null,
    syncedAt: a.syncedAt != null ? String(a.syncedAt) : null,
    note: a.note != null ? String(a.note) : null,
    source: a.source != null ? String(a.source) : null,
  };
}

/** Authenticated Demo login via local agent. Never touches Live vault. */
export async function requestMt5HfmDemoLoginBridge(): Promise<Mt5HfmLoginBridgeResult> {
  assertBridgeEnvironmentIsDemo("demo");
  const security = mt5HfmBridgeSecurityAuditSummary();
  const manager = await getMt5HfmDemoProfileManager();
  const meta = manager.getDemoLoginMeta();
  const password = manager.getDemoPassword();
  if (!meta || !password) {
    return {
      ok: false,
      status: "error",
      environment: "demo",
      authenticatedLogin: false,
      terminalConnected: null,
      account: null,
      agent: null,
      security,
      note: "Demo credentials not configured in vault.",
    };
  }

  try {
    const response = await callMt5HfmAgent(
      "demo.login",
      {
        environment: "demo",
        login: meta.login,
        server: meta.server,
        password,
      },
      // Terminal restart + MQL StartUp + journal/MQL wait routinely exceeds 90s on 1-vCPU Wine.
      { timeoutMs: 180_000 },
    );
    // Drop local password reference ASAP (immutable string remains until GC).
    const safeAgent = redactAgentPayload(response) as Record<string, unknown>;
    if (!response.ok) {
      const code = String(response.code ?? "AGENT_ERROR");
      return {
        ok: false,
        status: code === "AGENT_UNAVAILABLE" ? "agent_unavailable" : "auth_failed",
        environment: "demo",
        authenticatedLogin: false,
        terminalConnected: null,
        account: null,
        agent: safeAgent,
        security,
        note: `Demo login agent returned ${code}. TCP probe alone is not an authenticated login.`,
      };
    }
    const result = (response.result ?? {}) as Record<string, unknown>;
    let account = asAccount(result.account, meta.server);
    const authenticated = Boolean(result.authenticated);
    await manager.recordProbeResult("demo", {
      status: authenticated ? "demo_login_authenticated" : "demo_login_unconfirmed",
      errorMessage: authenticated ? null : String(result.authError ?? "AUTH_UNCONFIRMED"),
      summary: authenticated
        ? "Demo terminal login reported authenticated (journal inference)."
        : "Demo login attempted; authentication not confirmed from journal.",
    });
    // Journal auth often lands before the MQL Expert writes balance/equity. Enrich
    // from demo.account_snapshot without fabricating numbers.
    if (authenticated && (account?.balance == null || account?.equity == null || account?.currency == null)) {
      for (let i = 0; i < 10; i += 1) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const snapResp = await callMt5HfmAgent("demo.account_snapshot", {}, { timeoutMs: 20_000 });
          if (!snapResp.ok || !snapResp.result || typeof snapResp.result !== "object") continue;
          const snapAcct = asAccount(
            (snapResp.result as Record<string, unknown>).account,
            meta.server,
          );
          if (!snapAcct) continue;
          account = {
            ...(account ?? snapAcct),
            ...snapAcct,
            loginHint: snapAcct.loginHint ?? account?.loginHint ?? null,
            server: snapAcct.server ?? account?.server ?? meta.server,
          };
          if (account.balance != null && account.equity != null && account.currency != null) break;
        } catch {
          // Keep journal identity; balance remains null until a later sync.
        }
      }
    }
    if (account) {
      await manager.recordDemoAccountSnapshot({
        loginHint: account.loginHint,
        server: account.server,
        currency: account.currency,
        balance: account.balance,
        equity: account.equity,
        freeMargin: account.freeMargin,
        marginLevel: account.marginLevel,
        leverage: account.leverage,
        company: account.company,
        syncedAt: account.syncedAt,
        note: account.note,
      });
    }
    const hasMqlMoney =
      account != null && account.balance != null && account.equity != null && account.currency != null;
    return {
      ok: true,
      status: MT5_HFM_LOGIN_BRIDGE_STATUS,
      environment: "demo",
      authenticatedLogin: authenticated,
      terminalConnected: result.terminalConnected == null ? null : Boolean(result.terminalConnected),
      account,
      agent: safeAgent,
      security,
      note: authenticated
        ? hasMqlMoney
          ? "Authenticated Demo login with MQL account snapshot (balance/equity present)."
          : "Authenticated Demo login confirmed. Balance/equity still pending MQL snapshot — use account/sync."
        : "Agent login invoked; journal did not confirm authentication. Not a TCP-only success claim.",
    };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "AGENT_ERROR";
    return {
      ok: false,
      status: code === "AGENT_UNAVAILABLE" ? "agent_unavailable" : "error",
      environment: "demo",
      authenticatedLogin: false,
      terminalConnected: null,
      account: null,
      agent: null,
      security,
      note:
        code === "AGENT_UNAVAILABLE"
          ? "MT5 agent socket unavailable. Deploy/start agent after approval. TCP probe ≠ login."
          : `Demo login bridge error (${code}).`,
    };
  }
}

export async function requestMt5HfmDemoAccountSnapshot(): Promise<Mt5HfmLoginBridgeResult> {
  assertBridgeEnvironmentIsDemo("demo");
  const security = mt5HfmBridgeSecurityAuditSummary();
  try {
    const response = await callMt5HfmAgent("demo.account_snapshot", {});
    const result = (response.result ?? {}) as Record<string, unknown>;
    return {
      ok: response.ok,
      status: response.ok ? MT5_HFM_LOGIN_BRIDGE_STATUS : "error",
      environment: "demo",
      authenticatedLogin: Boolean(result.authenticated),
      terminalConnected: result.terminalConnected == null ? null : Boolean(result.terminalConnected),
      account: asAccount(result.account, null),
      agent: redactAgentPayload(response) as Record<string, unknown>,
      security,
      note: "Demo account snapshot from agent (null fields are intentionally not fabricated).",
    };
  } catch {
    return {
      ok: false,
      status: "agent_unavailable",
      environment: "demo",
      authenticatedLogin: false,
      terminalConnected: null,
      account: null,
      agent: null,
      security,
      note: "Account snapshot unavailable — agent not running.",
    };
  }
}
