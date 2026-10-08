/**
 * Phase 25 — Market-data provider registry API (read-only).
 * GET /api/forex/providers
 * GET /api/forex/providers/fxcm/status
 * GET /api/forex/providers/fxcm/instruments
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { userFacingFxcmError } from "../../ai/market-data/fxcm/errors.js";
import { getMarketDataProviderRegistry } from "../../ai/market-data/providers/index.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

export async function handleForexProvidersApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/providers")) return false;

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Provider routes are read-only (GET)." },
    });
    return true;
  }

  const registry = getMarketDataProviderRegistry();

  try {
    if (url.pathname === "/api/forex/providers") {
      const snapshot = await registry.snapshot();
      sendJson(res, 200, {
        ok: true,
        ...snapshot,
        note: "FXCM Phase 25 foundation — live stream and trading are not enabled.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/providers/fxcm/status") {
      const fxcm = registry.getFxcm();
      const health = await fxcm.healthCheck();
      const info = fxcm.getProviderInfo();
      sendJson(res, health.status === "CONNECTED" || health.status === "NOT_CONFIGURED" || health.status === "DISABLED" ? 200 : 503, {
        ok: health.status !== "ERROR" && health.status !== "AUTHENTICATION_ERROR" && health.status !== "NETWORK_ERROR",
        provider: info,
        health,
        capabilities: fxcm.getCapabilities(),
        liveStream: "NOT_ENABLED_YET",
        trading: "DISABLED",
      });
      return true;
    }

    if (url.pathname === "/api/forex/providers/fxcm/instruments") {
      const fxcm = registry.getFxcm();
      const config = fxcm.getConfig();
      if (!config.enabled) {
        sendJson(res, 503, {
          ok: false,
          error: { code: "FXCM_DISABLED", message: "FXCM market data is disabled." },
        });
        return true;
      }
      if (!config.accessTokenConfigured) {
        sendJson(res, 503, {
          ok: false,
          error: {
            code: "FXCM_NOT_CONFIGURED",
            message: "FXCM access token is not configured on the server.",
          },
          environmentLabel: config.environmentLabel,
        });
        return true;
      }
      const refresh = url.searchParams.get("refresh") === "1";
      const instruments = await fxcm.listInstruments({ refresh });
      sendJson(res, 200, {
        ok: true,
        provider: "FXCM",
        environmentLabel: config.environmentLabel,
        count: instruments.length,
        instruments,
        note: "Instrument metadata only — no live prices in Phase 25.",
      });
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown forex providers route." },
    });
    return true;
  } catch (error) {
    const mapped = userFacingFxcmError(error);
    sendJson(res, 503, {
      ok: false,
      error: { code: mapped.code, message: mapped.message },
    });
    return true;
  }
}
