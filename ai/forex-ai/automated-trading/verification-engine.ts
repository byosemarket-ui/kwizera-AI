/**
 * Phase 52 — FXCM account & market verification engine (read-only).
 * Reuses account-snapshot, contract-spec, and ForexConnect live feed honesty rules.
 * Never places, modifies, or closes broker orders.
 */
import {
  buildAccountSnapshotFromAccountsResult,
  type ForexAccountSnapshot,
} from "../position-sizing/account-snapshot.js";
import { contractSpecFromForexConnectMetadata } from "../position-sizing/contract-spec.js";
import type { ForexConnectAccountsResult, ForexConnectInstrument } from "../../market-data/forexconnect/types.js";
import type { ForexConnectLiveStreamState } from "../../market-data/forexconnect/live-types.js";
import { resolveFcFeedStreamState } from "../../market-data/forexconnect/stream-state.js";
import { maskAccountId, type AutomatedTradingEnvironment } from "./types.js";
import {
  ACCOUNT_SNAPSHOT_MAX_AGE_MS,
  MARKET_QUOTE_STALE_MS,
  emptyAccountMetadata,
  emptyInstrument,
  emptyMarket,
  type AutomatedTradingReadinessGates,
  type AutomatedTradingVerificationResult,
  type InstrumentVerificationLevel,
  type VerificationBlocker,
  type VerificationBlockerCode,
  type VerificationIdentityStatus,
  type VerificationMarketFeedStatus,
  type VerifiedAccountMetadataPublic,
  type VerifiedInstrumentPublic,
  type VerifiedMarketQuotePublic,
} from "./verification-types.js";

function uiEnvFromFc(raw: string | null | undefined): AutomatedTradingEnvironment | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "demo") return "DEMO";
  if (v === "live" || v === "real") return "LIVE";
  return null;
}

function sdkEnv(selected: AutomatedTradingEnvironment): "demo" | "live" {
  return selected === "LIVE" ? "live" : "demo";
}

function blocker(code: VerificationBlockerCode, message: string): VerificationBlocker {
  return { code, message };
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Distinguish missing balance from legitimate zero. */
export function parseOptionalFinite(raw: unknown): { present: boolean; value: number | null; invalid: boolean } {
  if (raw == null || raw === "") return { present: false, value: null, invalid: false };
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return { present: true, value: null, invalid: true };
    return { present: true, value: raw, invalid: false };
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { present: true, value: null, invalid: true };
    return { present: true, value: n, invalid: false };
  }
  return { present: false, value: null, invalid: false };
}

export function validateBidAsk(bid: unknown, ask: unknown): {
  ok: boolean;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  reason: string | null;
} {
  const b = parseOptionalFinite(bid);
  const a = parseOptionalFinite(ask);
  if (!b.present || !a.present) {
    return { ok: false, bid: null, ask: null, spread: null, reason: "Bid/Ask unavailable." };
  }
  if (b.invalid || a.invalid || b.value == null || a.value == null) {
    return { ok: false, bid: null, ask: null, spread: null, reason: "Bid/Ask are non-finite." };
  }
  if (b.value <= 0 || a.value <= 0) {
    return { ok: false, bid: null, ask: null, spread: null, reason: "Bid/Ask must be positive." };
  }
  if (a.value < b.value) {
    return { ok: false, bid: null, ask: null, spread: null, reason: "Ask is less than Bid." };
  }
  return { ok: true, bid: b.value, ask: a.value, spread: a.value - b.value, reason: null };
}

