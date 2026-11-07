/**
 * Stage 7.2 — distinct system-owner authorization boundary tests.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  assertOwnerAccess,
  getOwnerAuthPublicStatus,
  isOwnerIdentityConfigured,
  ownerTokenFromHeaders,
} from "../../../../ai/admin-control-plane/owner-auth-boundary.js";

const PREV_OWNER = process.env.KWIZERA_OWNER_API_TOKEN;
const PREV_ADMIN = process.env.KWIZERA_ADMIN_API_TOKEN;
const PREV_PRINCIPAL = process.env.KWIZERA_OWNER_PRINCIPAL_ID;

afterEach(() => {
  if (PREV_OWNER === undefined) delete process.env.KWIZERA_OWNER_API_TOKEN;
  else process.env.KWIZERA_OWNER_API_TOKEN = PREV_OWNER;
  if (PREV_ADMIN === undefined) delete process.env.KWIZERA_ADMIN_API_TOKEN;
  else process.env.KWIZERA_ADMIN_API_TOKEN = PREV_ADMIN;
  if (PREV_PRINCIPAL === undefined) delete process.env.KWIZERA_OWNER_PRINCIPAL_ID;
  else process.env.KWIZERA_OWNER_PRINCIPAL_ID = PREV_PRINCIPAL;
});

describe("Stage 7.2 — owner auth boundary", () => {
  it("fails closed when owner token not configured", () => {
    delete process.env.KWIZERA_OWNER_API_TOKEN;
    process.env.KWIZERA_ADMIN_API_TOKEN = "admin-secret-token-aaaa";
    expect(isOwnerIdentityConfigured()).toBe(false);
    const d = assertOwnerAccess({
      ownerToken: "anything",
      path: "/api/test",
      clientClaimedOwnerRole: "owner",
    });
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("OWNER_TOKEN_NOT_CONFIGURED");
  });

  it("rejects owner token equal to admin token (no silent promotion)", () => {
    process.env.KWIZERA_ADMIN_API_TOKEN = "same-secret-value-zzzz";
    process.env.KWIZERA_OWNER_API_TOKEN = "same-secret-value-zzzz";
    expect(isOwnerIdentityConfigured()).toBe(false);
    const d = assertOwnerAccess({
      ownerToken: "same-secret-value-zzzz",
      path: "/api/test",
    });
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("OWNER_TOKEN_NOT_DISTINCT");
  });

  it("rejects missing / invalid owner token when configured", () => {
    process.env.KWIZERA_ADMIN_API_TOKEN = "admin-secret-token-bbbb";
    process.env.KWIZERA_OWNER_API_TOKEN = "owner-secret-token-cccc";
    process.env.KWIZERA_OWNER_PRINCIPAL_ID = "owner-alice";
    expect(isOwnerIdentityConfigured()).toBe(true);
    expect(assertOwnerAccess({ path: "/api/test" }).code).toBe("OWNER_TOKEN_MISSING");
    expect(assertOwnerAccess({
      ownerToken: "wrong",
      path: "/api/test",
    }).code).toBe("OWNER_TOKEN_INVALID");
  });

  it("ignores forged client owner role/id headers", () => {
    process.env.KWIZERA_ADMIN_API_TOKEN = "admin-secret-token-dddd";
    process.env.KWIZERA_OWNER_API_TOKEN = "owner-secret-token-eeee";
    const d = assertOwnerAccess({
      path: "/api/test",
      clientClaimedOwnerRole: "owner",
      clientClaimedOwnerId: "forged-owner",
      ownerToken: undefined,
    });
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("OWNER_TOKEN_MISSING");
  });

  it("accepts valid distinct owner token and never reveals secrets", () => {
    process.env.KWIZERA_ADMIN_API_TOKEN = "admin-secret-token-ffff";
    process.env.KWIZERA_OWNER_API_TOKEN = "owner-secret-token-gggg";
    process.env.KWIZERA_OWNER_PRINCIPAL_ID = "owner-bob";
    const d = assertOwnerAccess({
      ownerToken: "owner-secret-token-gggg",
      path: "/api/risk-policy",
      correlationId: "corr-1",
      clientClaimedOwnerRole: "admin",
    });
    expect(d.allowed).toBe(true);
    expect(d.code).toBe("OWNER_TOKEN_OK");
    expect(d.actorId).toBe("owner-bob");
    expect(d.mayRevealSecrets).toBe(false);
    expect(JSON.stringify(d)).not.toContain("owner-secret-token-gggg");
    const pub = getOwnerAuthPublicStatus();
    expect(pub.ownerConfigured).toBe(true);
    expect(JSON.stringify(pub)).not.toContain("owner-secret-token-gggg");
  });

  it("reads owner token only from dedicated header", () => {
    expect(ownerTokenFromHeaders({
      authorization: "Bearer admin-or-anything",
      "x-kwizera-owner-role": "owner",
    })).toBeUndefined();
    expect(ownerTokenFromHeaders({
      "x-kwizera-owner-token": "  owner-only  ",
    })).toBe("owner-only");
  });
});
