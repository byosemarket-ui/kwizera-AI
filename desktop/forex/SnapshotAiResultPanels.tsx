/**
 * Phase 44 — Compact Local/OpenAI result + trade-plan panels.
 */
import { ForexStatusBadge } from "./components/ForexStatusBadge";

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
    patterns: Array<{ name: string; direction: string; status: string }>;
    warnings: string[];
    quoteFreshness: string | null;
    dataUsable: boolean;
  };
  pullback: SnapshotPlanUi;
  breakout: SnapshotPlanUi;
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
};

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function lifecycleTone(life: string): "live" | "future" | "offline" {
  if (life === "SETUP_CONFIRMED") return "live";
  if (life === "WAIT_CONFLICT" || life === "INVALIDATED" || life === "EXPIRED") return "offline";
  return "future";
}

function PlanCard({ plan, collapsedDefault = true }: { plan: SnapshotPlanUi; collapsedDefault?: boolean }) {
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
                  : "N/A"}
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
        {plan.expiryConditions[0] ? (
          <p className="fx-ai-muted">
            <span className="fx-ai-label">Expiry</span> {plan.expiryConditions[0]}
          </p>
        ) : null}
        {plan.unsuitableReasons[0] ? (
          <p className="fx-ai-snapshot-warn">{plan.unsuitableReasons[0]}</p>
        ) : null}
        {plan.spreadNote ? <p className="fx-ai-muted">{plan.spreadNote}</p> : null}
      </div>
    </details>
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
  const bundle = data?.planBundle ?? null;
  return (
    <div
      className="fx-ai-result-card"
      data-ai-provider-result={dataAttr}
      data-ai-busy={busy ? "true" : "false"}
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

      {data ? (
        <>
          <div className="fx-ai-local-head">
            <ForexStatusBadge tone={data.decision === "WAIT" || data.decision === "NO_TRADE" ? "future" : "live"}>
              {data.decision}
            </ForexStatusBadge>
            {bundle ? (
              <ForexStatusBadge tone="future">{bundle.marketDirection}</ForexStatusBadge>
            ) : null}
            <span className="fx-ai-muted">
              bias {data.marketBias} · dq {data.dataQuality} · {data.status}
              {data.inferenceLatencyMs != null ? ` · ${data.inferenceLatencyMs} ms` : ""}
              {data.newsResearchStatus ? ` · news ${data.newsResearchStatus}` : ""}
            </span>
            <span className="fx-ai-mono" title={data.analysisId}>a {data.analysisId.slice(0, 8)}</span>
            <span className="fx-ai-mono" title={data.snapshotId}>s {data.snapshotId.slice(0, 8)}</span>
            <span className="fx-ai-mono" title={data.contentFingerprint}>fp {data.contentFingerprint.slice(0, 12)}</span>
          </div>

          {bundle ? (
            <div className="fx-ai-direction-block" data-ai-market-direction={bundle.marketDirection}>
              <p className="fx-ai-local-rationale">
                <span className="fx-ai-label">Direction</span> {bundle.marketDirection}
                {" — "}{bundle.directionMeaning}
              </p>
              <p className="fx-ai-muted">{bundle.directionExplanation}</p>
              <p className="fx-ai-muted">
                <span className="fx-ai-label">Confidence</span> {bundle.confidenceDisplay}
              </p>
            </div>
          ) : null}

          <p className="fx-ai-local-rationale">{data.decisionRationale}</p>
          {data.marketStructureSummary ? (
            <p className="fx-ai-muted"><span className="fx-ai-label">Structure</span> {data.marketStructureSummary}</p>
          ) : null}

          {bundle ? (
            <div className="fx-ai-plans" data-ai-trade-plans="true">
              <PlanCard plan={bundle.pullback} collapsedDefault={false} />
              <PlanCard plan={bundle.breakout} collapsedDefault={false} />
            </div>
          ) : (
            <p className="fx-ai-snapshot-warn">Trade plans unavailable for this result.</p>
          )}

          <details className="fx-ai-evidence-details">
            <summary>Evidence &amp; structure details</summary>
            {data.keyEvidence.length ? (
              <ul className="fx-ai-local-list" aria-label="Key evidence">
                {data.keyEvidence.map((e, i) => <li key={`ev-${i}`}>{e}</li>)}
              </ul>
            ) : <p className="fx-ai-muted">No key evidence listed.</p>}
            {bundle?.structureEvidence ? (
              <div className="fx-ai-structure-meta">
                <p className="fx-ai-muted">
                  trend {bundle.structureEvidence.trendState ?? "—"}
                  {" · "}H {fmtPrice(bundle.structureEvidence.lastSwingHigh)}
                  {" · "}L {fmtPrice(bundle.structureEvidence.lastSwingLow)}
                  {" · "}quote {bundle.structureEvidence.quoteFreshness ?? "—"}
                  {" · "}usable {bundle.structureEvidence.dataUsable ? "yes" : "no"}
                </p>
                {bundle.structureEvidence.events.length ? (
                  <ul className="fx-ai-local-list">
                    {bundle.structureEvidence.events.slice(0, 4).map((ev, i) => (
                      <li key={`sev-${i}`}>{ev.type} {ev.direction} {ev.status} @ {fmtPrice(ev.level)}</li>
                    ))}
                  </ul>
                ) : null}
                {bundle.structureEvidence.zones.length ? (
                  <ul className="fx-ai-local-list">
                    {bundle.structureEvidence.zones.slice(0, 3).map((z, i) => (
                      <li key={`z-${i}`}>{z.side} {fmtPrice(z.low)}–{fmtPrice(z.high)} ({z.status})</li>
                    ))}
                  </ul>
                ) : null}
                {bundle.structureEvidence.patterns.length ? (
                  <ul className="fx-ai-local-list">
                    {bundle.structureEvidence.patterns.slice(0, 3).map((p, i) => (
                      <li key={`p-${i}`}>{p.name} {p.direction} {p.status}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {data.invalidationConditions.length ? (
              <p className="fx-ai-muted">
                <span className="fx-ai-label">Invalidation</span> {data.invalidationConditions.join(" · ")}
              </p>
            ) : null}
            {data.limitations[0] ? <p className="fx-ai-snapshot-warn">{data.limitations[0]}</p> : null}
            {data.warnings[0] ? <p className="fx-ai-snapshot-warn">{data.warnings[0]}</p> : null}
          </details>

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
