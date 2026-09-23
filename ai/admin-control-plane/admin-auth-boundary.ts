/**
 * Authorization boundary for Admin Control Plane.
 * Development remains configurable; production defaults to requiring a role or API token.
 * Secrets are never revealed through this boundary.
 */

import { timingSafeEqual } from "node:crypto";

export interface AdminAccessContext {
  /** Future: authenticated principal id */
  principalId?: string;
  /** Future: role claims (admin, operator, viewer) */
  roles: string[];
  /** Request path being accessed */
  path: string;
  /** Whether this is an admin-only API */
  adminApi: boolean;
  /** Source IP / trust hint (optional) */
  remoteAddress?: string;
  /** Optional Admin API token from Authorization Bearer / x-kwizera-admin-token */
  adminToken?: string;
}

export interface AdminAccessDecision {
  allowed: boolean;
  reason: string;
  /** When false, callers must not return secrets even if allowed */
  mayRevealSecrets: boolean;
}

export type AdminAuthMode =
  | "development-open"
  | "require-admin-role"
  | "require-admin-token"
  | "deny-all";

function isProductionEnv(): boolean {
  const env = (process.env.KWIZERA_ENV ?? "").trim().toLowerCase();
  const node = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  return env === "production" || node === "production";
}

export function resolveAdminAuthMode(): AdminAuthMode {
  const raw = (process.env.KWIZERA_ADMIN_AUTH_MODE ?? "").trim().toLowerCase();
  if (
    raw === "require-admin-role"
    || raw === "require-admin-token"
    || raw === "deny-all"
    || raw === "development-open"
  ) {
    return raw;
  }
  // Production must not default to open or spoofable role-header-only access.
  // Operators set KWIZERA_ADMIN_API_TOKEN in the server .env (never committed).
  if (isProductionEnv()) {
    return "require-admin-token";
  }
  return "development-open";
}

function hasAdminRole(roles: string[]): boolean {
  const normalized = roles.map((r) => r.toLowerCase());
  return normalized.includes("admin")
    || normalized.includes("super-administrator")
    || normalized.includes("super_admin");
}

function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Constant-time-ish reject without leaking length via early return on equal buffers only.
    const padded = Buffer.alloc(b.length);
    a.copy(padded);
    timingSafeEqual(padded, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Decide whether the caller may access Admin APIs.
 * Secrets are never revealed through this boundary (mayRevealSecrets = false).
 */
export function assertAdminAccess(ctx: AdminAccessContext): AdminAccessDecision {
  const mode = resolveAdminAuthMode();

  if (mode === "deny-all") {
    return { allowed: false, reason: "Admin access denied by KWIZERA_ADMIN_AUTH_MODE=deny-all", mayRevealSecrets: false };
  }

  if (mode === "require-admin-token") {
    const expected = process.env.KWIZERA_ADMIN_API_TOKEN?.trim();
    if (!expected) {
      return {
        allowed: false,
        reason: "Admin API token is not configured on the server",
        mayRevealSecrets: false,
      };
    }
    if (tokenMatches(ctx.adminToken, expected)) {
      return {
        allowed: true,
        reason: "Admin API token accepted",
        mayRevealSecrets: false,
      };
    }
    return { allowed: false, reason: "Admin API token required", mayRevealSecrets: false };
  }

  if (mode === "require-admin-role") {
    const ok = hasAdminRole(ctx.roles);
    return {
      allowed: ok,
      reason: ok ? "Admin role granted" : "Admin role required",
      mayRevealSecrets: false,
    };
  }

  // development-open: allow for Stage 1 direct-access development
  return {
    allowed: true,
    reason: "Development open access (auth boundary ready for future enforcement)",
    mayRevealSecrets: false,
  };
}

/** Extract role hints from headers without implementing login. */
export function rolesFromHeaders(headers: Record<string, string | string[] | undefined>): string[] {
  const raw = headers["x-kwizera-admin-role"] ?? headers["x-kwizera-roles"];
  if (!raw) return [];
  const value = Array.isArray(raw) ? raw.join(",") : String(raw);
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Extract Admin API token from Authorization Bearer or dedicated header. */
export function adminTokenFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
  const dedicated = headers["x-kwizera-admin-token"];
  if (dedicated) {
    const value = Array.isArray(dedicated) ? dedicated[0] : dedicated;
    if (value?.trim()) return value.trim();
  }
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth) return undefined;
  const value = Array.isArray(auth) ? auth[0] : auth;
  const match = /^Bearer\s+(.+)$/i.exec(String(value ?? "").trim());
  return match?.[1]?.trim() || undefined;
}

/** Mask a credential for UI display — never return the full secret. */
export function maskCredential(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4) return "••••";
  return `${trimmed.slice(0, 2)}••••••••${trimmed.slice(-2)}`;
}
