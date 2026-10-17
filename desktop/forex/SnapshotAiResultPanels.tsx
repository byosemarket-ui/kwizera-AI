/**
 * Phase 44/46/50A.1 — Guided Local/OpenAI result + trade-plan + FXCM ticket panels.
 */
import { ForexStatusBadge } from "./components/ForexStatusBadge";
import {
  BuyPriceProjectionPanel,
  type BuyPriceProjectionUi,
} from "./capture-library/BuyPriceProjectionPanel";

export type SnapshotPlanUi = {
  planId: string;
  planKind: string;
  intent: string;
  lifecycle: string;
  lifecycleNote: string;
  marketDirection: string;
  entryZone: {
    lower: number | null;
    upper: number | null;
    reference: number | null;
    rationale: string;
    unavailableReason: string | null;
  };
  confirmationRequired: string[];
  confirmationStatus: string;
  stopLoss: { price: number | null; rationale: string; unavailableReason: string | null };
  takeProfit: { prices: number[]; rationale: string; unavailableReason: string | null };
  invalidationConditions: string[];
  expiryConditions: string[];
  riskReward: {
    ratio: number | null;
    risk: number | null;
    reward: number | null;
    unavailableReason: string | null;
  };
  dataQualityLimitations: string[];
  unsuitableReasons: string[];
  spreadNote: string | null;
  positionRisk?: {
    riskEligible: boolean;
    blockingReasons: string[];
    calculationMode: string;
    positionSize: number | null;
    positionSizeUnit: string;
    maxPermissibleSize: number | null;
    netLossAccount: number | null;
    netProfitAccount: number | null;
    rewardRiskRatio: number | null;
    minRewardRiskRatio: number;
    accountCurrency: string | null;
    excessRiskAccount: number | null;
    margin?: { estimatedMarginAccount: number | null; unavailableReason: string | null };
    contract?: { convention: string; verified: boolean; unavailableReason: string | null };
    tradeAllocationAmount?: number | null;
    tradeAllocationCurrency?: string | null;
    notes?: string[];
  } | null;
};

export type SnapshotPlanBundleUi = {
  marketDirection: string;
  directionExplanation: string;
  directionMeaning: string;
  confidenceDisplay: string;
  structureEvidence: {
    trendState: string | null;
    lastSwingHigh: number | null;
    lastSwingLow: number | null;
    events: Array<{ type: string; direction: string; status: string; level: number | null }>;
    zones: Array<{ side: string; low: number; high: number; status: string }>;
    patterns: Array<{
      name: string;
      direction: string;
      status: string;
      candleEndTime?: number | null;
      completedAt?: string | null;
      timeframe?: string | null;
    }>;
    warnings: string[];
    quoteFreshness: string | null;
    dataUsable: boolean;
  };
  pullback: SnapshotPlanUi;
  breakout: SnapshotPlanUi;
};

/** Phase 46 guided response (UI mirror — validated on server). */
export type GuidedAnalysisUi = {
  schemaVersion: string;
  provider: string | null;
  model: string | null;
  marketSummary: {
    instrument: string | null;
    provider: string | null;
    snapshotId: string | null;
    dataQuality: string | null;
    marketCondition: string | null;
    conditionMeaning: string | null;
    conditionExplanation: string | null;
    decision: string | null;
    decisionRationale: string | null;
    confidenceDisplay: string | null;
  };
  evidence: {
    observedFacts: string[];
    supportingEvidence: string[];
    contradictingEvidence: string[];
    confirmationRequired: string[];
    invalidationConditions: string[];
    dataLimitations: string[];
    structureNotes: string[];
  };
  orderTicketByPlan: Array<{
    schemaVersion: string;
    planKind: string;
    planId: string;
    readiness: string;
    readinessNote: string;
    fields: Array<{
      fieldId: string;
      label: string;
      proposedValue: string | null;
      support: string;
      why: string;
      verify: string;
      unavailableReason: string | null;
    }>;
    disclaimer: string;
  }>;
  finalDecision: {
    summary: string;
    nextAction: string;
    primaryInvalidation: string | null;
    keyFinancialRisk: string | null;
  };
  tradeAllocation: {
    amount: number | null;
    currency: string | null;
    note: string;
  } | null;
};

/** Phase 46B — nine numbered OpenAI assistant items (server-built). */
export type OpenAiAssistantGuidanceUi = {
  schemaVersion: string;
  planKind: string;
  planId: string;
  readiness: string;
  readinessNote: string;
  items: Array<{
    number: number;
    tone: string;
    title: string;
    value: string;
    ticketField: string;
    support: string;
    why: string;
    verify: string;
    unavailableReason: string | null;
  }>;
  finalSummary: {
    directionOrWait: string;
    confirmationStatus: string;
    riskEligible: boolean | null;
    reason: string;
    verifyNext: string;
    tone: string;
  };
  disclaimer: string;
};

