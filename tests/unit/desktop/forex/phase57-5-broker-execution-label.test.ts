/**
 * Phase 57.5 — Broker execution badge label must not duplicate "EXECUTION".
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatBrokerExecutionBadgeLabel } from "../../../../desktop/forex/broker-execution-label.js";

const root = process.cwd();

describe("Phase 57.5 formatBrokerExecutionBadgeLabel", () => {
  it("does not produce BROKER EXECUTION EXECUTION_FORBIDDEN", () => {
    const label = formatBrokerExecutionBadgeLabel("EXECUTION_FORBIDDEN");
    expect(label).toBe("Broker execution: Forbidden");
    expect(label).not.toContain("EXECUTION EXECUTION");
    expect(label).not.toMatch(/BROKER EXECUTION EXECUTION_/i);
  });

  it("maps DISABLED/UNAUTHORIZED/BLOCKED to Forbidden without duplicating EXECUTION", () => {
    for (const code of ["DISABLED", "UNAUTHORIZED", "BLOCKED", null, undefined]) {
      const label = formatBrokerExecutionBadgeLabel(code as string | null | undefined);
      expect(label).toBe("Broker execution: Forbidden");
      expect(label.split("EXECUTION").length - 1).toBeLessThanOrEqual(0);
    }
  });

  it("passes through unknown codes once after the prefix", () => {
    expect(formatBrokerExecutionBadgeLabel("PAUSED")).toBe("Broker execution: PAUSED");
  });
});

describe("Phase 57.5 UI wiring", () => {
  it("Automated Trading page uses formatter and does not concatenate BROKER EXECUTION with enum", () => {
    const ui = readFileSync(
      join(root, "desktop/forex/ForexAutomatedTradingPage.tsx"),
      "utf8",
    );
    expect(ui).toContain("formatBrokerExecutionBadgeLabel");
    expect(ui).toContain("data-fx-at-execution-code");
    expect(ui).not.toMatch(/`BROKER EXECUTION \$\{/);
    expect(ui).not.toContain("BROKER EXECUTION ${automation");
  });
});
