import type { AiMeCertificationContext, CertificationSnapshot } from "./types";
import { FOUNDATION_VERSION } from "./types";

export function buildAiMeCertificationContext(snapshot: CertificationSnapshot | null): AiMeCertificationContext {
  if (!snapshot) {
    return {
      certified: false,
      readiness: "requires-manual-review",
      overallScore: 0,
      stabilityScore: 0,
      performanceScore: 0,
      uxScore: 0,
      recommendation: "Run Workspace Foundation Certification to assess professional readiness.",
      explanation: "Certification engine has not produced a snapshot yet.",
    };
  }

  const explanation = [
    `Workspace Foundation ${FOUNDATION_VERSION} certification: ${snapshot.certified ? "CERTIFIED" : "NOT CERTIFIED"}.`,
    `Readiness: ${snapshot.readiness} — ${snapshot.readinessExplanation}`,
    `Scores — overall ${snapshot.overallScore}, stability ${snapshot.stabilityScore}, performance ${snapshot.performanceScore}, UX ${snapshot.uxScore}.`,
    `AI Me can explain workspace=${snapshot.aime.canExplainWorkspace}, navigation=${snapshot.aime.canExplainNavigation}, layouts=${snapshot.aime.canExplainLayouts}, widgets=${snapshot.aime.canExplainWidgets}, guide=${snapshot.aime.canGuideUser}, health=${snapshot.aime.canMonitorHealth}.`,
    snapshot.recommendation,
  ].join(" ");

  return {
    certified: snapshot.certified,
    readiness: snapshot.readiness,
    overallScore: snapshot.overallScore,
    stabilityScore: snapshot.stabilityScore,
    performanceScore: snapshot.performanceScore,
    uxScore: snapshot.uxScore,
    recommendation: snapshot.recommendation,
    explanation,
  };
}
