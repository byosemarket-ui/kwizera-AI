import { useEffect, useState } from "react";
import {
  CheckCircle2, FileVideo, Image as ImageIcon, Play, RotateCcw, ShieldCheck, Package, History, AlertTriangle,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { productionFinalEngine, listProductionHistory } from "./final-engine";
import type { FinalizationUiSnapshot } from "./types";
import { STAGE_ORDER } from "./types";
import "./production-final.css";

export function ProductionFinalWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<FinalizationUiSnapshot>(() => productionFinalEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(() => listProductionHistory());

  useEffect(() => {
    productionFinalEngine.setNotify(notify);
    productionFinalEngine.setEventEmitter((type, payload) => {
      const allowed = new Set([
        "product-analysis.started", "product-analysis.completed", "production.progress",
        "product.updated", "state.shared", "notify.info", "notify.warning",
        "rendering.started", "rendering.completed", "export.started", "export.completed",
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
    const unsub = productionFinalEngine.subscribe((s) => {
      setSnap(s);
      setHistory(listProductionHistory());
    });
    productionFinalEngine.hydrate();
    return () => {
      unsub();
      productionFinalEngine.setNotify(null);
      productionFinalEngine.setEventEmitter(null);
    };
  }, [notify]);

  const start = async () => {
    setBusy(true);
    try {
      await productionFinalEngine.start();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
    } catch (error) {
      notify("error", "Finalization failed", error instanceof Error ? error.message : "Unable to start", "errors");
    } finally {
      setBusy(false);
    }
  };

  const s = snap.state;

  if (!s) {
    return (
      <div className="pfin">
        <header className="pf-hero">
          <div>
            <span className="pf-kicker">Phase 5 · Step 4</span>
            <h1>Final Assembly, Render & Export</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="pf-panel">
          <button type="button" onClick={() => switchWorkspace("command-center")}>Open Command Center (Step 3)</button>
          <button type="button" onClick={() => switchWorkspace("active-production")}>Open Active Production (Step 2)</button>
        </section>
      </div>
    );
  }

  const done = s.status === "COMPLETED" && s.package;
  const rp = s.renderProgress;

  return (
    <div className="pfin">
      <header className="pf-hero">
        <div>
          <span className="pf-kicker">Phase 5 · Step 4 · Final Engine</span>
          <h1>{done ? "PRODUCTION COMPLETE" : "Final Assembly, Render & Export"}</h1>
          <p>Consumes Live Production State. Reuses pipeline artifacts, snapshot output config, and Claim Safety. Phase 6 is not started.</p>
        </div>
        <div className="pf-hero-stats">
          <div><b>{s.projectName}</b><span>PROJECT</span></div>
          <div><b>{s.productionId}</b><span>PRODUCTION</span></div>
          <div><b>{s.status}</b><span>STATUS</span></div>
          <div><b>{s.progress}%</b><span>PROGRESS</span></div>
        </div>
      </header>

      <section className="pf-toolbar">
        <div>
          <strong>{s.stage}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="pf-actions">
          <button type="button" className="pf-primary" disabled={busy || snap.ticking || done} onClick={() => void start()}>
            <Play size={15} /> {s.status === "FAILED" || s.status === "BLOCKED" || s.status === "QC_FAILED" ? "RETRY FINALIZATION" : "START FINALIZATION"}
          </button>
          {(s.status === "FAILED" || s.status === "QC_FAILED") && (
            <button type="button" disabled={busy} onClick={() => void productionFinalEngine.retryStage()}>
              <RotateCcw size={15} /> Retry Stage
            </button>
          )}
          {done && (
            <button type="button" disabled={busy} onClick={() => void productionFinalEngine.createNewVersion()}>
              CREATE NEW VERSION
            </button>
          )}
          <button type="button" onClick={() => switchWorkspace("command-center")}>Command Center</button>
          <button type="button" onClick={() => switchWorkspace("history")}>View History</button>
        </div>
      </section>

      <section className="pf-progress">
        <div className="pf-bar"><i style={{ width: `${s.progress}%` }} /></div>
        <div className="pf-stages">
          {STAGE_ORDER.filter((x) => x !== "COMPLETE").map((stage) => (
            <span key={stage} className={s.stage === stage ? "active" : s.progress === 100 || STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(s.stage) ? "done" : ""}>
              {stage.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </section>

      {s.status === "RENDERING" || (rp.totalFrames > 0 && s.stage === "FINAL_RENDER") ? (
        <section className="pf-panel">
          <h2>FINAL RENDER</h2>
          <div className="pf-bar"><i style={{ width: `${rp.percent}%` }} /></div>
          <p>Frame: {rp.frame} / {rp.totalFrames} · Speed: {rp.speedFps != null ? `${rp.speedFps.toFixed(1)} FPS` : "—"} · ETA: {rp.etaSec != null ? `00:${String(Math.max(0, rp.etaSec)).padStart(2, "0")}` : "—"}</p>
        </section>
      ) : null}

      {(s.status === "BLOCKED" || s.status === "FAILED" || s.status === "QC_FAILED") && (
        <section className="pf-banner err">
          <AlertTriangle size={16} />
          <div>
            <strong>{s.status}</strong>
            <p>{s.errors.at(-1)?.message}</p>
            <em>{s.errors.at(-1)?.recoveryRecommendation}</em>
          </div>
        </section>
      )}

      <div className="pf-grid">
        <section className="pf-panel">
          <h2>Input & Scene Validation</h2>
          {s.inputValidation.map((i) => (
            <div key={i.id} className="pf-line"><span>{i.ok ? "✓" : "✕"}</span><strong>{i.label}</strong><em>{i.detail}</em></div>
          ))}
          {s.sceneValidations.length > 0 && (
            <>
              <h3>SCENE VALIDATION</h3>
              {s.sceneValidations.map((sc) => (
                <div key={sc.sceneId} className="pf-line"><span>{sc.ok ? "✓" : "✕"}</span><strong>{sc.sceneName}</strong><em>{sc.ok ? "VALID" : "FAILED"}</em></div>
              ))}
              {s.sceneValidations.every((sc) => sc.ok) && <p className="ok">ALL SCENES VALID</p>}
            </>
          )}
        </section>

        <section className="pf-panel">
          <h2>Master Timeline</h2>
          {!s.timeline && <p className="pf-note">Not assembled yet.</p>}
          {s.timeline?.clips.map((c) => (
            <div key={c.sceneId} className="pf-line">
              <strong>{c.startSec.toFixed(2)}–{c.endSec.toFixed(2)}</strong>
              <span>{c.sceneName}</span>
              <em>{c.durationSec}s · {c.transition}</em>
            </div>
          ))}
          {s.timeline && <p className="pf-note">Total {s.timeline.totalDurationSec}s · gaps {s.timeline.gaps} · overlaps {s.timeline.overlaps}</p>}
        </section>

        <section className="pf-panel">
          <h2>Quality Control</h2>
          {!s.qcReport && <p className="pf-note">QC runs after render validation.</p>}
          {s.qcReport && (
            <>
              <p className={s.qcReport.overall === "PASS" ? "ok" : "err"}>
                <ShieldCheck size={14} /> PRODUCTION QUALITY: {s.qcReport.overall}
              </p>
              {s.qcReport.checks.map((c) => (
                <div key={c.id} className="pf-line">
                  <span>{c.status === "PASS" ? "✓" : c.status === "FAIL" ? "✕" : "○"}</span>
                  <strong>{c.label}</strong>
                  <em>{c.status} — {c.detail}</em>
                </div>
              ))}
            </>
          )}
        </section>
      </div>

      {done && s.package && (
        <section className="pf-complete">
          <h2><CheckCircle2 size={22} /> PRODUCTION COMPLETE · 100%</h2>
          <div className="pf-complete-grid">
            <article>
              <FileVideo size={28} />
              <strong>FINAL VIDEO</strong>
              <em>{s.render?.outputPath}</em>
              <span>{s.render?.resolution} · {s.render?.durationSec}s · {s.render?.checksum}</span>
            </article>
            <article>
              <ImageIcon size={28} />
              <strong>THUMBNAIL</strong>
              <em>{s.thumbnail?.outputPath}</em>
              <span>{s.thumbnail?.width}×{s.thumbnail?.height}</span>
            </article>
            <article>
              <Package size={28} />
              <strong>OUTPUT PACKAGE</strong>
              <em>{s.package.packageId} · {s.package.versionLabel}</em>
              <span>{s.package.outputDirectory}</span>
            </article>
            <article>
              <ShieldCheck size={28} />
              <strong>QUALITY</strong>
              <em className="ok">PASS ✓</em>
              <span>Report {s.qcReport?.reportId}</span>
            </article>
          </div>
          <ul className="pf-outputs">
            {s.package.outputs.map((o) => (
              <li key={o.outputId}><b>{o.kind}</b> · {o.format} · {o.validationStatus} · {o.path}</li>
            ))}
          </ul>
          <div className="pf-actions">
            <button type="button" className="pf-primary" onClick={() => switchWorkspace("creative-review")}>PREVIEW / CREATIVE REVIEW</button>
            <button type="button" onClick={() => switchWorkspace("output")}>OPEN OUTPUT</button>
            <button type="button" onClick={() => document.getElementById("pf-qc")?.scrollIntoView({ behavior: "smooth" })}>VIEW REPORT</button>
            <button type="button" onClick={() => switchWorkspace("history")}><History size={14} /> VIEW PRODUCTION HISTORY</button>
            <button type="button" onClick={() => void productionFinalEngine.createNewVersion()}>CREATE NEW VERSION</button>
          </div>
          {s.phase5Complete && <p className="ok">PHASE 5 STATUS: COMPLETE — open Creative Review (Phase 6 Step 1). Step 2 is not started.</p>}
        </section>
      )}

      <section className="pf-panel">
        <h2>Errors & Checkpoints</h2>
        {s.errors.length === 0 && <p className="ok">No finalization errors.</p>}
        {s.errors.map((e) => (
          <article key={e.errorId} className="pf-err">
            <strong>{e.errorClass}</strong> · {e.stage}
            <p>{e.message}</p>
            <em>{e.recoveryRecommendation}</em>
          </article>
        ))}
        {s.checkpoints.map((c) => (
          <p key={c.checkpointId} className="ok">Checkpoint: {c.stage} — {c.note}</p>
        ))}
      </section>

      <section className="pf-panel">
        <h2>Production History (local)</h2>
        {history.length === 0 && <p className="pf-note">No completed final packages yet.</p>}
        {history.slice(0, 8).map((h) => (
          <div key={h.historyId} className="pf-line">
            <strong>{h.versionLabel}</strong>
            <span>{h.productionId}</span>
            <em>{h.qcResult} · {h.finalVideoPath}</em>
          </div>
        ))}
      </section>
    </div>
  );
}
