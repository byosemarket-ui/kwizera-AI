import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown, ChevronRight, Megaphone, Play, RefreshCw, ShieldCheck,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { marketingStrategyEngine } from "./strategy-engine";
import type { MarketingStrategySnapshot } from "./types";
import { STRATEGY_STAGES, STRATEGY_STAGE_LABELS } from "./types";
import "./marketing-strategy.css";

export function MarketingStrategyWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<MarketingStrategySnapshot>(() => marketingStrategyEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    dash: true, audience: true, problem: true, position: true, angles: true,
    message: false, platform: false, cta: true, claims: true, risks: true, creative: false,
  });

  useEffect(() => {
    marketingStrategyEngine.setNotify(notify);
    marketingStrategyEngine.setEventEmitter((type, payload) => {
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
    const unsub = marketingStrategyEngine.subscribe(setSnap);
    marketingStrategyEngine.hydrate();
    return () => {
      unsub();
      marketingStrategyEngine.setNotify(null);
      marketingStrategyEngine.setEventEmitter(null);
    };
  }, [notify]);

  const run = async (force = false, keep = false) => {
    setBusy(true);
    try {
      await marketingStrategyEngine.run({ force, keepUserSettings: keep || undefined });
      workspaceStateEngine.autoSave.markDirty();
      notify("success", "Strategy drafted", "Review angles and claims, then confirm. Step 2 is not started.", "ai-suggestions");
    } catch (error) {
      notify("error", "Strategy failed", error instanceof Error ? error.message : "Unable to compile", "errors");
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    setBusy(true);
    try {
      marketingStrategyEngine.confirm();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "Phase 4 Step 1 complete",
        "Master Marketing Strategy confirmed. Opening Creative Planner.",
        "production-complete",
      );
      switchWorkspace("storyboard");
    } catch (error) {
      notify("error", "Cannot confirm", error instanceof Error ? error.message : "Review required", "errors");
    } finally {
      setBusy(false);
    }
  };

  const pkg = snap.package;
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));
  const primary = pkg?.angles.find((a) => a.id === pkg.primaryAngleId);

  if (!pkg && !snap.progress.running && snap.recommendation.includes("No confirmed")) {
    return (
      <div className="mstrat">
        <header className="ms-hero">
          <div>
            <span className="ms-kicker">Phase 4 · Step 1</span>
            <h1>Master Marketing Strategy</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="ms-panel">
          <button type="button" onClick={() => switchWorkspace("master-intelligence")}>Open Master Intelligence</button>
        </section>
      </div>
    );
  }

  return (
    <div className="mstrat">
      <header className="ms-hero">
        <div>
          <span className="ms-kicker">Phase 4 · Step 1 · Marketing Strategy</span>
          <h1>Master Marketing Strategy</h1>
          <p>
            Turns confirmed Product Intelligence and the Marketing Brief into a campaign strategy.
            This is not a script, storyboard, or video.
          </p>
        </div>
        <div className="ms-hero-stats">
          <div><b>{pkg?.objective.activeObjective || "—"}</b><span>CAMPAIGN</span></div>
          <div><b>{pkg?.audience.primaryAudience || "—"}</b><span>AUDIENCE</span></div>
          <div><b>{primary?.name || "—"}</b><span>PRIMARY ANGLE</span></div>
          <div><b>{pkg ? `${pkg.confidence.overall}%` : "—"}</b><span>CONFIDENCE</span></div>
        </div>
      </header>

      <section className="ms-toolbar">
        <div>
          <strong>{pkg?.versionLabel ? `Marketing Strategy ${pkg.versionLabel}` : "Not compiled"}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="ms-toolbar-actions">
          <button type="button" onClick={() => void run(false)} disabled={busy || snap.progress.running}>
            <Play size={15} /> {pkg ? "Regenerate Recommendations" : "Compile Strategy"}
          </button>
          <button type="button" onClick={() => void run(true)} disabled={busy || snap.progress.running}>
            <RefreshCw size={15} /> New Version
          </button>
          <button type="button" onClick={() => switchWorkspace("marketing")}>Edit</button>
          <button
            type="button"
            disabled={busy || !pkg || pkg.userConfirmed}
            onClick={() => { marketingStrategyEngine.keepMySettings(); notify("info", "Kept your settings", "User objective, CTA, and promotion stay in control.", "information"); }}
          >
            Keep My Settings
          </button>
          <button
            type="button"
            className="ms-primary"
            disabled={busy || !pkg || pkg.userConfirmed || (pkg.status !== "review" && pkg.status !== "draft")}
            onClick={() => void onConfirm()}
          >
            <ShieldCheck size={15} /> Confirm Strategy
          </button>
          {pkg?.userConfirmed && (
            <button type="button" className="ms-primary" onClick={() => switchWorkspace("storyboard")}>
              Open Creative Planner
            </button>
          )}
        </div>
      </section>

      {(snap.progress.running || snap.progress.percent > 0) && (
        <section className="ms-progress">
          <div className="ms-progress-head">
            <h3><Megaphone size={16} /> STRATEGY PROGRESS</h3>
            <p>{snap.progress.percent}% · {snap.progress.currentLabel}</p>
          </div>
          <div className="ms-progress-bar"><i style={{ width: `${snap.progress.percent}%` }} /></div>
          <div className="ms-stages">
            {STRATEGY_STAGES.map((stage, idx) => (
              <span key={stage} className={snap.progress.currentStage === stage ? "active" : snap.progress.completed > idx ? "done" : ""}>
                {STRATEGY_STAGE_LABELS[stage]}
              </span>
            ))}
          </div>
        </section>
      )}

      {pkg && (
        <>
          <section className="ms-dash">
            <Dash label="Customer Need" value={pkg.audience.needs} />
            <Dash label="Positioning" value={`For ${pkg.positioning.forAudience}`} />
            <Dash label="Value Proposition" value={pkg.valueProposition.statement} />
            <Dash label="Primary Benefit" value={pkg.benefits[0]?.benefit || "—"} />
            <Dash label="Platform" value={pkg.platforms.map((p) => p.platform).join(", ")} />
            <Dash label="Language" value={pkg.languageVoice.language} />
            <Dash label="CTA" value={pkg.cta.activeCta} />
            <Dash label="Promotion" value={pkg.promotion.status === "NO PROMOTION CONFIGURED" ? "NO PROMOTION CONFIGURED" : pkg.promotion.type} />
            <Dash label="Status" value={pkg.readyForCreativePlanning ? "READY FOR CREATIVE PLANNING" : pkg.status} />
          </section>

          <Panel id="dash" title="Campaign Objective" open={open.dash} onToggle={toggle}>
            <p><strong>User objective:</strong> {pkg.objective.userObjective}</p>
            {pkg.objective.aiRecommendation && (
              <p className="ms-rec">
                AI RECOMMENDATION: {pkg.objective.aiRecommendation} — {pkg.objective.aiReason}
                {!pkg.userConfirmed && (
                  <span className="ms-inline">
                    <button type="button" onClick={() => marketingStrategyEngine.setObjectiveDecision("accepted")}>Accept</button>
                    <button type="button" onClick={() => marketingStrategyEngine.setObjectiveDecision("rejected")}>Keep mine</button>
                  </span>
                )}
              </p>
            )}
            <p>Active: {pkg.objective.activeObjective} · {pkg.objective.recDecision}</p>
          </Panel>

          <Panel id="audience" title="Target Audience" open={open.audience} onToggle={toggle}>
            <dl className="ms-dl">
              <dt>Primary</dt><dd>{pkg.audience.primaryAudience}</dd>
              <dt>Secondary</dt><dd>{pkg.audience.secondaryAudience}</dd>
              <dt>Age</dt><dd>{pkg.audience.ageRange}</dd>
              <dt>Location</dt><dd>{pkg.audience.location}</dd>
              <dt>Interests</dt><dd>{pkg.audience.interests.join(", ") || "UNKNOWN / NOT PROVIDED"}</dd>
              <dt>Needs</dt><dd>{pkg.audience.needs}</dd>
              <dt>Buying motivation</dt><dd>{pkg.audience.buyingMotivation}</dd>
            </dl>
          </Panel>

          <Panel id="problem" title="Problem, Desire & Motivation" open={open.problem} onToggle={toggle}>
            <article className="ms-row">
              <strong>Problem</strong>
              <span>{pkg.customerProblem.detail}</span>
              <em>{pkg.customerProblem.classification} · {Math.round(pkg.customerProblem.confidence * 100)}% · {pkg.customerProblem.evidence}</em>
            </article>
            {pkg.customerDesire.map((d) => (
              <article key={d.id} className="ms-row">
                <strong>Desire: {d.label}</strong>
                <span>{d.detail}</span>
                <em>{d.classification}</em>
              </article>
            ))}
            {pkg.buyingMotivations.map((m) => (
              <article key={m.id} className="ms-row">
                <strong>{m.rank}. {m.motivation} — {m.band} confidence</strong>
                <span>{m.evidence}</span>
              </article>
            ))}
          </Panel>

          <Panel id="position" title="Positioning, Value & USP" open={open.position} onToggle={toggle}>
            <p>
              FOR {pkg.positioning.forAudience} WHO NEED {pkg.positioning.whoNeed}. THIS PRODUCT {pkg.positioning.thisProduct} PROVIDES {pkg.positioning.provides} BECAUSE {pkg.positioning.because}.
            </p>
            <p><strong>Value:</strong> {pkg.valueProposition.statement}</p>
            <p className="ms-note">{pkg.valueProposition.whyCare}</p>
            {pkg.uspCandidates.map((u) => (
              <article key={u.id} className="ms-row">
                <strong>{u.statement}</strong>
                {u.superiorityClaim && <span className="ms-tag warn">Not a uniqueness claim</span>}
                <em>{u.classification} · {Math.round(u.confidence * 100)}%</em>
              </article>
            ))}
          </Panel>

          <Panel id="angles" title="Marketing Angles" open={open.angles} onToggle={toggle}>
            {pkg.angles.map((a) => (
              <article key={a.id} className={`ms-row ${a.id === pkg.primaryAngleId ? "picked" : ""}`}>
                <strong>#{a.rank} {a.name}{a.id === pkg.primaryAngleId ? " · PRIMARY" : ""}</strong>
                <span>{a.message}</span>
                <em>{a.classification} · {Math.round(a.confidence * 100)}% · {a.recommendedPlatform}</em>
                {!pkg.userConfirmed && a.id !== pkg.primaryAngleId && (
                  <button type="button" onClick={() => marketingStrategyEngine.setPrimaryAngle(a.id)}>Use as primary</button>
                )}
              </article>
            ))}
          </Panel>

          <Panel id="message" title="Message & Benefits" open={open.message} onToggle={toggle}>
            <p className="ms-note">{pkg.message.note}</p>
            <p><strong>Main:</strong> {pkg.message.mainMessage}</p>
            <p><strong>Functional:</strong> {pkg.message.functionalMessage}</p>
            <p><strong>CTA message:</strong> {pkg.message.ctaMessage}</p>
            <ul>{pkg.message.proofPoints.map((p) => <li key={p}>{p}</li>)}</ul>
            {pkg.benefits.map((b) => (
              <article key={b.id} className="ms-row">
                <strong>{b.role}: {b.benefit}</strong>
                <em>{b.classification} · {Math.round(b.confidence * 100)}%</em>
              </article>
            ))}
          </Panel>

          <Panel id="platform" title="Platform, Language & Voice" open={open.platform} onToggle={toggle}>
            {pkg.platforms.map((p) => (
              <article key={p.platform} className="ms-row">
                <strong>{p.platform}</strong>
                <span>{p.contentDirection} · {p.messagingIntensity} · {p.formatConsideration} · {p.durationConsideration}</span>
              </article>
            ))}
            <dl className="ms-dl">
              <dt>Language</dt><dd>{pkg.languageVoice.language} — {pkg.languageVoice.communicationStyle}</dd>
              <dt>Voice</dt><dd>{pkg.languageVoice.voice}</dd>
              <dt>Tone</dt><dd>{pkg.languageVoice.tone} · intensity {pkg.languageVoice.salesIntensity}</dd>
            </dl>
          </Panel>

          <Panel id="cta" title="CTA & Promotion" open={open.cta} onToggle={toggle}>
            <p><strong>User CTA:</strong> {pkg.cta.userCta}</p>
            <p>{pkg.cta.alignmentNote} {pkg.cta.aligned ? "" : "(mismatch flagged)"}</p>
            {pkg.cta.aiRecommendation && (
              <p className="ms-rec">
                AI RECOMMENDATION: {pkg.cta.aiRecommendation}
                {!pkg.userConfirmed && (
                  <span className="ms-inline">
                    <button type="button" onClick={() => marketingStrategyEngine.setCtaDecision("accepted")}>Accept</button>
                    <button type="button" onClick={() => marketingStrategyEngine.setCtaDecision("rejected")}>Keep mine</button>
                  </span>
                )}
              </p>
            )}
            <p><strong>Promotion:</strong> {pkg.promotion.status}{pkg.promotion.configured ? ` — ${pkg.promotion.type} ${pkg.promotion.details}` : ""}</p>
            {pkg.promotion.aiRecommendation && <p className="ms-rec">AI RECOMMENDATION: {pkg.promotion.aiRecommendation}</p>}
          </Panel>

          <Panel id="creative" title="Competitive, Content & Creative Direction" open={open.creative} onToggle={toggle}>
            <p className="ms-note">{pkg.competitive.note}</p>
            <p><strong>Primary content:</strong> {pkg.contentDirection.primary}</p>
            <p>Alternatives: {pkg.contentDirection.alternatives.join(", ")}</p>
            <dl className="ms-dl">
              <dt>Visual mood</dt><dd>{pkg.creative.visualMood}</dd>
              <dt>Energy</dt><dd>{pkg.creative.energy}</dd>
              <dt>Storytelling</dt><dd>{pkg.creative.storytellingStyle}</dd>
              <dt>Camera</dt><dd>{pkg.creative.cameraStyleDirection}</dd>
              <dt>Audio</dt><dd>{pkg.creative.audioStyleDirection}</dd>
            </dl>
          </Panel>

          <Panel id="claims" title="Claim Safety" open={open.claims} onToggle={toggle}>
            <ClaimList title="Approved" items={pkg.claims.approved.map((c) => c.claim)} ok />
            <ClaimList title="Requiring review" items={pkg.claims.requiringReview.map((c) => c.claim)} />
            <ClaimList title="Unverified" items={pkg.claims.unverified.map((c) => c.claim)} />
            <ClaimList title="Prohibited / do not use" items={pkg.claims.prohibited.map((c) => c.claim)} err />
          </Panel>

          <Panel id="risks" title="Risks & Confidence" open={open.risks} onToggle={toggle}>
            {pkg.risks.map((r) => (
              <article key={r.id} className="ms-row">
                <strong>{r.level}: {r.title}</strong>
                <span>{r.detail}</span>
              </article>
            ))}
            <p>{pkg.confidence.explanation}</p>
            <p>
              Audience {pkg.confidence.audience}% · Positioning {pkg.confidence.productPositioning}% · Angle {pkg.confidence.marketingAngle}% · Market {pkg.confidence.marketContext}% · Overall {pkg.confidence.overall}%
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}

function Dash({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <b title={value}>{value.length > 72 ? `${value.slice(0, 72)}…` : value || "—"}</b>
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
    <section className="ms-panel">
      <button type="button" className="ms-panel-toggle" onClick={() => onToggle(id)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {title}
      </button>
      {open && <div className="ms-panel-body">{children}</div>}
    </section>
  );
}

function ClaimList({ title, items, ok, err }: { title: string; items: string[]; ok?: boolean; err?: boolean }) {
  return (
    <div className="ms-claim-block">
      <strong className={ok ? "ok" : err ? "err" : ""}>{title}</strong>
      {items.length === 0 ? <p>—</p> : <ul>{items.map((c) => <li key={c}>{c}</li>)}</ul>}
    </div>
  );
}
