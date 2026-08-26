import { History } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { listProductionHistory, loadPhase5Complete } from "./final-engine";
import { creativeDecisionEngine } from "../creative-decision/decision-engine";
import { creativeMemoryEngine, loadPhase6Complete } from "../creative-memory/memory-engine";
import "./production-final.css";

/** Lightweight history view — reuses finalization history store (no duplicate DB). */
export function ProductionHistoryWorkspace() {
  const { switchWorkspace } = useShell();
  const history = listProductionHistory();
  const phase5 = loadPhase5Complete();
  const phase6 = loadPhase6Complete();
  creativeDecisionEngine.hydrate();
  creativeMemoryEngine.hydrate();
  const plans = creativeDecisionEngine.snapshot().plans;
  const memories = creativeMemoryEngine.snapshot().memories.filter(
    (m) => m.category === "VERSION_MEMORY" || m.category === "DECISION_MEMORY",
  );

  return (
    <div className="pfin">
      <header className="pf-hero">
        <div>
          <span className="pf-kicker">Production History</span>
          <h1>Completed Productions</h1>
          <p>Registered final packages from Phase 5 Step 4. Prior versions are preserved. Phase 6 corrections appear when recorded.</p>
        </div>
      </header>
      {phase5 && (
        <section className="pf-panel">
          <p className="ok">PHASE 5: {phase5.status} · Production {phase5.productionId}</p>
        </section>
      )}
      {phase6 && (
        <section className="pf-panel">
          <p className="ok">PHASE 6: {phase6.status} · Intelligent Assistant Center integrated</p>
        </section>
      )}
      <section className="pf-panel">
        <h2><History size={16} /> History entries</h2>
        {history.length === 0 && <p className="pf-note">No completed final packages yet. Finish Step 4 finalization first.</p>}
        {history.map((h) => {
          const relatedPlan = plans.find((p) => p.targetVersion === h.versionLabel || p.sourceVersion === h.versionLabel);
          const relatedMem = memories.find((m) => m.versionLabel === h.versionLabel);
          return (
            <div key={h.historyId} className="pf-line">
              <strong>{h.versionLabel}</strong>
              <span>{h.projectName} · {h.productionId}</span>
              <em>{h.qcResult} · {h.completedAt} · {h.finalVideoPath}</em>
              <em>
                Trigger: {relatedPlan ? "AI-approved correction" : "Manual / pipeline production"}
                {relatedPlan ? ` · ${relatedPlan.sourceVersion} → ${relatedPlan.targetVersion}` : ""}
              </em>
              {relatedMem && <em>Memory: {relatedMem.content}</em>}
            </div>
          );
        })}
        <div className="pf-actions" style={{ marginTop: 12 }}>
          <button type="button" className="pf-primary" onClick={() => switchWorkspace("output")}>Open Final Outputs</button>
          <button type="button" onClick={() => switchWorkspace("creative-review")}>Creative Review</button>
          <button type="button" onClick={() => switchWorkspace("command-center")}>Command Center</button>
        </div>
      </section>
    </div>
  );
}
