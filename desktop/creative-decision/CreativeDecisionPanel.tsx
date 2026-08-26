import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { creativeDecisionEngine } from "./decision-engine";
import type { DecisionUiSnapshot, SmartRecommendation } from "./types";
import "./creative-decision.css";

export function CreativeDecisionPanel({ compact = false }: { compact?: boolean }) {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<DecisionUiSnapshot>(() => creativeDecisionEngine.snapshot());

  useEffect(() => {
    creativeDecisionEngine.setNotify(notify);
    creativeDecisionEngine.setEventEmitter((type, payload) => {
      const allowed = new Set([
        "product.updated", "state.shared", "notify.info", "notify.warning",
        "production.progress", "rendering.completed",
      ]);
      const eventType = allowed.has(type) ? type : "state.shared";
      void workspaceIntegrationEngine.emit({
        type: eventType as "product.updated",
        source: "product-analysis",
        targets: ["ai-me", "notifications", "workspace"],
        payload,
        priority: "normal",
      });
    });
    const unsub = creativeDecisionEngine.subscribe(setSnap);
    creativeDecisionEngine.hydrate();
    return () => {
      unsub();
      creativeDecisionEngine.setNotify(null);
      creativeDecisionEngine.setEventEmitter(null);
    };
  }, [notify]);

  const recs = snap.recommendations.filter((r) => r.status !== "IGNORED");
  const plan = snap.activePlan;

  return (
    <div className={`cd ${compact ? "compact" : ""}`}>
      <header className="cd-head">
        <div>
          <span className="cd-kicker">Phase 6 · Step 3</span>
          <h2><Sparkles size={16} /> AI Recommendations & Smart Corrections</h2>
          <p>{snap.recommendation}</p>
        </div>
        <div className="cd-actions">
          <button
            type="button"
            className="cd-primary"
            disabled={snap.analyzing || !snap.available}
            onClick={() => void creativeDecisionEngine.runAnalysis(true)}
          >
            {snap.analyzing ? <LoaderCircle size={14} className="spin" /> : null}
            {snap.analyzing ? "Analyzing…" : "RUN ANALYSIS"}
          </button>
          <button type="button" onClick={() => switchWorkspace("ai-me")}>Open AI Me</button>
        </div>
      </header>

      {!snap.available && (
        <div className="cd-banner">
          <AlertTriangle size={14} />
          {snap.unavailableReason}
        </div>
      )}

      {snap.analysis && (
        <div className="cd-groups">
          <span>MUST FIX · {snap.analysis.mustFix.length}</span>
          <span>SHOULD IMPROVE · {snap.analysis.shouldImprove.length}</span>
          <span>OPTIONAL · {snap.analysis.optional.length}</span>
          <span>Score · {snap.analysis.creativeScoreCurrent ?? "NOT AVAILABLE"} → Expected · {snap.analysis.creativeScoreExpected}</span>
        </div>
      )}

      <div className="cd-list">
        {recs.length === 0 && !snap.analyzing && (
          <p className="cd-muted">No recommendations yet. Run analysis on the current version.</p>
        )}
        {recs.map((r) => (
          <RecommendationCard key={r.recommendationId} rec={r} />
        ))}
      </div>

      {plan && (
        <section className="cd-plan">
          <h3>CREATIVE CORRECTION PLAN</h3>
          <dl>
            <dt>Source</dt><dd>{plan.sourceVersion}</dd>
            <dt>Target</dt><dd>{plan.targetVersion}</dd>
            <dt>Status</dt><dd>{plan.status}</dd>
            <dt>Risk</dt><dd>{plan.risk} — {plan.riskReason}</dd>
          </dl>
          <ol>
            {plan.changes.map((c) => <li key={c.itemId}>{c.change}</li>)}
          </ol>
          {plan.dependencies.length > 0 && (
            <p className="cd-warn">Dependencies: {plan.dependencies.join(", ")}</p>
          )}
          <div className="cd-impact">
            <strong>IMPACT</strong>
            <p>Affected: {plan.impact.affected.join(", ")}</p>
            <p>Not affected: {plan.impact.notAffected.join(", ")}</p>
            <p>{plan.impact.expectedProcessing}</p>
            <em>{plan.impact.partialNote}</em>
          </div>
          {plan.conflicts.map((c) => (
            <div key={c.conflictId} className="cd-conflict">
              <AlertTriangle size={14} /> {c.message}
            </div>
          ))}
          {plan.verification && (
            <div className="cd-verify">
              <CheckCircle2 size={14} />
              <div>
                <strong>Verification</strong>
                <p>{plan.verification.beforeNote}</p>
                <p>{plan.verification.afterNote}</p>
                <p>{plan.verification.message}</p>
              </div>
            </div>
          )}
          {(plan.status === "PENDING_APPROVAL" || plan.status === "FAILED") && (
            <div className="cd-actions">
              <button type="button" className="cd-primary" onClick={() => void creativeDecisionEngine.applyPlan(plan.planId)}>
                APPLY
              </button>
              <button type="button" onClick={() => creativeDecisionEngine.cancelPlan()}>CANCEL</button>
              {plan.status === "FAILED" && (
                <button type="button" onClick={() => void creativeDecisionEngine.applyPlan(plan.planId)}>RETRY CORRECTION</button>
              )}
            </div>
          )}
        </section>
      )}

      {!plan && recs.some((r) => r.selected) && (
        <div className="cd-actions">
          <button
            type="button"
            className="cd-primary"
            onClick={() => creativeDecisionEngine.preparePlan()}
          >
            PREPARE SELECTED CHANGES
          </button>
          <button type="button" onClick={() => creativeDecisionEngine.selectAll("MUST_FIX")}>Select Must-Fix</button>
          <button
            type="button"
            onClick={() => {
              creativeDecisionEngine.selectAll();
              creativeDecisionEngine.preparePlan();
            }}
          >
            APPLY ALL (prepare)
          </button>
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: SmartRecommendation }) {
  return (
    <article className={`cd-rec ${rec.group.toLowerCase()} ${rec.selected ? "selected" : ""}`}>
      <header>
        <label>
          <input
            type="checkbox"
            checked={rec.selected}
            onChange={(e) => creativeDecisionEngine.selectRecommendation(rec.recommendationId, e.target.checked)}
          />
          <strong>{rec.severity}</strong>
        </label>
        <em>{rec.group.replace(/_/g, " ")}</em>
        <span>{rec.status}</span>
      </header>
      <h4>{rec.what}</h4>
      <p><b>Observation:</b> {rec.observation}</p>
      <p><b>Why:</b> {rec.why}</p>
      <p><b>Where:</b> {rec.where}</p>
      <p><b>Expected:</b> {rec.expectedResult}</p>
      <p><b>Confidence:</b> {rec.confidenceLabel}{rec.confidence != null ? ` (${rec.confidence})` : ""}</p>
      <p><b>Risk:</b> {rec.risk} — {rec.riskReason}</p>
      {rec.conflicts.map((c) => (
        <p key={c.conflictId} className="cd-warn">{c.message}</p>
      ))}
      <div className="cd-actions">
        <button type="button" onClick={() => creativeDecisionEngine.viewRecommendation(rec.recommendationId)}>VIEW</button>
        <button
          type="button"
          className="cd-primary"
          onClick={() => {
            creativeDecisionEngine.selectRecommendation(rec.recommendationId, true);
            creativeDecisionEngine.preparePlan([rec.recommendationId]);
          }}
        >
          PREPARE CHANGE
        </button>
        <button type="button" onClick={() => creativeDecisionEngine.ignoreRecommendation(rec.recommendationId)}>IGNORE</button>
      </div>
    </article>
  );
}