export type SnapshotAnalysisPanelData = {
  analysisId: string;
  snapshotId: string;
  contentFingerprint: string;
  decision: string;
  decisionRationale: string;
  marketBias: string;
  marketStructureSummary: string;
  keyEvidence: string[];
  bullishScenario: string;
  bearishScenario: string;
  invalidationConditions: string[];
  confidence: string | null;
  limitations: string[];
  dataQuality: string;
  status: string;
  model: string | null;
  inferenceLatencyMs: number | null;
  warnings: string[];
  newsResearchStatus?: string;
  analysisProvider?: string;
  planBundle?: SnapshotPlanBundleUi | null;
  guidedResponse?: GuidedAnalysisUi | null;
  assistantGuidance?: OpenAiAssistantGuidanceUi | null;
  /** Phase 49C/50A — multi-image MTF + BUY assessment when present. */
  multiImage?: {
    captureIds: string[];
    imageCount: number;
    selectionFingerprint?: string;
    buyAssessment?: {
      directionalConfidencePercent: number | null;
      directionalConfidenceLabel: string;
      scoreMethod: string;
      supportsBuy: boolean;
      buyBlockedReason: string | null;
      entryReadiness: string;
      modelDecisionBeforePolicy?: string;
      finalDecision?: string;
      imagesSubmittedAsImageUrl?: boolean;
    };
    directionalClassification?: {
      direction: "BUY" | "SELL";
      directionalConfidencePercent: number;
      directionalConfidenceLabel: string;
      scoreMethod: string;
      bullishScore: number;
      bearishScore: number;
      margin: number;
      confidenceBand: "LOW" | "MODERATE" | "HIGH";
      supportingEvidence: string[];
      contradictingEvidence: string[];
      tieBreakNote: string | null;
      lowConfidenceNote: string | null;
      entryReadiness: string;
      imagesSubmittedAsImageUrl?: boolean;
      modelDecisionBeforePolicy?: string;
      finalDecision?: string;
    };
    priceProjection?: BuyPriceProjectionUi;
    mtfReasoning?: {
      timeframeAgreement: string;
      higherTimeframeContext: string | null;
      intermediateStructure: string | null;
      lowerTimeframeSetup: string | null;
      agreementSummary: string | null;
      conflictSummary: string | null;
      bullishScenario: string | null;
      bearishScenario: string | null;
      keyLevels: Array<{
        level: string;
        provenance: string;
        captureId: string | null;
        timeframe: string | null;
      }>;
      confirmationConditions: string[];
      invalidationConditions: string[];
      missingEvidence: string[];
      roster: {
        distinctTimeframes: string[];
        sameTimeframeDuplicates: boolean;
        captureSpanMs: number | null;
        note: string;
        roles: Array<{
          timeframe: string;
          role: string;
          imageCount: number;
          captureIds: string[];
          note: string | null;
        }>;
      };
    };
    provenance?: {
      captureTime?: { note?: string };
      analysisTime?: {
        snapshotId?: string | null;
        feedHealth?: string | null;
        quoteFreshness?: string | null;
        observedAtUtc?: string | null;
        note?: string;
      };
    };
  };
};

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtMoney(n: number | null | undefined, ccy: string | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "unavailable";
  return `${n.toFixed(2)}${ccy ? ` ${ccy}` : ""}`;
}

function lifecycleTone(life: string): "live" | "future" | "offline" {
  if (life === "SETUP_CONFIRMED") return "live";
  if (life === "WAIT_CONFLICT" || life === "INVALIDATED" || life === "EXPIRED") return "offline";
  return "future";
}

function readinessTone(r: string): "live" | "future" | "offline" {
  if (r === "READY_FOR_REVIEW") return "live";
  if (r === "UNSUITABLE" || r === "BLOCKED") return "offline";
  return "future";
}

