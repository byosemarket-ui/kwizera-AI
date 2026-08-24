import { describe, expect, it, beforeEach, vi } from "vitest";
import { WorkspaceCertificationEngine } from "../../../desktop/shell/certification/certification-engine.ts";
import { buildSnapshot, decideReadiness, scoreCategories } from "../../../desktop/shell/certification/scoring.ts";
import { buildCertificationMarkdown } from "../../../desktop/shell/certification/report-builder.ts";
import { buildAiMeCertificationContext } from "../../../desktop/shell/certification/aime-certification-awareness.ts";
import type { CertificationCheck } from "../../../desktop/shell/certification/types.ts";
import { workspaceIntegrationEngine } from "../../../desktop/shell/integration/integration-engine.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  });
  vi.stubGlobal("window", {
    ...globalThis,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
}

function check(partial: Partial<CertificationCheck> & Pick<CertificationCheck, "id" | "category" | "label">): CertificationCheck {
  return {
    status: "pass",
    detail: "ok",
    critical: false,
    score: 100,
    ...partial,
  };
}

describe("Scoring & readiness", () => {
  it("certifies when overall high and no critical fails", () => {
    const checks = [
      check({ id: "a", category: "architecture", label: "A", critical: true }),
      check({ id: "s", category: "stability", label: "S", critical: true }),
      check({ id: "d", category: "data-safety", label: "D", critical: true }),
    ];
    const categories = scoreCategories(checks);
    expect(categories[0]?.score).toBe(100);
    const decision = decideReadiness(checks, 92);
    expect(decision.certified).toBe(true);
    expect(decision.readiness).toBe("foundation-ready");
  });

  it("blocks certification on critical failure", () => {
    const checks = [
      check({ id: "a", category: "architecture", label: "Broken arch", critical: true, status: "fail", score: 0, detail: "missing" }),
    ];
    const decision = decideReadiness(checks, 95);
    expect(decision.certified).toBe(false);
    expect(decision.readiness).toBe("requires-manual-review");
    expect(decision.blockers[0]).toContain("Broken arch");
  });
});

describe("Certification engine", () => {
  beforeEach(() => {
    mockStorage();
    workspaceIntegrationEngine.stop();
  });

  it("runs full suite and produces markdown report", () => {
    workspaceIntegrationEngine.start();
    const engine = new WorkspaceCertificationEngine();
    const snap = engine.run();
    expect(snap.version).toBe("1.0");
    expect(snap.checks.length).toBeGreaterThan(20);
    expect(snap.overallScore).toBeGreaterThanOrEqual(70);
    expect(snap.aime.canExplainWorkspace).toBe(true);
    expect(snap.aime.canGuideUser).toBe(true);
    const md = buildCertificationMarkdown(snap);
    expect(md).toContain("WORKSPACE FOUNDATION CERTIFICATION REPORT");
    expect(md).toContain("Overall Workspace Score");
    const ctx = buildAiMeCertificationContext(snap);
    expect(ctx.explanation).toContain("Foundation");
    engine.run(); // idempotent
    expect(engine.getSnapshot()?.certifiedAt).toBe(snap.certifiedAt);
  });

  it("buildSnapshot includes pillar scores", () => {
    const snap = buildSnapshot({
      checks: [
        check({ id: "1", category: "architecture", label: "Arch" }),
        check({ id: "2", category: "navigation", label: "Nav" }),
        check({ id: "3", category: "stability", label: "Stab" }),
        check({ id: "4", category: "ux", label: "UX" }),
        check({ id: "5", category: "performance", label: "Perf" }),
      ],
      issuesFound: [],
      issuesRepaired: [],
      remainingLimitations: ["phase2"],
      aime: {
        canExplainWorkspace: true,
        canExplainNavigation: true,
        canExplainLayouts: true,
        canExplainWidgets: true,
        canGuideUser: true,
        canMonitorHealth: true,
      },
    });
    expect(snap.scores.architecture).toBe(100);
    expect(snap.remainingLimitations).toContain("phase2");
  });
});
