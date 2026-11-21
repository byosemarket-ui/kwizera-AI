import type { ParsedAnalysisView } from "./parse-hfm-analysis-result";
import { HFM_ANALYTICAL_CONFIDENCE_DISCLAIMER } from "./parse-hfm-analysis-result";

function formatDecision(action: ParsedAnalysisView["action"]): string {
  switch (action) {
    case "BUY": return "BUY";
    case "SELL": return "SELL";
    case "NO_TRADE": return "NO TRADE";
    case "WAITING_FOR_CONFIRMATION": return "WAITING";
    default: return "—";
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
  const confidencePct = view?.confidence != null
    ? Math.max(0, Math.min(100, view.confidence))
    : null;

  return (
    <article className="hap-card hap-decision-panel" data-card="decision" data-mode={mode}>
      <h3>AI Decision</h3>
      <div className="hap-decision" data-action={view?.action ?? "NONE"} data-phase3-result="true">
        {formatDecision(view?.action ?? "NONE")}
      </div>
      <dl className="hap-kv">
        <div>
          <dt>Decision status</dt>
          <dd>{view?.decisionStatus ?? "—"}</dd>
        </div>
        <div>
          <dt>Selected scenario</dt>
          <dd>{view?.selectedScenarioId ?? "None"}</dd>
        </div>
        <div>
          <dt>Market regime</dt>
          <dd>{view?.marketRegime ?? "—"}</dd>
        </div>
      </dl>
      <div className="hap-confidence-label">
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
          data-tone={view?.action === "SELL" ? "sell" : view?.action === "WAITING_FOR_CONFIRMATION" ? "wait" : "buy"}
          style={{ width: `${confidencePct ?? 0}%` }}
        />
      </div>
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
      {view?.supportingEvidenceIds.length ? (
        <p className="hap-empty">Supporting: {view.supportingEvidenceIds.join(", ")}</p>
      ) : null}
      {view?.conflictingEvidenceIds.length ? (
        <p className="hap-empty">Conflicting: {view.conflictingEvidenceIds.join(", ")}</p>
      ) : null}
      {view?.missingConfirmations.length ? (
        <p className="hap-empty">Missing: {view.missingConfirmations.join(", ")}</p>
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
