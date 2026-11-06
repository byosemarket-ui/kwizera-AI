/**
 * Stage 3 — order readiness / lifecycle consistency audit (read-only).
 * Does not introduce READY_TO_SUBMIT or a new lifecycle state machine.
 */
import type { AtBrokerHandoffRecord } from "../broker-compatibility/types.js";
import type { AtOrderProposalRecord } from "../order-proposal/types.js";
import { RISK_POLICY_STAGE, type OrderReadinessAudit, type OrderReadinessFinding } from "./types.js";
import { finitePositive, normalizeInstrumentSymbol } from "./validate.js";

export interface OrderReadinessAuditInput {
  proposal: AtOrderProposalRecord | null;
  handoff: AtBrokerHandoffRecord | null;
  liveAccountIdMasked?: string | null;
  liveAccountId?: string | null;
  quoteAgeMs?: number | null;
  quoteMaxAgeMs?: number;
  nowMs?: number;
}

function finding(
  id: string,
  severity: OrderReadinessFinding["severity"],
  code: string,
  message: string,
): OrderReadinessFinding {
  return { id, severity, code, message };
}

function masksMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = String(a ?? "").trim();
  const y = String(b ?? "").trim();
  if (!x || !y) return false;
  if (x === y) return true;
  // Compare last 4 digits when masked forms differ slightly.
  const dx = x.replace(/\D/g, "").slice(-4);
  const dy = y.replace(/\D/g, "").slice(-4);
  return Boolean(dx && dy && dx === dy);
}

/**
 * Audit whether proposal+handoff are consistent and fresh enough for Phase 2 precheck.
 * Never claims execution authorization.
 */
