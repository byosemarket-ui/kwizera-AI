/** Workspace Foundation Certification & Professional Readiness — Step 10 */

export type CheckStatus = "pass" | "warn" | "fail" | "repaired";
export type ReadinessVerdict = "foundation-ready" | "needs-improvement" | "requires-manual-review";

export interface CertificationCheck {
  id: string;
  category:
    | "architecture"
    | "navigation"
    | "dashboard"
    | "layout"
    | "state"
    | "performance"
    | "accessibility"
    | "integration"
    | "stability"
    | "responsive"
    | "ux"
    | "data-safety"
    | "ai-me";
  label: string;
  status: CheckStatus;
  detail: string;
  critical: boolean;
  score: number; // 0–100 contribution weight for category average
}

export interface CategoryScore {
  id: CertificationCheck["category"];
  label: string;
  score: number;
  passed: number;
  failed: number;
  warned: number;
  repaired: number;
  status: CheckStatus;
}

export interface CertificationSnapshot {
  version: "1.0";
  certifiedAt: string;
  certified: boolean;
  readiness: ReadinessVerdict;
  readinessExplanation: string;
  overallScore: number;
  stabilityScore: number;
  performanceScore: number;
  uxScore: number;
  categories: CategoryScore[];
  checks: CertificationCheck[];
  issuesFound: string[];
  issuesRepaired: string[];
  remainingLimitations: string[];
  blockers: string[];
  aime: {
    canExplainWorkspace: boolean;
    canExplainNavigation: boolean;
    canExplainLayouts: boolean;
    canExplainWidgets: boolean;
    canGuideUser: boolean;
    canMonitorHealth: boolean;
  };
  scores: {
    architecture: number;
    navigation: number;
    dashboard: number;
    layout: number;
    state: number;
    performance: number;
    accessibility: number;
    integration: number;
  };
  recommendation: string;
}

export interface AiMeCertificationContext {
  certified: boolean;
  readiness: ReadinessVerdict;
  overallScore: number;
  stabilityScore: number;
  performanceScore: number;
  uxScore: number;
  recommendation: string;
  explanation: string;
}

export const CERT_STORAGE_KEY = "kwizera.workspace-foundation-cert.v1";
export const FOUNDATION_VERSION = "1.0";
