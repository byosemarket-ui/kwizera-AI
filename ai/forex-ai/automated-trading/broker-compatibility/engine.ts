/**
 * Step 3 — Deterministic FXCM broker compatibility validation.
 * Consumes Step 2 PROPOSAL_READY records + verified account/instrument metadata.
 * Never mutates the broker.
 */
import { randomUUID } from "node:crypto";
import { evaluateBrokerQuantityContract } from "../order-execution/broker-quantity-contract.js";
import { evaluateProtectiveGeometry } from "../broker-intent/protective-geometry.js";
import { OWNER_MAX_QUANTITY } from "../order-proposal/types.js";
import {
  AT_BROKER_HANDOFF_PHASE,
  AT_BROKER_HANDOFF_SCHEMA,
  AT_FUTURE_EXECUTION_CONTRACT_VERSION,
  OWNER_MAX_LOTS,
  type AtBrokerCheck,
  type AtBrokerCompatibilityInput,
  type AtBrokerHandoffBlockCode,
  type AtBrokerHandoffRecord,
  type AtBrokerBlocker,
  type AtFutureExecutionContract,
} from "./types.js";

const DEFAULT_HANDOFF_TTL_MS = 15 * 60 * 1000;

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function finiteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function priceOnTick(price: number, tickSize: number | null | undefined): boolean {
  if (!finitePositive(tickSize)) return true;
  const q = price / tickSize;
  return Math.abs(q - Math.round(q)) < 1e-8;
}

function block(code: AtBrokerHandoffBlockCode | string, message: string): AtBrokerBlocker {
  return { code, message };
}

function check(code: string, pass: boolean, message: string): AtBrokerCheck {
  return { code, pass, message };
}

function mapBuySell(dir: "BUY" | "SELL"): "B" | "S" {
  return dir === "BUY" ? "B" : "S";
}

/**
 * Build a broker handoff validation record from a Step 2 proposal + verified specs.
 */
