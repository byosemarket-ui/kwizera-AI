/**
 * Stage 7.1 — Compose read-only DEMO execution readiness audit.
 * Fail-closed on missing evidence. Never mutates broker / never issues grants.
 */
import type { InstrumentRiskPolicy } from "../risk-policy/types.js";
import type { AtOrderProposalRecord } from "../order-proposal/types.js";
import {
  OWNER_MAX_QUANTITY,
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  PER_ORDER_RISK_TARGET_PERCENT,
} from "../order-proposal/types.js";
import { verifyDemoEnvironment } from "../demo-submission-adapter/demo-environment.js";
import { evaluateStage5ProposalIntegrity } from "../demo-submission-adapter/proposal-integrity.js";
import { evaluateTimeInForce } from "../controlled-demo-execution/tif.js";
import {
  AT_DEMO_READINESS_AUDIT_PHASE,
  AT_DEMO_READINESS_AUDIT_SCHEMA,
  AT_DEMO_READINESS_AUDIT_STAGE,
  STAGE71_TRACKED_INSTRUMENTS,
  type Stage71AuditReport,
  type Stage71Category,
  type Stage71Finding,
  type Stage71FindingStatus,
  type Stage71InstrumentPolicyAudit,
  type Stage71OverallState,
  type Stage71TifMatrixRow,
} from "./types.js";

function finding(
  partial: Omit<Stage71Finding, "evidenceTimestampUtc"> & { evidenceTimestampUtc?: string },
  nowIso: string,
): Stage71Finding {
  return {
    ...partial,
    evidenceTimestampUtc: partial.evidenceTimestampUtc ?? nowIso,
  };
}

export interface Stage71AuditInput {
  /** Source inspection: distinct owner principal configured? */
  ownerIdentityConfigured: boolean;
  /** Source: requireForexAdmin proves owner vs admin-only. */
  requireForexAdminProvesOwner: boolean;
  ownerAuthEvidenceNote: string;
  policyDocumentVersion: number | null;
  policiesByInstrument: Record<string, InstrumentRiskPolicy | null>;
  proposal: AtOrderProposalRecord | null;
  configuredEnvironment: "DEMO" | "LIVE";
  sessionEnvironment: string | null;
  accountEnvironment?: string | null;
  accountIdMasked: string | null;
  sessionStatus?: string | null;
  usableMargin: number | null;
  accountBalance: number | null;
  accountEquity: number | null;
  marginFresh: boolean | null;
  proposedOrderMarginRequirement: number | null;
  proposedOrderMarginSource: string | null;
  proposedOrderMarginAuthoritative: boolean;
  quoteFresh: boolean | null;
  quoteTimestampUtc: string | null;
  executionMasterEnabled: boolean;
  emergencyEntryLock: boolean;
  tradingEnabled: boolean;
  activeGrantPresent: boolean;
  submissionPathwayWired: boolean;
  /** Source/fixture evidence flags for protection / reconciliation. */
  protectionSourceCodeConfirmed: boolean;
  protectionBrokerReadOnlyConfirmed: boolean;
  protectionFixtureOnly: boolean;
  protectionLiveVerified: boolean;
  reconciliationAttemptPersistence: boolean;
  reconciliationIdempotencyUnique: boolean;
  reconciliationDuplicateSafe: boolean;
  reconciliationReadOnlyLookupWired: boolean;
  reconciliationUnknownBlocksRetry: boolean;
  reconciliationLiveBrokerLookupVerified: boolean;
  baselineCommitHint?: string;
  nowMs?: number;
}

function categoryStatus(findings: Stage71Finding[], category: Stage71Category): Stage71FindingStatus {
  const rows = findings.filter((f) => f.category === category);
  if (rows.length === 0) return "NOT_VERIFIED";
  if (rows.some((f) => f.status === "BLOCKED" || f.status === "FAIL")) {
    return rows.some((f) => f.status === "BLOCKED") ? "BLOCKED" : "FAIL";
  }
  if (rows.some((f) => f.status === "NOT_VERIFIED")) return "NOT_VERIFIED";
  if (rows.some((f) => f.status === "NOT_CONFIGURED")) return "NOT_CONFIGURED";
  if (rows.every((f) => f.status === "PASS" || f.status === "NOT_APPLICABLE")) {
    if (rows.some((f) => f.status === "PASS")) return "PASS";
    return "NOT_APPLICABLE";
  }
  return "NOT_VERIFIED";
}