export function mapIdentityFromSnapshot(input: {
  credentialsConfigured: boolean;
  connectionStatus: string;
  selected: AutomatedTradingEnvironment;
  sessionEnv: AutomatedTradingEnvironment | null;
  snapshot: ForexAccountSnapshot;
  expectedAccountId?: string | null;
}): {
  identityStatus: VerificationIdentityStatus;
  environmentMatches: boolean | null;
  blockers: VerificationBlocker[];
} {
  const blockers: VerificationBlocker[] = [];
  const st = String(input.connectionStatus ?? "").toUpperCase();

  if (!input.credentialsConfigured) {
    blockers.push(blocker("CONFIGURATION_MISSING", `${input.selected} credentials are not configured.`));
    return { identityStatus: "CONFIGURATION_MISSING", environmentMatches: null, blockers };
  }
  if (st === "CONNECTING") {
    return { identityStatus: "CONNECTING", environmentMatches: null, blockers };
  }
  if (st === "SERVICE_UNAVAILABLE" || st === "DISABLED" || st === "SDK_UNAVAILABLE") {
    blockers.push(blocker("PROVIDER_UNAVAILABLE", `ForexConnect provider status: ${st}.`));
    return { identityStatus: "PROVIDER_UNAVAILABLE", environmentMatches: null, blockers };
  }
  if (st !== "CONNECTED") {
    blockers.push(blocker("CONNECTION_FAILED", `Broker session is ${st || "unknown"}.`));
    return { identityStatus: "CONNECTION_FAILED", environmentMatches: null, blockers };
  }

  if (!input.sessionEnv) {
    blockers.push(blocker("ENVIRONMENT_MISMATCH", "Connected session environment could not be verified."));
    return { identityStatus: "ENVIRONMENT_MISMATCH", environmentMatches: false, blockers };
  }
  if (input.sessionEnv !== input.selected) {
    blockers.push(
      blocker(
        "ENVIRONMENT_MISMATCH",
        `Session is ${input.sessionEnv} but Automated Trading selection is ${input.selected}.`,
      ),
    );
    return { identityStatus: "ENVIRONMENT_MISMATCH", environmentMatches: false, blockers };
  }

  if (input.snapshot.code === "ENVIRONMENT_MISMATCH") {
    blockers.push(blocker("ENVIRONMENT_MISMATCH", input.snapshot.message));
    return { identityStatus: "ENVIRONMENT_MISMATCH", environmentMatches: false, blockers };
  }

  if (!input.snapshot.accountId) {
    blockers.push(
      blocker(
        "ACCOUNT_IDENTITY_UNVERIFIED",
        input.snapshot.message || "Account identity is not available from ForexConnect.",
      ),
    );
    return { identityStatus: "ACCOUNT_IDENTITY_UNVERIFIED", environmentMatches: true, blockers };
  }

  if (input.expectedAccountId && input.expectedAccountId !== input.snapshot.accountId) {
    blockers.push(
      blocker(
        "ACCOUNT_IDENTITY_UNVERIFIED",
        "Connected account identity does not match the previously verified binding.",
      ),
    );
    return { identityStatus: "ACCOUNT_IDENTITY_UNVERIFIED", environmentMatches: true, blockers };
  }

  if (!input.snapshot.isFresh || input.snapshot.code === "STALE") {
    blockers.push(blocker("ACCOUNT_DATA_STALE", "Account metadata is stale — refresh verification."));
    return { identityStatus: "ACCOUNT_DATA_STALE", environmentMatches: true, blockers };
  }

  return { identityStatus: "ACCOUNT_VERIFIED", environmentMatches: true, blockers };
}

