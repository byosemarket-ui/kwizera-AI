import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Pause, Play, Square, RotateCcw, Activity } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { productionPipelineEngine } from "./pipeline-engine";
import type { PipelineUiSnapshot, PipelineStageId } from "./types";
import { STAGE_LABELS } from "./types";
import "./production-pipeline.css";

export function ProductionPipelineWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<PipelineUiSnapshot>(() => productionPipelineEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    tasks: true, artifacts: true, stages: true, errors: true, handoff: true,
  });

  useEffect(() => {
    productionPipelineEngine.setNotify(notify);
    productionPipelineEngine.setEventEmitter((type, payload) => {
      const allowed = new Set([
        "product-analysis.started", "product-analysis.completed", "production.progress",
        "product.updated", "state.shared", "notify.info", "notify.warning",
      ]);
      const eventType = allowed.has(type) ? type : "state.shared";
      void workspaceIntegrationEngine.emit({
        type: eventType as "product-analysis.started",
        source: "product-analysis",
        targets: ["ai-me", "notifications", "workspace"],
        payload,
        priority: "normal",
      });
    });
    const unsub = productionPipelineEngine.subscribe(setSnap);
    productionPipelineEngine.hydrate();
    return () => {
      unsub();
      productionPipelineEngine.setNotify(null);
      productionPipelineEngine.setEventEmitter(null);
    };
  }, [notify]);

  const start = async () => {
    setBusy(true);
    try {
      await productionPipelineEngine.start();
      workspaceStateEngine.autoSave.markDirty();
      notify("success", "Production started", "Pipeline executing. Final render is Step 4.", "updates");
    } catch (error) {
      notify("error", "Start failed", error instanceof Error ? error.message : "Unable to start", "errors");
    } finally {
      setBusy(false);
    }
  };

  const state = snap.state;
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  if (!state && snap.recommendation.includes("No Production Execution")) {
    return (
      <div className="ppipe">
        <header className="pl-hero">
          <div>
            <span className="pl-kicker">Phase 5 · Step 2</span>
            <h1>AI Production Pipeline</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="pl-panel">
          <button type="button" onClick={() => switchWorkspace("queue")}>Open Production Queue</button>
        </section>
      </div>
    );
  }

  const run = state?.run;
  const canStart = run && (run.status === "IDLE" || run.status === "PAUSED" || run.status === "BLOCKED" || run.status === "FAILED");

  return (
    <div className="ppipe">
      <header className="pl-hero">
        <div>
          <span className="pl-kicker">Phase 5 · Step 2 · Pipeline Engine</span>
          <h1>Active Production Pipeline</h1>
          <p>Executes the Production Execution Package. Live command center is Step 3. Final encode/export is Step 4.</p>
        </div>
        <div className="pl-hero-stats">
          <div><b>{run?.productionId || "—"}</b><span>PRODUCTION</span></div>
          <div><b>{run?.runId || "—"}</b><span>RUN ID</span></div>
          <div><b>{run?.status || "—"}</b><span>STATUS</span></div>
          <div><b>{run ? `${run.progress}%` : "—"}</b><span>STEP 2 PROGRESS</span></div>
        </div>
      </header>

      <section className="pl-toolbar">
        <div>
          <strong>{run ? `${run.jobName}` : "No run"}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="pl-toolbar-actions">
          <button type="button" className="pl-primary" disabled={busy || snap.ticking || !canStart || run?.status === "READY_FOR_STEP3"} onClick={() => void start()}>
            <Play size={15} /> {run?.status === "PAUSED" ? "RESUME PRODUCTION" : "START PRODUCTION"}
          </button>
          <button type="button" disabled={!run || run.status !== "RUNNING"} onClick={() => productionPipelineEngine.pause()}>
            <Pause size={15} /> Pause
          </button>
          <button type="button" disabled={!run || (run.status !== "PAUSED" && run.status !== "BLOCKED")} onClick={() => void productionPipelineEngine.resume()}>
            <Play size={15} /> Resume
          </button>
          <button type="button" disabled={!run || run.status === "CANCELLED" || run.status === "READY_FOR_STEP3"} onClick={() => productionPipelineEngine.cancel()}>
            <Square size={15} /> Cancel
          </button>
          <button type="button" onClick={() => switchWorkspace("queue")}>Open Queue</button>
          <button type="button" className="pl-primary" onClick={() => switchWorkspace("command-center")}>
            <Activity size={15} /> Open Command Center
          </button>
        </div>
      </section>

      {run && (
        <>
          <section className="pl-banner">
            <strong>Snapshot</strong> {run.snapshotId} · {run.snapshotVersion}
            <br />
            <strong>Machine</strong> {run.machineId} · App {run.applicationVersion}
            <br />
            <strong>Workers</strong> GPU {run.gpuWorkers} · CPU {run.cpuWorkers}
            <br />
            <strong>Current</strong> {run.currentTaskId || "—"} · Stage {run.currentStage ? STAGE_LABELS[run.currentStage] : "—"}
            <div className="pl-progress-bar"><i style={{ width: `${run.progress}%` }} /></div>
          </section>

          <section className="pl-stages">
            {(Object.keys(STAGE_LABELS) as PipelineStageId[]).map((id) => (
              <div key={id}>
                <b>{run.stageProgress[id] ?? 0}%</b>
                <span>{STAGE_LABELS[id]}</span>
              </div>
            ))}
          </section>

          <Panel id="tasks" title="Task execution" open={open.tasks} onToggle={toggle}>
            {state!.tasks.map((t) => (
              <div key={t.taskId} className="pl-line">
                <strong>{String(t.order).padStart(2, "0")}</strong>
                <div>
                  <strong>{t.taskName}</strong>
                  <em>{t.taskType} · {t.requiredAiEngine || "Local Pipeline Worker"} · {t.progress}%</em>
                  {t.blockedReason && <span className="warn">{t.blockedReason}</span>}
                  {t.error && <span className="err">{t.error}</span>}
                  {t.deferredToStep4 && <span className="pl-note">Deferred to Step 4</span>}
                  {t.status === "FAILED" && (
                    <button type="button" onClick={() => void productionPipelineEngine.retryTask(t.taskId)}>
                      <RotateCcw size={14} /> Retry
                    </button>
                  )}
                </div>
                <span className={`pl-pill ${t.status}`}>{t.status}</span>
              </div>
            ))}
          </Panel>

          <Panel id="artifacts" title="Versioned artifacts" open={open.artifacts} onToggle={toggle}>
            {state!.artifacts.length === 0 && <p className="pl-note">No artifacts yet.</p>}
            {state!.artifacts.map((a) => (
              <article key={a.artifactId} className="pl-row">
                <strong>{a.kind} · {a.version} · {a.validationState}</strong>
                <span>{a.outputPath}</span>
                <em>Engine: {a.engine} · consistency {a.productConsistency} · {a.validationNotes.join("; ")}</em>
              </article>
            ))}
          </Panel>

          <Panel id="errors" title="Errors & checkpoints" open={open.errors} onToggle={toggle}>
            {run.errors.length === 0 && <p className="ok">No errors recorded.</p>}
            {run.errors.map((e) => (
              <article key={e.errorId} className="pl-row">
                <strong className="err">{e.errorType}</strong>
                <span>{e.message}</span>
                <em>{e.recoveryRecommendation} · retries {e.retryCount}</em>
              </article>
            ))}
            {state!.checkpoints.map((c) => (
              <p key={c.checkpointId} className="ok">Checkpoint: {c.label} · {c.completedTaskIds.length} tasks · {c.timestamp}</p>
            ))}
          </Panel>

          <Panel id="handoff" title="Step 3 handoff" open={open.handoff} onToggle={toggle}>
            {snap.handoffReady || state!.readyForStep3 ? (
              <>
                <p className="ok">READY FOR LIVE COMMAND CENTER / NEXT PIPELINE STAGE — Step 3 is not auto-started. Final render remains Step 4.</p>
                <button type="button" className="pl-primary" onClick={() => switchWorkspace("command-center")}>
                  <Activity size={15} /> Open Live Command Center (Step 3)
                </button>
              </>
            ) : (
              <p className="pl-note">Handoff appears when Step 2 actionable tasks complete.</p>
            )}
            <p className="pl-note"><Activity size={14} /> Detailed live monitoring belongs to Step 3.</p>
          </Panel>
        </>
      )}
    </div>
  );
}

function Panel({
  id, title, open, onToggle, children,
}: {
  id: string; title: string; open: boolean; onToggle: (id: string) => void; children: ReactNode;
}) {
  return (
    <section className="pl-panel">
      <button type="button" className="pl-panel-toggle" onClick={() => onToggle(id)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {title}
      </button>
      {open && <div className="pl-panel-body">{children}</div>}
    </section>
  );
}
