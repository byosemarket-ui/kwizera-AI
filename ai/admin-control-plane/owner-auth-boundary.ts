/**
 * Stage 7.2 — Distinct system-owner authorization boundary.
 * Server-side KWIZERA_OWNER_API_TOKEN only. Never trusts client role/owner headers.
 * Owner is never implied by Forex Admin / KWIZERA_ADMIN_API_TOKEN.
 * Secrets are never revealed through this boundary.
 */
import { timingSafeEqual } from "node:crypto";

export interface OwnerAccessContext {
  /** Dedicated owner token from x-kwizera-owner-token only (never role headers). */
  ownerToken?: string;
  path: string;
  correlationId?: string | null;
  /** Ignored for authorization — accepted only to prove forged claims are discarded. */
  clientClaimedOwnerRole?: string | null;
  clientClaimedOwnerId?: string | null;
}

export interface OwnerAccessDecision {
  allowed: boolean;
  code: string;
  reason: string;
  /** Non-secret principal label for audit (never the token). */
  actorId: string | null;
  ownerConfigured: boolean;
  ownerDistinctFromAdmin: boolean;
  mayRevealSecrets: false;
  correlationId: string | null;
}

function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    const padded = Buffer.alloc(b.length);
    a.copy(padded);
    timingSafeEqual(padded, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

function readOwnerTokenEnv(): string | null {
  const t = process.env.KWIZERA_OWNER_API_TOKEN?.trim();
  return t && t.length > 0 ? t : null;
}

function readAdminTokenEnv(): string | null {
  const t = process.env.KWIZERA_ADMIN_API_TOKEN?.trim();
  return t && t.length > 0 ? t : null;
}

function readOwnerPrincipalId(): string {
  const id = process.env.KWIZERA_OWNER_PRINCIPAL_ID?.trim();
  return id && id.length > 0 ? id : "system-owner";
}

/** True when a distinct owner token is configured server-side. */
export function isOwnerIdentityConfigured(): boolean {
  const owner = readOwnerTokenEnv();
  if (!owner) return false;
  const admin = readAdminTokenEnv();
  if (admin && owner === admin) return false;
  return true;
}

export function getOwnerAuthPublicStatus(): {
  ownerConfigured: boolean;
  ownerDistinctFromAdmin: boolean;
  principalId: string | null;
  permissionModel: "owner-token";
  trustsClientOwnerHeaders: false;
  note: string;
} {
  const owner = readOwnerTokenEnv();
  const admin = readAdminTokenEnv();
  const distinct = Boolean(owner && (!admin || owner !== admin));
  const configured = Boolean(owner && distinct);
  return {
    ownerConfigured: configured,
    ownerDistinctFromAdmin: distinct || !owner,
    principalId: configured ? readOwnerPrincipalId() : null,
    permissionModel: "owner-token",
    trustsClientOwnerHeaders: false,
    note: configured
      ? "Distinct KWIZERA_OWNER_API_TOKEN is configured. Client owner/role headers are ignored."
      : (!owner
        ? "KWIZERA_OWNER_API_TOKEN is not configured — owner actions fail closed."
        : "KWIZERA_OWNER_API_TOKEN must be distinct from KWIZERA_ADMIN_API_TOKEN."),
  };
}

/**
 * Authorize a system-owner sensitive action.
 * Client-supplied owner role/id headers are ignored (and cannot grant access).
 */
export function assertOwnerAccess(ctx: OwnerAccessContext): OwnerAccessDecision {
  const correlationId = ctx.correlationId ? String(ctx.correlationId) : null;
  // Explicitly discard client claims — never use them for allow decisions.
  void ctx.clientClaimedOwnerRole;
  void ctx.clientClaimedOwnerId;

  const expected = readOwnerTokenEnv();
  const admin = readAdminTokenEnv();

  if (!expected) {
    return {
      allowed: false,
      code: "OWNER_TOKEN_NOT_CONFIGURED",
      reason: "System owner token is not configured on the server (KWIZERA_OWNER_API_TOKEN).",
      actorId: null,
      ownerConfigured: false,
      ownerDistinctFromAdmin: true,
      mayRevealSecrets: false,
      correlationId,
    };
  }

  if (admin && expected === admin) {
    return {
      allowed: false,
      code: "OWNER_TOKEN_NOT_DISTINCT",
      reason:
        "Owner token must be distinct from the Admin API token — administrators are not silently promoted to owners.",
      actorId: null,
      ownerConfigured: false,
      ownerDistinctFromAdmin: false,
      mayRevealSecrets: false,
      correlationId,
    };
  }

  const provided = ctx.ownerToken?.trim();
  if (!provided) {
    return {
      allowed: false,
      code: "OWNER_TOKEN_MISSING",
      reason: "Owner API token missing (send x-kwizera-owner-token).",
      actorId: null,
      ownerConfigured: true,
      ownerDistinctFromAdmin: true,
      mayRevealSecrets: false,
      correlationId,
    };
  }

  if (!tokenMatches(provided, expected)) {
    return {
      allowed: false,
      code: "OWNER_TOKEN_INVALID",
      reason: "Owner API token invalid.",
      actorId: null,
      ownerConfigured: true,
      ownerDistinctFromAdmin: true,
      mayRevealSecrets: false,
      correlationId,
    };
  }

  return {
    allowed: true,
    code: "OWNER_TOKEN_OK",
    reason: "System owner token accepted.",
    actorId: readOwnerPrincipalId(),
    ownerConfigured: true,
    ownerDistinctFromAdmin: true,
    mayRevealSecrets: false,
    correlationId,
  };
}

/** Extract owner token from dedicated header only — never Authorization Bearer / role headers. */
export function ownerTokenFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const dedicated = headers["x-kwizera-owner-token"];
  if (!dedicated) return undefined;
  const value = Array.isArray(dedicated) ? dedicated[0] : dedicated;
  return value?.trim() || undefined;
}

export function clientOwnerClaimsFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): { role: string | null; ownerId: string | null } {
  const roleRaw = headers["x-kwizera-owner-role"] ?? headers["x-kwizera-is-owner"];
  const idRaw = headers["x-kwizera-owner-id"];
  const role = roleRaw == null
    ? null
    : (Array.isArray(roleRaw) ? roleRaw[0] : String(roleRaw)).trim() || null;
  const ownerId = idRaw == null
    ? null
    : (Array.isArray(idRaw) ? idRaw[0] : String(idRaw)).trim() || null;
  return { role, ownerId };
}
