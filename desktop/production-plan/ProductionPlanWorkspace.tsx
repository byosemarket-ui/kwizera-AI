import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Play, RefreshCw, ShieldCheck, Workflow } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { productionPlanEngine } from "./plan-engine";
import type { ProductionPlanSnapshot, ReadinessLevel } from "./types";
import { PLAN_STAGES, PLAN_STAGE_LABELS } from "./types";
import "./production-plan.css";

function statusClass(level: ReadinessLevel): string {
  if (level === "READY") return "ok";
  if (level === "READY WITH WARNINGS") return "warn";
  return "err";
}

function statusMark(level: ReadinessLevel): string {
  if (level === "READY") return "READY ✓";
  if (level === "READY WITH WARNINGS") return "READY WITH WARNINGS ⚠";
  return "BLOCKED ✕";
}

export function ProductionPlanWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<ProductionPlanSnapshot>(() => productionPlanEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    project: true, product: true, marketing: true, creative: false,
    story: true, script: false, scenes: true, assets: true, audio: false,
    visual: false, timeline: true, claims: true, restrictions: false,
    output: true, deps: false, consistency: true, checklist: true, confirm: true,
  });

  useEffect(() => {
    productionPlanEngine.setNotify(notify);
    productionPlanEngine.setEventEmitter((type, payload) => {
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
    const unsub = productionPlanEngine.subscribe(setSnap);
    productionPlanEngine.hydrate();
    return () => {
      unsub();
      productionPlanEngine.setNotify(null);
      productionPlanEngine.setEventEmitter(null);
    };
  }, [notify]);

  const run = async (force = false) => {
    setBusy(true);
    try {
      await productionPlanEngine.run({ force });
      workspaceStateEngine.autoSave.markDirty();
      notify("success", "Plan drafted", "Review readiness. No video is rendered.", "ai-suggestions");
    } catch (error) {
      notify("error", "Plan failed", error instanceof Error ? error.message : "Unable to compile", "errors");
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    setBusy(true);
    try {
      productionPlanEngine.confirm();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "Phase 4 complete",
        "Production Snapshot created. Opening Production Queue.",
        "production-complete",
      );
      switchWorkspace("queue");
    } catch (error) {
      notify("error", "Cannot confirm", error instanceof Error ? error.message : "Fix required items", "errors");
    } finally {
      setBusy(false);
    }
  };

  const pkg = snap.package;
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));
  const blocked = pkg?.readiness === "BLOCKED";
  const canConfirm = Boolean(pkg && !pkg.userConfirmed && (pkg.status === "review" || pkg.status === "draft") && !blocked);

  if (!pkg && !snap.progress.running && snap.recommendation.includes("No confirmed")) {
    return (
      <div className="pplan">
        <header className="pp-hero">
          <div>
            <span className="pp-kicker">Phase 4 · Step 3</span>
            <h1>Master Production Plan</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="pp-panel">
          <button type="button" onClick={() => switchWorkspace("storyboard")}>Open Creative Planner</button>
        </section>
      </div>
    );
  }

  return (
    <div className="pplan">
      <header className="pp-hero">
        <div>
          <span className="pp-kicker">Phase 4 · Step 3 · Pre-Production Control</span>
          <h1>Master Production Plan Center</h1>
          <p>Prepares the production job. Does not render video or generate media files. Phase 5 is not started from here.</p>
        </div>
        <div className="pp-hero-stats">
          <div><b>{pkg ? `${pkg.scores.overall}%` : "—"}</b><span>READINESS</span></div>
          <div><b className={pkg ? statusClass(pkg.readiness) : ""}>{pkg ? statusMark(pkg.readiness) : "—"}</b><span>STATUS</span></div>
          <div><b>{pkg ? `${pkg.project.durationSec}s` : "—"}</b><span>DURATION</span></div>
          <div><b>{pkg?.project.outputType || "—"}</b><span>OUTPUT</span></div>
        </div>
      </header>

      <section className="pp-toolbar">
        <div>
          <strong>{pkg?.versionLabel ? `Master Production Plan ${pkg.versionLabel}` : "Not compiled"}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="pp-toolbar-actions">
          <button type="button" onClick={() => void run(false)} disabled={busy || snap.progress.running}>
            <Play size={15} /> {pkg ? "Regenerate Plan" : "Compile Plan"}
          </button>
          <button type="button" onClick={() => void run(true)} disabled={busy || snap.progress.running}>
            <RefreshCw size={15} /> New Version
          </button>
          <button type="button" onClick={() => switchWorkspace("marketing-strategy")}>Edit Marketing</button>
          <button type="button" onClick={() => switchWorkspace("storyboard")}>Edit Creative</button>
          <button type="button" onClick={() => { switchWorkspace("storyboard"); }}>Edit Scenes</button>
          <button type="button" onClick={() => toggle("assets")}>Fix Assets</button>
          <button type="button" onClick={() => toggle("claims")}>Review Claims</button>
          <button type="button" onClick={() => toggle("output")}>Change Output</button>
          {pkg?.userConfirmed ? (
            <button type="button" className="pp-primary" onClick={() => switchWorkspace("queue")}>
              <ShieldCheck size={15} /> Open Production Queue
            </button>
          ) : blocked ? (
            <button type="button" className="pp-primary" disabled>
              Fix Required Items
            </button>
          ) : (
            <button type="button" className="pp-primary" disabled={busy || !canConfirm} onClick={() => void onConfirm()}>
              <ShieldCheck size={15} /> Confirm & Send to Production
            </button>
          )}
        </div>
      </section>

      {(snap.progress.running || snap.progress.percent > 0) && (
        <section className="pp-progress">
          <div className="pp-progress-head">
            <h3><Workflow size={16} /> PRE-PRODUCTION PROGRESS</h3>
            <p>{snap.progress.percent}% · {snap.progress.currentLabel}</p>
          </div>
          <div className="pp-progress-bar"><i style={{ width: `${snap.progress.percent}%` }} /></div>
          <div className="pp-stages">
            {PLAN_STAGES.map((stage, idx) => (
              <span key={stage} className={snap.progress.currentStage === stage ? "active" : snap.progress.completed > idx ? "done" : ""}>
                {PLAN_STAGE_LABELS[stage]}
              </span>
            ))}
          </div>
        </section>
      )}

      {pkg && (
        <>
          <section className={`pp-banner ${statusClass(pkg.readiness)}`}>
            <strong>WHAT WILL BE PRODUCED:</strong> {pkg.project.durationSec}s {pkg.project.outputType} · {pkg.project.contentType} · {pkg.product.identity}
            <br />
            <strong>HOW:</strong> {pkg.timeline.entries.length} scenes · {pkg.project.language} · {pkg.project.voice} · CTA {pkg.project.cta}
            <br />
            <strong>ASSETS:</strong> {pkg.assets.filter((a) => a.status === "AVAILABLE").length} available · {pkg.assets.filter((a) => a.status === "MISSING").length} missing
            <br />
            <strong>READY:</strong> <span className={statusClass(pkg.readiness)}>{pkg.userConfirmed ? "READY FOR PHASE 5" : pkg.readiness === "READY" ? "READY FOR PRODUCTION" : statusMark(pkg.readiness)}</span>
            {pkg.userConfirmed && snap.snapshot && (
              <p className="pp-note">Snapshot {snap.snapshot.snapshotId} is immutable. Phase 5 must execute from this snapshot. Phase 5 is not started.</p>
            )}
          </section>

          <section className="pp-scores">
            {([
              ["Product", pkg.scores.product],
              ["Marketing", pkg.scores.marketing],
              ["Creative", pkg.scores.creative],
              ["Assets", pkg.scores.assets],
              ["Audio", pkg.scores.audio],
              ["Claims", pkg.scores.claims],
              ["Output", pkg.scores.output],
              ["Overall", pkg.scores.overall],
            ] as Array<[string, number]>).map(([label, n]) => (
              <div key={label}><b>{n}%</b><span>{label.toUpperCase()}</span></div>
            ))}
          </section>
          <p className="pp-note">{pkg.scores.explanation}</p>

          <Panel id="project" title="1. Project" open={open.project} onToggle={toggle}>
            <Dash label="Project" value={`${pkg.projectName} (${pkg.projectId})`} />
            <Dash label="Product" value={`${pkg.productName} (${pkg.productId})`} />
            <Dash label="Campaign" value={pkg.campaignName} />
            <Dash label="Objective" value={pkg.project.campaignObjective} />
            <Dash label="Content type" value={pkg.project.contentType} />
            <Dash label="Platforms" value={pkg.project.platforms.join(", ") || "NOT CONFIGURED"} />
            <Dash label="Audience" value={pkg.project.audience} />
            <Dash label="Language / Voice / Tone" value={`${pkg.project.language} · ${pkg.project.voice} · ${pkg.project.tone}`} />
            <Dash label="CTA" value={pkg.project.cta} />
            <Dash label="Promotion" value={pkg.project.promotion} />
            <Dash label="Duration / Output" value={`${pkg.project.durationSec}s · ${pkg.project.outputType}`} />
          </Panel>

          <Panel id="product" title="2. Product" open={open.product} onToggle={toggle}>
            <Dash label="Identity" value={pkg.product.identity} />
            <Dash label="Category" value={pkg.product.category} />
            <p>Variants: {pkg.product.variants.join(", ") || "—"}</p>
            <p>Specifications: {pkg.product.specifications.join("; ") || "—"}</p>
            <p>Images mapped: {pkg.product.imageCount}</p>
            {pkg.product.features.map((f) => <p key={f}>{f}</p>)}
            {pkg.product.benefits.map((b) => <p key={b}>{b}</p>)}
            {pkg.product.differentiators.map((d) => <p key={d}>{d}</p>)}
          </Panel>

          <Panel id="marketing" title="3. Marketing" open={open.marketing} onToggle={toggle}>
            <Dash label="Objective" value={pkg.project.campaignObjective} />
            <Dash label="Audience" value={pkg.project.audience} />
            <Dash label="CTA" value={pkg.project.cta} />
            <Dash label="Promotion" value={pkg.project.promotion} />
            {pkg.marketingConflicts.length === 0 && <p className="ok">No marketing configuration conflicts.</p>}
            {pkg.marketingConflicts.map((c) => (
              <article key={c.id} className="pp-row">
                <strong className="err">{c.title}</strong>
                <span>{c.detail}</span>
                <em>User settings were not changed.</em>
              </article>
            ))}
          </Panel>

          <Panel id="creative" title="Creative configuration" open={Boolean(open.creative)} onToggle={toggle}>
            <p>Style: {pkg.visual.productPresentation} · Camera {pkg.visual.cameraStyle} · Motion {pkg.visual.motionStyle}</p>
            <p>Lighting: {pkg.visual.lighting} · Color: {pkg.visual.colorDirection}</p>
            <p>Typography: {pkg.visual.typographyDirection} · Transitions: {pkg.visual.transitionStyle}</p>
            <p>Refs: blueprint {pkg.blueprintRef} · strategy {pkg.strategyRef} · master {pkg.masterRef || "—"}</p>
          </Panel>

          <Panel id="story" title="4. Story" open={open.story} onToggle={toggle}>
            <p>{pkg.story.fullStory}</p>
            <p className="pp-note">{pkg.story.beginning} → {pkg.story.cta}</p>
          </Panel>

          <Panel id="script" title="5. Script" open={Boolean(open.script)} onToggle={toggle}>
            {pkg.script.map((line) => (
              <article key={line.sceneId} className="pp-row">
                <strong>SCENE {line.sceneNumber} · {line.durationSec}s</strong>
                <span>Narration: {line.narration || "—"}</span>
                <span>On-screen: {line.onScreenText || "—"}</span>
                {line.cta && <span>CTA: {line.cta}</span>}
              </article>
            ))}
          </Panel>

          <Panel id="scenes" title="6. Scenes" open={open.scenes} onToggle={toggle}>
            {pkg.scenes.map((s) => (
              <article key={s.id} className="pp-row">
                <strong>SCENE {String(s.sceneNumber).padStart(2, "0")} {s.name} · {fmt(s.startSec)}–{fmt(s.endSec)}</strong>
                <span>Visual: {s.visualDescription}</span>
                <span>Camera: {s.cameraDirection} · {s.cameraMovement}</span>
                <span>Asset: {s.sourceAsset.fileName || s.sourceAsset.status}</span>
              </article>
            ))}
            <div className="pp-timeline">
              {pkg.timeline.entries.map((e) => (
                <div key={e.sceneId} className="pp-tl">
                  <strong>{fmt(e.startSec)}–{fmt(e.endSec)}</strong>
                  <span>Scene {String(e.sceneNumber).padStart(2, "0")} — {e.name} ({e.durationSec}s)</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel id="assets" title="7. Assets" open={open.assets} onToggle={toggle}>
            {pkg.assets.map((a) => (
              <article key={a.id} className="pp-row">
                <strong>
                  {a.sceneNumber != null ? `SCENE ${String(a.sceneNumber).padStart(2, "0")} · ` : ""}
                  {a.assetType}: {a.fileName || "—"}
                </strong>
                <span className={a.status === "MISSING" ? "err" : "ok"}>
                  Status: {a.status === "AVAILABLE" ? "AVAILABLE ✓" : "MISSING ⚠"} · {a.required}
                </span>
                <em>{a.why}. Solution: {a.solution}. Source: {a.source}. Resolution: {a.resolution}.</em>
              </article>
            ))}
          </Panel>

          <Panel id="audio" title="8. Audio" open={Boolean(open.audio)} onToggle={toggle}>
            <p>VOICE · {pkg.audio.language} · {pkg.audio.voiceType} · {pkg.audio.tone} · {pkg.audio.pace} · {pkg.audio.emotion}</p>
            <p>MUSIC · {pkg.audio.musicStyle} · {pkg.audio.musicMood} · {pkg.audio.musicEnergy} · BPM {pkg.audio.bpmDirection}</p>
            <p>MIX · {pkg.audio.voicePriority} · music {pkg.audio.musicLevel} · SFX {pkg.audio.sfxLevel} · {pkg.audio.ducking}</p>
            {pkg.audio.sfx.map((s, i) => (
              <p key={`${s.scene}-${i}`}>SFX: {s.effect} · {s.scene} · {s.trigger}</p>
            ))}
            <p className="pp-note">{pkg.audio.note}</p>
          </Panel>

          <Panel id="visual" title="9. Visuals" open={Boolean(open.visual)} onToggle={toggle}>
            <p>Resolution {pkg.visual.resolution} · Aspect {pkg.visual.aspectRatio}</p>
            <p>{pkg.visual.productPresentation} · {pkg.visual.backgroundDirection} · {pkg.visual.lighting}</p>
            <p>Camera {pkg.visual.cameraStyle} · Motion {pkg.visual.motionStyle} · Type {pkg.visual.typographyDirection}</p>
            <p>Brand: {pkg.visual.brandPresentation}</p>
          </Panel>

          <Panel id="timeline" title="10. Timeline" open={open.timeline} onToggle={toggle}>
            <p>Total {pkg.timeline.totalDurationSec}s · Target {pkg.timeline.targetDurationSec}s · {pkg.timeline.valid ? "Valid" : "Invalid"}</p>
            {pkg.timeline.gaps.map((g) => <p key={g} className="err">{g}</p>)}
            {pkg.timeline.overlaps.map((g) => <p key={g} className="err">{g}</p>)}
            {pkg.timeline.valid && <p className="ok">No unintended gaps or overlaps.</p>}
          </Panel>

          <Panel id="claims" title="11. Claims" open={open.claims} onToggle={toggle}>
            {pkg.claimAudit.length === 0 && <p className="ok">No unsafe claims detected against the Claim Safety Register.</p>}
            {pkg.claimAudit.map((c) => (
              <article key={c.id} className="pp-row">
                <strong className={c.blocks ? "err" : "warn"}>{c.blocks ? "⚠ BLOCKED" : c.status}</strong>
                <span>Claim: {c.text}</span>
                <em>{c.location} — {c.reason}</em>
              </article>
            ))}
          </Panel>

          <Panel id="restrictions" title="12. Restrictions" open={Boolean(open.restrictions)} onToggle={toggle}>
            {pkg.restrictions.length === 0 && <p>No production restrictions recorded.</p>}
            {pkg.restrictions.map((r) => (
              <p key={r.id}><strong>{r.category}</strong> [{r.severity}] {r.detail}</p>
            ))}
            <p className="pp-note">Every Phase 5 engine must receive these restrictions. Phase 5 is not started here.</p>
          </Panel>

          <Panel id="output" title="13. Output" open={open.output} onToggle={toggle}>
            <p>Types: {pkg.output.types.join(", ")}</p>
            <p>Resolution: {pkg.output.resolution}</p>
            <p>Aspect ratio: {pkg.output.aspectRatio}</p>
            <p>Frame rate: {pkg.output.frameRate}</p>
            <p>Duration: {pkg.output.durationSec}s</p>
            <p>Codec/container: {pkg.output.codec}</p>
            <p>Quality preset: {pkg.output.qualityPreset}</p>
            <p>Output directory: {pkg.output.outputDirectory}</p>
            <p className="pp-note">{pkg.output.platformRecommendation}</p>
          </Panel>

          <Panel id="deps" title="Production dependencies" open={Boolean(open.deps)} onToggle={toggle}>
            {pkg.dependencies.map((d) => (
              <article key={d.id} className="pp-row">
                <strong>{d.name} {d.ready ? "✓" : "✕"}</strong>
                <span>depends on: {d.dependsOn.join(" + ")}</span>
                <em>{d.note}</em>
              </article>
            ))}
          </Panel>

          <Panel id="consistency" title="Creative consistency" open={open.consistency} onToggle={toggle}>
            {pkg.consistency.length === 0 && <p className="ok">Story, script, scenes, assets, audio, CTA, and visual style are consistent.</p>}
            {pkg.consistency.map((w) => (
              <article key={w.id} className="pp-row">
                <strong className="warn">CREATIVE CONSISTENCY WARNING</strong>
                <span>{w.relationship}</span>
                <em>{w.detail}</em>
              </article>
            ))}
          </Panel>

          <Panel id="checklist" title="14. Readiness checklist" open={open.checklist} onToggle={toggle}>
            {["PRODUCT", "MARKETING", "CREATIVE", "ASSETS", "AUDIO", "TIMELINE", "CLAIMS", "OUTPUT", "USER"].map((group) => (
              <div key={group}>
                <h4>{group}</h4>
                {pkg.checklist.filter((c) => c.group === group).map((c) => (
                  <p key={c.id} className={c.ok ? "ok" : c.critical ? "err" : "warn"}>
                    {c.ok ? "✓" : c.critical ? "✕" : "!"} {c.label}
                  </p>
                ))}
              </div>
            ))}
          </Panel>

          <Panel id="confirm" title="Final confirmation" open={open.confirm} onToggle={toggle}>
            <p>PRODUCTION READINESS: <strong>{pkg.scores.overall}%</strong></p>
            <p>STATUS: <strong className={statusClass(pkg.readiness)}>{pkg.userConfirmed ? "READY FOR PHASE 5" : pkg.readiness === "BLOCKED" ? "BLOCKED" : "READY FOR PRODUCTION"}</strong></p>
            {blocked && <p className="err">FIX REQUIRED ITEMS — production launch is not allowed.</p>}
            {pkg.userConfirmed && <p className="ok">Phase 4 STATUS: COMPLETE. PRODUCTION STATUS: READY FOR PHASE 5. Phase 5 is not started.</p>}
          </Panel>
        </>
      )}
    </div>
  );
}

function Dash({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <b title={value}>{value.length > 90 ? `${value.slice(0, 90)}…` : value || "—"}</b>
      <span>{label}</span>
    </div>
  );
}

function Panel({
  id, title, open, onToggle, children,
}: {
  id: string; title: string; open: boolean; onToggle: (id: string) => void; children: ReactNode;
}) {
  return (
    <section className="pp-panel">
      <button type="button" className="pp-panel-toggle" onClick={() => onToggle(id)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {title}
      </button>
      {open && <div className="pp-panel-body">{children}</div>}
    </section>
  );
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