export function mapAccountMetadata(snapshot: ForexAccountSnapshot): VerifiedAccountMetadataPublic {
  const balanceParsed = parseOptionalFinite(snapshot.balance);
  const equityParsed = parseOptionalFinite(snapshot.equity);
  const usedParsed = parseOptionalFinite(snapshot.usedMargin);
  const usableParsed = parseOptionalFinite(snapshot.usableMargin);

  let equity = equityParsed.present && !equityParsed.invalid ? equityParsed.value : null;
  let equityDerived = false;
  let equityDerivation: string | null = null;

  // Derive equity only when provider equity is missing but balance + margins are finite.
  if (
    equity == null
    && balanceParsed.present
    && !balanceParsed.invalid
    && balanceParsed.value != null
    && usedParsed.present
    && !usedParsed.invalid
    && usedParsed.value != null
    && usableParsed.present
    && !usableParsed.invalid
    && usableParsed.value != null
  ) {
    // FXCM-style: usable ≈ equity - used; rearrange → equity ≈ used + usable.
    // Prefer used+usable when both present (provider-consistent margin pair).
    equity = usedParsed.value + usableParsed.value;
    equityDerived = true;
    equityDerivation = "equity = usedMargin + usableMargin (provider equity unavailable)";
  }

  const currencyOk = Boolean(snapshot.accountCurrency && String(snapshot.accountCurrency).trim());
  const fields = {
    accountCurrency: currencyOk,
    balance: balanceParsed.present && !balanceParsed.invalid,
    equity: equity != null,
    usedMargin: usedParsed.present && !usedParsed.invalid,
    usableMargin: usableParsed.present && !usableParsed.invalid,
  };

  const missingFields = [...snapshot.missingFields];
  if (balanceParsed.invalid && !missingFields.includes("balance_invalid")) {
    missingFields.push("balance_invalid");
  }
  if (equityParsed.invalid && !missingFields.includes("equity_invalid")) {
    missingFields.push("equity_invalid");
  }

  return {
    accountIdMasked: snapshot.accountIdMasked ?? maskAccountId(snapshot.accountId),
    environment: uiEnvFromFc(snapshot.environmentLabel ?? snapshot.environment),
    accountCurrency: currencyOk ? String(snapshot.accountCurrency).toUpperCase() : null,
    balance: fields.balance ? balanceParsed.value : null,
    equity,
    equityDerived,
    equityDerivation,
    usedMargin: fields.usedMargin ? usedParsed.value : null,
    usableMargin: fields.usableMargin ? usableParsed.value : null,
    fetchedAtUtc: snapshot.fetchedAt,
    ageMs: snapshot.ageMs,
    isFresh: snapshot.isFresh,
    fields,
    missingFields,
    snapshotCode: snapshot.code,
  };
}

export function findInstrument(
  instruments: ForexConnectInstrument[],
  symbol: string,
): ForexConnectInstrument | null {
  const raw = symbol.trim();
  const compact = raw.replace(/[/_-]/g, "").toUpperCase();
  return (
    instruments.find((i) => i.providerSymbol === raw || i.canonicalSymbol === raw || i.displaySymbol === raw)
    ?? instruments.find(
      (i) =>
        i.providerSymbol.replace(/[/_-]/g, "").toUpperCase() === compact
        || i.canonicalSymbol.replace(/[/_-]/g, "").toUpperCase() === compact,
    )
    ?? null
  );
}