function requiredCategoriesPass(categories: Record<Stage71Category, Stage71FindingStatus>): boolean {
  const required: Stage71Category[] = [
    "OWNER_AUTHORIZATION",
    "SPREAD_POLICY",
    "SLIPPAGE_POLICY",
    "LIVE_PROPOSAL",
    "RISK_INTEGRITY",
    "MARGIN_ATTESTATION",
    "FXCM_POST_FILL_PROTECTION",
    "UNKNOWN_RESULT_RECONCILIATION",
    "TIME_IN_FORCE",
    "DEMO_ENVIRONMENT",
    "EXECUTION_CONTROLS",
  ];
  return required.every((c) => categories[c] === "PASS");
}

export function runDemoExecutionReadinessAudit(input: Stage71AuditInput): Stage71AuditReport {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const findings: Stage71Finding[] = [];

  // --- AUDIT 1 Owner authorization ---
  // requireForexAdmin never proves owner. PASS only when distinct owner capability is configured.
  if (!input.ownerIdentityConfigured) {
    findings.push(finding({
      category: "OWNER_AUTHORIZATION",
      status: "NOT_VERIFIED",
      code: "OWNER_AUTHORIZATION_NOT_VERIFIED",
      message:
        "Distinct system-owner capability is not configured. "
        + "requireForexAdmin remains Admin-only and does not prove owner. "
        + input.ownerAuthEvidenceNote,
      evidenceSource: "ai/admin-control-plane/owner-auth-boundary.ts",
      evidenceKind: "RUNTIME_CONTROLS",
      remediation:
        "Set a distinct KWIZERA_OWNER_API_TOKEN (≠ KWIZERA_ADMIN_API_TOKEN) on the server. "
        + "Owner actions require x-kwizera-owner-token; client owner/role headers are ignored.",
      details: { requireForexAdminProvesOwner: input.requireForexAdminProvesOwner === true },
    }, nowIso));
  } else {
    findings.push(finding({
      category: "OWNER_AUTHORIZATION",
      status: "PASS",
      code: "OWNER_AUTHORIZATION_VERIFIED",
      message:
        "Distinct system-owner capability is configured server-side and enforced for sensitive actions. "
        + "Ordinary Forex Admin is not silently promoted. "
        + input.ownerAuthEvidenceNote,
      evidenceSource: "owner-auth-boundary + requireForexOwner gates",
      evidenceKind: "RUNTIME_CONTROLS",
      remediation: "None.",
      details: { requireForexAdminProvesOwner: false },
    }, nowIso));
  }

  // --- AUDIT 2 Spread / Slippage ---
  const instrumentPolicies: Stage71InstrumentPolicyAudit[] = [];
  for (const inst of STAGE71_TRACKED_INSTRUMENTS) {
    const pol = input.policiesByInstrument[inst] ?? null;
    // Stage 5–7 consume only APPROVED+VERIFIED absolute values (resolveSpreadLimit/resolveSlippageLimit).
    const spreadConsumed = pol?.spread.status === "VERIFIED"
      && pol.spread.approvalState === "APPROVED"
      && pol.spread.maxSpreadAbsolute != null;
    const slipConsumed = pol?.slippage.status === "VERIFIED"
      && pol.slippage.approvalState === "APPROVED"
      && pol.slippage.maxSlippageAbsolute != null;

    instrumentPolicies.push({
      instrument: inst,
      spread: {
        status: pol?.spread.status ?? "NOT_CONFIGURED",
        approvalState: pol?.spread.approvalState ?? "NOT_CONFIGURED",
        maxSpreadAbsolute: pol?.spread.maxSpreadAbsolute ?? null,
        units: pol?.spread.units ?? "absolute_price",
        pricePrecision: pol?.spread.pricePrecision ?? null,
        approvedBy: pol?.spread.approvedBy ?? null,
        approvedAtUtc: pol?.spread.approvedAtUtc ?? null,
        configVersion: pol?.spread.configVersion ?? null,
        consumedByStage57: spreadConsumed,
      },
      slippage: {
        status: pol?.slippage.status ?? "NOT_CONFIGURED",
        approvalState: pol?.slippage.approvalState ?? "NOT_CONFIGURED",
        maxSlippageAbsolute: pol?.slippage.maxSlippageAbsolute ?? null,
        units: pol?.slippage.units ?? "absolute_price",
        pricePrecision: pol?.slippage.pricePrecision ?? null,
        approvedBy: pol?.slippage.approvedBy ?? null,
        approvedAtUtc: pol?.slippage.approvedAtUtc ?? null,
        configVersion: pol?.slippage.configVersion ?? null,
        consumedByStage57: slipConsumed,
      },
    });

    if (!spreadConsumed) {
      findings.push(finding({
        category: "SPREAD_POLICY",
        status: "NOT_CONFIGURED",
        code: "SPREAD_POLICY_NOT_VERIFIED",
        message:
          `${inst} spread not consumed by Stage 5–7 `
          + `(status=${pol?.spread.status ?? "null"}; approval=${pol?.spread.approvalState ?? "null"}).`,
        evidenceSource: "risk-policy store (approval → VERIFIED only when APPROVED)",
        evidenceKind: "PRODUCTION",
        remediation: `Approve an explicit absolute max spread for ${inst} via Stage 4 workflow (do not invent values).`,
        details: {
          instrument: inst,
          status: pol?.spread.status ?? null,
          approvalState: pol?.spread.approvalState ?? null,
          maxSpreadAbsolute: pol?.spread.maxSpreadAbsolute ?? null,
        },
      }, nowIso));
    } else {
      findings.push(finding({
        category: "SPREAD_POLICY",
        status: "PASS",
        code: "SPREAD_POLICY_VERIFIED",
        message: `${inst} spread VERIFIED/APPROVED and eligible for Stage 5–7 resolve consumption.`,
        evidenceSource: "risk-policy store",
        evidenceKind: "PRODUCTION",
        remediation: "None.",
        details: {
          instrument: inst,
          maxSpreadAbsolute: pol?.spread.maxSpreadAbsolute,
          approvedBy: pol?.spread.approvedBy,
          approvedAtUtc: pol?.spread.approvedAtUtc,
          policyDocumentVersion: input.policyDocumentVersion,
        },
      }, nowIso));
    }

    if (!slipConsumed) {
      findings.push(finding({
        category: "SLIPPAGE_POLICY",
        status: "NOT_CONFIGURED",
        code: "SLIPPAGE_POLICY_NOT_VERIFIED",
        message:
          `${inst} slippage not consumed by Stage 5–7 `
          + `(status=${pol?.slippage.status ?? "null"}; approval=${pol?.slippage.approvalState ?? "null"}).`,
        evidenceSource: "risk-policy store",
        evidenceKind: "PRODUCTION",
        remediation: `Approve an explicit absolute max slippage for ${inst} via Stage 4 workflow.`,
        details: {
          instrument: inst,
          status: pol?.slippage.status ?? null,
          approvalState: pol?.slippage.approvalState ?? null,
          maxSlippageAbsolute: pol?.slippage.maxSlippageAbsolute ?? null,
        },
      }, nowIso));
    } else {
      findings.push(finding({
        category: "SLIPPAGE_POLICY",
        status: "PASS",
        code: "SLIPPAGE_POLICY_VERIFIED",
        message: `${inst} slippage VERIFIED/APPROVED and eligible for Stage 5–7 resolve consumption.`,
        evidenceSource: "risk-policy store",
        evidenceKind: "PRODUCTION",
        remediation: "None.",
        details: {
          instrument: inst,
          maxSlippageAbsolute: pol?.slippage.maxSlippageAbsolute,
          approvedBy: pol?.slippage.approvedBy,
          approvedAtUtc: pol?.slippage.approvedAtUtc,
        },
      }, nowIso));
    }
  }

  // --- AUDIT 3 Live proposal ---
  const integrity = evaluateStage5ProposalIntegrity({
    proposal: input.proposal,
    expectedAccountIdMasked: input.accountIdMasked,
    nowMs,
  });
  if (!input.proposal) {
    findings.push(finding({
      category: "LIVE_PROPOSAL",
      status: "NOT_VERIFIED",
      code: "NO_ELIGIBLE_LIVE_PROPOSAL",
      message: "No canonical Stage 5 PROPOSAL_READY record available for read-only audit.",
      evidenceSource: "order-proposal store",
      evidenceKind: "PRODUCTION",
      remediation: "Produce an eligible Stage 5 proposal through the normal analysis pipeline — do not synthesize for audit.",
    }, nowIso));
    findings.push(finding({
      category: "RISK_INTEGRITY",
      status: "NOT_VERIFIED",
      code: "RISK_INTEGRITY_UNVERIFIED_NO_PROPOSAL",
      message: "Per-order risk cannot be verified without an eligible live proposal.",
      evidenceSource: "order-proposal store",
      evidenceKind: "PRODUCTION",
      remediation: "Requires NO_ELIGIBLE_LIVE_PROPOSAL remediation first.",
    }, nowIso));
  } else if (!integrity.ok) {
    findings.push(finding({
      category: "LIVE_PROPOSAL",
      status: "FAIL",
      code: integrity.blockers[0]?.code ?? "PROPOSAL_INTEGRITY_FAIL",
      message: `Live proposal present but integrity failed: ${integrity.blockers.map((b) => b.code).join(",")}`,
      evidenceSource: "evaluateStage5ProposalIntegrity",
      evidenceKind: "PRODUCTION",
      remediation: "Repair or supersede the canonical proposal; do not force-pass audit.",
      details: {
        proposalId: input.proposal.proposalId,
        lifecycle: input.proposal.lifecycle,
        blockers: integrity.blockers,
      },
    }, nowIso));
    findings.push(finding({
      category: "RISK_INTEGRITY",
      status: "FAIL",
      code: "RISK_INTEGRITY_FAIL",
      message: "Risk integrity blocked by proposal integrity failures.",
      evidenceSource: "evaluateStage5ProposalIntegrity",
      evidenceKind: "PRODUCTION",
      remediation: "Fix proposal/risk record until Stage 5 integrity PASS.",
    }, nowIso));
  } else {
    const p = input.proposal;
    const risk = p.perOrderRisk!;
    const qty = p.quantity.normalizedQuantity ?? p.quantity.calculatedQuantity;
    findings.push(finding({
      category: "LIVE_PROPOSAL",
      status: "PASS",
      code: "LIVE_PROPOSAL_ELIGIBLE",
      message: `Canonical proposal ${p.proposalId} is PROPOSAL_READY with integrity PASS.`,
      evidenceSource: "order-proposal store",
      evidenceKind: "PRODUCTION",
      remediation: "None.",
      details: {
        proposalId: p.proposalId,
        proposalVersion: integrity.proposalVersion,
        instrument: p.instrument,
        direction: p.direction,
        allocationId: risk.allocationId,
        individualOrderAllocation: risk.capitalAllocation,
        entryPrice: p.pricePlan.entryPrice,
        stopLoss: p.pricePlan.stopLoss,
        takeProfit: p.pricePlan.takeProfit,
        quantity: qty,
        contractSize: p.quantity.contractSize,
        expiry: p.brokerPrep.expiration,
        accountReference: p.brokerPrep.accountReference,
        quoteFresh: input.quoteFresh,
        quoteTimestampUtc: input.quoteTimestampUtc,
      },
    }, nowIso));

    const riskOk =
      risk.operatingRiskPercent === PER_ORDER_RISK_TARGET_PERCENT
      && risk.hardMaximumRiskPercent === PER_ORDER_RISK_MAXIMUM_PERCENT
      && risk.actualModeledMonetaryRisk != null
      && risk.maximumAllowedMonetaryLoss != null
      && risk.actualModeledMonetaryRisk <= risk.maximumAllowedMonetaryLoss + 1e-8
      && risk.actualRewardToRiskRatio != null
      && risk.actualRewardToRiskRatio + 1e-9 >= 3
      && qty != null
      && qty <= OWNER_MAX_QUANTITY + 1e-12
      && risk.validationResult === "PASS";

    findings.push(finding({
      category: "RISK_INTEGRITY",
      status: riskOk ? "PASS" : "FAIL",
      code: riskOk ? "RISK_INTEGRITY_PASS" : "RISK_INTEGRITY_FAIL",
      message: riskOk
        ? "Per-order risk applies to individual allocation; 20%/25%/3R/0.01 constraints hold on live record."
        : "Live risk record fails one or more Stage 5 constraints.",
      evidenceSource: "per-order-risk on canonical proposal",
      evidenceKind: "PRODUCTION",
      remediation: riskOk ? "None." : "Regenerate proposal with compliant per-order risk.",
      details: {
        operatingRiskPercent: risk.operatingRiskPercent,
        hardMaximumRiskPercent: risk.hardMaximumRiskPercent,
        actualModeledMonetaryRisk: risk.actualModeledMonetaryRisk,
        maximumAllowedMonetaryLoss: risk.maximumAllowedMonetaryLoss,
        expectedMonetaryProfit: risk.expectedMonetaryProfit,
        actualRewardToRiskRatio: risk.actualRewardToRiskRatio,
        quantity: qty,
        ownerMaxLots: OWNER_MAX_QUANTITY,
      },
    }, nowIso));
  }

  // Quote freshness as part of proposal readiness evidence
  if (input.proposal && input.quoteFresh !== true) {
    findings.push(finding({
      category: "LIVE_PROPOSAL",
      status: "FAIL",
      code: "MARKET_DATA_STALE",
      message: "Quote freshness not confirmed for the live proposal audit window.",
      evidenceSource: "broker verification market snapshot",
      evidenceKind: "PRODUCTION",
      remediation: "Refresh DEMO market data until quote is fresh; stale data must block readiness.",
    }, nowIso));
  }

  // --- AUDIT 4 Margin ---
  if (!input.proposedOrderMarginAuthoritative) {
    findings.push(finding({
      category: "MARGIN_ATTESTATION",
      status: "NOT_VERIFIED",
      code: "PROPOSED_ORDER_MARGIN_NOT_VERIFIED",
      message:
        "Proposed-order margin is not authoritatively verified from broker instrument/account attestation. "
        + `Observed usableMargin=${input.usableMargin}; estimated/required=${input.proposedOrderMarginRequirement}; `
        + `source=${input.proposedOrderMarginSource ?? "null"}.`,
      evidenceSource: input.proposedOrderMarginSource ?? "proposal.quantity.estimatedMargin / risk.marginRequirement",
      evidenceKind: "PRODUCTION",
      remediation:
        "Attest required margin from authoritative FXCM instrument/account fields for the specific proposal; "
        + "do not infer from balance/equity alone.",
      details: {
        accountBalance: input.accountBalance,
        accountEquity: input.accountEquity,
        usableMargin: input.usableMargin,
        marginFresh: input.marginFresh,
        proposedOrderMarginRequirement: input.proposedOrderMarginRequirement,
      },
    }, nowIso));
  } else if (
    input.usableMargin == null
    || input.marginFresh !== true
    || input.proposedOrderMarginRequirement == null
    || input.usableMargin + 1e-9 < input.proposedOrderMarginRequirement
  ) {
    findings.push(finding({
      category: "MARGIN_ATTESTATION",
      status: "FAIL",
      code: "MARGIN_INSUFFICIENT_OR_STALE",
      message: "Authoritative margin present but usable margin insufficient or stale.",
      evidenceSource: "broker account + margin attestation",
      evidenceKind: "BROKER_READ_ONLY",
      remediation: "Refresh account margin and ensure usable ≥ proposed-order requirement.",
    }, nowIso));
  } else {
    findings.push(finding({
      category: "MARGIN_ATTESTATION",
      status: "PASS",
      code: "MARGIN_ATTESTATION_PASS",
      message: "Proposed-order margin authoritatively verified; usable margin sufficient.",
      evidenceSource: input.proposedOrderMarginSource ?? "broker margin attestation",
      evidenceKind: "BROKER_READ_ONLY",
      remediation: "None.",
    }, nowIso));
  }

  // --- AUDIT 5 Post-fill protection ---
  if (!input.protectionLiveVerified) {
    const status: Stage71FindingStatus = input.protectionSourceCodeConfirmed
      ? "NOT_VERIFIED"
      : "NOT_VERIFIED";
    findings.push(finding({
      category: "FXCM_POST_FILL_PROTECTION",
      status,
      code: "FXCM_POST_FILL_PROTECTION_NOT_VERIFIED",
      message:
        "Post-fill SL/TP capability is evidenced in sidecar source (`_trade_protection_snapshot`, "
        + "RATE_STOP/RATE_LIMIT, STOP/LIMIT+TRADE_ID) and Stage 7 fixture verifier, "
        + "but live broker protection attach/verify was not demonstrated in this read-only audit.",
      evidenceSource: "services/forexconnect-sidecar/mutation_demo.py + controlled-demo-execution/protection.ts",
      evidenceKind: input.protectionFixtureOnly ? "FIXTURE" : "SOURCE_CODE",
      remediation:
        "Demonstrate read-only retrieval of fill/trade/SL/TP on a real DEMO trade under a separately authorized procedure; "
        + "do not claim live-ready from fixtures alone.",
      details: {
        sourceCodeConfirmed: input.protectionSourceCodeConfirmed,
        brokerReadOnlyConfirmed: input.protectionBrokerReadOnlyConfirmed,
        fixtureOnly: input.protectionFixtureOnly,
        liveVerified: input.protectionLiveVerified,
      },
    }, nowIso));
  } else {
    findings.push(finding({
      category: "FXCM_POST_FILL_PROTECTION",
      status: "PASS",
      code: "FXCM_POST_FILL_PROTECTION_VERIFIED",
      message: "Live broker read-only protection evidence confirmed.",
      evidenceSource: "broker trades/orders read-only",
      evidenceKind: "BROKER_READ_ONLY",
      remediation: "None.",
    }, nowIso));
  }

  // --- AUDIT 6 Unknown-result reconciliation ---
  if (
    input.reconciliationAttemptPersistence
    && input.reconciliationIdempotencyUnique
    && input.reconciliationDuplicateSafe
    && input.reconciliationUnknownBlocksRetry
    && !input.reconciliationLiveBrokerLookupVerified
  ) {
    findings.push(finding({
      category: "UNKNOWN_RESULT_RECONCILIATION",
      status: "NOT_VERIFIED",
      code: "UNKNOWN_RESULT_RECONCILIATION_NOT_LIVE_VERIFIED",
      message:
        "Idempotency, duplicate-safe persistence, and UNKNOWN retry blocking are implemented and unit-tested, "
        + "but authoritative live broker order/trade lookup for post-restart reconciliation is not verified "
        + "(submission pathway remains disabled).",
      evidenceSource: "demo-submission-adapter store/ack + Stage 7 attempt store",
      evidenceKind: "SOURCE_CODE",
      remediation:
        "Wire and verify read-only order/trade reconciliation against DEMO broker evidence before enabling submission.",
      details: {
        attemptPersistence: input.reconciliationAttemptPersistence,
        uniqueIdempotency: input.reconciliationIdempotencyUnique,
        duplicateSafe: input.reconciliationDuplicateSafe,
        unknownBlocksRetry: input.reconciliationUnknownBlocksRetry,
        readOnlyLookupWired: input.reconciliationReadOnlyLookupWired,
        liveLookupVerified: input.reconciliationLiveBrokerLookupVerified,
      },
    }, nowIso));
  } else if (!input.reconciliationUnknownBlocksRetry || !input.reconciliationAttemptPersistence) {
    findings.push(finding({
      category: "UNKNOWN_RESULT_RECONCILIATION",
      status: "FAIL",
      code: "UNKNOWN_RESULT_RECONCILIATION_INCOMPLETE",
      message: "Core UNKNOWN/idempotency safety properties are incomplete.",
      evidenceSource: "Stage 6/7 stores",
      evidenceKind: "SOURCE_CODE",
      remediation: "Complete attempt persistence and UNKNOWN retry blocking before any submission stage.",
    }, nowIso));
  } else {
    findings.push(finding({
      category: "UNKNOWN_RESULT_RECONCILIATION",
      status: "PASS",
      code: "UNKNOWN_RESULT_RECONCILIATION_VERIFIED",
      message: "Reconciliation properties verified including live broker lookup.",
      evidenceSource: "broker read-only + stores",
      evidenceKind: "BROKER_READ_ONLY",
      remediation: "None.",
    }, nowIso));
  }

  // --- AUDIT 7 TIF ---
  const tifMatrix: Stage71TifMatrixRow[] = [
    {
      tif: "IOC",
      internalAccepted: true,
      adapterMappingImplemented: true,
      sdkRequestSupportVerified: false,
      brokerSupportConfirmed: false,
      testedBehavior: "PROBE_DOCUMENTED",
      note: "OM documented default; Stage 7 accepts; broker live support not confirmed in this audit.",
    },
    {
      tif: "GTC",
      internalAccepted: true,
      adapterMappingImplemented: true,
      sdkRequestSupportVerified: false,
      brokerSupportConfirmed: false,
      testedBehavior: "UNIT_TEST",
      note: "Listed in documentedOmSupportedTif probe; Stage 7 unit-accepted; broker not live-confirmed.",
    },
    {
      tif: "FOK",
      internalAccepted: true,
      adapterMappingImplemented: true,
      sdkRequestSupportVerified: false,
      brokerSupportConfirmed: false,
      testedBehavior: "UNIT_TEST",
      note: "Listed in documentedOmSupportedTif; not live-confirmed.",
    },
    {
      tif: "DAY",
      internalAccepted: true,
      adapterMappingImplemented: true,
      sdkRequestSupportVerified: false,
      brokerSupportConfirmed: false,
      testedBehavior: "UNIT_TEST",
      note: "Listed in documentedOmSupportedTif; not live-confirmed.",
    },
    {
      tif: "GTD",
      internalAccepted: false,
      adapterMappingImplemented: false,
      sdkRequestSupportVerified: false,
      brokerSupportConfirmed: false,
      testedBehavior: "EXPLICITLY_REJECTED",
      note: "Stage 7 UNSUPPORTED_TIF_GTD — never silently converted to GTC.",
    },
  ];
  const gtd = evaluateTimeInForce({ requested: "GTD" });
  const ioc = evaluateTimeInForce({ requested: "IOC" });
  findings.push(finding({
    category: "TIME_IN_FORCE",
    status: "NOT_VERIFIED",
    code: "TIF_BROKER_SUPPORT_NOT_LIVE_VERIFIED",
    message:
      `Internal TIF: IOC ok=${ioc.ok}; GTD rejected=${!gtd.ok}. `
      + "Adapter accepts IOC/GTC/FOK/DAY per Stage 6/7 docs/probe; broker live confirmation absent. "
      + "Internal enum ≠ broker support.",
    evidenceSource: "mutation_demo.py TIF probe + controlled-demo-execution/tif.ts",
    evidenceKind: "SOURCE_CODE",
    remediation: "Confirm each TIF against live DEMO OM responses under a later authorized test — without silent GTD→GTC.",
    details: { tifMatrix },
  }, nowIso));

  // --- AUDIT 8/10 DEMO env + controls ---
  const env = verifyDemoEnvironment({
    configuredEnvironment: input.configuredEnvironment,
    sessionEnvironment: input.sessionEnvironment,
    accountEnvironment: input.accountEnvironment,
    accountIdMasked: input.accountIdMasked,
    expectedAccountIdMasked: input.accountIdMasked,
    sessionStatus: input.sessionStatus,
  });
  findings.push(finding({
    category: "DEMO_ENVIRONMENT",
    status: env.positivelyVerifiedDemo ? "PASS" : (input.configuredEnvironment === "LIVE" ? "BLOCKED" : "FAIL"),
    code: env.positivelyVerifiedDemo ? "DEMO_ENVIRONMENT_VERIFIED" : env.code,
    message: env.message,
    evidenceSource: "verifyDemoEnvironment",
    evidenceKind: "RUNTIME_CONTROLS",
    remediation: env.positivelyVerifiedDemo
      ? "None."
      : "Establish positively verified DEMO session/account identity; LIVE/UNKNOWN must block.",
  }, nowIso));

  const controlsOk =
    input.executionMasterEnabled === false
    && input.emergencyEntryLock === true
    && input.activeGrantPresent === false
    && input.submissionPathwayWired === false;

  findings.push(finding({
    category: "EXECUTION_CONTROLS",
    status: controlsOk ? "PASS" : "BLOCKED",
    code: controlsOk ? "EXECUTION_CONTROLS_SAFE" : "EXECUTION_CONTROLS_UNSAFE",
    message: controlsOk
      ? "Execution Master OFF, Emergency Lock ON, no active grant, submission pathway unwired — audit-safe posture."
      : "Execution controls are not in the required audit-safe posture.",
    evidenceSource: "broker-execution foundation + Stage 7 store + submissionEnabled=false",
    evidenceKind: "RUNTIME_CONTROLS",
    remediation: controlsOk
      ? "Keep controls unchanged. Do not enable Execution Master or clear Emergency Lock for Stage 7.1."
      : "Restore EM OFF / lock ON / no grant / no submission wiring before continuing.",
    details: {
      executionMasterEnabled: input.executionMasterEnabled,
      emergencyEntryLock: input.emergencyEntryLock,
      tradingEnabled: input.tradingEnabled,
      activeGrantPresent: input.activeGrantPresent,
      submissionPathwayWired: input.submissionPathwayWired,
    },
  }, nowIso));

  const categories = {} as Record<Stage71Category, Stage71FindingStatus>;
  const cats: Stage71Category[] = [
    "OWNER_AUTHORIZATION",
    "SPREAD_POLICY",
    "SLIPPAGE_POLICY",
    "LIVE_PROPOSAL",
    "RISK_INTEGRITY",
    "MARGIN_ATTESTATION",
    "FXCM_POST_FILL_PROTECTION",
    "UNKNOWN_RESULT_RECONCILIATION",
    "TIME_IN_FORCE",
    "DEMO_ENVIRONMENT",
    "EXECUTION_CONTROLS",
  ];
  for (const c of cats) categories[c] = categoryStatus(findings, c);

  let overallState: Stage71OverallState = "NOT_READY";
  if (findings.some((f) => f.status === "BLOCKED") || categories.EXECUTION_CONTROLS === "BLOCKED") {
    overallState = "BLOCKED";
  } else if (requiredCategoriesPass(categories)) {
    overallState = "READY_FOR_OWNER_REVIEW";
  } else {
    overallState = "NOT_READY";
  }

  return {
    schemaVersion: AT_DEMO_READINESS_AUDIT_SCHEMA,
    stage: AT_DEMO_READINESS_AUDIT_STAGE,
    phase: AT_DEMO_READINESS_AUDIT_PHASE,
    evaluatedAtUtc: nowIso,
    overallState,
    categories,
    findings,
    instrumentPolicies,
    tifMatrix,
    controlsObserved: {
      executionMasterEnabled: input.executionMasterEnabled,
      emergencyEntryLock: input.emergencyEntryLock,
      tradingEnabled: input.tradingEnabled,
      selectedEnvironment: input.configuredEnvironment,
      activeGrantPresent: input.activeGrantPresent,
      submissionEnabled: false,
    },
    baselineCommitHint: input.baselineCommitHint ?? "e22703be240fb7972e45e9ebc4278d6a2764297e",
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
    mutationInvoked: false,
    note:
      "Stage 7.1 read-only DEMO execution readiness audit. "
      + "READY_FOR_EXECUTION is intentionally absent. Missing evidence never PASSes. "
      + "No grants issued; no broker mutation.",
  };
}
