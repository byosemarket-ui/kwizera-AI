/**
 * Phase 58.5 — blocker resolution unit tests (no broker mutation).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertAdminAccess } from "../../../../ai/admin-control-plane/admin-auth-boundary.ts";
import { nodeDemoMutationEnvEnabled } from "../../../../ai/forex-ai/automated-trading/demo-execution/forexconnect-mutation-adapter.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 58.5 admin auth codes", () => {
  const prevMode = process.env.KWIZERA_ADMIN_AUTH_MODE;
  const prevToken = process.env.KWIZERA_ADMIN_API_TOKEN;
  const prevEnv = process.env.KWIZERA_ENV;
  const prevNode = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.KWIZERA_ADMIN_AUTH_MODE = "require-admin-token";
    process.env.KWIZERA_ENV = "production";
    process.env.NODE_ENV = "production";
    process.env.KWIZERA_ADMIN_API_TOKEN = "unit-test-admin-token-58-5";
  });

  afterEach(() => {
    if (prevMode == null) delete process.env.KWIZERA_ADMIN_AUTH_MODE;
    else process.env.KWIZERA_ADMIN_AUTH_MODE = prevMode;
    if (prevToken == null) delete process.env.KWIZERA_ADMIN_API_TOKEN;
    else process.env.KWIZERA_ADMIN_API_TOKEN = prevToken;
    if (prevEnv == null) delete process.env.KWIZERA_ENV;
    else process.env.KWIZERA_ENV = prevEnv;
    if (prevNode == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  });

  it("distinguishes missing vs invalid admin token without revealing secrets", () => {
    const missing = assertAdminAccess({
      roles: [],
      adminToken: undefined,
      path: "/api/forex/automated-trading/demo-lifecycle/readiness",
      adminApi: true,
    });
    expect(missing.allowed).toBe(false);
    expect(missing.code).toBe("ADMIN_TOKEN_MISSING");
    expect(missing.mayRevealSecrets).toBe(false);

    const invalid = assertAdminAccess({
      roles: [],
      adminToken: "wrong-token",
      path: "/api/forex/automated-trading/demo-lifecycle/readiness",
      adminApi: true,
    });
    expect(invalid.allowed).toBe(false);
    expect(invalid.code).toBe("ADMIN_TOKEN_INVALID");
    expect(JSON.stringify(invalid)).not.toContain("unit-test-admin-token-58-5");

    const ok = assertAdminAccess({
      roles: [],
      adminToken: "unit-test-admin-token-58-5",
      path: "/api/forex/automated-trading/demo-lifecycle/readiness",
      adminApi: true,
    });
    expect(ok.allowed).toBe(true);
    expect(ok.code).toBe("ADMIN_TOKEN_OK");
  });
});

describe("Phase 58.5 Node mutation fail-closed", () => {
  const prev = process.env.KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION;

  afterEach(() => {
    if (prev == null) delete process.env.KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION;
    else process.env.KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION = prev;
  });

  it("defaults to disabled", () => {
    delete process.env.KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION;
    expect(nodeDemoMutationEnvEnabled()).toBe(false);
  });

  it("enables only for explicit truthy values", () => {
    process.env.KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION = "1";
    expect(nodeDemoMutationEnvEnabled()).toBe(true);
    process.env.KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION = "0";
    expect(nodeDemoMutationEnvEnabled()).toBe(false);
  });
});

describe("Phase 58.5 wiring", () => {
  it("readiness exposes owner checklist and node/sidecar mutation split", () => {
    const orch = read("ai/forex-ai/automated-trading/demo-execution/orchestrator.ts");
    expect(orch).toContain("ownerActionChecklist");
    expect(orch).toContain("NODE_MUTATION_ENV_DISABLED");
    expect(orch).toContain("sidecarMutationEnvEnabled");
    expect(orch).toContain("probeQuote");
    expect(orch).toContain('phase: "58.5"');
  });

  it("API exposes quote-probe and admin auth codes surface", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("demo-lifecycle/quote-probe");
    const auth = read("dev/server/forex-admin-auth.ts");
    expect(auth).toContain("decision.code");
    const adapter = read("ai/forex-ai/automated-trading/demo-execution/forexconnect-mutation-adapter.ts");
    expect(adapter).toContain("NODE_DEMO_MUTATION_DISABLED");
    expect(adapter).toContain("requireNodeMutationGate");
  });

  it("ordinary AT remains disabled", () => {
    const stub = read("ai/forex-ai/automated-trading/broker-intent/mutation-stub.ts");
    expect(stub).toContain("EXECUTION_FORBIDDEN");
  });
});
