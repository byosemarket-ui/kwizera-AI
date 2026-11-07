/**
 * Stage 7.1 — DEMO Execution Readiness Audit contracts.
 * Read-only. Never places orders / never mutates broker.
 */

export const AT_DEMO_READINESS_AUDIT_SCHEMA = "at-demo-execution-readiness-audit-v1" as const;
export const AT_DEMO_READINESS_AUDIT_STAGE = "STAGE_7_1_DEMO_EXECUTION_READINESS_AUDIT" as const;
export const AT_DEMO_READINESS_AUDIT_PHASE = "7.1" as const;

export const STAGE71_TRACKED_INSTRUMENTS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "XAU/USD",
] as const;

export type Stage71TrackedInstrument = (typeof STAGE71_TRACKED_INSTRUMENTS)[number];

export type Stage71FindingStatus =
  | "PASS"
  | "FAIL"
  | "NOT_CONFIGURED"
  | "NOT_VERIFIED"
  | "BLOCKED"
  | "NOT_APPLICABLE";

export type Stage71EvidenceKind =
  | "PRODUCTION"
  | "SOURCE_CODE"
  | "TEST"
  | "FIXTURE"
  | "BROKER_READ_ONLY"
  | "RUNTIME_CONTROLS";

export type Stage71Category =
  | "OWNER_AUTHORIZATION"
  | "SPREAD_POLICY"
  | "SLIPPAGE_POLICY"
  | "LIVE_PROPOSAL"
  | "RISK_INTEGRITY"
  | "MARGIN_ATTESTATION"
  | "FXCM_POST_FILL_PROTECTION"
  | "UNKNOWN_RESULT_RECONCILIATION"
  | "TIME_IN_FORCE"
  | "DEMO_ENVIRONMENT"
  | "EXECUTION_CONTROLS";

export type Stage71OverallState =
  | "READY_FOR_OWNER_REVIEW"
  | "NOT_READY"
  | "BLOCKED";

export interface Stage71Finding {
  category: Stage71Category;
  status: Stage71FindingStatus;
  code: string;
  message: string;
  evidenceSource: string;
  evidenceTimestampUtc: string;
  evidenceKind: Stage71EvidenceKind;
  remediation: string;
  details?: Record<string, unknown>;
}

export interface Stage71InstrumentPolicyAudit {
  instrument: Stage71TrackedInstrument;
  spread: {
    status: string;
    approvalState: string;
    maxSpreadAbsolute: number | null;
    units: string;
    pricePrecision: number | null;
    approvedBy: string | null;
    approvedAtUtc: string | null;
    configVersion: number | null;
    consumedByStage57: boolean;
  };
  slippage: {
    status: string;
    approvalState: string;
    maxSlippageAbsolute: number | null;
    units: string;
    pricePrecision: number | null;
    approvedBy: string | null;
    approvedAtUtc: string | null;
    configVersion: number | null;
    consumedByStage57: boolean;
  };
}

export interface Stage71TifMatrixRow {
  tif: "IOC" | "GTC" | "FOK" | "DAY" | "GTD";
  internalAccepted: boolean;
  adapterMappingImplemented: boolean;
  sdkRequestSupportVerified: boolean;
  brokerSupportConfirmed: boolean;
  testedBehavior: "UNIT_TEST" | "PROBE_DOCUMENTED" | "NOT_TESTED" | "EXPLICITLY_REJECTED";
  note: string;
}

export interface Stage71AuditReport {
  schemaVersion: typeof AT_DEMO_READINESS_AUDIT_SCHEMA;
  stage: typeof AT_DEMO_READINESS_AUDIT_STAGE;
  phase: typeof AT_DEMO_READINESS_AUDIT_PHASE;
  evaluatedAtUtc: string;
  overallState: Stage71OverallState;
  categories: Record<Stage71Category, Stage71FindingStatus>;
  findings: Stage71Finding[];
  instrumentPolicies: Stage71InstrumentPolicyAudit[];
  tifMatrix: Stage71TifMatrixRow[];
  controlsObserved: {
    executionMasterEnabled: boolean;
    emergencyEntryLock: boolean;
    tradingEnabled: boolean;
    selectedEnvironment: string;
    activeGrantPresent: boolean;
    submissionEnabled: false;
  };
  baselineCommitHint: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  executionAuthorized: false;
  mutationInvoked: false;
  note: string;
}
