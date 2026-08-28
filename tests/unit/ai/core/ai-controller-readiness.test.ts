import { describe, expect, it } from "vitest";
import { AiController, type AiControllerDeps } from "../../../../ai/core/ai-controller.js";
import { AiLifecycleState } from "../../../../ai/core/types.js";

function controllerWithSlots(slotIds: string[]): AiController {
  const entries = new Map(slotIds.map((id) => [id, { id, name: id, status: "initialized" as const }]));
  const deps = {
    lifecycle: { getState: () => AiLifecycleState.Ready },
    startup: { getDiagnostics: () => [] },
    shutdown: {},
    configuration: {
      isLoaded: () => true,
      getConfiguration: () => ({
        futureModules: {
          futureModules: slotIds.map((id) => ({ id, name: id, enabled: false })),
        },
      }),
    },
    runtime: { isInitialized: () => true, isWorkflowReady: () => true },
    registry: {
      getSlotCount: () => entries.size,
      getRegisteredCount: () => entries.size,
      getEntry: (id: string) => entries.get(id),
      getAllEntries: () => [...entries.values()],
    },
    logger: { isInitialized: () => true, getLogDirectory: () => "/tmp/logs" },
    health: {
      runChecks: () => ({
        healthy: true,
        checks: [{ name: "initialization", passed: true, message: "ok" }],
      }),
    },
    coordinator: {},
    sessions: {},
  } as unknown as AiControllerDeps;
  return new AiController(deps);
}

describe("AiController readiness score", () => {
  it("does not fail when configured module slots exceed the original Step 2A count of 10", () => {
    const ids = Array.from({ length: 43 }, (_, index) => `module-${index + 1}`);
    const report = controllerWithSlots(ids).buildStatusReport();
    expect(report.registryStatus).toContain("43 slots reserved");
    expect(report.readinessScore).toBe(100);
  });

  it("fails readiness when a configured future module slot is missing", () => {
    const deps = {
      lifecycle: { getState: () => AiLifecycleState.Ready },
      startup: { getDiagnostics: () => [] },
      shutdown: {},
      configuration: {
        isLoaded: () => true,
        getConfiguration: () => ({
          futureModules: { futureModules: [{ id: "missing-slot", name: "Missing", enabled: false }] },
        }),
      },
      runtime: { isInitialized: () => true, isWorkflowReady: () => true },
      registry: {
        getSlotCount: () => 10,
        getRegisteredCount: () => 8,
        getEntry: () => undefined,
        getAllEntries: () => [],
      },
      logger: { isInitialized: () => true, getLogDirectory: () => "/tmp/logs" },
      health: {
        runChecks: () => ({
          healthy: true,
          checks: [{ name: "initialization", passed: true, message: "ok" }],
        }),
      },
      coordinator: {},
      sessions: {},
    } as unknown as AiControllerDeps;

    expect(new AiController(deps).buildStatusReport().readinessScore).toBe(83);
  });
});
