import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Clapperboard, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { creativePlannerEngine } from "./planner-engine";
import type { CreativePlannerSnapshot } from "./types";
import { PLANNER_STAGES, PLANNER_STAGE_LABELS } from "./types";
import "./creative-planner.css";

export function CreativePlannerWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<CreativePlannerSnapshot>(() => creativePlannerEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    dash: true, story: true, hook: true, script: true, scenes: true,
    assets: true, audio: false, claims: true, valid: true,
  });

  useEffect(() => {
    creativePlannerEngine.setNotify(notify);
    creativePlannerEngine.setEventEmitter((type, payload) => {
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
    const unsub = creativePlannerEngine.subscribe(setSnap);
    creativePlannerEngine.hydrate();
    return () => {
      unsub();
      creativePlannerEngine.setNotify(null);
      creativePlannerEngine.setEventEmitter(null);
    };
  }, [notify]);

  const run = async (force = false) => {
    setBusy(true);
    try {
      await creativePlannerEngine.run({ force });
      workspaceStateEngine.autoSave.markDirty();
      notify("success", "Blueprint drafted", "Review story and claims. No video is rendered.", "ai-suggestions");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to plan";
      if (message.includes("Live Creative Plan generated")) {
        notify("success", "Creative Plan generated", message, "ai-suggestions");
      } else {
        notify("error", "Planning failed", message, "errors");
      }
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    setBusy(true);
    try {
      creativePlannerEngine.confirm();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "Phase 4 Step 2 complete",
        "Creative Blueprint confirmed. Opening Master Production Plan.",
        "production-complete",
      );
      switchWorkspace("pipeline");
    } catch (error) {
      notify("error", "Cannot confirm", error instanceof Error ? error.message : "Validation blocked", "errors");
    } finally {
      setBusy(false);
    }
  };

  const pkg = snap.package;
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));
  const hook = pkg?.hooks.find((h) => h.id === pkg.primaryHookId);

  if (!pkg && !snap.livePlan && !snap.progress.running && snap.recommendation.includes("No confirmed")) {
    return (
      <div className="cplan">
        <header className="cp-hero">
          <div>
            <span className="cp-kicker">Phase 4 · Step 2</span>
            <h1>Creative Production Planner</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="cp-panel">
          <button type="button" onClick={() => switchWorkspace("marketing-strategy")}>Open Marketing Strategy</button>
        </section>
      </div>
    );
  }

  return (
    <div className="cplan">
      <header className="cp-hero">
        <div>
          <span className="cp-kicker">Phase 4 · Step 2 · Story · Script · Scenes</span>
          <h1>Creative Production Planner</h1>
          <p>Blueprint only — no video, image, or audio files are generated here.</p>
        </div>
        <div className="cp-hero-stats">
          <div><b>{pkg?.contentType || snap.livePlan?.angle || "—"}</b><span>CONTENT TYPE</span></div>
          <div><b>{hook?.kind || snap.livePlan?.angle || "—"}</b><span>HOOK</span></div>
          <div><b>{pkg ? `${pkg.totalDurationSec}s` : snap.livePlan ? `${snap.livePlan.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0)}s` : "—"}</b><span>DURATION</span></div>
          <div><b>{pkg ? `${pkg.validation.readinessPercent}%` : snap.livePlan ? `v${snap.livePlan.version}` : "—"}</b><span>READINESS</span></div>
        </div>
      </header>

      <section className="cp-toolbar">
        <div>
          <strong>{pkg?.versionLabel ? `Creative Blueprint ${pkg.versionLabel}` : "Not compiled"}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="cp-toolbar-actions">
          <button type="button" onClick={() => void run(false)} disabled={busy || snap.progress.running}>
            <Play size={15} /> {pkg ? "Regenerate" : "Compile Blueprint"}
          </button>
          <button type="button" onClick={() => void run(true)} disabled={busy || snap.progress.running}>
            <RefreshCw size={15} /> New Version
          </button>
          <button type="button" onClick={() => switchWorkspace("marketing-strategy")}>Edit Story</button>
          <button type="button" onClick={() => toggle("script")}>Edit Script</button>
          <button type="button" onClick={() => toggle("scenes")}>Edit Scenes</button>
          <button type="button" onClick={() => toggle("hook")}>Change Hook</button>
          <button type="button" onClick={() => toggle("cta")}>Change CTA</button>
          {pkg?.userConfirmed ? (
            <button type="button" className="cp-primary" onClick={() => switchWorkspace("pipeline")}>
              Open Production Plan
            </button>
          ) : (
            <button
              type="button"
              className="cp-primary"
              disabled={busy || !pkg || !pkg.validation.canConfirm}
              onClick={() => void onConfirm()}
            >
              <ShieldCheck size={15} /> Confirm Blueprint
            </button>
          )}
        </div>
      </section>

      {(snap.progress.running || snap.progress.percent > 0) && (
        <section className="cp-progress">
          <div className="cp-progress-head">
            <h3><Clapperboard size={16} /> PLANNING PROGRESS</h3>
            <p>{snap.progress.percent}% · {snap.progress.currentLabel}</p>
          </div>
          <div className="cp-progress-bar"><i style={{ width: `${snap.progress.percent}%` }} /></div>
          <div className="cp-stages">
            {PLANNER_STAGES.map((stage, idx) => (
              <span key={stage} className={snap.progress.currentStage === stage ? "active" : snap.progress.completed > idx ? "done" : ""}>
                {PLANNER_STAGE_LABELS[stage]}
              </span>
            ))}
          </div>
        </section>
      )}

      {snap.livePlan && (
        <section className="cp-panel">
          <h3>Live Creative Plan v{snap.livePlan.version}</h3>
          <p>{snap.livePlan.creativeStrategy}</p>
          <p>Objective: {snap.livePlan.objective || "—"} · Audience: {snap.livePlan.audience || "—"} · CTA: {snap.livePlan.callToAction || "—"}</p>
          {snap.livePlan.scenes.map((scene) => (
            <article key={scene.id} className="cp-row">
              <strong>SCENE {scene.order} {scene.purpose} · {scene.durationSeconds}s</strong>
              <span>Asset {scene.assetId || "unassigned"} · {scene.cameraDirection || scene.camera}</span>
              <span>{scene.visual}</span>
              <span>{scene.text || scene.narration}</span>
            </article>
          ))}
        </section>
      )}

      {pkg && (
        <>
          <section className="cp-dash">
            <Dash label="Objective" value={pkg.storyObjective} />
            <Dash label="Language" value={pkg.language} />
            <Dash label="CTA" value={pkg.cta.text} />
            <Dash label="Promotion" value={pkg.promotion.status} />
            <Dash label="Platform" value={pkg.platforms.map((p) => p.platform).join(", ")} />
          </section>

          {pkg.contentTypeAiRec && (
            <p className="cp-rec">AI RECOMMENDATION (content type): {pkg.contentTypeAiRec} — user format remains authoritative.</p>
          )}

          <Panel id="hook" title="Hooks" open={open.hook} onToggle={toggle}>
            {pkg.hooks.map((h) => (
              <article key={h.id} className={`cp-row ${h.id === pkg.primaryHookId ? "picked" : ""}`}>
                <strong>{h.kind}{h.id === pkg.primaryHookId ? " · PRIMARY" : ""}</strong>
                <span>{h.text}</span>
                <em>{h.concept} · {Math.round(h.confidence * 100)}% · {h.evidence}</em>
                {!pkg.userConfirmed && h.id !== pkg.primaryHookId && (
                  <button type="button" onClick={() => creativePlannerEngine.setPrimaryHook(h.id)}>Use as primary</button>
                )}
              </article>
            ))}
            <h4>Story directions</h4>
            {pkg.storyAlternatives.map((s) => (
              <article key={s.id} className={`cp-row ${s.id === pkg.selectedStoryAltId ? "picked" : ""}`}>
                <strong>{s.name}</strong>
                <span>{s.summary}</span>
                {!pkg.userConfirmed && s.id !== pkg.selectedStoryAltId && (
                  <button type="button" onClick={() => creativePlannerEngine.setStoryAlt(s.id)}>Use this direction</button>
                )}
              </article>
            ))}
          </Panel>

          <Panel id="story" title="Story" open={open.story} onToggle={toggle}>
            <p>{pkg.story.fullStory}</p>
            <p className="cp-note">Beats: {pkg.storyBeats.filter((b) => b.included).map((b) => b.name).join(" → ")}</p>
          </Panel>

          <Panel id="script" title="Script" open={open.script} onToggle={toggle}>
            {pkg.script.map((line) => (
              <article key={line.sceneId} className="cp-row">
                <strong>SCENE {line.sceneNumber} · {line.durationSec}s</strong>
                <span>Narration: {line.narration || "—"}</span>
                <span>On-screen: {line.onScreenText || "—"}</span>
                {line.cta && <span>CTA: {line.cta}</span>}
                {line.flags.map((f) => (
                  <em key={f.id} className="err">⚠ CLAIM REQUIRES REVIEW — {f.claim}: {f.reason}</em>
                ))}
              </article>
            ))}
          </Panel>

          <Panel id="scenes" title="Scenes · Visual · Camera · Timing" open={open.scenes} onToggle={toggle}>
            {pkg.scenes.map((s) => (
              <article key={s.id} className="cp-row">
                <strong>SCENE {String(s.sceneNumber).padStart(2, "0")} {s.name} · {fmt(s.startSec)}–{fmt(s.endSec)}</strong>
                <span>Visual: {s.visualDescription}</span>
                <span>Camera: {s.cameraDirection} · {s.cameraMovement}</span>
                <span>Narration: {s.narration || "—"}</span>
                <span>On-screen: {s.onScreenText || "—"}</span>
                <span>Audio: {s.audioDirection}</span>
                <em>{s.sourceAsset.status === "MISSING ASSET" ? s.sourceAsset.note : s.sourceAsset.fileName} · {s.productionNotes}</em>
                {!pkg.userConfirmed && (
                  <button type="button" onClick={() => creativePlannerEngine.regenerateScene(s.id)}>Regenerate this scene</button>
                )}
              </article>
            ))}
          </Panel>

          <Panel id="assets" title="Assets & Missing" open={open.assets} onToggle={toggle}>
            {pkg.scenes.map((s) => (
              <p key={s.id}>Scene {s.sceneNumber}: {s.sourceAsset.fileName || "MISSING ASSET"} ({s.sourceAsset.viewType || "—"})</p>
            ))}
          </Panel>

          <Panel id="cta" title="CTA, Promotion, Style, Platform" open={Boolean(open.cta)} onToggle={toggle}>
            {pkg.ctaAlternatives.map((c) => (
              <article key={c.id} className={`cp-row ${c.id === pkg.selectedCtaId ? "picked" : ""}`}>
                <strong>{c.source}: {c.text}</strong>
                {!pkg.userConfirmed && c.id !== pkg.selectedCtaId && (
                  <button type="button" onClick={() => creativePlannerEngine.setCta(c.id)}>Use this CTA</button>
                )}
              </article>
            ))}
            <p>Promotion: {pkg.promotion.status} — {pkg.promotion.details}</p>
            <p>Narration: {pkg.narrationDirection.language} · {pkg.narrationDirection.voiceType} · {pkg.narrationDirection.note}</p>
            <p>Style: {pkg.style.visualStyle} · {pkg.style.cameraStyle} · {pkg.style.audioMood}</p>
            {pkg.platforms.map((p) => (
              <p key={p.platform}>{p.platform}: {p.notes.join(" · ")}</p>
            ))}
          </Panel>

          <Panel id="claims" title="Claim Safety & Restrictions" open={open.claims} onToggle={toggle}>
            {pkg.claimFlags.length === 0 && <p>No prohibited or unverified claims inserted into the script.</p>}
            {pkg.claimFlags.map((f) => (
              <article key={f.id} className="cp-row">
                <strong>⚠ {f.status}</strong>
                <span>{f.claim} — {f.reason}</span>
              </article>
            ))}
          </Panel>

          <Panel id="valid" title="Creative Validation" open={open.valid} onToggle={toggle}>
            {pkg.validation.checks.map((c) => (
              <p key={c.id}>{c.ok ? "✓" : c.critical ? "✕" : "!"} {c.label} — {c.detail}</p>
            ))}
            <p><strong>CREATIVE READINESS {pkg.validation.readinessPercent}%</strong></p>
            {!pkg.validation.canConfirm && <p className="err">Confirmation blocked: {pkg.validation.blocking.join("; ")}</p>}
          </Panel>
        </>
      )}
    </div>
  );
}

function Dash({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <b title={value}>{value.length > 80 ? `${value.slice(0, 80)}…` : value || "—"}</b>
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
    <section className="cp-panel">
      <button type="button" className="cp-panel-toggle" onClick={() => onToggle(id)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {title}
      </button>
      {open && <div className="cp-panel-body">{children}</div>}
    </section>
  );
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
