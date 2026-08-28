import { describe, expect, it } from "vitest";
import { coreHttpHealth } from "../../../../dev/persistent/runtime-health.js";

describe("coreHttpHealth", () => {
  it("reports starting before persistent runtime exists", () => {
    const health = coreHttpHealth(null);
    expect(health.status).toBe("starting");
    expect(health.runtimeReady).toBe(false);
    expect(health.sessionRestored).toBe(false);
  });

  it("reports starting while boot is in progress", () => {
    const health = coreHttpHealth({
      ready: false,
      booting: true,
      restored: false,
      message: "Booting persistent AI runtime…",
    });
    expect(health.status).toBe("starting");
    expect(health.runtimeReady).toBe(false);
  });

  it("does not report healthy after a failed boot", () => {
    const health = coreHttpHealth({
      ready: false,
      booting: false,
      restored: false,
      message: "Runtime boot failed: Unknown memory category: learning-intelligence-runtime",
    });
    expect(health.status).toBe("unhealthy");
    expect(health.runtimeReady).toBe(false);
    expect(health.sessionRestored).toBe(false);
    expect(health.message).toContain("Unknown memory category");
  });

  it("reports healthy only when the runtime is actually ready", () => {
    const health = coreHttpHealth({
      ready: true,
      booting: false,
      restored: true,
      message: "Previous session restored — all engines reconnected",
    });
    expect(health.status).toBe("healthy");
    expect(health.runtimeReady).toBe(true);
    expect(health.sessionRestored).toBe(true);
  });
});
