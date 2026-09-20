/**
 * Authorization layers for future customer/admin/system auth.
 * Stage B does not add login — it defines the plug-in boundary.
 */
import { assertAdminAccess, type AdminAccessContext, type AdminAccessDecision } from "./admin-auth-boundary.js";

export type AccessLayer = "PUBLIC" | "CUSTOMER" | "ADMIN" | "SYSTEM";

export interface LayeredAccessContext extends AdminAccessContext {
  layer?: AccessLayer;
  customerId?: string;
  /** Future service-to-service token presence */
  internalService?: boolean;
}

const LAYER_RANK: Record<AccessLayer, number> = {
  PUBLIC: 0,
  CUSTOMER: 1,
  ADMIN: 2,
  SYSTEM: 3,
};

export function resolveAccessLayer(ctx: LayeredAccessContext): AccessLayer {
  if (ctx.internalService || ctx.layer === "SYSTEM") return "SYSTEM";
  if (ctx.adminApi || ctx.layer === "ADMIN") return "ADMIN";
  if (ctx.customerId || ctx.layer === "CUSTOMER") return "CUSTOMER";
  return "PUBLIC";
}

export function assertLayerAccess(required: AccessLayer, ctx: LayeredAccessContext): AdminAccessDecision {
  if (required === "ADMIN" || required === "SYSTEM") {
    if (required === "SYSTEM" && (ctx.internalService || ctx.layer === "SYSTEM")) {
      return { allowed: true, reason: "Internal system access", mayRevealSecrets: false };
    }
    return assertAdminAccess(ctx);
  }
  const actual = resolveAccessLayer(ctx);
  const ok = LAYER_RANK[actual] >= LAYER_RANK[required];
  return {
    allowed: ok,
    reason: ok ? `${actual} satisfies ${required}` : `${required} access required`,
    mayRevealSecrets: false,
  };
}

/**
 * Customer A cannot read Customer B records. Admin/System may access global control-plane data.
 * Unscoped records (no customerId) are treated as studio-local, not another tenant.
 */
export function assertTenantIsolation(
  resource: { customerId?: string; projectId?: string },
  actor: { customerId?: string; layer: AccessLayer },
): { allowed: boolean; reason: string } {
  if (actor.layer === "ADMIN" || actor.layer === "SYSTEM") {
    return { allowed: true, reason: "Control-plane access" };
  }
  if (!resource.customerId) {
    return { allowed: actor.layer !== "CUSTOMER", reason: "Unscoped studio record" };
  }
  if (actor.layer !== "CUSTOMER" || !actor.customerId) {
    return { allowed: false, reason: "Customer scope required" };
  }
  if (actor.customerId !== resource.customerId) {
    return { allowed: false, reason: "Tenant isolation: customer mismatch" };
  }
  return { allowed: true, reason: "Same customer" };
}
