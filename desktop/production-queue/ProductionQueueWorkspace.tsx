import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ListOrdered, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { productionQueueEngine } from "./queue-engine";
import type { JobPriority, JobStatus, ProductionQueueSnapshot, TaskStatus } from "./types";
import { PREP_STAGES, PREP_STAGE_LABELS } from "./types";
import "./production-queue.css";

function jobMark(status: JobStatus): string {
  if (status === "READY") return "READY TO EXECUTE ✓";
  if (status === "BLOCKED") return "BLOCKED ✕";
  return status;
}

export function ProductionQueueWorkspace() {
  const { notify, switchWorkspace, core } = useShell();
  const [snap, setSnap] = useState<ProductionQueueSnapshot>(() => productionQueueEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    dash: true, queue: true, assets: true, engines: false, resources: true,
    deps: false, readiness: true, package: true,
  });

  useEffect(() => {
    productionQueueEngine.setNotify(notify);
    productionQueueEngine.setAiCoreOnline(Boolean(core?.aiCore));
    productionQueueEngine.setEventEmitter((type, payload) => {
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
    const unsub = productionQueueEngine.subscribe(setSnap);
    productionQueueEngine.hydrate();
    return () => {
      unsub();
      productionQueueEngine.setNotify(null);
      productionQueueEngine.setEventEmitter(null);
    };
  }, [notify, core?.aiCore]);

  const prepare = async (forceNewVersion = false) => {
    setBusy(true);
    try {
      await productionQueueEngine.prepare({ forceNewVersion });
      workspaceStateEngine.autoSave.markDirty();
      notify("success", "Queue prepared", "Job is prepared only — generation is not started.", "ai-suggestions");
    } catch (error) {
      notify("error", "Prepare failed", error instanceof Error ? error.message : "Unable to prepare", "errors");
    } finally {
      setBusy(false);
    }
  };

  const onReady = async () => {
    setBusy(true);
    try {
      productionQueueEngine.markReadyAcknowledged();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "READY TO EXECUTE",
        "Opening Active Production Pipeline. Step 2 will execute — Step 3 is not started.",
        "production-complete",
      );
      switchWorkspace("active-production");
    } catch (error) {
      notify("error", "Cannot acknowledge", error instanceof Error ? error.message : "Review required", "errors");
    } finally {
      setBusy(false);
    }
  };

  const job = snap.job;
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  if (!job && !snap.progress.running && snap.recommendation.includes("No confirmed")) {
    return (
      <div className="pqueue">
        <header className="pq-hero">
          <div>
            <span className="pq-kicker">Phase 5 · Step 1</span>
            <h1>Production Queue</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="pq-panel">
          <button type="button" onClick={() => switchWorkspace("pipeline")}>Open Production Plan</button>
        </section>
      </div>
    );
  }

  return (
    <div className="pqueue">
      <header className="pq-hero">
        <div>
          <span className="pq-kicker">Phase 5 · Step 1 · Queue & Orchestration</span>
          <h1>Production Preparation Center</h1>
          <p>Converts the Production Snapshot into a job and queue. Does not generate media or start rendering. Step 2 is not started.</p>
        </div>
        <div className="pq-hero-stats">
          <div><b>{job?.productionId || "—"}</b><span>PRODUCTION ID</span></div>
          <div><b>{job ? jobMark(job.status) : "—"}</b><span>STATUS</span></div>
          <div><b>{job ? `${job.readiness.overall}%` : "—"}</b><span>READINESS</span></div>
          <div><b>{job ? `${job.readyTasks}/${job.totalTasks}` : "—"}</b><span>READY TASKS</span></div>
        </div>
      </header>

      <section className="pq-toolbar">
        <div>
          <strong>{job ? `${job.jobName} · ${job.versionLabel}` : "Not prepared"}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="pq-toolbar-actions">
          <button type="button" onClick={() => void prepare(false)} disabled={busy || snap.progress.running}>
            <Play size={15} /> {job ? "Re-check / Prepare" : "Prepare Job"}
          </button>
          <button type="button" onClick={() => void prepare(true)} disabled={busy || snap.progress.running}>
            <RefreshCw size={15} /> Create New Version
          </button>
          <label>
            Priority{" "}
            <select
              value={job?.priority ?? "NORMAL"}
              disabled={!job || busy}
              onChange={(e) => productionQueueEngine.setPriority(e.target.value as JobPriority)}
            >
              <option value="LOW">LOW</option>
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </label>
          <button type="button" onClick={() => toggle("queue")}>Review Queue</button>
          <button type="button" onClick={() => toggle("deps")}>Review Dependencies</button>
          <button type="button" onClick={() => toggle("assets")}>Review Assets</button>
          <button type="button" onClick={() => toggle("resources")}>Review Resources</button>
          <button type="button" onClick={() => productionQueueEngine.cancelJob()} disabled={!job || job.status === "CANCELLED"}>
            Cancel Job
          </button>
          <button type="button" onClick={() => switchWorkspace("pipeline")}>Edit Snapshot (Plan)</button>
          {job?.status === "READY" ? (
            <button type="button" className="pq-primary" disabled={busy} onClick={() => void onReady()}>
              <ShieldCheck size={15} /> {job.userConfirmedReady ? "Open Active Production" : "READY TO EXECUTE"}
            </button>
          ) : job?.status === "BLOCKED" ? (
            <button type="button" className="pq-primary" disabled>Fix Required Items</button>
          ) : null}
        </div>
      </section>

      {(snap.progress.running || snap.progress.percent > 0) && (
        <section className="pq-progress">
          <div className="pq-progress-head">
            <h3><ListOrdered size={16} /> PREPARATION PROGRESS</h3>
            <p>{snap.progress.percent}% · {snap.progress.currentLabel}</p>
          </div>
          <div className="pq-progress-bar"><i style={{ width: `${snap.progress.percent}%` }} /></div>
          <div className="pq-stages">
            {PREP_STAGES.map((stage, idx) => (
              <span key={stage} className={snap.progress.currentStage === stage ? "active" : snap.progress.completed > idx ? "done" : ""}>
                {PREP_STAGE_LABELS[stage]}
              </span>
            ))}
          </div>
        </section>
      )}

      {job && (
        <>
          <section className="pq-banner">
            <strong>PROJECT</strong> {job.projectName}
            <br />
            <strong>PRODUCTION</strong> {job.productionId} · snapshot {job.snapshotId}
            <br />
            <strong>STATUS</strong> {jobMark(job.status)} · Priority {job.priority}
            <br />
            <strong>PROGRESS</strong> {job.progress}% (execution not started) · Est. {job.estimatedDurationLabel}
            {job.duplicateOf && <p className="warn">Created as new version of {job.duplicateOf}</p>}
            {job.warnings.map((w) => <p key={w} className="warn">{w}</p>)}
            {job.errorState && <p className="err">BLOCKED — {job.errorState}</p>}
          </section>

          <section className="pq-scores">
            {([
              ["Snapshot", job.readiness.snapshot],
              ["Assets", job.readiness.assets],
              ["AI Engines", job.readiness.aiEngines],
              ["Resources", job.readiness.resources],
              ["Dependencies", job.readiness.dependencies],
              ["Configuration", job.readiness.configuration],
              ["Overall", job.readiness.overall],
            ] as Array<[string, number]>).map(([label, n]) => (
              <div key={label}><b>{n}%</b><span>{label.toUpperCase()}</span></div>
            ))}
          </section>
          <p className="pq-note">{job.readiness.explanation}</p>

          <Panel id="dash" title="Preparation checks" open={open.dash} onToggle={toggle}>
            {job.prepChecks.map((c) => (
              <p key={c.id} className={c.ok ? "ok" : c.critical ? "err" : "warn"}>
                {c.ok ? "✓" : c.critical ? "✕" : "!"} {c.label} — {c.detail}
              </p>
            ))}
            <p><strong>JOB STATUS: {job.status === "READY" ? "READY TO EXECUTE" : job.status}</strong></p>
          </Panel>

          <Panel id="queue" title="Production Queue" open={open.queue} onToggle={toggle}>
            {job.tasks.map((t) => (
              <div key={t.taskId} className="pq-queue-line">
                <strong>{String(t.order).padStart(2, "0")}</strong>
                <div>
                  <strong>{t.taskName}</strong>
                  <em>{t.description}</em>
                  {t.blockedReason && <span className="err">TASK BLOCKED — {t.blockedReason}. {t.resolution}</span>}
                </div>
                <span className={`pq-pill ${t.status}`}>{labelStatus(t.status)}</span>
              </div>
            ))}
            {job.parallelGroups.length > 0 && (
              <p className="pq-note">Parallel-safe ready groups: {job.parallelGroups.map((g) => g.length).join(", ")} task(s) in group(s). Not started.</p>
            )}
          </Panel>

          <Panel id="assets" title="Asset checks" open={open.assets} onToggle={toggle}>
            {job.assetChecks.map((a) => (
              <article key={a.id} className="pq-row">
                <strong>{a.category}{a.sceneNumber != null ? ` · Scene ${a.sceneNumber}` : ""}: {a.fileName || "—"}</strong>
                <span className={a.status === "AVAILABLE" ? "ok" : a.status === "OPTIONAL" ? "warn" : "err"}>
                  {a.status === "AVAILABLE" ? "AVAILABLE ✓" : a.status === "OPTIONAL" ? "OPTIONAL / MISSING" : `${a.status} ⚠`}
                  {" · "}integrity {a.integrity} · {a.required}
                </span>
                <em>{a.reason}. {a.resolution}</em>
              </article>
            ))}
          </Panel>

          <Panel id="engines" title="AI engines & models" open={Boolean(open.engines)} onToggle={toggle}>
            {job.engines.map((e) => (
              <article key={e.id} className="pq-row">
                <strong>{e.name} · {e.status}</strong>
                <span>Model: {e.model} · version {e.modelVersion} · {e.location}</span>
                <em>VRAM {e.vram} · RAM {e.ram} · CPU {e.cpu}. {e.note}</em>
              </article>
            ))}
            <p className="pq-note">Local-first. Private assets are not uploaded externally from this step.</p>
          </Panel>

          <Panel id="resources" title="Machine resources & storage" open={open.resources} onToggle={toggle}>
            {job.resources.map((r) => (
              <p key={r.id} className={r.status === "AVAILABLE" ? "ok" : r.status === "WARNING" ? "warn" : undefined}>
                {r.name}: {r.value} · {r.status} — {r.note}
              </p>
            ))}
            <p>
              Estimated Required: {job.storage.estimatedRequiredLabel}
              <br />
              Available: {job.storage.availableLabel}
              <br />
              Status: {job.storage.status === "SUFFICIENT" ? "SUFFICIENT ✓" : job.storage.status}
            </p>
            <p className="pq-note">{job.storage.note}</p>
          </Panel>

          <Panel id="deps" title="Dependencies & retries" open={Boolean(open.deps)} onToggle={toggle}>
            {job.tasks.map((t) => (
              <p key={t.taskId}>
                {t.taskName} ← [{t.dependencies.map((d) => job.tasks.find((x) => x.taskId === d)?.taskName || d).join(" + ") || "none"}]
                {" · "}retry {t.retryCount}/{t.maxRetries}
              </p>
            ))}
          </Panel>

          <Panel id="package" title="Step 2 handoff" open={open.package} onToggle={toggle}>
            {snap.executionPackage ? (
              <>
                <p className="ok">Production Execution Package ready: {snap.executionPackage.productionId}</p>
                <p className="pq-note">{snap.executionPackage.note}</p>
              </>
            ) : (
              <p className="err">No execution package until the job is READY.</p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function labelStatus(status: TaskStatus): string {
  if (status === "READY") return "READY";
  if (status === "WAITING") return "WAITING";
  if (status === "BLOCKED") return "BLOCKED";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "FAILED") return "FAILED";
  if (status === "RUNNING") return "RUNNING";
  return status;
}

function Panel({
  id, title, open, onToggle, children,
}: {
  id: string; title: string; open: boolean; onToggle: (id: string) => void; children: ReactNode;
}) {
  return (
    <section className="pq-panel">
      <button type="button" className="pq-panel-toggle" onClick={() => onToggle(id)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {title}
      </button>
      {open && <div className="pq-panel-body">{children}</div>}
    </section>
  );
}
