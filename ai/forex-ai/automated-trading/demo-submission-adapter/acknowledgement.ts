/**
 * Stage 6 — Broker acknowledgement contract helpers.
 * Dry-run / HTTP success never establish verifiedBrokerAcceptance.
 */
import type { BrokerAcknowledgementContract } from "./types.js";

export function buildDryRunAcknowledgement(input: {
  executionAttemptId: string;
  proposalId: string;
  accountIdMasked: string | null;
}): BrokerAcknowledgementContract {
  return {
    executionAttemptId: input.executionAttemptId,
    proposalId: input.proposalId,
    accountIdMasked: input.accountIdMasked,
    brokerRequestId: null,
    brokerOrderId: null,
    brokerTradeId: null,
    brokerStatus: null,
    accepted: false,
    rejected: false,
    resultUnknown: false,
    actualFillPrice: null,
    actualQuantity: null,
    brokerTimestampUtc: null,
    rejectionReason: null,
    verifiedBrokerAcceptance: false,
    source: "DRY_RUN",
    note:
      "Dry-run / local prepare is not a broker acknowledgement. "
      + "verifiedBrokerAcceptance remains false until an authoritative FXCM response exists.",
  };
}

/**
 * Parse a mock/fixture or future broker response into the acknowledgement contract.
 * Missing broker order ID → not accepted. HTTP-shaped ok without IDs → not accepted.
 */
export function parseBrokerAcknowledgementFixture(input: {
  executionAttemptId: string;
  proposalId: string;
  accountIdMasked: string | null;
  raw: Record<string, unknown>;
  source?: "MOCK_FIXTURE" | "BROKER_RESPONSE";
}): BrokerAcknowledgementContract {
  const source = input.source ?? "MOCK_FIXTURE";
  const brokerOrderId = input.raw.brokerOrderId != null && String(input.raw.brokerOrderId).trim()
    ? String(input.raw.brokerOrderId).trim()
    : null;
  const brokerTradeId = input.raw.tradeId != null && String(input.raw.tradeId).trim()
    ? String(input.raw.tradeId).trim()
    : input.raw.brokerTradeId != null && String(input.raw.brokerTradeId).trim()
      ? String(input.raw.brokerTradeId).trim()
      : null;
  const httpOk = input.raw.httpOk === true || input.raw.ok === true;
  const explicitReject = input.raw.rejected === true || String(input.raw.code || "").includes("REJECT");
  const resultUnknown = input.raw.resultUnknown === true || input.raw.timeout === true;

  if (resultUnknown) {
    return {
      executionAttemptId: input.executionAttemptId,
      proposalId: input.proposalId,
      accountIdMasked: input.accountIdMasked,
      brokerRequestId: input.raw.brokerRequestId != null ? String(input.raw.brokerRequestId) : null,
      brokerOrderId,
      brokerTradeId,
      brokerStatus: "UNKNOWN",
      accepted: false,
      rejected: false,
      resultUnknown: true,
      actualFillPrice: null,
      actualQuantity: null,
      brokerTimestampUtc: null,
      rejectionReason: null,
      verifiedBrokerAcceptance: false,
      source,
      note: "Broker result unknown (e.g. timeout). Do not blind-retry; reconcile via read-only orders/trades.",
    };
  }

  if (explicitReject) {
    return {
      executionAttemptId: input.executionAttemptId,
      proposalId: input.proposalId,
      accountIdMasked: input.accountIdMasked,
      brokerRequestId: input.raw.brokerRequestId != null ? String(input.raw.brokerRequestId) : null,
      brokerOrderId,
      brokerTradeId,
      brokerStatus: "REJECTED",
      accepted: false,
      rejected: true,
      resultUnknown: false,
      actualFillPrice: null,
      actualQuantity: null,
      brokerTimestampUtc: input.raw.brokerTimestampUtc != null ? String(input.raw.brokerTimestampUtc) : null,
      rejectionReason: input.raw.rejectionReason != null
        ? String(input.raw.rejectionReason)
        : input.raw.error != null
          ? String(input.raw.error)
          : "Broker rejected",
      verifiedBrokerAcceptance: false,
      source,
      note: "Broker rejection fixture/response — not an acceptance.",
    };
  }

  // HTTP success alone is insufficient.
  if (httpOk && !brokerOrderId) {
    return {
      executionAttemptId: input.executionAttemptId,
      proposalId: input.proposalId,
      accountIdMasked: input.accountIdMasked,
      brokerRequestId: null,
      brokerOrderId: null,
      brokerTradeId: null,
      brokerStatus: "HTTP_OK_WITHOUT_BROKER_ID",
      accepted: false,
      rejected: false,
      resultUnknown: true,
      actualFillPrice: null,
      actualQuantity: null,
      brokerTimestampUtc: null,
      rejectionReason: null,
      verifiedBrokerAcceptance: false,
      source,
      note: "HTTP success without broker order ID is not acceptance.",
    };
  }

  const verified = Boolean(brokerOrderId) && source === "BROKER_RESPONSE" && httpOk && !explicitReject;
  return {
    executionAttemptId: input.executionAttemptId,
    proposalId: input.proposalId,
    accountIdMasked: input.accountIdMasked,
    brokerRequestId: input.raw.brokerRequestId != null ? String(input.raw.brokerRequestId) : null,
    brokerOrderId,
    brokerTradeId,
    brokerStatus: verified ? "ACCEPTED" : brokerOrderId ? "FIXTURE_ACCEPTED_UNVERIFIED" : "INCOMPLETE",
    accepted: verified,
    rejected: false,
    resultUnknown: !verified,
    actualFillPrice: typeof input.raw.fillPrice === "number" ? input.raw.fillPrice : null,
    actualQuantity: typeof input.raw.quantity === "number" ? input.raw.quantity : null,
    brokerTimestampUtc: input.raw.brokerTimestampUtc != null ? String(input.raw.brokerTimestampUtc) : null,
    rejectionReason: null,
    verifiedBrokerAcceptance: verified,
    source,
    note: verified
      ? "Authoritative broker response with order ID."
      : "Fixture or incomplete response — verifiedBrokerAcceptance false unless BROKER_RESPONSE + order ID.",
  };
}
