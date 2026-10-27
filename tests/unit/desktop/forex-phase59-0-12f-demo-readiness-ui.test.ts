/**
 * Phase 59.0.12F — DEMO readiness UI must surface primary blocker + grant coverage
 * (API fields from 59.0.12E) without exposing secrets.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ui = readFileSync(join(root, "desktop/forex/ForexAutomatedTradingPage.tsx"), "utf8");

describe("Phase 59.0.12F DEMO readiness UI wiring", () => {
  it("maps and displays primaryBlocker, categories, secret presence, and grantCoverage", () => {
    expect(ui).toContain("primaryBlocker");
    expect(ui).toContain("blockerCategories");
    expect(ui).toContain("nodeMutationSecretConfigured");
    expect(ui).toContain("sidecarMutationSecretConfigured");
    expect(ui).toContain("grantCoverage");
    expect(ui).toContain("Primary blocker:");
    expect(ui).toContain("Mutation secrets configured:");
    expect(ui).toContain("Grant coverage:");
    expect(ui).toContain("presence only");
  });

  it("does not embed or log mutation secret values", () => {
    expect(ui).not.toMatch(/KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET\s*=/);
    expect(ui).toContain("never displayed");
  });

  it("keeps grant creation scoped and does not default to EUR/USD", () => {
    expect(ui).toContain('|| "XAU/USD"');
    expect(ui).not.toMatch(/shellInstrument \|\| "EUR\/USD"/);
  });
});