export function auditOrderReadiness(input: OrderReadinessAuditInput): OrderReadinessAudit {
  const nowMs = input.nowMs ?? Date.now();
  const findings: OrderReadinessFinding[] = [];
  const proposal = input.proposal;
  const handoff = input.handoff;
  const quoteMaxAgeMs = input.quoteMaxAgeMs ?? 5_000;

  if (!proposal) {
    findings.push(finding("proposal_exists", "block", "PROPOSAL_MISSING", "Order proposal record is missing."));
  } else {
    findings.push(finding(
      "proposal_exists",
      "info",
      "PROPOSAL_PRESENT",
      `Proposal ${proposal.proposalId} lifecycle=${proposal.lifecycle}.`,
    ));
    if (proposal.lifecycle === "SUPERSEDED") {
      findings.push(finding("proposal_lifecycle", "block", "PROPOSAL_SUPERSEDED", "Proposal is SUPERSEDED."));
    } else if (proposal.lifecycle === "EXPIRED") {
      findings.push(finding("proposal_lifecycle", "block", "PROPOSAL_EXPIRED", "Proposal is EXPIRED."));
    } else if (proposal.lifecycle !== "PROPOSAL_READY") {
      findings.push(finding(
        "proposal_lifecycle",
        "block",
        "PROPOSAL_NOT_READY",
        `Proposal lifecycle is ${proposal.lifecycle}; PROPOSAL_READY required.`,
      ));
    }

    if (!finitePositive(proposal.pricePlan?.entryPrice) && !finitePositive(proposal.brokerPrep?.entryPrice)) {
      findings.push(finding("entry", "block", "INVALID_ENTRY", "Entry price missing/invalid."));
    }
    if (!finitePositive(proposal.pricePlan?.stopLoss) && !finitePositive(proposal.brokerPrep?.stopLoss)) {
      findings.push(finding("stop_loss", "block", "INVALID_STOP_LOSS", "Stop loss missing/invalid."));
    }
    if (!finitePositive(proposal.pricePlan?.takeProfit) && !finitePositive(proposal.brokerPrep?.takeProfit)) {
      findings.push(finding("take_profit", "block", "INVALID_TAKE_PROFIT", "Take profit missing/invalid."));
    }
    if (!finitePositive(proposal.quantity?.normalizedQuantity) && !finitePositive(proposal.brokerPrep?.amountQuantity)) {
      findings.push(finding("quantity", "block", "INVALID_QUANTITY", "Quantity missing/invalid."));
    }

    const tif = String(proposal.brokerPrep?.timeInForce ?? "").trim().toUpperCase();
    if (tif === "GTD") {
      const exp = proposal.brokerPrep?.expiration;
      const expMs = exp ? Date.parse(exp) : NaN;
      if (!Number.isFinite(expMs)) {
        findings.push(finding("tif", "block", "INVALID_GTD_EXPIRY", "GTD requires a valid expiration timestamp."));
      } else if (expMs <= nowMs) {
        findings.push(finding("tif", "block", "INVALID_GTD_EXPIRY", `GTD expiration ${exp} is in the past.`));
      }
    } else if (tif && tif !== "GTC" && tif !== "IOC" && tif !== "FOK") {
      findings.push(finding("tif", "block", "UNSUPPORTED_TIME_IN_FORCE", `Unsupported timeInForce=${tif}.`));
    }

    const acctRef = proposal.brokerPrep?.accountReference ?? null;
    if (input.liveAccountIdMasked || input.liveAccountId) {
      if (!acctRef) {
        findings.push(finding(
          "account_identity",
          "block",
          "ACCOUNT_IDENTITY_MISMATCH",
          "Proposal accountReference missing while live account identity is known.",
        ));
      } else if (
        !masksMatch(acctRef, input.liveAccountIdMasked)
        && !masksMatch(acctRef, input.liveAccountId)
        && acctRef !== input.liveAccountId
      ) {
        findings.push(finding(
          "account_identity",
          "block",
          "ACCOUNT_IDENTITY_MISMATCH",
          "Proposal accountReference does not match live account identity.",
        ));
      } else {
        findings.push(finding("account_identity", "info", "ACCOUNT_IDENTITY_OK", "Proposal account matches live snapshot."));
      }
    }
  }

  if (!handoff) {
    findings.push(finding("handoff_exists", "block", "HANDOFF_MISSING", "Broker handoff record is missing."));
  } else {
    findings.push(finding(
      "handoff_exists",
      "info",
      "HANDOFF_PRESENT",
      `Handoff ${handoff.provenance.handoffId} lifecycle=${handoff.lifecycle}.`,
    ));
    if (handoff.lifecycle === "SUPERSEDED") {
      findings.push(finding("handoff_lifecycle", "block", "HANDOFF_SUPERSEDED", "Handoff is SUPERSEDED."));
    } else if (handoff.lifecycle === "EXPIRED") {
      findings.push(finding("handoff_lifecycle", "block", "HANDOFF_EXPIRED", "Handoff is EXPIRED."));
    } else if (handoff.lifecycle !== "HANDOFF_READY") {
      findings.push(finding(
        "handoff_lifecycle",
        "block",
        "HANDOFF_NOT_READY",
        `Handoff lifecycle is ${handoff.lifecycle}; HANDOFF_READY required.`,
      ));
    }

    const expMs = handoff.expiresAtUtc ? Date.parse(handoff.expiresAtUtc) : NaN;
    if (Number.isFinite(expMs) && expMs <= nowMs) {
      findings.push(finding(
        "handoff_expiry",
        "block",
        "HANDOFF_EXPIRED",
        `Handoff expired at ${handoff.expiresAtUtc}.`,
      ));
    }

    if (proposal?.proposalId && handoff.provenance.proposalId && handoff.provenance.proposalId !== proposal.proposalId) {
      findings.push(finding(
        "proposal_link",
        "block",
        "HANDOFF_PROPOSAL_MISMATCH",
        `Handoff proposalId ${handoff.provenance.proposalId} ≠ proposal ${proposal.proposalId}.`,
      ));
    }

    // Stale proposal snapshot vs handoff linkage (updatedAt consistency).
    if (proposal?.updatedAtUtc && handoff.provenance.updatedAtUtc) {
      const pMs = Date.parse(proposal.updatedAtUtc);
      const hMs = Date.parse(handoff.provenance.updatedAtUtc);
      if (Number.isFinite(pMs) && Number.isFinite(hMs) && pMs > hMs + 1_000) {
        findings.push(finding(
          "snapshot_consistency",
          "block",
          "STALE_PROPOSAL_SNAPSHOT",
          "Proposal updatedAt is newer than handoff — re-validate handoff against current proposal version.",
        ));
      }
    }

    const pInst = normalizeInstrumentSymbol(proposal?.instrument ?? null);
    const hInst = normalizeInstrumentSymbol(handoff.instrument?.symbol ?? null);
    if (pInst && hInst && pInst !== hInst) {
      findings.push(finding(
        "instrument_match",
        "block",
        "INSTRUMENT_MISMATCH",
        `Instrument mismatch proposal=${pInst} handoff=${hInst}.`,
      ));
    }

    if (!handoff.instrument?.offerId && !handoff.instrument?.symbol) {
      findings.push(finding("offer", "block", "MISSING_OFFER_OR_SYMBOL", "Handoff missing offerId/symbol."));
    }
  }

  if (input.quoteAgeMs == null || !Number.isFinite(input.quoteAgeMs)) {
    findings.push(finding("quote_fresh", "warn", "STALE_MARKET_DATA", "Quote age unknown."));
  } else if (input.quoteAgeMs > quoteMaxAgeMs) {
    findings.push(finding(
      "quote_fresh",
      "block",
      "STALE_MARKET_DATA",
      `Quote age ${input.quoteAgeMs}ms exceeds ${quoteMaxAgeMs}ms.`,
    ));
  }

  const blocks = findings.filter((f) => f.severity === "block");
  const inconsistent = blocks.some((f) =>
    f.code === "HANDOFF_PROPOSAL_MISMATCH"
    || f.code === "ACCOUNT_IDENTITY_MISMATCH"
    || f.code === "INSTRUMENT_MISMATCH"
    || f.code === "STALE_PROPOSAL_SNAPSHOT"
  );

  let verdict: OrderReadinessAudit["verdict"] = "READY_FOR_PRECHECK";
  if (blocks.length > 0) verdict = inconsistent ? "INCONSISTENT" : "NOT_READY";

  return {
    schemaVersion: "kwizera.order-readiness.v1",
    stage: RISK_POLICY_STAGE,
    auditedAtUtc: new Date(nowMs).toISOString(),
    verdict,
    proposalId: proposal?.proposalId ?? handoff?.provenance?.proposalId ?? null,
    handoffId: handoff?.provenance?.handoffId ?? null,
    proposalLifecycle: proposal?.lifecycle ?? null,
    handoffLifecycle: handoff?.lifecycle ?? null,
    findings,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
    note:
      "Stage 3 order-readiness audit only. READY_FOR_PRECHECK is not execution authorization "
      + "and does not introduce READY_TO_SUBMIT.",
  };
}
