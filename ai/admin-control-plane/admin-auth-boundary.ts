/**
 * Authorization boundary for Admin Control Plane.
 * Stage 1: development allow-all with structured hooks for future auth.
 * Does not implement customer login or password forms.
 */

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
}

export interface AdminAccessDecision {
  allowed: boolean;
  reason: string;
  /** When false, callers must not return secrets even if allowed */
  mayRevealSecrets: boolean;
}

export type AdminAuthMode = "development-open" | "require-admin-role" | "deny-all";

function resolveMode(): AdminAuthMode {
  const raw = (process.env.KWIZERA_ADMIN_AUTH_MODE ?? "development-open").trim().toLowerCase();
  if (raw === "require-admin-role" || raw === "deny-all" || raw === "development-open") return raw;
  return "development-open";
}

/**
 * Decide whether the caller may access Admin APIs.
 * Secrets are never revealed through this boundary in Stage 1 (mayRevealSecrets = false).
 */
export function assertAdminAccess(ctx: AdminAccessContext): AdminAccessDecision {
  const mode = resolveMode();

  if (mode === "deny-all") {
    return { allowed: false, reason: "Admin access denied by KWIZERA_ADMIN_AUTH_MODE=deny-all", mayRevealSecrets: false };
  }

  if (mode === "require-admin-role") {
    const roles = ctx.roles.map((r) => r.toLowerCase());
    const ok = roles.includes("admin") || roles.includes("super-administrator") || roles.includes("super_admin");
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

/** Mask a credential for UI display — never return the full secret. */
export function maskCredential(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4) return "••••";
  return `${trimmed.slice(0, 2)}••••••••${trimmed.slice(-2)}`;
}
