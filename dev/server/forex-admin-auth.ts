/**
 * Shared Admin authorization for Forex Admin / Intelligence / Memory write routes.
 * Reuses the Admin Control Plane boundary (token / role / development-open).
 * Never returns secrets.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  assertAdminAccess,
  adminTokenFromHeaders,
  rolesFromHeaders,
} from "../../ai/admin-control-plane/admin-auth-boundary.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

function headersRecord(req: IncomingMessage): Record<string, string | string[] | undefined> {
  return req.headers as Record<string, string | string[] | undefined>;
}

/**
 * Require Admin access for the request. Returns false after sending 403.
 */
export function requireForexAdmin(
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
      error: {
        code: decision.code || "ADMIN_FORBIDDEN",
        message: decision.reason,
      },
      placesOrders: false,
      acceptsForExecution: false,
      liveUnauthorized: true,
    });
    return false;
  }
  return true;
}
