import { useEffect, useState } from "react";
import { Brain, CheckCircle2, Sparkles } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { creativeMemoryEngine } from "./memory-engine";
import type { CreativeIntelligenceSnapshot } from "./types";
import "./creative-memory.css";

export function CreativeMemoryPanel({ compact = false }: { compact?: boolean }) {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<CreativeIntelligenceSnapshot>(() => creativeMemoryEngine.snapshot());

  useEffect(() => {
    creativeMemoryEngine.setNotify(notify);
    creativeMemoryEngine.setEventEmitter((type, payload) => {
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
    const unsub = creativeMemoryEngine.subscribe(setSnap);
    creativeMemoryEngine.hydrate();
    creativeMemoryEngine.syncPreferencesToMemory();
    creativeMemoryEngine.runSafeAutomation("open_project");
    return () => {
      unsub();
      creativeMemoryEngine.setNotify(null);
      creativeMemoryEngine.setEventEmitter(null);
    };
  }, [notify]);

  const next = snap.nextAction;
  const summary = snap.summary;

  return (
    <div className={`cm ${compact ? "compact" : ""}`}>
      <header className="cm-head">
        <div>
          <span className="cm-kicker">Phase 6 · Step 4 · Integration</span>
          <h2><Brain size={16} /> Project Memory & Smart Status</h2>
          <p>{snap.recommendation}</p>
        </div>
        <div className="cm-actions">
          {next?.primary && next.workspace && (
            <button
              type="button"
              className="cm-primary"
              onClick={() => switchWorkspace(next.workspace as never)}
            >
              {next.label}
            </button>
          )}
          <button type="button" onClick={() => switchWorkspace("ai-me")}>
            <Sparkles size={14} /> AI Me
          </button>
        </div>
      </header>

      {snap.phase6Complete && (
        <div className="cm-banner ok">
          <CheckCircle2 size={14} /> PHASE 6 COMPLETE — Creative Review & Intelligent Assistant Center integrated.
        </div>
      )}

      {summary && (
        <section className="cm-card">
          <h3>PROJECT STATUS</h3>
          <dl>
            <dt>Project</dt><dd>{summary.projectName}</dd>
            <dt>Production</dt><dd>{summary.productionStatus}</dd>
            <dt>Version</dt><dd>{summary.currentVersion}</dd>
            <dt>Review</dt><dd>{summary.reviewStatus}</dd>
            <dt>Recommendations</dt><dd>{summary.recommendationCount} (High: {summary.highPriorityCount})</dd>
            <dt>Workflow</dt><dd>{summary.workflowPhase}</dd>
            <dt>Next</dt><dd>{summary.nextActionLabel}</dd>
          </dl>
          <div className="cm-summary">
            {summary.lines.map((line) => <p key={line}>{line}</p>)}
          </div>
        </section>
      )}

      {snap.profile && (
        <section className="cm-card">
          <h3>CREATIVE PROFILE</h3>
          <ul>
            {snap.profile.productPresentation && <li>{snap.profile.productPresentation}</li>}
            {snap.profile.pacing && <li>{snap.profile.pacing}</li>}
            {snap.profile.language && <li>Language: {snap.profile.language}</li>}
            {snap.profile.ctaStyle && <li>CTA: {snap.profile.ctaStyle}</li>}
            {snap.profile.platform && <li>Platform: {snap.profile.platform}</li>}
            {snap.profile.musicStyle && <li>Music: {snap.profile.musicStyle}</li>}
            {snap.profile.visualStyle && <li>Visual: {snap.profile.visualStyle}</li>}
          </ul>
          {!snap.profile.populatedFrom.length && <p className="cm-muted">Sparse — fill marketing/creative config.</p>}
        </section>
      )}

      <section className="cm-card">
        <h3>PROJECT MEMORY</h3>
        {snap.memories.length === 0 && <p className="cm-muted">No creative memories yet for this project.</p>}
        {snap.memories.slice(0, compact ? 4 : 12).map((m) => (
          <article key={m.memoryId} className={`cm-mem ${m.disabled ? "disabled" : ""}`}>
            <header>
              <strong>{m.importance}</strong>
              <em>{m.category.replace(/_/g, " ")}</em>
              <span>{m.source} · {m.confidence}</span>
            </header>
            <p>{m.content}</p>
            <small>{m.topic} · {new Date(m.updatedAt).toLocaleString()} · {m.lifecycle}</small>
            <div className="cm-actions">
              <button type="button" onClick={() => {
                const nextContent = window.prompt("Correct memory", m.content);
                if (nextContent != null && nextContent.trim()) {
                  creativeMemoryEngine.correctMemory(m.memoryId, m.projectId, nextContent.trim());
                }
              }}>Correct</button>
              <button type="button" onClick={() => creativeMemoryEngine.disableMemory(m.memoryId, m.projectId)}>Disable</button>
              <button type="button" onClick={() => creativeMemoryEngine.archiveMemory(m.memoryId, m.projectId)}>Archive</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