export function verifyInstrumentMetadata(
  symbol: string | null | undefined,
  instruments: ForexConnectInstrument[],
): { instrument: VerifiedInstrumentPublic; blockers: VerificationBlocker[] } {
  const blockers: VerificationBlocker[] = [];
  if (!symbol || !String(symbol).trim()) {
    blockers.push(blocker("INSTRUMENT_NOT_SELECTED", "Select a ForexConnect instrument."));
    return { instrument: emptyInstrument(null), blockers };
  }
  const hit = findInstrument(instruments, symbol);
  if (!hit) {
    blockers.push(
      blocker("INSTRUMENT_NOT_SUPPORTED", `Instrument "${symbol}" is not in the ForexConnect catalog.`),
    );
    return { instrument: emptyInstrument(symbol), blockers };
  }

  const metadata: Record<string, unknown> = {
    pointSize: hit.pointSize,
    pipCost: hit.pipCost,
    baseUnitSize: hit.baseUnitSize,
    contractMultiplier: hit.contractMultiplier,
    quantityStep: hit.lotStep,
    lotStep: hit.lotStep,
    marginPerLotAccount: hit.mmrPerLot,
    mmrPerLot: hit.mmrPerLot,
    quoteCurrency: hit.quoteAsset,
    contractCurrency: hit.contractCurrency,
    instrumentTypeLabel: hit.instrumentTypeLabel,
    condDistStop: hit.condDistStop,
    condDistAvailable: hit.condDistAvailable,
    condDistUnit: hit.condDistUnit,
  };
  const spec = contractSpecFromForexConnectMetadata({
    instrumentId: hit.providerSymbol,
    metadata,
    quoteCurrency: hit.quoteAsset,
    contractCurrency: hit.contractCurrency,
    instrumentTypeLabel: hit.instrumentTypeLabel ?? null,
    observedAt: new Date().toISOString(),
  });

  let level: InstrumentVerificationLevel = "RECOGNIZED";
  if (spec.verified) {
    level = "ELIGIBLE_FOR_FUTURE_RISK";
  } else {
    level = "METADATA_PARTIAL";
    blockers.push(
      blocker(
        "CONTRACT_METADATA_MISSING",
        spec.unavailableReason ?? "Contract metadata incomplete for future risk calculation.",
      ),
    );
  }

  if (spec.quantityStep == null || spec.quantityMin == null) {
    blockers.push(blocker("QUANTITY_RULES_UNVERIFIED", "Quantity min/step are not verified."));
    if (level === "ELIGIBLE_FOR_FUTURE_RISK") level = "METADATA_PARTIAL";
  }
  if (spec.marginRate == null && spec.marginPerLotAccount == null) {
    blockers.push(
      blocker("MARGIN_METADATA_UNVERIFIED", "Margin requirement is not verified from provider metadata."),
    );
    // Margin gap alone does not revoke ELIGIBLE when sizing fields verified — recorded as soft blocker.
  }

  return {
    instrument: {
      symbol: hit.providerSymbol,
      displaySymbol: hit.displaySymbol || hit.providerSymbol,
      provider: "FOREXCONNECT",
      recognized: true,
      level,
      instrumentType: hit.instrumentTypeLabel ?? (hit.instrumentType != null ? String(hit.instrumentType) : null),
      baseAsset: hit.baseAsset,
      quoteAsset: hit.quoteAsset,
      pointSize: spec.pointSize,
      pipCostAccount: spec.pipCostAccount,
      contractMultiplier: spec.contractMultiplier,
      baseUnitSize: spec.baseUnitSize,
      quantityMin: spec.quantityMin,
      quantityStep: spec.quantityStep,
      quantityUnit: spec.quantityUnit,
      marginRate: spec.marginRate,
      marginPerLotAccount: spec.marginPerLotAccount,
      contractVerified: spec.verified,
      contractSource: spec.source,
      unavailableReason: spec.unavailableReason,
      condDistStop:
        typeof hit.condDistStop === "number" && Number.isFinite(hit.condDistStop)
          ? hit.condDistStop
          : null,
      condDistAvailable: Boolean(hit.condDistAvailable),
      condDistUnit: hit.condDistUnit ?? null,
    },
    blockers,
  };
}

export function mapMarketFeedStatus(
  streamState: ForexConnectLiveStreamState | string | null | undefined,
): VerificationMarketFeedStatus {
  const s = String(streamState ?? "").toUpperCase();
  if (s === "LIVE") return "LIVE";
  if (s === "SUBSCRIBING") return "SUBSCRIBING";
  if (s === "NO_RECENT_MARKET_UPDATES") return "NO_RECENT_MARKET_UPDATES";
  if (s === "STALE") return "STALE";
  if (s === "DISCONNECTED" || s === "DISABLED") return "DISCONNECTED";
  if (s === "MARKET_INACTIVE") return "MARKET_INACTIVE";
  if (s === "ERROR" || s === "SERVICE_UNAVAILABLE") return "ERROR";
  if (s === "NOT_CONFIGURED") return "NOT_CONFIGURED";
  if (s === "SUBSCRIBED_WAITING" || s === "AUTHENTICATED_IDLE") return "SUBSCRIBING";
  return "UNKNOWN_SESSION";
}

