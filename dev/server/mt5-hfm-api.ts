/**
 * HFM MT5 Connection Manager API (Demo + locked Live credential storage).
 *
 * GET  /api/forex/providers/mt5-hfm/status
 * POST /api/forex/providers/mt5-hfm/auth-check
 * POST /api/forex/providers/mt5-hfm/credentials
 * POST /api/forex/providers/mt5-hfm/credentials/clear
 * POST /api/forex/providers/mt5-hfm/test-connection   (Demo DNS/TCP + optional agent status)
 * POST /api/forex/providers/mt5-hfm/login              (Demo authenticated login via agent)
 * POST /api/forex/providers/mt5-hfm/account/sync       (Demo account snapshot via agent)
 * POST /api/forex/providers/mt5-hfm/market/quotes      (Demo quotes via agent)
 * POST /api/forex/providers/mt5-hfm/market/candles     (Demo candles via agent)
 * GET  /api/forex/providers/mt5-hfm/account            (cached Demo snapshot only)
 * GET  /api/forex/providers/mt5-hfm/stream             (Demo SSE realtime feed)
 * GET  /api/forex/providers/mt5-hfm/realtime/status    (Hub freshness / subscribers)
 * GET  /api/forex/providers/mt5-hfm/symbols            (HFM catalog query)
 * GET  /api/forex/providers/mt5-hfm/symbols/status     (Catalog discovery status)
 * GET  /api/forex/providers/mt5-hfm/symbols/categories (Category counts)
 * GET  /api/forex/providers/mt5-hfm/symbols/:symbol    (Symbol detail)
 * POST /api/forex/providers/mt5-hfm/symbols/sync       (Pull catalog from agent)
 *
 * Admin token required. Never returns stored passwords.
 * Live credential save/clear allowed. Live login / auth tests / trading locked.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  assertAdminAccess,
  rolesFromHeaders,
  adminTokenFromHeaders,
} from "../../ai/admin-control-plane/admin-auth-boundary.js";
import {
  ensureMt5HfmRealtimeHubStarted,
  getMt5HfmRealtimeHubStatus,
  subscribeMt5HfmSse,
} from "../../ai/market-data/mt5-hfm/realtime-hub.js";
import {
  getMt5HfmDemoProfileManager,
  parseMt5HfmEnvironment,
  type Mt5HfmEnvironment,
} from "../../ai/market-data/mt5-hfm/demo-profile.js";
import { probeHfmDemoNetwork } from "../../ai/market-data/mt5-hfm/connection-probe.js";
import { assertNoSecretsInMt5HfmPayload } from "../../ai/market-data/mt5-hfm/secrets-guard.js";
import { appendMt5HfmCredentialAudit } from "../../ai/market-data/mt5-hfm/credential-audit.js";
import {
  requestMt5HfmDemoAccountSnapshot,
  requestMt5HfmDemoLoginBridge,
} from "../../ai/market-data/mt5-hfm/login-bridge.js";
import {
  Mt5HfmLiveActivationLockedError,
  assertLiveActivationAllowed,
  publicLiveGate,
} from "../../ai/market-data/mt5-hfm/live-gate.js";
import { mt5HfmBridgeSecurityAuditSummary } from "../../ai/market-data/mt5-hfm/bridge-security-audit.js";
import {
  demoLoginPlanSummary,
  initialConnectionStagesFromProbe,
} from "../../ai/market-data/mt5-hfm/demo-login-plan.js";
import { mt5HfmSystemdProposalSummary } from "../../ai/market-data/mt5-hfm/systemd-proposal.js";
import { callMt5HfmAgent } from "../../ai/market-data/mt5-hfm/agent-client.js";
import { mt5HfmThreatModelSummary } from "../../ai/market-data/mt5-hfm/threat-model.js";
import { redactAgentPayload } from "../../ai/market-data/mt5-hfm/agent-protocol.js";
import { buildMt5HfmConnectionStates } from "../../ai/market-data/mt5-hfm/connection-states.js";
import { getHfmCatalogService } from "../../ai/market-data/mt5-hfm/catalog-service.js";
import { HFM_CATALOG_CATEGORIES } from "../../ai/market-data/mt5-hfm/catalog-types.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

const MAX_BODY_BYTES = 4096;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const ACTOR = "forex-admin";

const mutationHits = new Map<string, number[]>();

function headersRecord(req: IncomingMessage): Record<string, string | string[] | undefined> {
  return req.headers as Record<string, string | string[] | undefined>;
}

function clientKey(req: IncomingMessage): string {
  return String(req.socket.remoteAddress ?? "unknown");
}

function checkRateLimit(req: IncomingMessage): boolean {
  const key = clientKey(req);
  const now = Date.now();
  const prev = (mutationHits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX) {
    mutationHits.set(key, prev);
    return false;
  }
  prev.push(now);
  mutationHits.set(key, prev);
  return true;
}

function requireAdmin(
  req: IncomingMessage,
  res: ServerResponse,
  sendJson: SendJson,
  pathname: string,
): boolean {
  const decision = assertAdminAccess({
    roles: rolesFromHeaders(headersRecord(req)),
    adminToken: adminTokenFromHeaders(headersRecord(req)),
    path: pathname,
    adminApi: true,
    remoteAddress: req.socket.remoteAddress,
  });
  if (!decision.allowed) {
    sendJson(res, 403, {
      ok: false,
      error: { code: "ADMIN_FORBIDDEN", message: decision.reason },
    });
    return false;
  }
  return true;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body too large"), { code: "PAYLOAD_TOO_LARGE" });
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function sendLiveLocked(
  res: ServerResponse,
  sendJson: SendJson,
  action: string,
): void {
  const gate = publicLiveGate();
  sendJson(res, 403, {
    ok: false,
    error: {
      code: "LIVE_ACTIVATION_LOCKED",
      message: `HFM Live ${action} is locked. Credential storage is allowed; Live activation requires separate explicit owner authorization.`,
    },
    liveGate: gate,
  });
}

function requireAdminForStream(
  req: IncomingMessage,
  res: ServerResponse,
  sendJson: SendJson,
  url: URL,
): boolean {
  // EventSource cannot set custom headers; allow one-time query token for SSE only.
  const headers = { ...headersRecord(req) };
  const qToken = url.searchParams.get("adminToken")?.trim();
  if (qToken && !adminTokenFromHeaders(headers)) {
    headers["x-kwizera-admin-token"] = qToken;
  }
  const decision = assertAdminAccess({
    roles: rolesFromHeaders(headers),
    adminToken: adminTokenFromHeaders(headers),
    path: url.pathname,
    adminApi: true,
    remoteAddress: req.socket.remoteAddress,
  });
  if (!decision.allowed) {
    sendJson(res, 403, {
      ok: false,
      error: { code: "ADMIN_FORBIDDEN", message: decision.reason },
    });
    return false;
  }
  return true;
}

export async function handleMt5HfmApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/providers/mt5-hfm")) return false;

  const isMutation = req.method === "POST";
  if (!isMutation && req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Unsupported method for MT5 HFM routes." },
    });
    return true;
  }

  // SSE stream: auth first, then subscribe (do not use buffered sendJson body).
  if (url.pathname === "/api/forex/providers/mt5-hfm/stream" && req.method === "GET") {
    if (!requireAdminForStream(req, res, sendJson, url)) return true;
    const symbolsRaw = url.searchParams.get("symbols") ?? "";
    const symbols = symbolsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 32);
    const includeCandles = url.searchParams.get("candles") === "1" || url.searchParams.get("candles") === "true";
    ensureMt5HfmRealtimeHubStarted();
    const sub = subscribeMt5HfmSse(res, {
      symbols: symbols.length ? symbols : undefined,
      includeCandles,
    });
    if (!sub.ok) {
      sendJson(res, 429, {
        ok: false,
        error: { code: sub.code, message: sub.message },
      });
      return true;
    }
    return true;
  }

  if (!requireAdmin(req, res, sendJson, url.pathname)) return true;

  if (isMutation && !checkRateLimit(req)) {
    sendJson(res, 429, {
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too many MT5 HFM credential requests. Retry shortly." },
    });
    return true;
  }

  try {
    const manager = await getMt5HfmDemoProfileManager();

    if (url.pathname === "/api/forex/providers/mt5-hfm/auth-check" && req.method === "POST") {
      await readJsonBody(req);
      const payload = {
        ok: true,
        authorized: true,
        note: "Admin API token accepted for HFM MT5 credential actions.",
        liveGate: publicLiveGate(),
      };
      assertNoSecretsInMt5HfmPayload(payload);
      await appendMt5HfmCredentialAudit({
        action: "auth_check",
        ok: true,
        actor: ACTOR,
        path: url.pathname,
        remoteAddress: req.socket.remoteAddress ?? null,
      });
      sendJson(res, 200, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/status" && (req.method === "GET" || req.method === "HEAD")) {
      const status = manager.publicStatus();
      let agentOk: boolean | null = null;
      let terminalRunning: boolean | null = null;
      let authenticated: boolean | null = null;
      try {
        const agentRes = await callMt5HfmAgent("demo.connection_status", {}, { timeoutMs: 5_000 });
        agentOk = Boolean(agentRes.ok);
        const result = (agentRes.result ?? {}) as Record<string, unknown>;
        terminalRunning = Boolean(result.terminalRunning);
        authenticated = Boolean(result.authenticated);
      } catch {
        agentOk = false;
      }
      let market: {
        quotesAvailable: boolean | null;
        stale: boolean | null;
        quotes: Array<{
          symbol: string;
          bid: number | null;
          ask: number | null;
          spread: number | null;
          tickTime: string | null;
          source: string;
        }>;
        source: string | null;
        retrievedAt: string | null;
        note: string | null;
      } | null = null;
      if (agentOk && authenticated) {
        try {
          const qRes = await callMt5HfmAgent(
            "demo.quotes_snapshot",
            { symbols: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"] },
            { timeoutMs: 15_000 },
          );
          const q = (qRes.result ?? {}) as Record<string, unknown>;
          const rawQuotes = Array.isArray(q.quotes) ? q.quotes : [];
          market = {
            quotesAvailable: Boolean(q.quotesAvailable),
            stale: typeof q.stale === "boolean" ? q.stale : null,
            quotes: rawQuotes.slice(0, 24).map((row) => {
              const r = row as Record<string, unknown>;
              return {
                symbol: String(r.symbol ?? ""),
                bid: typeof r.bid === "number" ? r.bid : null,
                ask: typeof r.ask === "number" ? r.ask : null,
                spread: typeof r.spread === "number" ? r.spread : null,
                tickTime: r.tickTime != null ? String(r.tickTime) : null,
                source: String(r.source ?? "mt5_mcp"),
              };
            }),
            source: String(q.source ?? "mt5_mcp"),
            retrievedAt: q.retrievedAt != null ? String(q.retrievedAt) : null,
            note: q.note != null ? String(q.note) : null,
          };
        } catch {
          market = {
            quotesAvailable: false,
            stale: null,
            quotes: [],
            source: null,
            retrievedAt: null,
            note: "Market quote snapshot unavailable.",
          };
        }
      }
      const connectionStates = buildMt5HfmConnectionStates({
        credentialsConfigured: Boolean(status.demo.configured),
        agentOk,
        terminalRunning,
        hfmTcpOk: status.demo.lastProbeAt
          ? status.demo.lastProbeSummary?.toLowerCase().includes("fail")
            ? false
            : status.demo.connectionStatus === "ok" || status.demo.lastAuthStatus === "ok"
              ? true
              : null
          : null,
        authenticated,
        authFailed: Boolean(status.demo.lastAuthError) && authenticated !== true,
        accountSynced: Boolean(status.demo.account?.syncedAt && status.demo.account.balance != null),
        marketDataAvailable: market?.quotesAvailable ?? null,
        marketDataStale: market?.stale ?? null,
        syncFailed: Boolean(status.demo.lastAuthError?.includes("SYNC")),
      });
      ensureMt5HfmRealtimeHubStarted();
      const payload = {
        ...status,
        connectionStates,
        market,
        realtime: getMt5HfmRealtimeHubStatus(),
        bridgeSecurity: mt5HfmBridgeSecurityAuditSummary(),
        demoLoginPlan: demoLoginPlanSummary(),
        systemdProposal: mt5HfmSystemdProposalSummary(),
        threatModel: mt5HfmThreatModelSummary(),
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, 200, payload);
      return true;
    }

    if (
      url.pathname === "/api/forex/providers/mt5-hfm/realtime/status" &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      ensureMt5HfmRealtimeHubStarted();
      const payload = {
        ok: true,
        ...getMt5HfmRealtimeHubStatus(),
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, 200, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/account" && (req.method === "GET" || req.method === "HEAD")) {
      const envParam = String(url.searchParams.get("environment") ?? "demo");
      let env: Mt5HfmEnvironment = "demo";
      try {
        env = parseMt5HfmEnvironment(envParam);
      } catch {
        sendJson(res, 400, {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "environment must be demo or live" },
        });
        return true;
      }
      if (env === "live") {
        await appendMt5HfmCredentialAudit({
          action: "live_activation_blocked",
          ok: false,
          actor: ACTOR,
          environment: "live",
          code: "LIVE_ACTIVATION_LOCKED",
          path: url.pathname,
          remoteAddress: req.socket.remoteAddress ?? null,
          detail: "account_sync",
        });
        sendLiveLocked(res, sendJson, "account sync");
        return true;
      }
      const status = manager.publicStatus();
      const payload = {
        ok: true,
        environment: "demo" as const,
        configured: status.demo.configured,
        account: status.demo.account,
        lastSyncAt: status.demo.lastSyncAt,
        connectionStatus: status.demo.connectionStatus,
        mt5LoginBridge: status.mt5LoginBridge,
        liveGate: status.liveGate,
        note: status.demo.account
          ? "Verified Demo account snapshot."
          : "No verified Demo account snapshot yet. Save credentials and run Test Connection; terminal login bridge still required for balance/equity.",
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, 200, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/credentials" && req.method === "POST") {
      const body = await readJsonBody(req);
      let env: Mt5HfmEnvironment;
      try {
        env = parseMt5HfmEnvironment(body.environment ?? "demo");
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error instanceof Error ? error.message : "Invalid environment.",
          },
        });
        return true;
      }
      const password = String(body.password ?? "");
      try {
        const status = await manager.saveCredentials({
          environment: env,
          login: String(body.login ?? body.account ?? body.username ?? ""),
          server: String(body.server ?? ""),
          password,
        });
        const envStatus = env === "live" ? status.live : status.demo;
        const payload = {
          ok: true,
          environment: env,
          status,
          note: env === "live"
            ? "Live credentials saved to encrypted vault. Live login and trading remain locked."
            : "Demo credentials saved to encrypted vault. Password is not returned.",
        };
        assertNoSecretsInMt5HfmPayload(payload, [password]);
        await appendMt5HfmCredentialAudit({
          action: "save",
          ok: true,
          actor: ACTOR,
          environment: env,
          code: "SAVED",
          loginHint: envStatus.loginHint,
          server: envStatus.server,
          path: url.pathname,
          remoteAddress: req.socket.remoteAddress ?? null,
        });
        sendJson(res, 200, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 300) : "Invalid credentials.";
        const vaultLocked = /vault|passphrase|persist/i.test(message);
        await appendMt5HfmCredentialAudit({
          action: "save",
          ok: false,
          actor: ACTOR,
          environment: env,
          code: vaultLocked ? "VAULT_UNAVAILABLE" : "VALIDATION_ERROR",
          detail: message,
          path: url.pathname,
          remoteAddress: req.socket.remoteAddress ?? null,
        });
        sendJson(res, vaultLocked ? 503 : 400, {
          ok: false,
          error: {
            code: vaultLocked ? "VAULT_UNAVAILABLE" : "VALIDATION_ERROR",
            message,
          },
        });
      }
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/credentials/clear" && req.method === "POST") {
      const body = await readJsonBody(req);
      let env: Mt5HfmEnvironment;
      try {
        env = parseMt5HfmEnvironment(body.environment ?? "demo");
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error instanceof Error ? error.message : "Invalid environment.",
          },
        });
        return true;
      }
      const status = await manager.clearCredentials(env);
      const payload = {
        ok: true,
        environment: env,
        status,
        note: env === "live"
          ? "Live credentials cleared from vault and metadata."
          : "Demo credentials cleared from vault and metadata.",
      };
      assertNoSecretsInMt5HfmPayload(payload);
      await appendMt5HfmCredentialAudit({
        action: "clear",
        ok: true,
        actor: ACTOR,
        environment: env,
        code: "CLEARED",
        path: url.pathname,
        remoteAddress: req.socket.remoteAddress ?? null,
      });
      sendJson(res, 200, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/test-connection" && req.method === "POST") {
      const body = await readJsonBody(req);
      let env: Mt5HfmEnvironment = "demo";
      try {
        env = parseMt5HfmEnvironment(body.environment ?? "demo");
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error instanceof Error ? error.message : "Invalid environment.",
          },
        });
        return true;
      }

      if (env === "live") {
        try {
          assertLiveActivationAllowed("connection_test");
        } catch (error) {
          const locked = error instanceof Mt5HfmLiveActivationLockedError;
          await appendMt5HfmCredentialAudit({
            action: "live_activation_blocked",
            ok: false,
            actor: ACTOR,
            environment: "live",
            code: "LIVE_ACTIVATION_LOCKED",
            path: url.pathname,
            remoteAddress: req.socket.remoteAddress ?? null,
            detail: "connection_test",
          });
          if (locked) {
            sendLiveLocked(res, sendJson, "connection testing");
            return true;
          }
          throw error;
        }
      }

      const statusBefore = manager.publicStatus();
      if (!statusBefore.demo.configured) {
        await appendMt5HfmCredentialAudit({
          action: "test_connection",
          ok: false,
          actor: ACTOR,
          environment: "demo",
          code: "NOT_CONFIGURED",
          path: url.pathname,
          remoteAddress: req.socket.remoteAddress ?? null,
        });
        sendJson(res, 400, {
          ok: false,
          error: {
            code: "NOT_CONFIGURED",
            message: "Save Demo login, server, and password before testing connection.",
          },
        });
        return true;
      }

      const meta = manager.getDemoLoginMeta();
      const hasPassword = Boolean(manager.getDemoPassword());
      if (!meta || !hasPassword) {
        await appendMt5HfmCredentialAudit({
          action: "test_connection",
          ok: false,
          actor: ACTOR,
          environment: "demo",
          code: "NOT_CONFIGURED",
          path: url.pathname,
          remoteAddress: req.socket.remoteAddress ?? null,
        });
        sendJson(res, 400, {
          ok: false,
          error: {
            code: "NOT_CONFIGURED",
            message: "Demo credentials incomplete in vault.",
          },
        });
        return true;
      }

      // Never touch Live password. DNS/TCP only — does not invoke Demo login.
      const probe = await probeHfmDemoNetwork(meta.server);
      let agentStatus: Record<string, unknown> | null = null;
      try {
        const agentRes = await callMt5HfmAgent("demo.connection_status", {});
        agentStatus = redactAgentPayload(agentRes) as Record<string, unknown>;
      } catch {
        agentStatus = { ok: false, code: "AGENT_UNAVAILABLE" };
      }
      const stages = initialConnectionStagesFromProbe(probe);
      // Upgrade terminal stage if agent reports process presence.
      const terminalRunning = Boolean(
        agentStatus
        && typeof agentStatus === "object"
        && (agentStatus as { result?: { terminalRunning?: boolean } }).result?.terminalRunning,
      );
      if (terminalRunning) {
        const idx = stages.findIndex((s) => s.stage === "mt5_terminal");
        if (idx >= 0) {
          stages[idx] = {
            stage: "mt5_terminal",
            status: "ok",
            summary: "MT5 terminal64 process is running under the mt5 user (not authenticated).",
          };
        }
      }
      await manager.recordProbeResult("demo", {
        status: probe.status,
        errorMessage: probe.ok ? null : probe.summary,
        summary: probe.summary,
      });
      const status = manager.publicStatus();
      const payload = {
        ok: true,
        environment: "demo" as const,
        probe,
        stages,
        agentStatus,
        status,
        account: status.demo.account,
        liveGate: status.liveGate,
        authenticatedLogin: false as const,
        note: probe.ok
          ? "DNS/TCP Demo endpoints reachable. This is NOT an authenticated MT5 Demo login. Use POST /login for agent Demo authentication."
          : "HFM Demo network probe failed. Credentials were not sent to any host. Authenticated login was not attempted.",
      };
      assertNoSecretsInMt5HfmPayload(payload);
      await appendMt5HfmCredentialAudit({
        action: "test_connection",
        ok: probe.ok,
        actor: ACTOR,
        environment: "demo",
        code: probe.status,
        loginHint: status.demo.loginHint,
        server: status.demo.server,
        detail: probe.summary,
        path: url.pathname,
        remoteAddress: req.socket.remoteAddress ?? null,
      });
      sendJson(res, 200, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/login" && req.method === "POST") {
      const body = await readJsonBody(req);
      let env: Mt5HfmEnvironment = "demo";
      try {
        env = parseMt5HfmEnvironment(body.environment ?? "demo");
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error instanceof Error ? error.message : "Invalid environment.",
          },
        });
        return true;
      }
      if (env === "live") {
        await appendMt5HfmCredentialAudit({
          action: "live_activation_blocked",
          ok: false,
          actor: ACTOR,
          environment: "live",
          code: "LIVE_ACTIVATION_LOCKED",
          path: url.pathname,
          remoteAddress: req.socket.remoteAddress ?? null,
          detail: "login",
        });
        sendLiveLocked(res, sendJson, "login");
        return true;
      }
      const bridge = await requestMt5HfmDemoLoginBridge();
      const status = manager.publicStatus();
      const payload = {
        ok: bridge.ok,
        environment: "demo" as const,
        authenticatedLogin: bridge.authenticatedLogin,
        terminalConnected: bridge.terminalConnected,
        bridge,
        status,
        account: bridge.account ?? status.demo.account,
        liveGate: status.liveGate,
        note: bridge.note,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      await appendMt5HfmCredentialAudit({
        action: "test_connection",
        ok: bridge.authenticatedLogin,
        actor: ACTOR,
        environment: "demo",
        code: bridge.status,
        loginHint: status.demo.loginHint,
        server: status.demo.server,
        detail: bridge.authenticatedLogin ? "demo_login" : "demo_login_unconfirmed",
        path: url.pathname,
        remoteAddress: req.socket.remoteAddress ?? null,
      });
      sendJson(res, bridge.ok ? 200 : 503, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/account/sync" && req.method === "POST") {
      const body = await readJsonBody(req);
      let syncEnv: Mt5HfmEnvironment = "demo";
      try {
        syncEnv = parseMt5HfmEnvironment(body.environment ?? "demo");
      } catch {
        sendJson(res, 400, {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "environment must be demo or live" },
        });
        return true;
      }
      if (syncEnv === "live") {
        sendLiveLocked(res, sendJson, "account sync");
        return true;
      }
      const bridge = await requestMt5HfmDemoAccountSnapshot();
      if (bridge.account) {
        await manager.recordDemoAccountSnapshot({
          loginHint: bridge.account.loginHint,
          server: bridge.account.server,
          currency: bridge.account.currency,
          balance: bridge.account.balance,
          equity: bridge.account.equity,
          credit: (bridge.account as { credit?: number | null }).credit ?? null,
          profit: (bridge.account as { profit?: number | null }).profit ?? null,
          freeMargin: bridge.account.freeMargin,
          usedMargin: (bridge.account as { usedMargin?: number | null }).usedMargin ?? null,
          marginLevel: bridge.account.marginLevel,
          leverage: bridge.account.leverage,
          company: bridge.account.company,
          syncedAt: bridge.account.syncedAt,
          note: bridge.account.note,
          source: (bridge.account as { source?: string | null }).source ?? "mt5_mcp",
        });
      }
      const status = manager.publicStatus();
      const payload = { ok: bridge.ok, environment: "demo" as const, bridge, status, account: status.demo.account };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, bridge.ok ? 200 : 503, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/market/quotes" && req.method === "POST") {
      const body = await readJsonBody(req);
      let qEnv: Mt5HfmEnvironment = "demo";
      try {
        qEnv = parseMt5HfmEnvironment(body.environment ?? "demo");
      } catch {
        sendJson(res, 400, {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "environment must be demo or live" },
        });
        return true;
      }
      if (qEnv === "live") {
        sendLiveLocked(res, sendJson, "market data");
        return true;
      }
      try {
        const symbols = Array.isArray(body.symbols) ? body.symbols.map(String) : [];
        const agentRes = await callMt5HfmAgent("demo.quotes_snapshot", { symbols });
        const payload = {
          ok: agentRes.ok,
          environment: "demo" as const,
          quotes: agentRes.result ?? null,
          authenticatedLogin: false,
          note: "Quotes require agent + future MT5 API enhancer; empty/unavailable is explicit.",
        };
        assertNoSecretsInMt5HfmPayload(payload);
        sendJson(res, agentRes.ok ? 200 : 503, payload);
      } catch {
        sendJson(res, 503, {
          ok: false,
          error: { code: "AGENT_UNAVAILABLE", message: "MT5 agent socket unavailable." },
        });
      }
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/market/candles" && req.method === "POST") {
      const body = await readJsonBody(req);
      let cEnv: Mt5HfmEnvironment = "demo";
      try {
        cEnv = parseMt5HfmEnvironment(body.environment ?? "demo");
      } catch {
        sendJson(res, 400, {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "environment must be demo or live" },
        });
        return true;
      }
      if (cEnv === "live") {
        sendLiveLocked(res, sendJson, "market data");
        return true;
      }
      try {
        const agentRes = await callMt5HfmAgent("demo.candles", {
          symbol: String(body.symbol ?? ""),
          timeframe: String(body.timeframe ?? ""),
          limit: Number(body.limit ?? 100),
        });
        const payload = {
          ok: agentRes.ok,
          environment: "demo" as const,
          candles: agentRes.result ?? null,
          note: "Candles require agent + future MT5 API enhancer; empty/unavailable is explicit.",
        };
        assertNoSecretsInMt5HfmPayload(payload);
        sendJson(res, agentRes.ok ? 200 : (agentRes.code === "UNSUPPORTED_TIMEFRAME" || agentRes.code === "INVALID_SYMBOL" ? 400 : 503), payload);
      } catch {
        sendJson(res, 503, {
          ok: false,
          error: { code: "AGENT_UNAVAILABLE", message: "MT5 agent socket unavailable." },
        });
      }
      return true;
    }

    // --- Phase 1 HFM instrument catalog (admin-auth, HFM-only) ---
    const catalog = getHfmCatalogService();

    if (url.pathname === "/api/forex/providers/mt5-hfm/symbols/status" && (req.method === "GET" || req.method === "HEAD")) {
      const probe = url.searchParams.get("probe") !== "0";
      const status = await catalog.getStatus({ probeAgent: probe });
      const payload = {
        ok: true,
        provider: "HFM_MT5" as const,
        environment: "demo" as const,
        status,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, status.available || status.freshness === "IN_PROGRESS" ? 200 : 503, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/symbols/categories" && (req.method === "GET" || req.method === "HEAD")) {
      await catalog.load();
      const cats = await catalog.categories();
      const payload = {
        ok: cats.available,
        provider: "HFM_MT5" as const,
        environment: "demo" as const,
        catalogVersion: cats.catalogVersion,
        categories: HFM_CATALOG_CATEGORIES.map((name) => ({
          category: name,
          count: cats.counts[name] ?? 0,
        })),
        unavailableReason: cats.unavailableReason,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, cats.available ? 200 : 503, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/symbols/sync" && req.method === "POST") {
      const body = await readJsonBody(req);
      const forceRefresh = body.forceRefresh === true || body.refresh === true;
      const result = await catalog.syncFromAgent({ forceRefresh });
      const payload = {
        ok: result.ok,
        provider: "HFM_MT5" as const,
        environment: "demo" as const,
        synced: result.synced,
        durationMs: result.durationMs,
        errorCode: result.errorCode,
        status: result.status,
        catalogVersion: result.snapshot?.catalogVersion ?? null,
        enumeratedCount: result.snapshot?.enumeratedCount ?? null,
        generalSymbolCount: result.snapshot?.generalSymbolCount ?? null,
        selectedSymbolCount: result.snapshot?.selectedSymbolCount ?? null,
        metadataCompletenessAvg: result.snapshot?.metadataCompletenessAvg ?? null,
        categoryCounts: result.snapshot?.categoryCounts ?? null,
        checksumSha256: result.snapshot?.checksumSha256 ?? null,
        changes: result.snapshot?.changes ?? null,
        mutatesBroker: false,
        placesOrders: false,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, result.ok ? 200 : 503, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/symbols" && (req.method === "GET" || req.method === "HEAD")) {
      await catalog.load();
      if (url.searchParams.get("sync") === "1") {
        await catalog.syncFromAgent({ forceRefresh: false });
      }
      const selectedParam = url.searchParams.get("selected");
      const customParam = url.searchParams.get("custom");
      const result = await catalog.query({
        q: url.searchParams.get("q") ?? undefined,
        category: url.searchParams.get("category") ?? undefined,
        lifecycle: url.searchParams.get("lifecycle") ?? undefined,
        selected: selectedParam == null ? undefined : selectedParam === "1" || selectedParam === "true",
        custom: customParam == null ? undefined : customParam === "1" || customParam === "true",
        offset: Number(url.searchParams.get("offset") ?? 0),
        limit: Number(url.searchParams.get("limit") ?? 50),
      });
      const status = await catalog.getStatus({ probeAgent: false });
      const payload = {
        ok: result.available,
        provider: "HFM_MT5" as const,
        environment: "demo" as const,
        freshness: result.freshness,
        catalogVersion: result.catalogVersion,
        brokerServer: status.brokerServer,
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        returned: result.returned,
        symbols: result.symbols,
        completeness: {
          metadataCompletenessAvg: status.metadataCompletenessAvg,
          fieldErrorSummary: status.fieldErrorSummary,
          generalSymbolCount: status.generalSymbolCount,
          selectedSymbolCount: status.selectedSymbolCount,
          enumeratedCount: status.enumeratedCount,
        },
        unavailableReason: result.unavailableReason,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, result.available ? 200 : 503, payload);
      return true;
    }

    const symbolDetailMatch = url.pathname.match(/^\/api\/forex\/providers\/mt5-hfm\/symbols\/([^/]+)$/);
    if (symbolDetailMatch && (req.method === "GET" || req.method === "HEAD")) {
      const rawSym = decodeURIComponent(symbolDetailMatch[1] ?? "");
      if (!rawSym || rawSym === "status" || rawSym === "categories" || rawSym === "sync") {
        sendJson(res, 404, {
          ok: false,
          error: { code: "NOT_FOUND", message: "Unknown MT5 HFM symbols route." },
        });
        return true;
      }
      await catalog.load();
      const row = await catalog.getSymbol(rawSym);
      if (!row) {
        sendJson(res, 404, {
          ok: false,
          provider: "HFM_MT5",
          environment: "demo",
          error: { code: "SYMBOL_NOT_FOUND", message: `Symbol not in HFM catalog: ${rawSym}` },
        });
        return true;
      }
      const payload = {
        ok: true,
        provider: "HFM_MT5" as const,
        environment: "demo" as const,
        symbol: row,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, 200, payload);
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown MT5 HFM route." },
    });
    return true;
  } catch (error) {
    if (error instanceof Mt5HfmLiveActivationLockedError) {
      sendLiveLocked(res, sendJson, error.action.replace(/_/g, " "));
      return true;
    }
    const message = error instanceof Error ? error.message.slice(0, 300) : "MT5 HFM API error.";
    sendJson(res, 500, {
      ok: false,
      error: { code: "INTERNAL_ERROR", message },
    });
    return true;
  }
}
