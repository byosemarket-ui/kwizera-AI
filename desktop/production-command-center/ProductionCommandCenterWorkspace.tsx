import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ChevronDown, ChevronRight, Cpu, Gauge, HardDrive,
  Pause, Play, RotateCcw, Search, Square, Thermometer, Wifi, WifiOff, Zap,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { productionPipelineEngine } from "../production-pipeline/pipeline-engine";
import { buildTaskDetail, formatClock, formatDuration } from "./assemble";
import { productionCommandCenterEngine } from "./command-center-engine";
import type { CommandCenterSnapshot, LogCategory, PipelineNodeStatus } from "./types";
import "./production-command-center.css";

const LOG_FILTERS: LogCategory[] = ["all", "info", "success", "warning", "error", "task", "ai", "resource", "render"];

function nodeSymbol(status: PipelineNodeStatus): string {
  if (status === "COMPLETED") return "✓";
  if (status === "RUNNING") return "●";
  if (status === "FAILED") return "✕";
  if (status === "BLOCKED") return "!";
  if (status === "READY") return "→";
  return "○";
}

export function ProductionCommandCenterWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<CommandCenterSnapshot>(() => productionCommandCenterEngine.snapshot());
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    productionCommandCenterEngine.setNotify(notify);
    productionPipelineEngine.setNotify(notify);
    productionCommandCenterEngine.setEventHandler((type, payload) => {
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
    productionCommandCenterEngine.mount();
    productionCommandCenterEngine.hydrate();
    const unsub = productionCommandCenterEngine.subscribe(setSnap);
    return () => {
      unsub();
      productionCommandCenterEngine.unmount();
      productionCommandCenterEngine.setNotify(null);
    };
  }, [notify]);

  useEffect(() => {
    if (!snap.prefs.autoScrollLogs || snap.prefs.pauseLogScroll) return;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [snap.logs.length, snap.prefs.autoScrollLogs, snap.prefs.pauseLogScroll]);

  const d = snap.dashboard;
  const state = productionPipelineEngine.snapshot().state;
  const taskDetail = useMemo(
    () => buildTaskDetail(state, snap.prefs.selectedTaskId),
    [state, snap.prefs.selectedTaskId],
  );

  const filteredLogs = useMemo(() => {
    const q = snap.prefs.logSearch.trim().toLowerCase();
    return snap.logs.filter((l) => {
      if (snap.prefs.logFilter !== "all" && l.category !== snap.prefs.logFilter && l.level !== snap.prefs.logFilter) return false;
      if (q && !l.message.toLowerCase().includes(q) && !(l.taskId || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [snap.logs, snap.prefs.logFilter, snap.prefs.logSearch]);

  const healthClass = (level: string) => level.toLowerCase();

  if (!d) {
    return (
      <div className="pcc">
        <header className="pcc-hero">
          <div>
            <span className="pcc-kicker">Phase 5 · Step 3</span>
            <h1>AI Production Command Center</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="pcc-panel">
          {snap.connectionState === "lost" && (
            <p className="pcc-alert critical"><WifiOff size={16} /> PRODUCTION CONNECTION LOST</p>
          )}
          <button type="button" className="pcc-primary" onClick={() => productionCommandCenterEngine.attemptReconnect()}>
            Reconnect
          </button>
          <button type="button" onClick={() => switchWorkspace("active-production")}>Open Active Production (Step 2)</button>
          <button type="button" onClick={() => switchWorkspace("queue")}>Open Production Queue (Step 1)</button>
        </section>
      </div>
    );
  }

  const canPause = d.status === "RUNNING" && snap.controlPending === "none";
  const canResume = (d.status === "PAUSED" || d.status === "BLOCKED" || d.status === "FAILED") && snap.controlPending === "none";
  const canCancel = !["CANCELLED", "CANCELLING..."].includes(d.status);

  return (
    <div className="pcc">
      <header className="pcc-hero">
        <div>
          <span className="pcc-kicker">Phase 5 · Step 3 · Live Command Center</span>
          <h1>AI Production Command Center</h1>
          <p>Real-time monitoring and control over the existing Production Pipeline. Step 4 is not started.</p>
        </div>
        <div className="pcc-hero-stats">
          <div><b>{d.projectName}</b><span>PROJECT</span></div>
          <div><b>{d.productionId}</b><span>PRODUCTION ID</span></div>
          <div><b>{d.status}</b><span>STATUS</span></div>
          <div><b>{d.overallProgress}%</b><span>OVERALL PROGRESS</span></div>
          <div><b>{d.eta.label}</b><span>ETA</span></div>
        </div>
      </header>

      {(snap.connectionState === "lost" || snap.syncWarning) && (
        <section className="pcc-banner warn">
          {snap.connectionState === "lost" ? (
            <><WifiOff size={16} /> PRODUCTION CONNECTION LOST — production may still be running.</>
          ) : (
            <><AlertTriangle size={16} /> STATE SYNC WARNING — attempting recovery.</>
          )}
          <button type="button" onClick={() => productionCommandCenterEngine.attemptReconnect()}>Reconnect</button>
        </section>
      )}

      {d.recovery.active && (
        <section className="pcc-banner ok">
          <strong>RECOVERED PRODUCTION</strong>
          Last Checkpoint: {d.recovery.lastCheckpoint || "—"} · Recovered Tasks: {d.recovery.recoveredTasks} · Remaining: {d.recovery.remainingTasks} · Status: {d.recovery.status}
        </section>
      )}

      <section className="pcc-toolbar">
        <div>
          <strong>{d.currentStageLabel}</strong>
          <span>{d.currentTaskName} · Stage {d.stageIndex}/{d.stageCount} · Elapsed {d.elapsedLabel}</span>
        </div>
        <div className="pcc-toolbar-actions">
          <button type="button" disabled={!canPause || busy} onClick={() => productionCommandCenterEngine.pause()}>
            <Pause size={15} /> Pause
          </button>
          <button type="button" disabled={!canResume || busy} onClick={() => void productionCommandCenterEngine.resume()}>
            <Play size={15} /> Resume
          </button>
          <button type="button" disabled={!canCancel || busy} onClick={() => setCancelOpen(true)}>
            <Square size={15} /> Cancel
          </button>
          <button type="button" onClick={() => {
            const failed = d.queueItems.find((t) => t.marker === "failed");
            if (failed) productionCommandCenterEngine.selectTask(failed.taskId);
            logRef.current?.scrollIntoView({ behavior: "smooth" });
          }}>View Logs</button>
          <button type="button" onClick={() => switchWorkspace("active-production")}>Step 2 Pipeline</button>
        </div>
      </section>

      <section className="pcc-progress-top">
        <div>
          <span>PRODUCTION PROGRESS</span>
          <strong>{d.overallProgress}%</strong>
          <em>{d.completedTasks} / {d.totalTasks} tasks</em>
          <div className="pcc-bar"><i style={{ width: `${d.overallProgress}%` }} /></div>
        </div>
        <div>
          <span>CURRENT STAGE</span>
          <strong>{d.currentStageLabel}</strong>
          <em>{d.stageProgress}% · {d.currentTaskName}</em>
          <div className="pcc-bar"><i style={{ width: `${d.stageProgress}%` }} /></div>
        </div>
        <div>
          <span>CURRENT TASK</span>
          <strong>{d.currentTaskId || "—"}</strong>
          <em>{d.currentTaskProgress}% · Worker {taskDetail?.workerId || "—"}</em>
          <div className="pcc-bar"><i style={{ width: `${d.currentTaskProgress}%` }} /></div>
        </div>
      </section>

      <div className="pcc-grid">
        <section className="pcc-panel pcc-queue">
          <h2>Production Queue</h2>
          <ul>
            {d.queueItems.map((t) => (
              <li key={t.taskId}>
                <button
                  type="button"
                  className={snap.prefs.selectedTaskId === t.taskId ? "selected" : ""}
                  onClick={() => productionCommandCenterEngine.selectTask(t.taskId)}
                >
                  <span className={`mark ${t.marker}`}>{t.marker === "done" ? "✓" : t.marker === "current" ? "→" : t.marker === "failed" ? "✕" : "○"}</span>
                  <span className="name">{t.taskName}</span>
                  <span className={`pill ${t.status}`}>{t.progress}%</span>
                </button>
                {t.error && <em className="err">{t.error}</em>}
              </li>
            ))}
          </ul>
        </section>

        <section className="pcc-panel pcc-center">
          <h2>Pipeline</h2>
          <div className="pcc-pipeline">
            {d.pipelineNodes.map((n, idx) => (
              <div key={n.id} className={`node ${n.status}`}>
                <span>{nodeSymbol(n.status)}</span>
                <b>{n.shortLabel}</b>
                <em>{n.progress}%</em>
                {idx < d.pipelineNodes.length - 1 && <i className="arrow">↓</i>}
              </div>
            ))}
          </div>

          {taskDetail && (
            <div className="pcc-task-detail">
              <h3>Task Details — {taskDetail.taskName}</h3>
              <dl>
                <dt>Task ID</dt><dd>{taskDetail.taskId}</dd>
                <dt>Type</dt><dd>{taskDetail.taskType}</dd>
                <dt>Status</dt><dd>{taskDetail.status}</dd>
                <dt>Progress</dt><dd>{taskDetail.progress}%</dd>
                <dt>Started</dt><dd>{formatClock(taskDetail.startedAt)}</dd>
                <dt>Completed</dt><dd>{formatClock(taskDetail.completedAt)}</dd>
                <dt>Elapsed</dt><dd>{formatDuration(taskDetail.elapsedMs)}</dd>
                <dt>ETA</dt><dd>{formatDuration(taskDetail.etaMs)}</dd>
                <dt>Worker</dt><dd>{taskDetail.workerId || "—"}</dd>
                <dt>Engine</dt><dd>{taskDetail.engine}</dd>
                <dt>Model</dt><dd>{taskDetail.model}</dd>
                <dt>Retry</dt><dd>{taskDetail.retryCount} / {taskDetail.maxRetries}</dd>
                <dt>Dependencies</dt><dd>{taskDetail.dependencies.join(", ") || "—"}</dd>
                <dt>Inputs</dt><dd>{taskDetail.inputs.join(", ") || "—"}</dd>
                <dt>Outputs</dt><dd>{taskDetail.outputs.join(", ") || "—"}</dd>
              </dl>
              {taskDetail.errors.map((e) => (
                <p key={e.errorId} className="err">{e.message} — {e.recoveryRecommendation}</p>
              ))}
              {taskDetail.status === "FAILED" && (
                <button type="button" onClick={() => void productionCommandCenterEngine.retryTask(taskDetail.taskId)}>
                  <RotateCcw size={14} /> Retry
                </button>
              )}
            </div>
          )}

          <div className="pcc-current-task">
            <h3>Current Task Panel</h3>
            <p><strong>{d.currentTaskId || "—"}</strong> — {d.currentTaskName}</p>
            <p>Status: {d.status} · Progress: {d.currentTaskProgress}%</p>
            <p>Started: {formatClock(d.startedAt)} · Elapsed: {d.elapsedLabel} · ETA: {d.eta.label}</p>
            <p>Engine: {taskDetail?.engine || "—"} · Model: {taskDetail?.model || "—"}</p>
            <div className="pcc-bar"><i style={{ width: `${d.currentTaskProgress}%` }} /></div>
          </div>
        </section>

        <section className="pcc-panel pcc-resources">
          <h2>Resource Monitor</h2>
          <div className="pcc-metric"><Cpu size={14} /><span>CPU</span><b>{d.resources.cpuUsage ?? "UNAVAILABLE"}%</b></div>
          <div className="pcc-metric"><Activity size={14} /><span>RAM</span><b>{d.resources.ramUsedGb ?? "—"} / {d.resources.ramTotalGb ?? "—"} GB ({d.resources.ramUsage ?? "—"}%)</b></div>
          <div className="pcc-metric"><Zap size={14} /><span>GPU</span><b>{d.resources.gpuName || "NOT AVAILABLE"} · {d.resources.gpuUsage ?? "—"}%</b></div>
          <div className="pcc-metric"><Gauge size={14} /><span>VRAM</span><b>{d.resources.vramUsage ?? "UNAVAILABLE"}%</b></div>
          <div className="pcc-metric"><HardDrive size={14} /><span>Storage</span><b>Free {d.resources.diskFreeGb ?? "—"} GB / {d.resources.diskTotalGb ?? "—"} GB</b></div>
          <div className="pcc-metric"><Thermometer size={14} /><span>Temperature</span><b>UNAVAILABLE</b></div>
          <div className="pcc-metric"><Activity size={14} /><span>Render Speed</span><b>{d.resources.renderSpeedLabel}</b></div>

          <h3>AI System Status</h3>
          <ul className="pcc-ai">
            {d.aiEngines.map((e) => (
              <li key={e.category}><span>{e.category}</span><b className={e.status.toLowerCase()}>{e.status}</b><em>{e.engineName}</em></li>
            ))}
          </ul>

          <h3>Workers</h3>
          <ul className="pcc-workers">
            {d.workers.map((w) => (
              <li key={w.workerId}><strong>{w.label}</strong><span>{w.status}</span><em>{w.progress}% {w.taskName || ""}</em></li>
            ))}
          </ul>

          <h3>Resource Health</h3>
          <ul className="pcc-health">
            {Object.entries(d.resources.health).map(([k, v]) => (
              <li key={k} className={healthClass(v)}><span>{k.toUpperCase()}</span><b>{v}</b></li>
            ))}
          </ul>

          {d.resources.alerts.map((a) => (
            <p key={a.id} className={`pcc-alert ${a.severity}`}>{a.severity.toUpperCase()}: {a.message}</p>
          ))}
        </section>
      </div>

      <section className="pcc-panel pcc-logs">
        <div className="pcc-logs-head">
          <h2>Live Logs</h2>
          <div className="pcc-log-tools">
            {LOG_FILTERS.map((f) => (
              <button key={f} type="button" className={snap.prefs.logFilter === f ? "active" : ""} onClick={() => productionCommandCenterEngine.setLogFilter(f)}>
                {f}
              </button>
            ))}
            <label><Search size={14} /><input value={snap.prefs.logSearch} onChange={(e) => productionCommandCenterEngine.setLogSearch(e.target.value)} placeholder="Search logs" /></label>
            <button type="button" onClick={() => productionCommandCenterEngine.clearLogDisplay()}>Clear display</button>
            <label><input type="checkbox" checked={snap.prefs.autoScrollLogs} onChange={(e) => productionCommandCenterEngine.setAutoScroll(e.target.checked)} /> Auto-scroll</label>
            <label><input type="checkbox" checked={snap.prefs.pauseLogScroll} onChange={(e) => productionCommandCenterEngine.setPauseLogScroll(e.target.checked)} /> Pause scroll</label>
          </div>
        </div>
        <div className="pcc-log-list" ref={logRef}>
          {filteredLogs.length === 0 && <p className="pcc-note">No log entries match the current filter.</p>}
          {filteredLogs.map((l) => (
            <div key={l.id} className={`log ${l.level}`}>
              <time>{formatClock(l.at)}</time>
              <span>{l.message}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pcc-panel pcc-handoff">
        <h2>Step 4 Handoff</h2>
        <p className="ok">LIVE PRODUCTION STATE is maintained for Phase 5 Step 4. Final assembly/render/export is not auto-started.</p>
        <p className="pcc-note">Artifacts: {d.stats.artifactCount} · Checkpoints: {d.stats.checkpointCount} · Retries: {d.stats.retries}</p>
        <button type="button" className="pcc-primary" onClick={() => {
          productionCommandCenterEngine.writeStep4Handoff();
          switchWorkspace("output");
        }}>
          Open Final Assembly (Step 4)
        </button>
      </section>

      {cancelOpen && (
        <div className="pcc-modal">
          <div className="pcc-modal-body">
            <h3>CANCEL PRODUCTION?</h3>
            <p>Completed outputs will be preserved. Running tasks will be stopped where safely possible.</p>
            <div className="pcc-toolbar-actions">
              <button type="button" className="pcc-danger" disabled={busy} onClick={async () => {
                setBusy(true);
                productionCommandCenterEngine.cancel();
                await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
                setCancelOpen(false);
                setBusy(false);
              }}>Cancel Production</button>
              <button type="button" onClick={() => setCancelOpen(false)}>Keep Running</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
