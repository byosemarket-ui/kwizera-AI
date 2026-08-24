import type {
  CategoryScore, CertificationCheck, CertificationSnapshot, ReadinessVerdict,
} from "./types";
import { FOUNDATION_VERSION } from "./types";

const CATEGORY_LABELS: Record<CertificationCheck["category"], string> = {
  architecture: "Workspace Architecture",
  navigation: "Navigation",
  dashboard: "Dashboard UI",
  layout: "Layout Manager",
  state: "Workspace State",
  performance: "Performance",
  accessibility: "Accessibility",
  integration: "Integration",
  stability: "Stability",
  responsive: "Responsive",
  ux: "User Experience",
  "data-safety": "Data Safety",
  "ai-me": "AI Me",
};

const PILLAR_WEIGHTS: Partial<Record<CertificationCheck["category"], number>> = {
  architecture: 1,
  navigation: 1,
  dashboard: 1,
  layout: 1,
  state: 1.15,
  performance: 1,
  accessibility: 1,
  integration: 1.1,
  stability: 1.25,
  responsive: 0.85,
  ux: 1.1,
  "data-safety": 1.3,
  "ai-me": 1.15,
};

function avg(scores: number[]): number {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function scoreCategories(checks: CertificationCheck[]): CategoryScore[] {
  const ids = Object.keys(CATEGORY_LABELS) as CertificationCheck["category"][];
  return ids.map((id) => {
    const subset = checks.filter((c) => c.category === id);
    const score = avg(subset.map((c) => c.score));
    const failed = subset.filter((c) => c.status === "fail").length;
    const warned = subset.filter((c) => c.status === "warn").length;
    const repaired = subset.filter((c) => c.status === "repaired").length;
    const passed = subset.filter((c) => c.status === "pass").length;
    const status: CertificationCheck["status"] = failed
      ? "fail"
      : repaired
        ? "repaired"
        : warned
          ? "warn"
          : "pass";
    return {
      id,
      label: CATEGORY_LABELS[id],
      score,
      passed,
      failed,
      warned,
      repaired,
      status,
    };
  }).filter((c) => checks.some((x) => x.category === c.id));
}

export function decideReadiness(
  checks: CertificationCheck[],
  overall: number,
): { readiness: ReadinessVerdict; explanation: string; certified: boolean; blockers: string[] } {
  const blockers = checks
    .filter((c) => c.critical && c.status === "fail")
    .map((c) => `${c.label}: ${c.detail}`);

  if (blockers.length) {
    return {
      readiness: "requires-manual-review",
      certified: false,
      blockers,
      explanation: `Critical failures block Foundation ${FOUNDATION_VERSION} certification. Manual review required before Phase 2.`,
    };
  }

  if (overall < 80) {
    return {
      readiness: "needs-improvement",
      certified: false,
      blockers: [`Overall score ${overall}/100 is below the 80 threshold for Foundation Ready.`],
      explanation: `Score ${overall}/100 — improve weak pillars before certifying Version ${FOUNDATION_VERSION}.`,
    };
  }

  if (overall < 88) {
    return {
      readiness: "needs-improvement",
      certified: false,
      blockers: [],
      explanation: `Score ${overall}/100 shows a solid foundation but needs polish to reach professional certification (≥88).`,
    };
  }

  return {
    readiness: "foundation-ready",
    certified: true,
    blockers: [],
    explanation: `Overall ${overall}/100 with no critical failures. Workspace Foundation ${FOUNDATION_VERSION} is certified for professional product creation (single-user, local, offline-first).`,
  };
}

export function buildSnapshot(input: {
  checks: CertificationCheck[];
  issuesFound: string[];
  issuesRepaired: string[];
  remainingLimitations: string[];
  aime: CertificationSnapshot["aime"];
}): CertificationSnapshot {
  const categories = scoreCategories(input.checks);
  const weighted = categories.map((c) => ({
    score: c.score,
    weight: PILLAR_WEIGHTS[c.id] ?? 1,
  }));
  const weightSum = weighted.reduce((s, w) => s + w.weight, 0);
  const overallScore = Math.round(weighted.reduce((s, w) => s + w.score * w.weight, 0) / weightSum);

  const stabilityScore = categories.find((c) => c.id === "stability")?.score
    ?? avg(input.checks.filter((c) => c.category === "stability").map((c) => c.score));
  const performanceScore = categories.find((c) => c.id === "performance")?.score ?? 0;
  const uxScore = avg([
    categories.find((c) => c.id === "ux")?.score ?? 0,
    categories.find((c) => c.id === "accessibility")?.score ?? 0,
    categories.find((c) => c.id === "responsive")?.score ?? 0,
  ].filter((n) => n > 0));

  const { readiness, explanation, certified, blockers } = decideReadiness(input.checks, overallScore);

  const scores = {
    architecture: categories.find((c) => c.id === "architecture")?.score ?? 0,
    navigation: categories.find((c) => c.id === "navigation")?.score ?? 0,
    dashboard: categories.find((c) => c.id === "dashboard")?.score ?? 0,
    layout: categories.find((c) => c.id === "layout")?.score ?? 0,
    state: categories.find((c) => c.id === "state")?.score ?? 0,
    performance: performanceScore,
    accessibility: categories.find((c) => c.id === "accessibility")?.score ?? 0,
    integration: categories.find((c) => c.id === "integration")?.score ?? 0,
  };

  return {
    version: FOUNDATION_VERSION,
    certifiedAt: new Date().toISOString(),
    certified,
    readiness,
    readinessExplanation: explanation,
    overallScore,
    stabilityScore,
    performanceScore,
    uxScore,
    categories,
    checks: input.checks,
    issuesFound: input.issuesFound,
    issuesRepaired: input.issuesRepaired,
    remainingLimitations: input.remainingLimitations,
    blockers,
    aime: input.aime,
    scores,
    recommendation: certified
      ? "Foundation Ready — proceed to Phase 2 product modules when scheduled."
      : blockers[0] ?? explanation,
  };
}
