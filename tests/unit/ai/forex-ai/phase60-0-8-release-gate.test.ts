/**
 * Phase 60.0.8 — cloud CI / release gate for Trade Monitor.
 * Static + safety assertions only. Never places broker orders.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("Phase 60.0.8 Trade Monitor release gate", () => {
  it("cloud CI validate job includes Phase 60 Trade Monitor and safety tests", () => {
    const yml = read(".github/workflows/production-deploy.yml");
    expect(yml).toContain("tests/unit/ai/forex-ai/phase60-0-3-trade-history.test.ts");
    expect(yml).toContain("tests/unit/ai/forex-ai/phase60-0-4-trade-performance.test.ts");
    expect(yml).toContain("tests/unit/ai/forex-ai/phase60-0-5-trade-monitor-integration.test.ts");
    expect(yml).toContain("tests/unit/ai/forex-ai/phase60-0-6-runtime-readiness.test.ts");
    expect(yml).toContain("tests/unit/ai/forex-ai/phase60-0-8-release-gate.test.ts");
    expect(yml).toContain("tests/unit/desktop/forex-phase60-trade-monitor.test.ts");
    expect(yml).toContain("tests/unit/ai/forex-ai/phase55-preflight-safety.test.ts");
    expect(yml).toContain("npm run build:production");
    expect(yml).not.toContain("162.35.114.19");
  });

  it("post-deploy live HTTP verify covers Trade Monitor routes", () => {
    const verify = read("deploy/verify-live-http.mjs");
    expect(verify).toContain("/forex/trade-monitor");
    expect(verify).toContain("/forex/positions");
    expect(verify).toContain("/api/health");
    expect(verify).toContain("/api/deployment");
  });

  it("Trade Monitor API routes remain admin-gated and read-only labeled", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("requireForexAdmin");
    expect(api).toContain("/api/forex/automated-trading/broker-ro-tables");
    expect(api).toContain("/api/forex/automated-trading/trade-history");
    expect(api).toContain("/api/forex/automated-trading/trade-performance");
    expect(api).toMatch(/placesOrders:\s*false/);
    expect(api).toMatch(/acceptsForExecution:\s*false/);
    expect(api).toContain("Session CONNECTED ≠ quote received");
  });

  it("ordinary Automated Trading path keeps DisabledBrokerMutationAdapter", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("DisabledBrokerMutationAdapter");
    expect(service).toMatch(/placesOrders:\s*false/);
    expect(service).toMatch(/acceptsForExecution:\s*false/);
  });

  it("desktop routes expose Trade Monitor and positions alias", () => {
    const routes = read("desktop/forex/forex-routes.ts");
    expect(routes).toContain('path: "/forex/trade-monitor"');
    expect(routes).toContain('"/forex/positions": "trade-monitor"');
    expect(fs.existsSync(path.join(root, "desktop/forex/ForexTradeMonitorPage.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "ai/forex-ai/automated-trading/trade-history/index.ts"))).toBe(
      true,
    );
  });
});
