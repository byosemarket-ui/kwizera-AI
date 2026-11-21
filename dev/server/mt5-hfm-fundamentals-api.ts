/**
 * Phase 7 — HFM Economic Calendar Admin API (read-only + gated manual refresh).
 * Prefix: /api/forex/providers/mt5-hfm/fundamentals
 * Also: GET /api/forex/providers/mt5-hfm/analysis/fundamentals/:snapshotId
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  assertAdminAccess,
  rolesFromHeaders,
  adminTokenFromHeaders,
} from "../../ai/admin-control-plane/admin-auth-boundary.js";
import {
  buildFundamentalsStatusPublic,
  buildPublicCalendarEvent,
  buildPublicCalendarQuery,
  buildPublicFundamentalsSnapshotSummary,
  economicCalendarEnableInstructions,
  getBackgroundRefreshEnabled,
  refreshHfmEconomicCalendar,
} from "../../ai/market-data/mt5-hfm/fundamentals/index.js";
import { getHfmAnalysisStorage } from "../../ai/market-data/mt5-hfm/analysis/index.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

function headersRecord(req: IncomingMessage): Record<string, string | string[] | undefined> {
  return req.headers as Record<string, string | string[] | undefined>;
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
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return false;
  }
  return true;
}

export async function handleMt5HfmFundamentalsApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  const path = url.pathname;

  // Snapshot package under analysis/ prefix (Phase 6-style)
  const snapMatch = path.match(
    /^\/api\/forex\/providers\/mt5-hfm\/analysis\/fundamentals\/([^/]+)$/,
  );
  if (snapMatch && req.method === "GET") {
    if (!requireAdmin(req, res, sendJson, path)) return true;
    const snapshotId = decodeURIComponent(snapMatch[1] ?? "").trim();
    if (!snapshotId) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_SNAPSHOT_ID", message: "snapshotId required" },
      });
      return true;
    }
    let symbol = String(url.searchParams.get("symbol") ?? "").trim().toUpperCase();
    if (!symbol) {
      const ctx = await getHfmAnalysisStorage().loadContext(snapshotId);
      symbol = String((ctx as { snapshot?: { symbol?: string } } | null)?.snapshot?.symbol ?? "")
        .trim()
        .toUpperCase();
    }
    if (!symbol) {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: "SYMBOL_REQUIRED",
          message: "Pass ?symbol= or use a known snapshot context",
        },
      });
      return true;
    }
    const payload = await buildPublicFundamentalsSnapshotSummary({ snapshotId, symbol });
    sendJson(res, 200, payload);
    return true;
  }

  if (!path.startsWith("/api/forex/providers/mt5-hfm/fundamentals")) {
    return false;
  }
  if (!requireAdmin(req, res, sendJson, path)) return true;

  if (path === "/api/forex/providers/mt5-hfm/fundamentals/status" && req.method === "GET") {
    const status = buildFundamentalsStatusPublic();
    const storageState = await import("../../ai/market-data/mt5-hfm/fundamentals/storage.js").then(
      (m) => m.getHfmFundamentalsStorage().loadProviderState(),
    );
    sendJson(res, 200, {
      ...status,
      lastSuccessAtUtc: storageState?.lastSuccessAtUtc ?? null,
      lastError: storageState?.lastError ?? null,
      lastCount: storageState?.lastCount ?? null,
      attribution: storageState?.attribution ?? null,
    });
    return true;
  }

  if (path === "/api/forex/providers/mt5-hfm/fundamentals/calendar" && req.method === "GET") {
    const currencies = String(url.searchParams.get("currency") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const impacts = String(url.searchParams.get("impact") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const payload = await buildPublicCalendarQuery({
      currencies,
      impacts,
      limit: Number.isFinite(limit) ? limit : 50,
      symbol: url.searchParams.get("symbol") ?? undefined,
    });
    sendJson(res, payload.ok ? 200 : payload.availability === "LICENSING_BLOCKED" ? 403 : 200, payload);
    return true;
  }

  const eventMatch = path.match(
    /^\/api\/forex\/providers\/mt5-hfm\/fundamentals\/calendar\/([^/]+)$/,
  );
  if (eventMatch && req.method === "GET") {
    const eventId = decodeURIComponent(eventMatch[1] ?? "").trim();
    const payload = await buildPublicCalendarEvent(eventId);
    sendJson(res, payload.found ? 200 : 404, payload);
    return true;
  }

  if (path === "/api/forex/providers/mt5-hfm/fundamentals/refresh" && req.method === "POST") {
    const result = await refreshHfmEconomicCalendar({ force: false });
    const http =
      result.code === "LICENSING_BLOCKED"
        ? 403
        : result.code === "RATE_LIMITED" || result.code === "REFRESH_IN_FLIGHT"
          ? 409
          : result.ok
            ? 200
            : result.code === "NOT_CONFIGURED"
              ? 403
              : 502;
    sendJson(res, http, {
      ...result,
      enableInstructions: economicCalendarEnableInstructions(),
      backgroundRefreshEnabled: getBackgroundRefreshEnabled(),
    });
    return true;
  }

  sendJson(res, 404, {
    ok: false,
    error: { code: "NOT_FOUND", message: "Unknown fundamentals route" },
    placesOrders: false,
    mutatesBroker: false,
  });
  return true;
}
