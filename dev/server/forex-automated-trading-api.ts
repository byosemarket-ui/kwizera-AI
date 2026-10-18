/**
 * Phase 51/52 — Automated Trading configuration, status & verification API.
 * Admin-gated mutations. Never places broker orders.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  AUTOMATED_EXECUTION_BANNER,
  getAutomatedTradingService,
} from "../../ai/forex-ai/automated-trading/index.js";
import { requireForexAdmin } from "./forex-admin-auth.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

async function readJsonBody(req: IncomingMessage, max = 16_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > max) throw Object.assign(new Error("Body too large"), { code: "PAYLOAD_TOO_LARGE" });
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function isAtPath(pathname: string, base: string): boolean {
  return pathname === base || pathname === `${base}/`;
}

export async function handleForexAutomatedTradingApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/automated-trading")) return false;

  // Reject any order-like paths explicitly.
  if (/order|position\/close|submit|execute/i.test(url.pathname)) {
    sendJson(res, 403, {
      ok: false,
      error: {
        code: "EXECUTION_FORBIDDEN",
        message: AUTOMATED_EXECUTION_BANNER,
      },
      placesOrders: false,
    });
    return true;
  }

  try {
    if (!requireForexAdmin(req, res, sendJson, url.pathname)) return true;
    const service = getAutomatedTradingService();

    if (isAtPath(url.pathname, "/api/forex/automated-trading/status")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const status = await service.buildStatus();
      sendJson(res, 200, { ok: true, status, placesOrders: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/audit")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const limit = Number(url.searchParams.get("limit") ?? 40);
      sendJson(res, 200, {
        ok: true,
        events: service.getAudit(Number.isFinite(limit) ? limit : 40),
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/environment")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const result = await service.selectEnvironment({
        environment: body.environment,
        confirm: body.confirm,
        expectedCurrentEnvironment: body.expectedCurrentEnvironment,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
      });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, status: result.status, placesOrders: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/controls")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const patch = (body.patch && typeof body.patch === "object")
        ? (body.patch as Record<string, unknown>)
        : body;
      const result = await service.updateControls({
        environment: body.environment,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
        patch: {
          masterEnable: typeof patch.masterEnable === "boolean" ? patch.masterEnable : undefined,
          automaticEntry: typeof patch.automaticEntry === "boolean" ? patch.automaticEntry : undefined,
          positionManagement:
            typeof patch.positionManagement === "boolean" ? patch.positionManagement : undefined,
          emergencyEntryLock:
            typeof patch.emergencyEntryLock === "boolean" ? patch.emergencyEntryLock : undefined,
        },
      });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, status: result.status, placesOrders: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/emergency-lock")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const result = await service.setEmergencyLock({
        environment: body.environment,
        locked: body.locked,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
      });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, status: result.status, placesOrders: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/verify-account")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const result = await service.recordAccountVerification({
        environment: body.environment,
        accountId: body.accountId,
        status: body.status,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
      });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, status: result.status, placesOrders: false });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/verify")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const result = await service.runVerification({
        environment: body.environment,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
        instrument: body.instrument,
        accountId: body.accountId,
        timeframe: body.timeframe,
      });
      if (!result.ok) {
        sendJson(res, result.code === "STALE_EPOCH" || result.code === "ENVIRONMENT_MISMATCH" ? 409 : 503, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        verification: result.verification,
        status: result.status,
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/verification")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const status = await service.buildStatus();
      sendJson(res, 200, {
        ok: true,
        verification: service.getLatestVerification(),
        status,
        placesOrders: false,
      });
      return true;
    }

    if (isAtPath(url.pathname, "/api/forex/automated-trading/instrument")) {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const result = await service.setSelectedInstrument({
        environment: body.environment,
        instrument: body.instrument,
        expectedEnvironmentEpoch: body.expectedEnvironmentEpoch,
      });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: { code: result.code, message: result.message },
          status: result.status,
          placesOrders: false,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, status: result.status, placesOrders: false });
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown Automated Trading endpoint." },
      placesOrders: false,
    });
    return true;
  } catch (err) {
    const code = (err as { code?: string })?.code === "PAYLOAD_TOO_LARGE"
      ? "PAYLOAD_TOO_LARGE"
      : "AUTOMATED_TRADING_ERROR";
    sendJson(res, code === "PAYLOAD_TOO_LARGE" ? 413 : 500, {
      ok: false,
      error: {
        code,
        message: err instanceof Error ? err.message.slice(0, 240) : "Automated Trading request failed.",
      },
      placesOrders: false,
    });
    return true;
  }
}
