/**
 * Phase 59.0.12H — grant allowlist fail-closed + unprotected-fill policy alignment.
 * No broker mutation; no secret values; mutations remain disabled.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DemoExecutionGrantStore,
  GrantAllowlistError,
  normalizeInstrumentAllowlist,
  resetDemoExecutionGrantStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/demo-execution/grant-store.ts";
import { evaluateDemoGrantCoverage } from "../../../../ai/forex-ai/automated-trading/demo-execution/readiness-blockers.ts";
import { evaluateUnprotectedFillPolicy } from "../../../../ai/forex-ai/automated-trading/broker-intent/protective-geometry.ts";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 59.0.12H grant allowlist normalization", () => {
  it("rejects empty and whitespace-only entries", () => {
    expect(normalizeInstrumentAllowlist([])).toEqual([]);
    expect(normalizeInstrumentAllowlist(["", "  "])).toEqual([]);
    expect(normalizeInstrumentAllowlist(null)).toEqual([]);
    expect(normalizeInstrumentAllowlist(["XAU/USD", " xau/usd ", "EUR/USD"])).toEqual([
      "XAU/USD",
      "EUR/USD",
    ]);
  });
});

describe("Phase 59.0.12H DemoExecutionGrantStore fail-closed", () => {
  let dir: string;
  let store: DemoExecutionGrantStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kw-grant-12h-"));
    store = new DemoExecutionGrantStore(join(dir, "grants.json"));
  });

  afterEach(() => {
    resetDemoExecutionGrantStoreForTests();
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists grants to the configured path and reloads them", () => {
    const path = join(dir, "grants.json");
    const g = store.create({
      ttlMs: 120_000,
      maxLots: 1,
      instrumentAllowlist: ["XAU/USD"],
    });
    expect(existsSync(path)).toBe(true);
    const reloaded = new DemoExecutionGrantStore(path);
    expect(reloaded.get(g.grantId)?.instrumentAllowlist).toEqual(["XAU/USD"]);
    expect(reloaded.listActive()).toHaveLength(1);
  });

  it("create throws GrantAllowlistError when allowlist empty", () => {
    expect(() => store.create({ ttlMs: 60_000, instrumentAllowlist: [] })).toThrow(
      GrantAllowlistError,
    );
  });

  it("XAU/USD grant does not authorize EUR/USD; maxLots is integer-clamped", () => {
    const g = store.create({
      ttlMs: 120_000,
      maxLots: 1.9 as unknown as number,
      instrumentAllowlist: ["XAU/USD"],
    });
    expect(g.maxLots).toBe(1);
    expect(store.requireActive(g.grantId, "XAU/USD", 1).ok).toBe(true);
    expect(store.requireActive(g.grantId, "EUR/USD", 1)).toMatchObject({
      ok: false,
      code: "INSTRUMENT_NOT_ALLOWLISTED",
    });
    expect(store.requireActive(g.grantId, "XAU/USD", 2)).toMatchObject({
      ok: false,
      code: "LOTS_EXCEED_GRANT",
    });
  });

  it("expired and revoked grants are never active", () => {
    const g = store.create({
      ttlMs: 60_000,
      maxLots: 1,
      instrumentAllowlist: ["XAU/USD"],
    });
    store.revoke(g.grantId);
    expect(store.requireActive(g.grantId, "XAU/USD", 1)).toMatchObject({
      ok: false,
      code: "GRANT_EXPIRED_OR_REVOKED",
    });
    expect(store.listActive()).toHaveLength(0);
  });

  it("symbol normalization accepts spacing/case without broadening", () => {
    const g = store.create({
      ttlMs: 120_000,
      maxLots: 1,
      instrumentAllowlist: ["XAU/USD"],
    });
    expect(store.requireActive(g.grantId, "xau / usd", 1).ok).toBe(true);
    // Slash is significant — stripping only whitespace must not equate XAUUSD to XAU/USD.
    expect(store.requireActive(g.grantId, "XAUUSD", 1).ok).toBe(false);
    expect(store.requireActive(g.grantId, "GBP/USD", 1).ok).toBe(false);
  });
});

describe("Phase 59.0.12H grant coverage + unprotected policy wiring", () => {
  it("coverage rejects empty allowlist and unrelated instruments", () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    expect(
      evaluateDemoGrantCoverage({
        instrument: "XAU/USD",
        lots: 1,
        grants: [{
          instrumentAllowlist: [],
          maxLots: 5,
          expiresAtUtc: future,
          environment: "DEMO",
        }],
      }).ok,
    ).toBe(false);
    expect(
      evaluateDemoGrantCoverage({
        instrument: "EUR/USD",
        lots: 1,
        grants: [{
          instrumentAllowlist: ["XAU/USD"],
          maxLots: 1,
          expiresAtUtc: future,
          environment: "DEMO",
        }],
      }).blockers,
    ).toContain("NO_GRANT_COVERING_INSTRUMENT");
  });

  it("unprotected-fill policy forbids autonomous close", () => {
    const p = evaluateUnprotectedFillPolicy();
    expect(p.autonomousCloseAuthorized).toBe(false);
    expect(p.blockAdditionalEntries).toBe(true);
    expect(p.raiseCriticalAlert).toBe(true);
    expect(p.mutatesBroker).toBe(false);
    expect(p.code).toBe("PROTECTION_UNVERIFIED");
  });

  it("orchestrator gates close on policy.autonomousCloseAuthorized", () => {
    const orch = read("ai/forex-ai/automated-trading/demo-execution/orchestrator.ts");
    expect(orch).toContain("evaluateUnprotectedFillPolicy");
    expect(orch).toContain("policyAllowsAutonomousClose");
    expect(orch).toContain("closeIfUnprotected === true");
    expect(orch).not.toMatch(/closeIfUnprotected\s*!==\s*false/);
  });

  it("prepare-plan and API default closeIfUnprotected to false", () => {
    const plan = read("ai/forex-ai/automated-trading/order-execution/prepare-plan.ts");
    expect(plan).toContain("closeIfUnprotected: false");
    expect(plan).not.toContain("closeIfUnprotected: true");
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("closeIfUnprotected: body.closeIfUnprotected === true");
    expect(api).not.toContain("closeIfUnprotected: body.closeIfUnprotected !== false");
  });

  it("API grant create rejects empty allowlist without enabling placesOrders", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("GRANT_CREATE_FAILED");
    expect(api).toContain("placesOrders: false");
  });

  it("secret diagnostics stay boolean-only; mutation secret redacted from FC payloads", () => {
    const orch = read("ai/forex-ai/automated-trading/demo-execution/orchestrator.ts");
    expect(orch).toContain("nodeMutationSecretConfigured");
    expect(orch).toContain("sidecarMutationSecretConfigured");
    expect(orch).not.toMatch(/DEMO_MUTATION_SECRET\s*[:=]\s*process\.env/);
    const client = read("ai/market-data/forexconnect/client.ts");
    expect(client).toContain("KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET");
    const sidecar = read("services/forexconnect-sidecar/mutation_demo.py");
    expect(sidecar).toContain('"mutationSecretConfigured": bool(');
    expect(sidecar).toContain("hmac.compare_digest");
  });
});
