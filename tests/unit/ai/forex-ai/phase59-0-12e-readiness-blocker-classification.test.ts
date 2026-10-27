/**
 * Phase 59.0.12E — readiness blocker classification + grant coverage (no broker mutation).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyDemoReadinessBlocker,
  evaluateDemoGrantCoverage,
  groupDemoReadinessBlockers,
  primaryDemoReadinessBlocker,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/readiness-blockers.ts";

const root = process.cwd();

describe("Phase 59.0.12E blocker classification", () => {
  it("classifies owner-config vs grant vs session vs market vs SDK", () => {
    expect(classifyDemoReadinessBlocker("NODE_MUTATION_ENV_DISABLED")).toBe("OWNER_CONFIG");
    expect(classifyDemoReadinessBlocker("SIDECAR_MUTATION_SECRET_NOT_CONFIGURED")).toBe("OWNER_CONFIG");
    expect(classifyDemoReadinessBlocker("NO_ACTIVE_DEMO_GRANT")).toBe("GRANT_AUTHORIZATION");
    expect(classifyDemoReadinessBlocker("NO_GRANT_COVERING_INSTRUMENT")).toBe("GRANT_AUTHORIZATION");
    expect(classifyDemoReadinessBlocker("GRANT_LOTS_INSUFFICIENT")).toBe("GRANT_AUTHORIZATION");
    expect(classifyDemoReadinessBlocker("SESSION_NOT_CONNECTED")).toBe("SESSION");
    expect(classifyDemoReadinessBlocker("ENVIRONMENT_NOT_DEMO")).toBe("SESSION");
    expect(classifyDemoReadinessBlocker("QUOTE_STALE")).toBe("MARKET");
    expect(classifyDemoReadinessBlocker("SUBSCRIPTION_FAILED")).toBe("MARKET");
    expect(classifyDemoReadinessBlocker("SDK_MUTATION_SURFACE_UNVERIFIED")).toBe("SDK");
  });

  it("groups mixed blockers without collapsing to one category", () => {
    const grouped = groupDemoReadinessBlockers([
      "SIDECAR_MUTATION_ENV_DISABLED",
      "NODE_MUTATION_ENV_DISABLED",
      "MUTATION_SECRET_NOT_CONFIGURED",
      "NO_ACTIVE_DEMO_GRANT",
      "QUOTE_STALE",
    ]);
    expect(grouped.OWNER_CONFIG).toEqual([
      "SIDECAR_MUTATION_ENV_DISABLED",
      "NODE_MUTATION_ENV_DISABLED",
      "MUTATION_SECRET_NOT_CONFIGURED",
    ]);
    expect(grouped.GRANT_AUTHORIZATION).toEqual(["NO_ACTIVE_DEMO_GRANT"]);
    expect(grouped.MARKET).toEqual(["QUOTE_STALE"]);
    expect(grouped.SESSION).toEqual([]);
  });

  it("primary blocker prefers the first specific code over generic READINESS_BLOCKED", () => {
    expect(primaryDemoReadinessBlocker([])).toBe("READINESS_BLOCKED");
    expect(
      primaryDemoReadinessBlocker(["NODE_MUTATION_ENV_DISABLED", "NO_ACTIVE_DEMO_GRANT"]),
    ).toBe("NODE_MUTATION_ENV_DISABLED");
  });
});

describe("Phase 59.0.12E grant coverage for planned instrument/lots", () => {
  const future = new Date(Date.now() + 15 * 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();

  it("fails closed with NO_ACTIVE_DEMO_GRANT when empty", () => {
    const r = evaluateDemoGrantCoverage({ instrument: "XAU/USD", lots: 1, grants: [] });
    expect(r.ok).toBe(false);
    expect(r.blockers).toContain("NO_ACTIVE_DEMO_GRANT");
  });

  it("rejects expired grants", () => {
    const r = evaluateDemoGrantCoverage({
      instrument: "XAU/USD",
      lots: 1,
      grants: [{
        instrumentAllowlist: ["XAU/USD"],
        maxLots: 1,
        expiresAtUtc: past,
        environment: "DEMO",
      }],
    });
    expect(r.ok).toBe(false);
    expect(r.blockers).toContain("NO_ACTIVE_DEMO_GRANT");
  });

  it("rejects active grant that does not allowlist XAU/USD", () => {
    const r = evaluateDemoGrantCoverage({
      instrument: "XAU/USD",
      lots: 1,
      grants: [{
        instrumentAllowlist: ["EUR/USD"],
        maxLots: 1,
        expiresAtUtc: future,
        environment: "DEMO",
      }],
    });
    expect(r.ok).toBe(false);
    expect(r.blockers).toContain("NO_GRANT_COVERING_INSTRUMENT");
    expect(r.coveringGrantCount).toBe(0);
  });

  it("rejects covering grant when maxLots is below requested lots", () => {
    const r = evaluateDemoGrantCoverage({
      instrument: "XAU/USD",
      lots: 2,
      grants: [{
        instrumentAllowlist: ["XAU/USD"],
        maxLots: 1,
        expiresAtUtc: future,
        environment: "DEMO",
      }],
    });
    expect(r.ok).toBe(false);
    expect(r.blockers).toContain("GRANT_LOTS_INSUFFICIENT");
  });

  it("accepts XAU/USD + 1 lot when grant allowlists and maxLots>=1", () => {
    const r = evaluateDemoGrantCoverage({
      instrument: "XAU/USD",
      lots: 1,
      grants: [{
        instrumentAllowlist: ["XAU/USD"],
        maxLots: 1,
        expiresAtUtc: future,
        environment: "DEMO",
      }],
    });
    expect(r.ok).toBe(true);
    expect(r.coveringGrantCount).toBe(1);
    expect(r.blockers).toEqual([]);
  });

  it("treats empty allowlist as unrestricted for the requested instrument", () => {
    const r = evaluateDemoGrantCoverage({
      instrument: "XAU/USD",
      lots: 1,
      grants: [{
        instrumentAllowlist: [],
        maxLots: 5,
        expiresAtUtc: future,
        environment: "DEMO",
      }],
    });
    expect(r.ok).toBe(true);
  });
});

describe("Phase 59.0.12E wiring invariants", () => {
  it("orchestrator exposes classified readiness and does not enable ordinary AT mutation", () => {
    const orch = readFileSync(
      join(root, "ai/forex-ai/automated-trading/demo-execution/orchestrator.ts"),
      "utf8",
    );
    expect(orch).toContain("blockerCategories");
    expect(orch).toContain("grantCoverage");
    expect(orch).toContain("nodeMutationSecretConfigured");
    expect(orch).toContain("sidecarMutationSecretConfigured");
    expect(orch).toContain("primaryDemoReadinessBlocker");
    expect(orch).toContain('phase: "59.0.12E"');
    // Must not flip global placesOrders
    expect(orch).toContain("placesOrdersGlobal: false");
  });

  it("DisabledBrokerMutationAdapter remains on ordinary AT path", () => {
    const service = readFileSync(
      join(root, "ai/forex-ai/automated-trading/service.ts"),
      "utf8",
    );
    expect(service).toContain("getDisabledBrokerMutationAdapter");
    const stub = readFileSync(
      join(root, "ai/forex-ai/automated-trading/broker-intent/mutation-stub.ts"),
      "utf8",
    );
    expect(stub).toContain("EXECUTION_FORBIDDEN");
  });

  it("grant UI no longer defaults to EUR/USD when AT instrument is XAU/USD-capable", () => {
    const ui = readFileSync(join(root, "desktop/forex/ForexAutomatedTradingPage.tsx"), "utf8");
    expect(ui).toContain('|| "XAU/USD"');
    expect(ui).not.toMatch(/shellInstrument \|\| "EUR\/USD"/);
  });
});
