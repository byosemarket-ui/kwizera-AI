/**
 * HFM MT5 Demo Connection Manager API.
 *
 * GET  /api/forex/providers/mt5-hfm/status
 * POST /api/forex/providers/mt5-hfm/auth-check
 * POST /api/forex/providers/mt5-hfm/credentials
 * POST /api/forex/providers/mt5-hfm/credentials/clear
 * POST /api/forex/providers/mt5-hfm/test-connection
 * GET  /api/forex/providers/mt5-hfm/account
 *
 * Admin token required for all routes. Never returns stored passwords.
 * LIVE mutations are rejected. Stored passwords are never returned to clients.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  assertAdminAccess,
  rolesFromHeaders,
  adminTokenFromHeaders,
} from "../../ai/admin-control-plane/admin-auth-boundary.js";
import {
  getMt5HfmDemoProfileManager,
  isLiveLookingServer,
} from "../../ai/market-data/mt5-hfm/demo-profile.js";
import { probeHfmDemoNetwork } from "../../ai/market-data/mt5-hfm/connection-probe.js";
import { assertNoSecretsInMt5HfmPayload } from "../../ai/market-data/mt5-hfm/secrets-guard.js";
import { appendMt5HfmCredentialAudit } from "../../ai/market-data/mt5-hfm/credential-audit.js";
import { requestMt5HfmDemoLoginBridge } from "../../ai/market-data/mt5-hfm/login-bridge.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

const MAX_BODY_BYTES = 4096;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

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

function rejectLive(
  body: Record<string, unknown>,
  res: ServerResponse,
  sendJson: SendJson,
): boolean {
  const env = String(body.environment ?? body.env ?? "demo").trim().toLowerCase();
  if (env === "live" || env === "real" || env === "production") {
    sendJson(res, 403, {
      ok: false,
      error: {
        code: "LIVE_DISABLED",
        message: "HFM Live account operations are disabled. Demo only.",
      },
    });
    return true;
  }
  const server = String(body.server ?? "").trim();
  if (server && isLiveLookingServer(server)) {
    sendJson(res, 403, {
      ok: false,
      error: {
        code: "LIVE_DISABLED",
        message: "Live server names are not allowed. Demo servers only.",
      },
    });
    return true;
  }
  return false;
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
        note: "Admin API token accepted for HFM MT5 Demo credential actions.",
      };
      assertNoSecretsInMt5HfmPayload(payload);
      await appendMt5HfmCredentialAudit({
        action: "auth_check",
        ok: true,
        path: url.pathname,
        remoteAddress: req.socket.remoteAddress ?? null,
      });
      sendJson(res, 200, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/status" && (req.method === "GET" || req.method === "HEAD")) {
      const status = manager.publicStatus();
      assertNoSecretsInMt5HfmPayload(status);
      sendJson(res, 200, status);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/account" && (req.method === "GET" || req.method === "HEAD")) {
      const status = manager.publicStatus();
      const payload = {
        ok: true,
        configured: status.configured,
        account: status.account,
        lastSyncAt: status.lastSyncAt,
        connectionStatus: status.connectionStatus,
        mt5LoginBridge: status.mt5LoginBridge,
        note: status.account
          ? "Verified Demo account snapshot."
          : "No verified Demo account snapshot yet. Save credentials and run Test Connection; terminal login bridge still required for balance/equity.",
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, 200, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/credentials" && req.method === "POST") {
      const body = await readJsonBody(req);
      if (rejectLive(body, res, sendJson)) {
        await appendMt5HfmCredentialAudit({
          action: "save",
          ok: false,
          code: "LIVE_DISABLED",
          path: url.pathname,
          remoteAddress: req.socket.remoteAddress ?? null,
        });
        return true;
      }
      // Password is accepted for vault write only — never logged or echoed.
      const password = String(body.password ?? "");
      try {
        const status = await manager.saveCredentials({
          login: String(body.login ?? body.account ?? body.username ?? ""),
          server: String(body.server ?? ""),
          password,
        });
        const payload = {
          ok: true,
          status,
          note: "Demo credentials saved to encrypted vault. Password is not returned.",
        };
        assertNoSecretsInMt5HfmPayload(payload, [password]);
        await appendMt5HfmCredentialAudit({
          action: "save",
          ok: true,
          code: "SAVED",
          loginHint: status.loginHint,
          server: status.server,
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
      if (rejectLive(body, res, sendJson)) {
        await appendMt5HfmCredentialAudit({
          action: "clear",
          ok: false,
          code: "LIVE_DISABLED",
          path: url.pathname,
          remoteAddress: req.socket.remoteAddress ?? null,
        });
        return true;
      }
      const status = await manager.clearCredentials();
      const payload = {
        ok: true,
        status,
        note: "Demo credentials cleared from vault and metadata.",
      };
      assertNoSecretsInMt5HfmPayload(payload);
      await appendMt5HfmCredentialAudit({
        action: "clear",
        ok: true,
        code: "CLEARED",
        path: url.pathname,
        remoteAddress: req.socket.remoteAddress ?? null,
      });
      sendJson(res, 200, payload);
      return true;
    }

    if (url.pathname === "/api/forex/providers/mt5-hfm/test-connection" && req.method === "POST") {
      const body = await readJsonBody(req);
      if (rejectLive(body, res, sendJson)) {
        await appendMt5HfmCredentialAudit({
          action: "test_connection",
          ok: false,
          code: "LIVE_DISABLED",
          path: url.pathname,
          remoteAddress: req.socket.remoteAddress ?? null,
        });
        return true;
      }

      const statusBefore = manager.publicStatus();
      if (!statusBefore.configured) {
        await appendMt5HfmCredentialAudit({
          action: "test_connection",
          ok: false,
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
      // Touch vault presence without placing password into argv/logs.
      const hasPassword = Boolean(manager.getDemoPassword());
      if (!meta || !hasPassword) {
        await appendMt5HfmCredentialAudit({
          action: "test_connection",
          ok: false,
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

      const probe = await probeHfmDemoNetwork(meta.server);
      // Documented bridge — not enabled; keeps account sync NOT VERIFIED.
      const bridge = await requestMt5HfmDemoLoginBridge();
      await manager.recordProbeResult({
        status: probe.status,
        errorMessage: probe.ok ? null : probe.summary,
        summary: probe.summary,
      });
      const status = manager.publicStatus();
      const payload = {
        ok: true,
        probe,
        bridge,
        status,
        account: status.account,
        note: probe.ok
          ? "HFM Demo network reachable. MT5 terminal login and account sync are not verified until the local mt5 agent is approved and enabled."
          : "HFM Demo network probe failed. Credentials were not sent to any host.",
      };
      assertNoSecretsInMt5HfmPayload(payload);
      await appendMt5HfmCredentialAudit({
        action: "test_connection",
        ok: probe.ok,
        code: probe.status,
        loginHint: status.loginHint,
        server: status.server,
        detail: probe.summary,
        path: url.pathname,
        remoteAddress: req.socket.remoteAddress ?? null,
      });
      sendJson(res, 200, payload);
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown MT5 HFM route." },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "MT5 HFM API error.";
    // Never include request bodies in error responses.
    sendJson(res, 500, {
      ok: false,
      error: { code: "INTERNAL_ERROR", message },
    });
    return true;
  }
}
