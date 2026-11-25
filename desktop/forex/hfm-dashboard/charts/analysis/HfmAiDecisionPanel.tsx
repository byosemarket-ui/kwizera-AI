import type { ParsedAnalysisView } from "./parse-hfm-analysis-result";
import {
  HFM_ANALYTICAL_CONFIDENCE_DISCLAIMER,
  HFM_ESTIMATED_PROBABILITY_UNAVAILABLE_LABEL,
  HFM_HISTORICAL_WIN_RATE_SEE_ADMIN,
} from "./parse-hfm-analysis-result";

function formatDecision(action: ParsedAnalysisView["action"]): string {
  switch (action) {
    case "BUY": return "BUY";
    case "SELL": return "SELL";
    case "NO_TRADE": return "NO TRADE";
    case "WAITING_FOR_CONFIRMATION": return "WAITING";
    default: return "—";
  }
}

function formatPreferredBias(bias: ParsedAnalysisView["preferredBias"]): string {
  switch (bias) {
    case "BUY_BIAS": return "BUY BIAS";
    case "SELL_BIAS": return "SELL BIAS";
    case "NO_TRADE": return "NO TRADE";
    default: return "NONE";
  }
}

function agreeLabel(v: boolean | null): string {
  if (v === true) return "Agrees";
  if (v === false) return "Disagrees";
  return "N/A";
}