export function buildMarketFromQuote(input: {
  bid: unknown;
  ask: unknown;
  streamState: ForexConnectLiveStreamState | string | null;
  sourceTimestampMs?: number | null;
  receivedAtMs?: number | null;
  priceChangeAgeMs?: number | null;
  receiptAgeMs?: number | null;
  updateCount?: number;
  nowMs?: number;
}): { market: VerifiedMarketQuotePublic; blockers: VerificationBlocker[] } {
  const blockers: VerificationBlocker[] = [];
  const feed = mapMarketFeedStatus(input.streamState);
  const quotes = validateBidAsk(input.bid, input.ask);

  let feedStatus = feed;
  if (!quotes.ok && feedStatus === "LIVE") {
    feedStatus = "ERROR";
    blockers.push(blocker("INVALID_QUOTE", quotes.reason ?? "Invalid Bid/Ask."));
  } else if (!quotes.ok && feedStatus !== "NOT_CONFIGURED" && feedStatus !== "DISCONNECTED") {
    blockers.push(blocker("INVALID_QUOTE", quotes.reason ?? "Bid/Ask unavailable."));
  }

  if (feedStatus === "STALE") {
    blockers.push(blocker("STALE_QUOTE", "Market quote is stale."));
  }
  if (feedStatus === "ERROR" || feedStatus === "DISCONNECTED") {
    blockers.push(blocker("MARKET_FEED_UNAVAILABLE", `Market feed status: ${feedStatus}.`));
  }

  // Honest LIVE gate: recent genuine price change required (reuse FC helper).
  const recomputed = resolveFcFeedStreamState({
    priceChangeAgeMs: input.priceChangeAgeMs ?? null,
    receiptAgeMs: input.receiptAgeMs ?? null,
    updateCount: input.updateCount ?? 0,
    staleMs: MARKET_QUOTE_STALE_MS,
  });
  if (feedStatus === "LIVE" && recomputed !== "LIVE") {
    feedStatus = mapMarketFeedStatus(recomputed);
    if (feedStatus === "NO_RECENT_MARKET_UPDATES") {
      blockers.push(
        blocker("STALE_QUOTE", "Receipts without recent Bid/Ask changes are not labelled LIVE."),
      );
    }
  }

  const marketSession: VerifiedMarketQuotePublic["marketSession"] =
    feedStatus === "MARKET_INACTIVE"
      ? "INACTIVE"
      : feedStatus === "LIVE" || feedStatus === "NO_RECENT_MARKET_UPDATES"
        ? "ACTIVE"
        : "UNKNOWN";

  return {
    market: {
      bid: quotes.bid,
      ask: quotes.ask,
      spread: quotes.spread,
      feedStatus,
      sourceTimestampMs: input.sourceTimestampMs ?? null,
      receivedAtMs: input.receivedAtMs ?? null,
      priceChangeAgeMs: input.priceChangeAgeMs ?? null,
      receiptAgeMs: input.receiptAgeMs ?? null,
      updateCount: input.updateCount ?? 0,
      marketSession,
    },
    blockers,
  };
}

export function computeReadinessGates(input: {
  identityStatus: VerificationIdentityStatus;
  account: VerifiedAccountMetadataPublic;
  instrument: VerifiedInstrumentPublic;
  market: VerifiedMarketQuotePublic;
}): AutomatedTradingReadinessGates {
  const environmentVerified =
    input.identityStatus === "ACCOUNT_VERIFIED" || input.identityStatus === "ACCOUNT_DATA_STALE";
  const accountIdentityVerified = input.identityStatus === "ACCOUNT_VERIFIED";
  const accountMetadataSufficient =
    accountIdentityVerified
    && input.account.fields.accountCurrency
    && (input.account.fields.balance || input.account.fields.equity)
    && input.account.isFresh;
  const instrumentMetadataVerified = input.instrument.level === "ELIGIBLE_FOR_FUTURE_RISK";
  const marketDataHealthVerified =
    input.market.feedStatus === "LIVE"
    && input.market.bid != null
    && input.market.ask != null;
  const readyForFutureAnalysis =
    environmentVerified
    && accountIdentityVerified
    && accountMetadataSufficient
    && instrumentMetadataVerified
    && marketDataHealthVerified;

  return {
    environmentVerified: environmentVerified && input.identityStatus !== "ENVIRONMENT_MISMATCH",
    accountIdentityVerified,
    accountMetadataSufficient,
    instrumentMetadataVerified,
    marketDataHealthVerified,
    riskEngineVerified: false,
    executionImplemented: false,
    readyForFutureAnalysis,
    readyForTrading: false,
  };
}