export function buildBrokerHandoff(input: AtBrokerCompatibilityInput): AtBrokerHandoffRecord {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const handoffId = input.handoffId ?? randomUUID();
  const proposal = input.proposal ?? null;
  const account = input.account;
  const instrument = input.instrument;

  const idempotencyKey =
    input.idempotencyKey
    ?? [
      proposal?.proposalId ?? "none",
      proposal?.updatedAtUtc ?? proposal?.createdAtUtc ?? "none",
      proposal?.lifecycle ?? "none",
    ].join(":");

  const ttl = input.handoffTtlMs ?? DEFAULT_HANDOFF_TTL_MS;
  const expiresAtUtc = new Date(nowMs + ttl).toISOString();

  const passedChecks: AtBrokerCheck[] = [];
  const failedChecks: AtBrokerCheck[] = [];
  const warnings: string[] = [];
  const blockers: AtBrokerBlocker[] = [];

  const add = (c: AtBrokerCheck, blockerCode?: AtBrokerHandoffBlockCode | string) => {
    if (c.pass) passedChecks.push(c);
    else {
      failedChecks.push(c);
      if (blockerCode) blockers.push(block(blockerCode, c.message));
    }
  };

  const record: AtBrokerHandoffRecord = {
    schemaVersion: AT_BROKER_HANDOFF_SCHEMA,
    phase: AT_BROKER_HANDOFF_PHASE,
    idempotencyKey,
    lifecycle: "RECEIVED",
    provenance: {
      handoffId,
      schemaVersion: AT_BROKER_HANDOFF_SCHEMA,
      createdAtUtc: nowIso,
      updatedAtUtc: nowIso,
      proposalId: proposal?.proposalId ?? null,
      proposalSchemaVersion: proposal?.schemaVersion ?? null,
      analysisId: proposal?.analysisId ?? null,
      resultIntakeId: proposal?.resultIntakeId ?? null,
      observationId: proposal?.observationId ?? null,
      imageId: proposal?.imageId ?? null,
      imageHash: proposal?.imageHash ?? null,
      instrument: proposal?.instrument ?? instrument?.symbol ?? null,
      timeframe: proposal?.timeframe ?? null,
      strategyId: proposal?.strategyId ?? null,
      riskPolicyVersion: proposal?.capital?.riskPolicyVersion ?? null,
      environment: proposal?.environment ?? account?.environment ?? null,
    },
    account: {
      broker: "FXCM",
      brokerPlatform: "FOREXCONNECT",
      accountReference: account?.accountIdMasked ?? null,
      accountCurrency: account?.accountCurrency ?? null,
      accountType: account?.accountType ?? null,
      accountStatus: account?.accountStatus ?? null,
      accountMetadataTimestamp: account?.fetchedAtUtc ?? null,
      accountConnected: input.accountConnected ?? null,
      accountAuthenticated: input.accountAuthenticated ?? null,
      accountDataFresh: account?.isFresh ?? null,
      equity: account?.equity ?? null,
      usedMargin: account?.usedMargin ?? null,
      availableMargin: account?.usableMargin ?? null,
    },
    instrument: {
      symbol: instrument?.symbol ?? proposal?.instrument ?? null,
      offerId: instrument?.offerId ?? null,
      instrumentType: instrument?.instrumentType ?? null,
      baseCurrency: instrument?.baseAsset ?? null,
      quoteCurrency: instrument?.quoteAsset ?? null,
      contractSize: instrument?.baseUnitSize ?? instrument?.contractMultiplier ?? null,
      lotSize: instrument?.baseUnitSize ?? null,
      amountUnit: instrument?.quantityUnit ?? null,
      minimumAmount: instrument?.quantityMin ?? null,
      maximumAmount: null,
      amountStep: instrument?.quantityStep ?? null,
      tickSize: instrument?.pointSize ?? null,
      pipSize: instrument?.pointSize ?? null,
      pricePrecision: instrument?.digits ?? null,
      pipValue: instrument?.pipCostAccount ?? null,
      tickValue: instrument?.pipCostAccount ?? null,
      tradingStatus: null,
      tradingSession: input.market?.marketSession ?? null,
      marginRequirement: instrument?.marginPerLotAccount ?? null,
      instrumentMetadataTimestamp: null,
      contractVerified: instrument?.contractVerified ?? null,
    },
    directionOrder: {
      canonicalDecision: proposal?.canonicalDecision ?? null,
      brokerBuySell: null,
      orderType: null,
      amount: null,
      normalizedQuantity: proposal?.quantity?.normalizedQuantity ?? null,
      ownerMaxLots: OWNER_MAX_LOTS,
      entryPrice: proposal?.pricePlan?.entryPrice ?? null,
      entryZoneLow: proposal?.pricePlan?.entryZoneLow ?? null,
      entryZoneHigh: proposal?.pricePlan?.entryZoneHigh ?? null,
      stopLoss: proposal?.pricePlan?.stopLoss ?? null,
      takeProfit: proposal?.pricePlan?.takeProfit ?? null,
      timeInForce: null,
      expiration: null,
      clientReference: proposal?.brokerPrep?.clientReference ?? proposal?.proposalId ?? null,
      brokerOrderId: null,
      brokerTradeId: null,
    },
    riskCapital: {
      strategyAllocationPercent: proposal?.capital?.strategyAllocationPercent ?? null,
      strategyAllocationBudget: proposal?.capital?.strategyAllocationBudget ?? null,
      individualOrderAllocation: proposal?.capital?.individualOrderAllocation ?? null,
      riskTargetPercent: proposal?.capital?.riskTargetPercent ?? null,
      maximumRiskPercent: proposal?.capital?.riskMaximumPercent ?? null,
      allowedRiskAmount: proposal?.capital?.allowedRiskAmount ?? null,
      projectedLossAtStopLoss: proposal?.capital?.projectedLossAtStopLoss ?? null,
      plannedRewardRisk: proposal?.pricePlan?.plannedRewardRiskRatio ?? null,
      requiredMargin: proposal?.quantity?.estimatedMargin ?? null,
      availableMargin: account?.usableMargin ?? proposal?.quantity?.availableMargin ?? null,
      projectedExposure: proposal?.quantity?.projectedExposure ?? null,
      remainingAllocation: proposal?.capital?.remainingStrategyBudget ?? null,
      riskPolicyVersion: proposal?.capital?.riskPolicyVersion ?? null,
    },
    protection: {
      stopLossSupported: null,
      takeProfitSupported: null,
      attachmentMode: "UNVERIFIED",
      requiredProtectionWorkflow: null,
      protectionCompatibilityStatus: "NOT_EVALUATED",
      note: "Protection attachability requires authoritative ForexConnect attestation — never invented.",
    },
    validationStatus: "NOT_EVALUATED",
    validationTimestamp: nowIso,
    passedChecks,
    failedChecks,
    warnings,
    blockers,
    expiresAtUtc,
    futureExecutionContractVersion: AT_FUTURE_EXECUTION_CONTRACT_VERSION,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      "BROKER VALIDATION / HANDOFF only. Not a broker order. placesOrders=false. "
      + "Future execution must revalidate time-sensitive data before any independently authorized submit.",
  };

  record.lifecycle = "VALIDATING";

  // --- System master ---
  if (input.systemMasterOn === false) {
    add(
      check("SYSTEM_MASTER", false, "System Master is OFF — handoff validation blocked."),
      "SYSTEM_MASTER_OFF",
    );
  } else {
    add(check("SYSTEM_MASTER", true, "System Master gate not OFF."));
  }

  // --- Proposal readiness ---
  if (!proposal) {
    add(check("PROPOSAL_PRESENT", false, "Order proposal is missing."), "PROPOSAL_MISSING");
  } else if (proposal.lifecycle === "SUPERSEDED") {
    add(check("PROPOSAL_READY", false, "Proposal was superseded before validation."), "PROPOSAL_SUPERSEDED");
  } else if (proposal.lifecycle === "EXPIRED") {
    add(check("PROPOSAL_READY", false, "Proposal is expired."), "PROPOSAL_EXPIRED");
  } else if (proposal.lifecycle !== "PROPOSAL_READY") {
    add(
      check("PROPOSAL_READY", false, `Proposal lifecycle is ${proposal.lifecycle}, not PROPOSAL_READY.`),
      "PROPOSAL_NOT_READY",
    );
  } else {
    add(check("PROPOSAL_READY", true, "Proposal is PROPOSAL_READY."));
  }

  // --- Direction ---
  const canonical = proposal?.canonicalDecision ?? null;
  const direction = proposal?.direction ?? null;
  if (canonical === "NO_TRADE") {
    add(
      check("CANONICAL_DIRECTION", false, "NO_TRADE cannot produce a broker-compatible handoff."),
      "NO_TRADE_NOT_ELIGIBLE",
    );
  } else if (canonical !== "BUY" && canonical !== "SELL") {
    add(
      check("CANONICAL_DIRECTION", false, "Eligible canonical BUY or SELL required."),
      "NO_CANONICAL_BUY_SELL",
    );
  } else if (direction != null && direction !== canonical) {
    add(
      check("DIRECTION_CONSISTENCY", false, "Proposal direction conflicts with canonical decision."),
      "DIRECTION_MISMATCH",
    );
  } else {
    add(check("CANONICAL_DIRECTION", true, `Canonical ${canonical} accepted.`));
    record.directionOrder.canonicalDecision = canonical;
    record.directionOrder.brokerBuySell = mapBuySell(canonical);
    add(
      check("BUY_SELL_MAPPING", true, `Mapped ${canonical} → broker ${record.directionOrder.brokerBuySell}.`),
    );
  }

  // AI cannot override — if proposal notes AI conflict, warn (canonical already gated).
  if (proposal?.confidenceCalibrationFlag) {
    warnings.push("Confidence is not a calibrated win probability — informational only.");
  }

  // --- Account ---
  if (!account?.accountIdMasked) {
    add(check("ACCOUNT_ID", false, "Account ID/reference missing."), "MISSING_ACCOUNT_ID");
  } else {
    add(check("ACCOUNT_ID", true, `Account reference present (${account.accountIdMasked}).`));
  }
  if (!account?.accountCurrency) {
    add(check("ACCOUNT_CURRENCY", false, "Account currency missing."), "MISSING_ACCOUNT_CURRENCY");
  } else {
    add(check("ACCOUNT_CURRENCY", true, `Account currency ${account.accountCurrency}.`));
  }
  if (account?.isFresh !== true) {
    add(
      check("ACCOUNT_FRESH", false, "Account metadata is not fresh."),
      account?.isFresh === false ? "STALE_ACCOUNT_METADATA" : "ACCOUNT_NOT_FRESH",
    );
  } else {
    add(check("ACCOUNT_FRESH", true, "Account metadata marked fresh."));
  }

  // --- Instrument ---
  if (!instrument?.symbol) {
    add(
      check("INSTRUMENT_SYMBOL", false, "Instrument symbol / Offer mapping missing."),
      "MISSING_OFFER_OR_SYMBOL",
    );
  } else {
    add(check("INSTRUMENT_SYMBOL", true, `Symbol ${instrument.symbol}.`));
  }
  if (proposal?.instrument && instrument?.symbol && proposal.instrument !== instrument.symbol) {
    // Allow loose match if one contains the other (e.g. XAU/USD vs XAUUSD) — still warn.
    const a = proposal.instrument.replace(/[^A-Za-z]/g, "").toUpperCase();
    const b = instrument.symbol.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (a !== b && !a.includes(b) && !b.includes(a)) {
      add(
        check("INSTRUMENT_MATCH", false, `Proposal instrument ${proposal.instrument} ≠ verified ${instrument.symbol}.`),
        "INSTRUMENT_MISMATCH",
      );
    } else {
      add(check("INSTRUMENT_MATCH", true, "Proposal instrument matches verified symbol."));
    }
  }
  if (!instrument?.offerId) {
    warnings.push("Offer ID not supplied — symbol-only mapping; future executor must resolve Offer ID.");
    add(check("OFFER_ID", false, "Offer ID unverified — not invented."), "MISSING_OFFER_OR_SYMBOL");
  } else {
    add(check("OFFER_ID", true, `Offer ID ${instrument.offerId}.`));
    record.instrument.offerId = instrument.offerId;
  }

  if (input.instrumentFresh === false) {
    add(check("INSTRUMENT_FRESH", false, "Instrument metadata is stale."), "STALE_INSTRUMENT_METADATA");
  } else if (instrument?.contractVerified) {
    add(check("INSTRUMENT_FRESH", true, "Instrument contract verified."));
  }

  if (!finitePositive(instrument?.baseUnitSize) && !finitePositive(instrument?.contractMultiplier)) {
    add(check("CONTRACT_SIZE", false, "Contract/base unit size missing."), "MISSING_CONTRACT_SIZE");
  } else {
    add(check("CONTRACT_SIZE", true, "Contract size present."));
  }

  const qtyUnit = instrument?.quantityUnit ?? null;
  if (!qtyUnit || qtyUnit === "unknown") {
    add(check("QUANTITY_UNIT", false, "Quantity/amount unit missing or unknown."), "MISSING_QUANTITY_UNIT");
  } else {
    add(check("QUANTITY_UNIT", true, `Amount unit ${qtyUnit}.`));
    record.instrument.amountUnit = qtyUnit;
  }

  // --- Quantity / amount ---
  const normalizedQty = proposal?.quantity?.normalizedQuantity ?? null;
  if (!finitePositive(normalizedQty)) {
    add(check("QUANTITY_PRESENT", false, "Normalized quantity missing from proposal."), "QUANTITY_STEP_INVALID");
  } else {
    add(check("QUANTITY_RISK_SIZED", true, `Quantity ${normalizedQty} lots from the proposal's risk sizing (no fixed owner lot cap).`));
  }

  if (finitePositive(normalizedQty) && instrument) {
    const qtyContract = evaluateBrokerQuantityContract({
      requestedLots: normalizedQty,
      baseUnitSize: instrument.baseUnitSize,
      minQuantity: instrument.quantityMin,
      mmrPerLot: instrument.marginPerLotAccount,
      maxLotsPerOrder: OWNER_MAX_LOTS,
    });
    const proposalAmount = proposal?.quantity?.brokerAmount ?? null;
    if (
      qtyContract.amountConversion.ok
      && proposalAmount != null
      && qtyContract.amountConversion.amount !== proposalAmount
    ) {
      add(
        check("AMOUNT_CONSISTENCY", false, `Handoff AMOUNT ${qtyContract.amountConversion.amount} ≠ proposal AMOUNT ${proposalAmount}.`),
        "QUANTITY_MISMATCH_BETWEEN_PIPELINE_STAGES",
      );
    }
    if (!qtyContract.amountConversion.ok) {
      add(
        check("AMOUNT_CONVERSION", false, qtyContract.amountConversion.message ?? "Amount conversion failed."),
        qtyContract.amountConversion.code === "BASE_UNIT_SIZE_UNKNOWN"
          || qtyContract.amountConversion.code === "BASE_UNIT_SIZE_INVALID"
          || qtyContract.amountConversion.code === "AMOUNT_NOT_INTEGER"
          ? "BROKER_AMOUNT_UNIT_UNVERIFIED"
          : qtyContract.amountConversion.code,
      );
    } else {
      add(check("AMOUNT_CONVERSION", true, `Broker AMOUNT=${qtyContract.amountConversion.amount}.`));
      record.directionOrder.amount = qtyContract.amountConversion.amount;
      record.directionOrder.normalizedQuantity = normalizedQty;
    }
    if (qtyContract.blockers.includes("REQUESTED_LOTS_BELOW_BROKER_MIN")) {
      add(
        check("BROKER_MIN", false, "Risk-sized quantity below broker minimum — never rounded up."),
        "BROKER_MINIMUM_EXCEEDS_RISK_BUDGET",
      );
    } else if (finitePositive(instrument.quantityMin)) {
      add(check("BROKER_MIN", true, "Risk-sized quantity satisfies the broker minimum."));
    }
    // Step alignment is on broker AMOUNT (contracts), not on owner lots.
    const brokerAmount = record.directionOrder.amount;
    if (finitePositive(instrument.quantityStep) && finitePositive(brokerAmount)) {
      const steps = brokerAmount / instrument.quantityStep;
      if (Math.abs(steps - Math.round(steps)) > 1e-8) {
        add(check("QUANTITY_STEP", false, "Broker AMOUNT not aligned to quantity step."), "QUANTITY_STEP_INVALID");
      } else {
        add(check("QUANTITY_STEP", true, "Broker AMOUNT aligned to step."));
      }
    }
    if (finitePositive(qtyContract.estimatedMarginAccount)) {
      record.riskCapital.requiredMargin = qtyContract.estimatedMarginAccount;
    }
  }

  // Floor-only reaffirm: proposal quantity must equal floor semantics (never higher than calculated).
  if (
    finitePositive(proposal?.quantity?.calculatedQuantity)
    && finitePositive(normalizedQty)
    && normalizedQty > proposal!.quantity.calculatedQuantity! + 1e-12
  ) {
    add(
      check("FLOOR_ONLY", false, "Normalized quantity exceeds calculated quantity (up-round forbidden)."),
      "QUANTITY_STEP_INVALID",
    );
  } else if (finitePositive(normalizedQty)) {
    add(check("FLOOR_ONLY", true, "Floor-only quantity rule respected."));
  }

  // --- Prices / geometry ---
  const entry = proposal?.pricePlan?.entryPrice ?? null;
  const sl = proposal?.pricePlan?.stopLoss ?? null;
  const tp = proposal?.pricePlan?.takeProfit ?? null;
  const tick = instrument?.pointSize ?? proposal?.quantity?.tickSize ?? null;

  if (!finitePositive(entry)) {
    add(check("ENTRY", false, "Entry price missing — not invented."), "INVALID_ENTRY");
  } else if (!priceOnTick(entry, tick)) {
    add(check("ENTRY_TICK", false, `Entry ${entry} not on tick ${tick}.`), "INVALID_PRICE_PRECISION");
  } else {
    add(check("ENTRY", true, `Entry ${entry}.`));
    record.directionOrder.entryPrice = entry;
  }
  if (!finitePositive(sl)) {
    add(check("STOP_LOSS", false, "Stop Loss missing — not invented."), "INVALID_STOP_LOSS");
  } else if (!priceOnTick(sl, tick)) {
    add(check("SL_TICK", false, `Stop Loss ${sl} not on tick ${tick}.`), "INVALID_PRICE_PRECISION");
  } else {
    add(check("STOP_LOSS", true, `Stop Loss ${sl}.`));
    record.directionOrder.stopLoss = sl;
  }
  if (!finitePositive(tp)) {
    add(check("TAKE_PROFIT", false, "Take Profit missing — not invented."), "INVALID_TAKE_PROFIT");
  } else if (!priceOnTick(tp, tick)) {
    add(check("TP_TICK", false, `Take Profit ${tp} not on tick ${tick}.`), "INVALID_PRICE_PRECISION");
  } else {
    add(check("TAKE_PROFIT", true, `Take Profit ${tp}.`));
    record.directionOrder.takeProfit = tp;
  }

  if ((canonical === "BUY" || canonical === "SELL") && finitePositive(entry) && finitePositive(sl) && finitePositive(tp)) {
    const geom = evaluateProtectiveGeometry({
      direction: canonical,
      entryPrice: entry,
      stopLoss: sl,
      takeProfit: tp,
      requireProtective: true,
      requireThreeR: true,
    });
    if (!geom.ok) {
      for (const r of geom.rejections) {
        const code =
          /STOP|SL/i.test(r.code) ? "INVALID_SL_GEOMETRY"
            : /TAKE|TP/i.test(r.code) ? "INVALID_TP_GEOMETRY"
              : /3R|REWARD/i.test(r.code) ? "REWARD_RISK_BELOW_3R"
                : "INVALID_SL_GEOMETRY";
        add(check(r.code, false, r.message), code);
      }
    } else {
      add(check("GEOMETRY_3R", true, `Protective geometry OK; planned R:R=${geom.rewardRisk ?? "n/a"}.`));
      record.riskCapital.plannedRewardRisk = geom.rewardRisk;
    }
  }

  // --- Order type / TIF ---
  const prepType = proposal?.brokerPrep?.orderType ?? null;
  const entryType = proposal?.pricePlan?.entryType ?? null;
  let orderType: AtBrokerHandoffRecord["directionOrder"]["orderType"] = null;
  if (prepType === "MARKET" || entryType === "UNSET") {
    orderType = "MARKET";
  } else if (prepType === "LIMIT" || entryType === "EXPLICIT" || entryType === "ZONE") {
    orderType = "LIMIT";
  } else if (prepType == null && entryType == null) {
    orderType = null;
  } else {
    orderType = prepType === "LIMIT" ? "LIMIT" : prepType === "MARKET" ? "MARKET" : null;
  }

  if (orderType !== "MARKET" && orderType !== "LIMIT") {
    add(
      check("ORDER_TYPE", false, "Order type unsupported or unset for FXCM handoff preparation."),
      "INVALID_ORDER_TYPE",
    );
  } else {
    add(check("ORDER_TYPE", true, `Order type ${orderType} prepared (not submitted).`));
    record.directionOrder.orderType = orderType;
  }

  // Default TIF: MARKET → IOC not assumed; use GTC for pending LIMIT, DAY for market prep without inventing.
  let tif: AtBrokerHandoffRecord["directionOrder"]["timeInForce"] = null;
  const requestedTif = proposal?.brokerPrep?.timeInForce?.toUpperCase?.() ?? null;
  if (requestedTif) {
    if (["GTC", "IOC", "FOK", "DAY", "GTD"].includes(requestedTif)) {
      tif = requestedTif as typeof tif;
    } else {
      add(
        check("TIME_IN_FORCE", false, `Unsupported Time in Force ${requestedTif}.`),
        "UNSUPPORTED_TIME_IN_FORCE",
      );
    }
  } else if (orderType === "LIMIT") {
    tif = "GTC";
    warnings.push("Time in Force defaulted to GTC for LIMIT preparation — not submitted.");
  } else if (orderType === "MARKET") {
    tif = "IOC";
    warnings.push("Time in Force defaulted to IOC for MARKET preparation — not submitted.");
  }

  if (tif === "GTD" && !proposal?.brokerPrep?.expiration) {
    add(check("GTD_EXPIRATION", false, "GTD requires expiration — not invented."), "GTD_EXPIRATION_MISSING");
  } else if (tif) {
    add(check("TIME_IN_FORCE", true, `Time in Force ${tif}.`));
    record.directionOrder.timeInForce = tif;
    record.directionOrder.expiration = proposal?.brokerPrep?.expiration ?? null;
  }

  // --- IDs never invented ---
  if (proposal?.brokerPrep?.brokerOrderId != null) {
    add(check("ORDER_ID_NULL", false, "Broker order ID must not be present pre-submit."), "ORDER_ID_MUST_NOT_BE_INVENTED");
  } else {
    add(check("ORDER_ID_NULL", true, "brokerOrderId is null (not invented)."));
  }
  if (proposal?.brokerPrep?.brokerTradeId != null) {
    add(check("TRADE_ID_NULL", false, "Broker trade ID must not be present pre-fill."), "TRADE_ID_MUST_NOT_BE_INVENTED");
  } else {
    add(check("TRADE_ID_NULL", true, "brokerTradeId is null (not invented)."));
  }

  // --- Protection attachment ---
  if (input.protectionAttachVerified === true) {
    record.protection = {
      stopLossSupported: true,
      takeProfitSupported: true,
      attachmentMode: "ATTACH_ON_OPEN_ORDER",
      requiredProtectionWorkflow: null,
      protectionCompatibilityStatus: "COMPATIBLE_ATTACH_ON_OPEN",
      note: "Caller attested opening-order SL/TP attach support — Step 3 still does not submit.",
    };
    add(check("PROTECTION_ATTACH", true, "Opening-order protection attach attested."));
  } else {
    // Fail-closed: we do not claim attach-on-open without attestation.
    record.protection = {
      stopLossSupported: false,
      takeProfitSupported: false,
      attachmentMode: "POST_FILL_SEPARATE_PROTECTION",
      requiredProtectionWorkflow: "POST_FILL_SEPARATE_PROTECTION_ORDERS_NOT_IMPLEMENTED",
      protectionCompatibilityStatus: "REQUIRES_POST_FILL_WORKFLOW",
      note:
        "SL/TP geometry validated locally. Opening-order attach not attested. "
        + "Future executor must use a separately authorized post-fill protection workflow. "
        + "Trade ID does not exist yet and is not invented.",
    };
    warnings.push(
      "Protection attachment on opening order is unverified — handoff requires post-fill protection workflow (not implemented in Step 3).",
    );
    add(
      check(
        "PROTECTION_ATTACH",
        true,
        "Post-fill protection workflow required; attach-on-open not claimed.",
      ),
    );
  }

  // --- Margin / exposure (fresh) ---
  if (input.marginFresh === false || account?.isFresh !== true) {
    add(check("MARGIN_FRESH", false, "Margin/account data stale."), "STALE_MARGIN_DATA");
  } else {
    add(check("MARGIN_FRESH", true, "Margin freshness acceptable."));
  }
  const available = account?.usableMargin;
  const required = record.riskCapital.requiredMargin ?? proposal?.quantity?.estimatedMargin ?? null;
  if (!finiteNonNeg(available)) {
    add(check("AVAILABLE_MARGIN", false, "Available margin missing."), "STALE_MARGIN_DATA");
  } else if (finitePositive(required) && required > available + 1e-8) {
    add(
      check("AVAILABLE_MARGIN", false, `Required margin ${required} exceeds available ${available}.`),
      "INSUFFICIENT_AVAILABLE_MARGIN",
    );
  } else {
    add(check("AVAILABLE_MARGIN", true, "Available margin covers required margin (when known)."));
  }

  const projectedExp = proposal?.quantity?.projectedExposure ?? null;
  if (
    finitePositive(input.maxExposureLimit)
    && finiteNonNeg(projectedExp)
    && projectedExp > input.maxExposureLimit + 1e-9
  ) {
    add(
      check("EXPOSURE", false, `Projected exposure ${projectedExp} exceeds limit ${input.maxExposureLimit}.`),
      "EXPOSURE_LIMIT_EXCEEDED",
    );
  } else {
    add(check("EXPOSURE", true, "Exposure within limit or no limit configured."));
  }

  // --- Risk policy ---
  const rp = proposal?.capital?.riskPolicyVersion;
  if (!rp) {
    add(check("RISK_POLICY", false, "Risk policy version missing on proposal."), "MISSING_RISK_POLICY_VERSION");
  } else if (rp !== "per-order-risk-v2-20target-25max" && !String(rp).includes("per-order-risk")) {
    warnings.push(`Unexpected risk policy version ${rp}.`);
    add(check("RISK_POLICY", true, `Risk policy version ${rp} recorded.`));
  } else {
    add(check("RISK_POLICY", true, `Risk policy ${rp}.`));
  }
  if (
    finitePositive(proposal?.capital?.projectedLossAtStopLoss)
    && finitePositive(proposal?.capital?.maximumPermittedOrderLoss)
    && proposal!.capital.projectedLossAtStopLoss! > proposal!.capital.maximumPermittedOrderLoss! + 1e-8
  ) {
    add(
      check("RISK_HARD_MAX", false, "Projected loss exceeds Step 2 hard maximum — cannot hand off."),
      "RISK_POLICY_MISMATCH",
    );
  }
  if (
    finitePositive(proposal?.capital?.projectedLossAtStopLoss)
    && finitePositive(proposal?.capital?.allowedRiskAmount)
    && proposal!.capital.projectedLossAtStopLoss! > proposal!.capital.allowedRiskAmount! + 1e-8
  ) {
    add(
      check("RISK_TARGET", false, "Projected loss exceeds Step 2 risk target — cannot hand off."),
      "RISK_POLICY_MISMATCH",
    );
  }

  // --- Finalize lifecycle ---
  record.updatedAtUtc = nowIso;
  record.provenance.updatedAtUtc = nowIso;
  record.validationTimestamp = nowIso;
  record.blockers = blockers;
  record.passedChecks = passedChecks;
  record.failedChecks = failedChecks;
  record.warnings = warnings;

  if (blockers.length > 0) {
    record.lifecycle = "BLOCKED";
    record.validationStatus = "FAIL";
  } else {
    record.lifecycle = "HANDOFF_READY";
    record.validationStatus = "PASS";
  }

  return record;
}

