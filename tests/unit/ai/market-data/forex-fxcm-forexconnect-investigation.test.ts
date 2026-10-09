/**
 * ForexConnect investigation — assert we do not ship an unsafe native FC integration.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createFxcmMarketDataProvider } from "../../../../ai/market-data/fxcm/provider.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("FXCM ForexConnect investigation — no unsafe Node integration", () => {
  it("documents the investigation and decision", () => {
    const doc = read("docs/forex-fxcm-forexconnect-investigation.md");
    expect(doc).toContain("Do not integrate ForexConnect");
    expect(doc).toContain("www.fxcorporate.com/Hosts.jsp");
    expect(doc).toContain("EULA");
    expect(doc).toContain("Socket REST");
    expect(doc).toContain("api@fxcm.com");
    expect(doc).toContain("no official Node.js SDK");
  });

  it("package.json does not depend on forexconnect native packages", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
    expect(deps.forexconnect).toBeUndefined();
    expect(Object.keys(deps).some((k) => /forex.?connect/i.test(k))).toBe(false);
  });

  it("FXCM provider health notes state ForexConnect is not integrated", async () => {
    const provider = createFxcmMarketDataProvider({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    const health = await provider.healthCheck();
    expect(health.errorCode).toBe("FXCM_DISABLED");
    expect(health.notes?.some((n) => /ForexConnect SDK is NOT integrated/i.test(n))).toBe(true);
    expect(health.notes?.some((n) => /Node\.js gateway/i.test(n))).toBe(true);
    expect(health.tradingEnabled).toBe(false);
  });

  it("existing Socket REST path remains the configured apiPath", () => {
    const provider = createFxcmMarketDataProvider({
      env: { KWIZERA_FXCM_ENABLED: "0" },
    });
    expect(provider.getProviderInfo().apiPath).toContain("Socket REST");
    expect(provider.getProviderInfo().apiPath).not.toMatch(/ForexConnect/i);
  });
});