function PlanCard({ plan, collapsedDefault = true }: { plan: SnapshotPlanUi; collapsedDefault?: boolean }) {
  const risk = plan.positionRisk;
  return (
    <details className="fx-ai-plan-card" data-plan-kind={plan.planKind} open={!collapsedDefault}>
      <summary className="fx-ai-plan-summary">
        <span className="fx-ai-plan-title">{plan.planKind} · {plan.intent}</span>
        <ForexStatusBadge tone={lifecycleTone(plan.lifecycle)}>{plan.lifecycle}</ForexStatusBadge>
        <span className="fx-ai-muted fx-ai-plan-confirm">{plan.confirmationStatus}</span>
      </summary>
      <div className="fx-ai-plan-body">
        <p className="fx-ai-muted">{plan.lifecycleNote}</p>
        <div className="fx-ai-plan-grid">
          <div>
            <span className="fx-ai-label">Entry zone</span>
            <p>
              {plan.entryZone.unavailableReason
                ? plan.entryZone.unavailableReason
                : `${fmtPrice(plan.entryZone.lower)} – ${fmtPrice(plan.entryZone.upper)}`
                  + (plan.entryZone.reference != null ? ` (ref ${fmtPrice(plan.entryZone.reference)})` : "")}
            </p>
            {plan.entryZone.rationale ? <p className="fx-ai-muted">{plan.entryZone.rationale}</p> : null}
          </div>
          <div>
            <span className="fx-ai-label">Stop loss</span>
            <p>
              {plan.stopLoss.unavailableReason
                ? plan.stopLoss.unavailableReason
                : fmtPrice(plan.stopLoss.price)}
            </p>
            {plan.stopLoss.rationale ? <p className="fx-ai-muted">{plan.stopLoss.rationale}</p> : null}
          </div>
          <div>
            <span className="fx-ai-label">Take profit</span>
            <p>
              {plan.takeProfit.unavailableReason
                ? plan.takeProfit.unavailableReason
                : plan.takeProfit.prices.length
                  ? plan.takeProfit.prices.map(fmtPrice).join(" · ")
                  : "—"}
            </p>
            {plan.takeProfit.rationale ? <p className="fx-ai-muted">{plan.takeProfit.rationale}</p> : null}
          </div>
          <div>
            <span className="fx-ai-label">R:R</span>
            <p>
              {plan.riskReward.unavailableReason
                ? plan.riskReward.unavailableReason
                : plan.riskReward.ratio != null
                  ? plan.riskReward.ratio.toFixed(2)
                  : "unavailable"}
            </p>
          </div>
        </div>
        {plan.confirmationRequired.length ? (
          <p className="fx-ai-muted">
            <span className="fx-ai-label">Confirmation</span> {plan.confirmationRequired.join(" · ")}
          </p>
        ) : null}
        {plan.invalidationConditions[0] ? (
          <p className="fx-ai-muted">
            <span className="fx-ai-label">Invalidation</span> {plan.invalidationConditions.slice(0, 2).join(" · ")}
          </p>
        ) : null}
        {plan.unsuitableReasons[0] ? (
          <p className="fx-ai-snapshot-warn">{plan.unsuitableReasons[0]}</p>
        ) : null}
        {risk ? (
          <div className="fx-ai-plan-risk" data-plan-risk="true">
            <span className="fx-ai-label">Position risk (Phase 45)</span>
            <p>
              {risk.riskEligible ? "RISK_ELIGIBLE" : "RISK_INELIGIBLE"}
              {" · "}
              {risk.calculationMode}
              {risk.positionSize != null
                ? ` · size ${risk.positionSize} ${risk.positionSizeUnit}`
                : " · size unavailable"}
            </p>
            <p className="fx-ai-muted">
              Est. loss {fmtMoney(risk.netLossAccount, risk.accountCurrency)}
              {" · Est. profit "}
              {fmtMoney(risk.netProfitAccount, risk.accountCurrency)}
              {" · R:R "}
              {risk.rewardRiskRatio != null ? risk.rewardRiskRatio.toFixed(2) : "unavailable"}
              {" / min "}
              {risk.minRewardRiskRatio}
            </p>
            {risk.tradeAllocationAmount != null ? (
              <p className="fx-ai-budget-note">
                Allocated capital {risk.tradeAllocationAmount}
                {risk.tradeAllocationCurrency ? ` ${risk.tradeAllocationCurrency}` : ""}
                {" — not an acceptable loss."}
              </p>
            ) : null}
            {risk.blockingReasons[0] ? (
              <p className="fx-ai-snapshot-warn">{risk.blockingReasons[0]}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function RiskSummaryBlock({ bundle }: { bundle: SnapshotPlanBundleUi }) {
  const plans = [bundle.pullback, bundle.breakout];
  return (
    <section className="fx-ai-guided-section fx-ai-risk-summary" aria-label="Financial risk summary">
      <h3 className="fx-ai-guided-title">E. Financial risk summary</h3>
      <p className="fx-ai-budget-note">
        Allocated trade capital is not the risk budget. Maximum loss uses Admin Phase 45 risk settings.
      </p>
      <ul className="fx-ai-local-list">
        {plans.map((p) => {
          const r = p.positionRisk;
          return (
            <li key={p.planId}>
              <strong>{p.planKind}</strong>
              {": "}
              {r
                ? [
                  r.riskEligible ? "eligible" : "ineligible",
                  r.positionSize != null ? `size ${r.positionSize} ${r.positionSizeUnit}` : "size unavailable",
                  `loss ${fmtMoney(r.netLossAccount, r.accountCurrency)}`,
                  `profit ${fmtMoney(r.netProfitAccount, r.accountCurrency)}`,
                  r.margin?.estimatedMarginAccount != null && r.accountCurrency
                    ? `margin ~${r.margin.estimatedMarginAccount.toFixed(2)} ${r.accountCurrency}`
                    : `margin ${r.margin?.unavailableReason ?? "unavailable"}`,
                  !r.contract?.verified && r.contract?.unavailableReason
                    ? `contract: ${r.contract.unavailableReason}`
                    : null,
                ].filter(Boolean).join(" · ")
                : "position risk not attached"}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function OrderTicketBlock({ guided }: { guided: GuidedAnalysisUi }) {
  if (!guided.orderTicketByPlan.length) {
    return (
      <section className="fx-ai-guided-section" aria-label="FXCM order ticket guidance">
        <h3 className="fx-ai-guided-title">D. FXCM order ticket guidance</h3>
        <p className="fx-ai-muted">No plan ticket mapping available for this result.</p>
      </section>
    );
  }
  return (
    <section className="fx-ai-guided-section" aria-label="FXCM order ticket guidance">
      <h3 className="fx-ai-guided-title">D. FXCM order ticket guidance</h3>
      <p className="fx-ai-muted">
        Decision-support only. Does not place, modify, or close FXCM orders.
      </p>
      {guided.orderTicketByPlan.map((ticket) => (
        <div key={ticket.planId} className="fx-ai-ticket-block" data-ticket-plan={ticket.planKind}>
          <div className="fx-ai-ticket-head">
            <strong>{ticket.planKind}</strong>
            <ForexStatusBadge tone={readinessTone(ticket.readiness)}>
              {ticket.readiness}
            </ForexStatusBadge>
            <span className="fx-ai-muted">{ticket.readinessNote}</span>
          </div>
          <ol className="fx-ai-ticket-list">
            {ticket.fields.map((f) => (
              <li key={f.fieldId} className="fx-ai-ticket-field" data-support={f.support}>
                <div className="fx-ai-ticket-field-top">
                  <span className="fx-ai-label">{f.label}</span>
                  <span className="fx-ai-ticket-support">{f.support}</span>
                  <strong>
                    {f.proposedValue ?? (f.unavailableReason ? "unavailable" : "—")}
                  </strong>
                </div>
                <p className="fx-ai-muted">{f.why}</p>
                <p className="fx-ai-muted">Verify: {f.verify}</p>
                {f.unavailableReason ? (
                  <p className="fx-ai-snapshot-warn">{f.unavailableReason}</p>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="fx-ai-muted">{ticket.disclaimer}</p>
        </div>
      ))}
    </section>
  );
}

function OpenAiAssistantResultBody({
  data,
  onRetry,
  retryDisabled,
}: {
  data: SnapshotAnalysisPanelData;
  onRetry: () => void;
  retryDisabled: boolean;
}) {
  const guided = data.guidedResponse ?? null;
  const ms = guided?.marketSummary;
  const guidance = data.assistantGuidance ?? null;
  const instrument = ms?.instrument ?? "—";
  const provider = ms?.provider ?? data.analysisProvider ?? "OPENAI";
  const summaryTone = guidance?.finalSummary.tone ?? "wait";

  return (
    <>
      <header className="fx-ai-asst-header" data-ai-openai-assistant-header="true">
        <h2 className="fx-ai-asst-title">
          OPENAI FOREX ANALYSIS ASSISTANT — {instrument}
        </h2>
        <p className="fx-ai-asst-status">
          <ForexStatusBadge tone={data.status === "completed" ? "live" : "future"}>
            {data.status}
          </ForexStatusBadge>
          <span className="fx-ai-muted">
            {instrument} · {provider}
            {data.model ? ` · model ${data.model}` : ""}
            {" · "}dq {data.dataQuality}
            {data.inferenceLatencyMs != null ? ` · ${data.inferenceLatencyMs} ms` : ""}
          </span>
          <span className="fx-ai-mono" title={data.analysisId}>a {data.analysisId.slice(0, 8)}</span>
          <span className="fx-ai-mono" title={data.snapshotId}>s {data.snapshotId.slice(0, 8)}</span>
        </p>
      </header>

      <section className="fx-ai-asst-context" aria-label="User context summary">
        <p className="fx-ai-asst-user-bubble">
          Analyze {instrument} for FXCM ticket preparation using the prepared snapshot and risk settings.
        </p>
        <ul className="fx-ai-asst-context-list">
          <li>
            <span className="fx-ai-label">Instrument</span> {instrument} ({provider})
          </li>
          <li>
            <span className="fx-ai-label">Trade allocation</span>{" "}
            {guided?.tradeAllocation?.amount != null
              ? `${guided.tradeAllocation.amount} ${guided.tradeAllocation.currency}`
              : "not submitted"}
            {" — capital set aside, not acceptable loss"}
          </li>
          <li>
            <span className="fx-ai-label">Decision</span> {data.decision}
            {" · "}
            <span className="fx-ai-label">Bias</span> {data.marketBias}
            {" · "}
            <span className="fx-ai-label">Data quality</span> {ms?.dataQuality ?? data.dataQuality}
          </li>
          <li data-ai-openai-data-readiness="true">
            <span className="fx-ai-label">Data readiness</span>{" "}
            validation {data.status}
            {" · "}quote/structure from immutable snapshot
            {data.planBundle?.structureEvidence?.quoteFreshness
              ? ` · quote ${data.planBundle.structureEvidence.quoteFreshness}`
              : ""}
            {data.planBundle?.structureEvidence?.dataUsable === false
              ? ` · structure evidence not usable${
                data.planBundle.structureEvidence.warnings?.[0]
                  ? ` (${data.planBundle.structureEvidence.warnings[0]})`
                  : ""
              }`
              : ""}
          </li>
          <li className="fx-ai-muted">
            Snapshot {data.snapshotId.slice(0, 12)}… · fp {data.contentFingerprint.slice(0, 12)}…
            {" · "}OHLC resolution only — not second-by-second ticks unless provided.
          </li>
        </ul>
      </section>

      {data.multiImage?.directionalClassification ? (
        <section
          className="fx-directional-classification"
          data-fx-directional-classification="true"
          data-direction={data.multiImage.directionalClassification.direction}
          aria-label="Directional classification"
        >
          <h3 className="fx-ai-guided-title">Directional classification</h3>
          <p className="fx-directional-headline">
            <span className="fx-ai-label">Direction</span>{" "}
            <strong data-fx-direction-value="true">{data.multiImage.directionalClassification.direction}</strong>
            {" · "}
            <span className="fx-ai-label">{data.multiImage.directionalClassification.directionalConfidenceLabel}</span>{" "}
            {data.multiImage.directionalClassification.directionalConfidencePercent}%
            {" · "}
            <span className="fx-ai-label">Band</span> {data.multiImage.directionalClassification.confidenceBand}
          </p>
          <p className="fx-ai-muted">
            {instrument} · {provider}
            {" · "}method {data.multiImage.directionalClassification.scoreMethod}
            {" · "}bullish {data.multiImage.directionalClassification.bullishScore}
            {" vs "}bearish {data.multiImage.directionalClassification.bearishScore}
            {" · "}margin {data.multiImage.directionalClassification.margin}
          </p>
          <p className="fx-ai-muted">
            Entry readiness {data.multiImage.directionalClassification.entryReadiness}
            {" · "}not a calibrated win probability
            {data.multiImage.directionalClassification.imagesSubmittedAsImageUrl
              ? " · screenshots submitted as image_url inputs"
              : ""}
            {data.multiImage.provenance?.analysisTime?.quoteFreshness
              || data.multiImage.provenance?.analysisTime?.feedHealth
              ? ` · data ${data.multiImage.provenance.analysisTime.feedHealth
                ?? data.multiImage.provenance.analysisTime.quoteFreshness}`
              : ""}
          </p>
          {data.multiImage.directionalClassification.lowConfidenceNote ? (
            <p className="fx-ai-snapshot-warn">{data.multiImage.directionalClassification.lowConfidenceNote}</p>
          ) : null}
          {data.multiImage.directionalClassification.tieBreakNote ? (
            <p className="fx-ai-muted">{data.multiImage.directionalClassification.tieBreakNote}</p>
          ) : null}
          {data.multiImage.directionalClassification.supportingEvidence.length > 0 ? (
            <div>
              <p className="fx-ai-label">Supporting evidence</p>
              <ul className="fx-ai-local-list">
                {data.multiImage.directionalClassification.supportingEvidence.map((e, i) => (
                  <li key={`sup-${i}`}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.multiImage.directionalClassification.contradictingEvidence.length > 0 ? (
            <div>
              <p className="fx-ai-label">Contradictory evidence</p>
              <ul className="fx-ai-local-list">
                {data.multiImage.directionalClassification.contradictingEvidence.map((e, i) => (
                  <li key={`con-${i}`}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="fx-ai-muted">
            Directional lean only — FXCM ticket guidance, position sizing, and risk checks remain separate eligibility gates.
          </p>
        </section>
      ) : data.multiImage?.buyAssessment ? (
        <section className="fx-buy-assessment" data-fx-buy-assessment="true" aria-label="BUY directional assessment">
          <h3 className="fx-ai-guided-title">BUY directional assessment</h3>
          <p>
            <span className="fx-ai-label">Decision</span> {data.decision}
            {" · "}
            <span className="fx-ai-label">{data.multiImage.buyAssessment.directionalConfidenceLabel}</span>{" "}
            {data.multiImage.buyAssessment.directionalConfidencePercent != null
              ? `${data.multiImage.buyAssessment.directionalConfidencePercent}%`
              : "unavailable"}
          </p>
          <p className="fx-ai-muted">
            Method {data.multiImage.buyAssessment.scoreMethod}
            {" · "}entry readiness {data.multiImage.buyAssessment.entryReadiness}
            {" · "}not a calibrated win probability
            {data.multiImage.buyAssessment.imagesSubmittedAsImageUrl
              ? " · screenshots submitted as image_url inputs"
              : ""}
          </p>
          {data.multiImage.buyAssessment.buyBlockedReason ? (
            <p className="fx-ai-snapshot-warn">{data.multiImage.buyAssessment.buyBlockedReason}</p>
          ) : null}
        </section>
      ) : null}

      {data.multiImage?.priceProjection ? (
        <BuyPriceProjectionPanel projection={data.multiImage.priceProjection} />
      ) : null}

      {data.multiImage?.mtfReasoning ? (
        <section className="fx-mtf-reasoning" data-fx-mtf-reasoning="true" aria-label="Multi-timeframe reasoning">
          <h3 className="fx-ai-guided-title">Multi-timeframe reasoning</h3>
          <p className="fx-ai-muted">
            Agreement <strong>{data.multiImage.mtfReasoning.timeframeAgreement}</strong>
            {" · "}
            TFs {data.multiImage.mtfReasoning.roster.distinctTimeframes.join(", ") || "—"}
            {" · "}
            {data.multiImage.imageCount} image(s)
          </p>
          <p className="fx-ai-muted">{data.multiImage.mtfReasoning.roster.note}</p>
          <dl className="fx-capture-meta-grid fx-mtf-roles">
            {data.multiImage.mtfReasoning.roster.roles.map((r) => (
              <div key={`${r.role}-${r.timeframe}`}>
                <dt>{r.role} · {r.timeframe}</dt>
                <dd>{r.imageCount} img · {r.captureIds.map((id) => id.slice(0, 8)).join(", ")}</dd>
              </div>
            ))}
          </dl>
          {data.multiImage.mtfReasoning.higherTimeframeContext ? (
            <p><span className="fx-ai-label">Higher TF</span> {data.multiImage.mtfReasoning.higherTimeframeContext}</p>
          ) : null}
          {data.multiImage.mtfReasoning.intermediateStructure ? (
            <p><span className="fx-ai-label">Intermediate</span> {data.multiImage.mtfReasoning.intermediateStructure}</p>
          ) : null}
          {data.multiImage.mtfReasoning.lowerTimeframeSetup ? (
            <p><span className="fx-ai-label">Lower TF</span> {data.multiImage.mtfReasoning.lowerTimeframeSetup}</p>
          ) : null}
          {data.multiImage.mtfReasoning.agreementSummary ? (
            <p><span className="fx-ai-label">Agreement</span> {data.multiImage.mtfReasoning.agreementSummary}</p>
          ) : null}
          {data.multiImage.mtfReasoning.conflictSummary ? (
            <p className="fx-ai-snapshot-warn"><span className="fx-ai-label">Conflict</span> {data.multiImage.mtfReasoning.conflictSummary}</p>
          ) : null}
          <div className="fx-mtf-scenarios">
            <p><span className="fx-ai-label">Bullish</span> {data.multiImage.mtfReasoning.bullishScenario ?? data.bullishScenario}</p>
            <p><span className="fx-ai-label">Bearish</span> {data.multiImage.mtfReasoning.bearishScenario ?? data.bearishScenario}</p>
          </div>
          {data.multiImage.mtfReasoning.keyLevels.length > 0 ? (
            <ul className="fx-ai-local-list">
              {data.multiImage.mtfReasoning.keyLevels.map((lvl, i) => (
                <li key={`lvl-${i}`}>
                  {lvl.level}
                  {" · "}
                  {lvl.provenance}
                  {lvl.timeframe ? ` · ${lvl.timeframe}` : ""}
                  {lvl.captureId ? ` · ${lvl.captureId.slice(0, 8)}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {data.multiImage.mtfReasoning.confirmationConditions[0] ? (
            <p className="fx-ai-muted">
              Confirm: {data.multiImage.mtfReasoning.confirmationConditions.join(" · ")}
            </p>
          ) : null}
          {data.multiImage.mtfReasoning.invalidationConditions[0] ? (
            <p className="fx-ai-muted">
              Invalidate: {data.multiImage.mtfReasoning.invalidationConditions.join(" · ")}
            </p>
          ) : null}
          {data.multiImage.mtfReasoning.missingEvidence[0] ? (
            <p className="fx-ai-snapshot-warn">
              Missing: {data.multiImage.mtfReasoning.missingEvidence.join(" · ")}
            </p>
          ) : null}
          {data.multiImage.provenance?.analysisTime ? (
            <p className="fx-ai-muted">
              ANALYSIS_TIME snapshot {data.multiImage.provenance.analysisTime.snapshotId ?? "none"}
              {" · "}feed {data.multiImage.provenance.analysisTime.feedHealth ?? "—"}
              {" · "}freshness {data.multiImage.provenance.analysisTime.quoteFreshness ?? "—"}
              {data.multiImage.provenance.analysisTime.observedAtUtc
                ? ` · observed ${data.multiImage.provenance.analysisTime.observedAtUtc}`
                : ""}
            </p>
          ) : null}
          <p className="fx-ai-muted">
            Decision {data.decision} · Bias {data.marketBias}. FXCM ticket guidance below remains eligibility-gated.
          </p>
        </section>
      ) : null}

      {guidance ? (
        <ol className="fx-ai-asst-items" data-ai-openai-assistant-items="true" aria-label="FXCM ticket guidance">
          {guidance.items.map((it) => (
            <li
              key={it.number}
              className="fx-ai-asst-item"
              data-asst-tone={it.tone}
              data-asst-support={it.support}
            >
              <div className="fx-ai-asst-item-head">
                <span className="fx-ai-asst-num" aria-hidden="true">{it.number}</span>
                <strong className="fx-ai-asst-item-title">{it.title}</strong>
                <span className="fx-ai-asst-value">{it.value}</span>
              </div>
              <p className="fx-ai-asst-map">
                <span className="fx-ai-label">FXCM field</span> {it.ticketField}
                {" · "}
                <span className="fx-ai-ticket-support">{it.support}</span>
              </p>
              <p className="fx-ai-muted">{it.why}</p>
              <p className="fx-ai-muted">Verify: {it.verify}</p>
              {it.unavailableReason ? (
                <p className="fx-ai-snapshot-warn">{it.unavailableReason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="fx-ai-snapshot-warn">
          Nine-item ticket guidance unavailable for this result (no validated plan bundle).
        </p>
      )}

      {guidance ? (
        <section
          className="fx-ai-asst-final"
          data-asst-final-tone={summaryTone}
          aria-label="Final assistant summary"
        >
          <h3 className="fx-ai-guided-title">Final recommendation</h3>
          <p>
            <span className="fx-ai-label">Direction</span> {guidance.finalSummary.directionOrWait}
            {" · "}
            <span className="fx-ai-label">Confirmation</span> {guidance.finalSummary.confirmationStatus}
            {" · "}
            <span className="fx-ai-label">Risk</span>{" "}
            {guidance.finalSummary.riskEligible == null
              ? "not calculated"
              : guidance.finalSummary.riskEligible
                ? "ELIGIBLE (review only)"
                : "INELIGIBLE"}
          </p>
          <p>{guidance.finalSummary.reason}</p>
          <p className="fx-ai-muted">{guidance.finalSummary.verifyNext}</p>
          <p className="fx-ai-muted">{guidance.disclaimer}</p>
        </section>
      ) : null}

      <details className="fx-ai-evidence-details">
        <summary>Technical evidence (expand)</summary>
        {data.planBundle?.structureEvidence?.patterns?.length ? (
          <div data-ai-pattern-provenance="true">
            <p className="fx-ai-label">Pattern provenance (detector)</p>
            <ul className="fx-ai-local-list">
              {data.planBundle.structureEvidence.patterns.map((p, i) => (
                <li key={`pat-${i}`}>
                  {p.name} {p.direction}/{p.status}
                  {p.timeframe ? ` · tf=${p.timeframe}` : ""}
                  {p.completedAt ? ` · end=${p.completedAt}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {data.planBundle?.structureEvidence?.warnings?.[0] ? (
          <p className="fx-ai-snapshot-warn">{data.planBundle.structureEvidence.warnings[0]}</p>
        ) : null}
        {data.keyEvidence.length ? (
          <ul className="fx-ai-local-list">
            {data.keyEvidence.map((e, i) => <li key={`kev-${i}`}>{e}</li>)}
          </ul>
        ) : (
          <p className="fx-ai-muted">No key evidence listed.</p>
        )}
        {data.decisionRationale ? <p className="fx-ai-muted">{data.decisionRationale}</p> : null}
        {data.limitations[0] ? <p className="fx-ai-snapshot-warn">{data.limitations[0]}</p> : null}
      </details>

      <button type="button" className="fx-text-button" disabled={retryDisabled} onClick={onRetry}>
        Retry OpenAI
      </button>
    </>
  );
}

export function SnapshotProviderResultPanel({
  title,
  busy,
  error,
  data,
  dataAttr,
  onRetry,
  retryDisabled,
}: {
  title: string;
  busy: boolean;
  error: string | null;
  data: SnapshotAnalysisPanelData | null;
  dataAttr: string;
  onRetry: () => void;
  retryDisabled: boolean;
}) {
  const isOpenAiAssistant = dataAttr === "openai";
  const bundle = data?.planBundle ?? null;
  const guided = data?.guidedResponse ?? null;
  const ms = guided?.marketSummary;

  return (
    <div
      className={
        isOpenAiAssistant
          ? "fx-ai-result-card fx-ai-guided fx-ai-asst"
          : "fx-ai-result-card fx-ai-guided"
      }
      data-ai-provider-result={dataAttr}
      data-ai-busy={busy ? "true" : "false"}
      data-forex-ai-phase46="true"
      data-forex-ai-phase46b={isOpenAiAssistant ? "true" : undefined}
    >
      <div className="fx-ai-result-card-head">
        <strong>{title}</strong>
        {data?.model ? <span className="fx-ai-mono">{data.model}</span> : null}
      </div>

      {busy ? (
        <div className="fx-ai-local-pending" role="status">
          <ForexStatusBadge tone="future">RUNNING</ForexStatusBadge>
          <span className="fx-ai-muted">{title} analyzing snapshot…</span>
        </div>
      ) : null}

      {data && isOpenAiAssistant ? (
        <OpenAiAssistantResultBody
          data={data}
          onRetry={onRetry}
          retryDisabled={retryDisabled}
        />
      ) : null}

      {data && !isOpenAiAssistant ? (
        <>
          <div className="fx-ai-local-head">
            <ForexStatusBadge tone={data.decision === "WAIT" || data.decision === "NO_TRADE" ? "future" : "live"}>
              {data.decision}
            </ForexStatusBadge>
            {(ms?.marketCondition || bundle?.marketDirection) ? (
              <ForexStatusBadge tone="future">
                {ms?.marketCondition ?? bundle!.marketDirection}
              </ForexStatusBadge>
            ) : null}
            <span className="fx-ai-muted">
              bias {data.marketBias} · dq {data.dataQuality} · {data.status}
              {data.inferenceLatencyMs != null ? ` · ${data.inferenceLatencyMs} ms` : ""}
            </span>
            <span className="fx-ai-mono" title={data.analysisId}>a {data.analysisId.slice(0, 8)}</span>
            <span className="fx-ai-mono" title={data.snapshotId}>s {data.snapshotId.slice(0, 8)}</span>
          </div>

          <section className="fx-ai-guided-section" aria-label="Market summary">
            <h3 className="fx-ai-guided-title">A. Market summary</h3>
            <p>
              <span className="fx-ai-label">Instrument</span>{" "}
              {ms?.instrument ?? "—"}
              {" · "}
              <span className="fx-ai-label">Provider</span>{" "}
              {ms?.provider ?? data.analysisProvider ?? "—"}
            </p>
            <p>
              <span className="fx-ai-label">Condition</span>{" "}
              {ms?.marketCondition ?? bundle?.marketDirection ?? data.marketBias}
              {ms?.conditionMeaning || bundle?.directionMeaning
                ? ` — ${ms?.conditionMeaning ?? bundle?.directionMeaning}`
                : ""}
            </p>
            <p className="fx-ai-muted">
              {ms?.conditionExplanation
                ?? bundle?.directionExplanation
                ?? data.decisionRationale}
            </p>
            {guided?.tradeAllocation ? (
              <p className="fx-ai-budget-note" data-ai-trade-allocation="true">
                Trade allocation used: {guided.tradeAllocation.amount}{" "}
                {guided.tradeAllocation.currency}. {guided.tradeAllocation.note}
              </p>
            ) : (
              <p className="fx-ai-muted">No trade allocation submitted with this run.</p>
            )}
          </section>

          <details className="fx-ai-guided-section fx-ai-evidence-details" open={false}>
            <summary className="fx-ai-guided-title">B. Evidence and reasoning</summary>
            {guided?.evidence ? (
              <>
                {guided.evidence.observedFacts.length ? (
                  <>
                    <span className="fx-ai-label">Observed facts</span>
                    <ul className="fx-ai-local-list">
                      {guided.evidence.observedFacts.map((e, i) => <li key={`of-${i}`}>{e}</li>)}
                    </ul>
                  </>
                ) : null}
                {guided.evidence.supportingEvidence.length ? (
                  <>
                    <span className="fx-ai-label">Supporting</span>
                    <ul className="fx-ai-local-list">
                      {guided.evidence.supportingEvidence.map((e, i) => <li key={`se-${i}`}>{e}</li>)}
                    </ul>
                  </>
                ) : null}
                {guided.evidence.contradictingEvidence.length ? (
                  <>
                    <span className="fx-ai-label">Contradicting</span>
                    <ul className="fx-ai-local-list">
                      {guided.evidence.contradictingEvidence.map((e, i) => <li key={`ce-${i}`}>{e}</li>)}
                    </ul>
                  </>
                ) : null}
                {guided.evidence.confirmationRequired[0] ? (
                  <p className="fx-ai-muted">
                    <span className="fx-ai-label">Confirmation needed</span>{" "}
                    {guided.evidence.confirmationRequired.join(" · ")}
                  </p>
                ) : null}
                {guided.evidence.dataLimitations[0] ? (
                  <p className="fx-ai-snapshot-warn">{guided.evidence.dataLimitations[0]}</p>
                ) : null}
              </>
            ) : (
              <>
                {data.keyEvidence.length ? (
                  <ul className="fx-ai-local-list">
                    {data.keyEvidence.map((e, i) => <li key={`ev-${i}`}>{e}</li>)}
                  </ul>
                ) : (
                  <p className="fx-ai-muted">No key evidence listed.</p>
                )}
                {data.marketStructureSummary ? (
                  <p className="fx-ai-muted">{data.marketStructureSummary}</p>
                ) : null}
              </>
            )}
          </details>

          <section className="fx-ai-guided-section" aria-label="Trade plan">
            <h3 className="fx-ai-guided-title">C. Trade plan</h3>
            {bundle ? (
              <div className="fx-ai-plans" data-ai-trade-plans="true">
                <PlanCard plan={bundle.pullback} collapsedDefault={false} />
                <PlanCard plan={bundle.breakout} collapsedDefault />
              </div>
            ) : (
              <p className="fx-ai-snapshot-warn">Trade plans unavailable for this result.</p>
            )}
          </section>

          {guided ? <OrderTicketBlock guided={guided} /> : (
            <section className="fx-ai-guided-section" aria-label="FXCM order ticket guidance">
              <h3 className="fx-ai-guided-title">D. FXCM order ticket guidance</h3>
              <p className="fx-ai-muted">Guided ticket mapping unavailable — plans still shown above.</p>
            </section>
          )}

          {bundle ? <RiskSummaryBlock bundle={bundle} /> : null}

          <section className="fx-ai-guided-section fx-ai-final-decision" aria-label="Final decision">
            <h3 className="fx-ai-guided-title">F. Final decision and next action</h3>
            <p>{guided?.finalDecision.summary ?? data.decisionRationale}</p>
            <p>
              <span className="fx-ai-label">Next</span>{" "}
              {guided?.finalDecision.nextAction
                ?? "WAIT — continue monitoring; do not submit a broker order from this panel."}
            </p>
            {guided?.finalDecision.primaryInvalidation || data.invalidationConditions[0] ? (
              <p className="fx-ai-muted">
                <span className="fx-ai-label">Invalidation</span>{" "}
                {guided?.finalDecision.primaryInvalidation ?? data.invalidationConditions[0]}
              </p>
            ) : null}
            {guided?.finalDecision.keyFinancialRisk ? (
              <p className="fx-ai-muted">
                <span className="fx-ai-label">Key financial risk</span>{" "}
                {guided.finalDecision.keyFinancialRisk}
              </p>
            ) : null}
            <p className="fx-ai-muted">
              Analytical decision support only — not a guarantee of direction or profit.
            </p>
          </section>

          <button type="button" className="fx-text-button" disabled={retryDisabled} onClick={onRetry}>
            Retry {title}
          </button>
        </>
      ) : null}

      {error ? (
        <div className="fx-ai-local-error" role="alert">
          <span className="fx-ai-snapshot-warn">{error}</span>
          <button type="button" className="fx-text-button" disabled={retryDisabled} onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