export function toFutureExecutionContract(
  handoff: AtBrokerHandoffRecord,
): AtFutureExecutionContract {
  return {
    contractVersion: AT_FUTURE_EXECUTION_CONTRACT_VERSION,
    handoffId: handoff.provenance.handoffId,
    proposalId: handoff.provenance.proposalId,
    analysisId: handoff.provenance.analysisId,
    riskPolicyVersion: handoff.provenance.riskPolicyVersion,
    broker: "FXCM",
    brokerPlatform: "FOREXCONNECT",
    accountReference: handoff.account.accountReference,
    symbol: handoff.instrument.symbol,
    offerId: handoff.instrument.offerId,
    brokerBuySell: handoff.directionOrder.brokerBuySell,
    amount: handoff.directionOrder.amount,
    amountUnit: handoff.instrument.amountUnit,
    orderType: handoff.directionOrder.orderType,
    entryPrice: handoff.directionOrder.entryPrice,
    stopLoss: handoff.directionOrder.stopLoss,
    takeProfit: handoff.directionOrder.takeProfit,
    timeInForce: handoff.directionOrder.timeInForce,
    expiration: handoff.directionOrder.expiration,
    clientReference: handoff.directionOrder.clientReference,
    requiredProtectionWorkflow: handoff.protection.requiredProtectionWorkflow,
    validationStatus: handoff.validationStatus,
    handoffLifecycle: handoff.lifecycle,
    expiresAtUtc: handoff.expiresAtUtc,
    revalidateBeforeExecute: true,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      "Read-only future execution contract. Revalidate market/account/margin/instrument before any "
      + "independently authorized execution. Step 3 does not submit orders.",
  };
}

export function isHandoffExpired(
  handoff: AtBrokerHandoffRecord,
  nowMs = Date.now(),
): boolean {
  if (!handoff.expiresAtUtc) return false;
  const exp = Date.parse(handoff.expiresAtUtc);
  return Number.isFinite(exp) && nowMs > exp;
}
