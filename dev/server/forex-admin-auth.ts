/**
 * Shared Admin authorization for Forex Admin / Intelligence / Memory write routes.
 * Reuses the Admin Control Plane boundary (token / role / development-open).
 * Stage 7.2 adds distinct system-owner authorization (never secrets).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  assertAdminAccess,
  adminTokenFromHeaders,
  rolesFromHeaders,
} from "../../ai/admin-control-plane/admin-auth-boundary.js";
import {
  assertOwnerAccess,
  clientOwnerClaimsFromHeaders,
  ownerTokenFromHeaders,
  type OwnerAccessDecision,
} from "../../ai/admin-control-plane/owner-auth-boundary.js";

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

export type ForexOwnerGateResult =
  | { ok: true; decision: OwnerAccessDecision; correlationId: string }
  | { ok: false };

/**
 * Require distinct system-owner access for sensitive governance actions.
 * Does not accept client-supplied owner role headers. Returns false after 403.
 */
export function requireForexOwner(
  req: IncomingMessage,
  res: ServerResponse,
  sendJson: SendJson,
  pathname: string,
  correlationId?: string | null,
): ForexOwnerGateResult {
  const headers = headersRecord(req);
  const claims = clientOwnerClaimsFromHeaders(headers);
  const corr = String(correlationId || req.headers["x-correlation-id"] || randomUUID());
  const decision = assertOwnerAccess({
    ownerToken: ownerTokenFromHeaders(headers),
    path: pathname,
    correlationId: corr,
    clientClaimedOwnerRole: claims.role,
    clientClaimedOwnerId: claims.ownerId,
  });
  if (!decision.allowed) {
    sendJson(res, 403, {
      ok: false,
      error: {
        code: decision.code || "OWNER_FORBIDDEN",
        message: decision.reason,
      },
      ownerConfigured: decision.ownerConfigured,
      ownerDistinctFromAdmin: decision.ownerDistinctFromAdmin,
      correlationId: corr,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      executionAuthorized: false,
      liveUnauthorized: true,
    });
    return { ok: false };
  }
  return { ok: true, decision, correlationId: corr };
}