export function HfmAiDecisionPanel(props: {
  view: ParsedAnalysisView | null;
  mode: "live" | "history";
}) {
  const { view, mode } = props;
  const heroAction = view?.marketDirection ?? (
    view?.action === "BUY" || view?.action === "SELL" ? view.action : null
  );
  const confidencePct = view?.confidence != null
    ? Math.max(0, Math.min(100, view.confidence))
    : null;
  const convictionPct = view?.directionalConviction?.score != null
    ? Math.max(0, Math.min(100, view.directionalConviction.score))
    : null;

  return (
    <article className="hap-card hap-decision-panel" data-card="decision" data-mode={mode}>
      <h3>AI Decision</h3>
      <div
        className="hap-decision"
        data-action={heroAction ?? view?.action ?? "NONE"}
        data-market-direction={heroAction ?? "NONE"}
        data-phase3-result="true"
      >
        {heroAction ? formatDecision(heroAction) : formatDecision(view?.action ?? "NONE")}
      </div>
      <dl className="hap-kv">
        <div data-preferred-bias={view?.preferredBias ?? "NONE"}>
          <dt>Preferred bias</dt>
          <dd>{formatPreferredBias(view?.preferredBias ?? "NONE")}</dd>
        </div>
        <div>
          <dt>Decision status</dt>
          <dd>{view?.decisionStatus ?? "—"}</dd>
        </div>
        <div data-execution-readiness={view?.executionReadiness ?? "NONE"}>
          <dt>Execution readiness</dt>
          <dd>{view?.executionReadiness ?? "EXECUTION_NOT_AUTHORIZED"}</dd>
        </div>
        <div>
          <dt>Selected scenario</dt>
          <dd>{view?.selectedScenarioId ?? "None"}</dd>
        </div>
        <div>
          <dt>Market regime</dt>
          <dd>{view?.marketRegime ?? "—"}</dd>
        </div>
        {view?.rankingReference ? (
          <div>
            <dt>Ranking reference</dt>
            <dd>{view.rankingReference}</dd>
          </div>
        ) : null}
        {view?.overallBias ? (
          <div>
            <dt>Overall bias</dt>
            <dd>{view.overallBias}</dd>
          </div>
        ) : null}
      </dl>
      {convictionPct != null ? (
        <>
          <div className="hap-confidence-label" data-score-kind="directional-conviction">
            <span>Directional conviction</span>
            <strong>
              {convictionPct}/100
              {view?.directionalConviction?.label ? ` · ${view.directionalConviction.label}` : ""}
            </strong>
          </div>
          <p className="hap-confidence-disclaimer" data-conviction-disclaimer="true">
            Analytical directional conviction — not a win probability and not trade authorization.
          </p>
          <div className="hap-confidence-bar" aria-hidden="true">
            <div
              className="hap-confidence-fill"
              data-tone={heroAction === "SELL" ? "sell" : "buy"}
              style={{ width: `${convictionPct}%` }}
            />
          </div>
          <dl className="hap-kv" data-score-kinds="directional-fusion">
            <div>
              <dt>Bullish evidence</dt>
              <dd>{view?.directionalConviction?.bullishEvidenceScore ?? "—"}</dd>
            </div>
            <div>
              <dt>Bearish evidence</dt>
              <dd>{view?.directionalConviction?.bearishEvidenceScore ?? "—"}</dd>
            </div>
            <div>
              <dt>Conflict</dt>
              <dd>
                {view?.directionalConviction?.conflictKind ?? "—"}
                {view?.directionalConviction?.conflictSeverity != null
                  ? ` · severity ${view.directionalConviction.conflictSeverity}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Evidence completeness</dt>
              <dd>
                {view?.directionalConviction?.evidenceCompleteness != null
                  ? view.directionalConviction.evidenceCompleteness
                  : "—"}
                {view?.directionalConviction?.dataQuality != null
                  ? ` · DQ ${view.directionalConviction.dataQuality}`
                  : ""}
              </dd>
            </div>
          </dl>
          {view?.directionalConviction?.supportingEngineIds.length ? (
            <p className="hap-empty">
              Supporting engines: {view.directionalConviction.supportingEngineIds.join(", ")}
            </p>
          ) : null}
          {view?.directionalConviction?.contradictingEngineIds.length ? (
            <p className="hap-empty">
              Contradicting engines: {view.directionalConviction.contradictingEngineIds.join(", ")}
            </p>
          ) : null}
          {view?.directionalConviction?.keyEvidence.length ? (
            <p className="hap-empty">
              Key evidence: {view.directionalConviction.keyEvidence.slice(0, 6).join("; ")}
            </p>
          ) : null}
          {view?.directionalConviction?.knownLimitations.length ? (
            <p className="hap-empty">
              Limitations: {view.directionalConviction.knownLimitations.slice(0, 6).join("; ")}
            </p>
          ) : null}
        </>
      ) : null}
      <div className="hap-confidence-label" data-score-kind="analytical-confidence">
        <span>Analytical confidence</span>
        <strong>
          {confidencePct != null ? `${confidencePct}%` : "Not provided by AI"}
          {view?.confidenceLabel ? ` · ${view.confidenceLabel}` : ""}
        </strong>
      </div>
      <p className="hap-confidence-disclaimer" data-confidence-disclaimer="true">
        {HFM_ANALYTICAL_CONFIDENCE_DISCLAIMER}
      </p>
      <div className="hap-confidence-bar" aria-hidden="true">
        <div
          className="hap-confidence-fill"
          data-tone={heroAction === "SELL" ? "sell" : heroAction === "BUY" ? "buy" : "wait"}
          style={{ width: `${confidencePct ?? 0}%` }}
        />
      </div>
      <dl className="hap-kv" data-score-kinds="phase03">
        <div data-score-kind="estimated-probability">
          <dt>Estimated probability</dt>
          <dd>
            {HFM_ESTIMATED_PROBABILITY_UNAVAILABLE_LABEL}
            {view?.estimatedProbabilityUnavailableReason
              ? ` — ${view.estimatedProbabilityUnavailableReason}`
              : ""}
          </dd>
        </div>
        <div data-score-kind="historical-win-rate">
          <dt>Historical win rate</dt>
          <dd>{HFM_HISTORICAL_WIN_RATE_SEE_ADMIN}</dd>
        </div>
        <div data-score-kind="prediction-linkage">
          <dt>Prediction record</dt>
          <dd>
            {view?.predictionLinkage?.status
              ? `${view.predictionLinkage.status}${
                  view.predictionLinkage.predictionId
                    ? ` · ${view.predictionLinkage.predictionId}`
                    : view.predictionLinkage.reason
                      ? ` · ${view.predictionLinkage.reason}`
                      : ""
                }`
              : "—"}
          </dd>
        </div>
      </dl>
      <p className="hap-insight" data-phase3-summary="true">
        {view?.summary || "Run Analyze Now to generate an insight from live HFM context."}
      </p>
      <div className="hap-disagree" data-disagreement="true">
        <strong>Deterministic ranking</strong>
        <span>
          Ranking: {agreeLabel(view?.disagreement.agreesWithRanking ?? null)}
          {" · "}
          Scenario outcome: {agreeLabel(view?.disagreement.agreesWithScenarioOutcome ?? null)}
        </span>
        {view?.disagreement.disagreementReason ? (
          <p>{view.disagreement.disagreementReason}</p>
        ) : null}
        {view?.disagreement.alternativeEvidenceIds.length ? (
          <p className="hap-empty">
            Alternative evidence: {view.disagreement.alternativeEvidenceIds.join(", ")}
          </p>
        ) : null}
      </div>
      {(view?.bullishAssessment || view?.bearishAssessment) ? (
        <div className="hap-disagree" data-directional-assessments="true">
          <strong>Directional assessments</strong>
          {view?.bullishAssessment ? (
            <p>
              Bullish: {view.bullishAssessment.status}
              {view.bullishAssessment.summary ? ` — ${view.bullishAssessment.summary}` : ""}
            </p>
          ) : null}
          {view?.bearishAssessment ? (
            <p>
              Bearish: {view.bearishAssessment.status}
              {view.bearishAssessment.summary ? ` — ${view.bearishAssessment.summary}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      {view?.supportingEvidenceIds.length ? (
        <p className="hap-empty">Supporting: {view.supportingEvidenceIds.join(", ")}</p>
      ) : null}
      {view?.conflictingEvidenceIds.length ? (
        <p className="hap-empty">Conflicting: {view.conflictingEvidenceIds.join(", ")}</p>
      ) : null}
      {view && (view.blockingReasons.length || view.missingConfirmations.length) ? (
        <div className="hap-disagree" data-blocking-reasons="true">
          <strong>Blocking reasons</strong>
          <p>
            {(view.blockingReasons.length ? view.blockingReasons : view.missingConfirmations).join("; ")}
          </p>
          {(view.executionReadiness === "WAITING_FOR_CONFIRMATION"
            || view.decisionStatus === "WAITING_FOR_CONFIRMATION") ? (
            <p className="hap-empty">
              Direction above is analytical bias only. Required to authorize a setup: closed-candle
              confirmation, source-backed entry, and non-forming tip evidence where rules require it.
              Execution remains unauthorized.
            </p>
          ) : null}
        </div>
      ) : null}
      {view?.invalidationConditions.length ? (
        <p className="hap-empty">Invalidation: {view.invalidationConditions.join(", ")}</p>
      ) : null}
      <div className="hap-empty" data-phase3-completeness="true">
        Completeness: {view?.completeness ?? "—"}
        {view?.inputCompleteness ? ` · Input ${view.inputCompleteness}` : ""}
        {view?.groundingStatus ? ` · Grounding ${view.groundingStatus}` : ""}
        {view?.analysisStatus === "COMPLETED_WITH_GAPS" ? " · AI analysis incomplete" : ""}
      </div>
      {view?.model ? <p className="hap-empty">Model: {view.model}</p> : null}
    </article>
  );
}