export function assembleVerificationResult(input: {
  selected: AutomatedTradingEnvironment;
  environmentEpoch: number;
  credentialsConfigured: boolean;
  connectionStatus: string;
  sessionEnv: AutomatedTradingEnvironment | null;
  accountsResult: ForexConnectAccountsResult;
  selectedAccountId?: string | null;
  expectedAccountId?: string | null;
  instrumentSymbol?: string | null;
  instruments: ForexConnectInstrument[];
  marketInput?: Parameters<typeof buildMarketFromQuote>[0] | null;
  nowMs?: number;
}): AutomatedTradingVerificationResult {
  const nowMs = input.nowMs ?? Date.now();
  const snapshot = buildAccountSnapshotFromAccountsResult({
    result: input.accountsResult,
    selectedAccountId: input.selectedAccountId ?? input.expectedAccountId ?? null,
    expectedEnvironment: sdkEnv(input.selected),
    maxAgeMs: ACCOUNT_SNAPSHOT_MAX_AGE_MS,
    nowMs,
  });

  const identity = mapIdentityFromSnapshot({
    credentialsConfigured: input.credentialsConfigured,
    connectionStatus: input.connectionStatus,
    selected: input.selected,
    sessionEnv: input.sessionEnv,
    snapshot,
    expectedAccountId: input.expectedAccountId,
  });

  const account =
    snapshot.accountId || snapshot.code === "OK" || snapshot.code === "INCOMPLETE" || snapshot.code === "STALE"
      ? mapAccountMetadata(snapshot)
      : emptyAccountMetadata();

  if (identity.identityStatus === "ACCOUNT_VERIFIED" || identity.identityStatus === "ACCOUNT_DATA_STALE") {
    if (!account.fields.accountCurrency) {
      identity.blockers.push(blocker("ACCOUNT_CURRENCY_MISSING", "Account currency is unavailable."));
    }
    if (!account.fields.balance && !account.fields.equity) {
      identity.blockers.push(
        blocker("ACCOUNT_BALANCE_MISSING", "Account balance and equity are both unavailable (zero is allowed when present)."),
      );
    }
    if (account.missingFields.some((f) => f.endsWith("_invalid"))) {
      identity.blockers.push(blocker("ACCOUNT_VALUES_INVALID", "Account numeric fields contain non-finite values."));
    }
  }

  const inst = verifyInstrumentMetadata(input.instrumentSymbol, input.instruments);
  const marketPart = input.marketInput
    ? buildMarketFromQuote(input.marketInput)
    : {
        market: emptyMarket(),
        blockers: input.instrumentSymbol
          ? [blocker("MARKET_FEED_UNAVAILABLE", "Market feed not subscribed for the selected instrument.")]
          : [],
      };

  const blockers = [
    ...identity.blockers,
    ...inst.blockers,
    ...marketPart.blockers,
    blocker("RISK_ENGINE_NOT_IMPLEMENTED", "Future risk engine is not verified in Phase 52."),
    blocker("EXECUTION_NOT_IMPLEMENTED", "Automated execution is not implemented in Phase 52."),
  ];

  // Deduplicate by code+message
  const seen = new Set<string>();
  const uniqueBlockers = blockers.filter((b) => {
    const k = `${b.code}:${b.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const readiness = computeReadinessGates({
    identityStatus: identity.identityStatus,
    account,
    instrument: inst.instrument,
    market: marketPart.market,
  });

  return {
    identityStatus: identity.identityStatus,
    environmentSelected: input.selected,
    environmentConnected: input.sessionEnv,
    environmentMatches: identity.environmentMatches,
    connectionStatus: input.connectionStatus,
    environmentEpoch: input.environmentEpoch,
    account,
    instrument: inst.instrument,
    market: marketPart.market,
    readiness,
    blockers: uniqueBlockers,
    verifiedAtUtc: new Date(nowMs).toISOString(),
    placesOrders: false,
  };
}

export { uiEnvFromFc, sdkEnv };
