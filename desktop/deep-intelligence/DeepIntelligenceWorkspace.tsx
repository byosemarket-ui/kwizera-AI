import { useEffect, useState, type ReactNode } from "react";
import {
  Brain, CheckCircle2, ChevronDown, ChevronRight, Play, RefreshCw,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { deepIntelligenceEngine } from "./deep-intelligence-engine";
import type { CrossCheck, DeepIntelligenceSnapshot, LayeredItem, ReviewStatus } from "./types";
import { INTEL_STAGES, INTEL_STAGE_LABELS } from "./types";
import "./deep-intelligence.css";

export function DeepIntelligenceWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<DeepIntelligenceSnapshot>(() => deepIntelligenceEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    overview: true,
    verified: true,
    observations: true,
    inferences: true,
    consistency: true,
    unknown: true,
    differentiators: true,
    cross: true,
  });

  useEffect(() => {
    deepIntelligenceEngine.setNotify(notify);
    deepIntelligenceEngine.setEventEmitter((type, payload) => {
      const allowed = new Set([
        "product-analysis.started",
        "product-analysis.completed",
        "production.progress",
        "product.updated",
        "state.shared",
        "notify.info",
        "notify.warning",
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
    const unsub = deepIntelligenceEngine.subscribe(setSnap);
    deepIntelligenceEngine.hydrate();
    return () => {
      unsub();
      deepIntelligenceEngine.setNotify(null);
      deepIntelligenceEngine.setEventEmitter(null);
    };
  }, [notify]);

  const run = async (force = false) => {
    setBusy(true);
    try {
      await deepIntelligenceEngine.run({ force });
      workspaceStateEngine.autoSave.markDirty();
      notify("success", "Product Intelligence complete", "Verified facts were not overwritten. Review conflicts and inferences.", "ai-suggestions");
    } catch (error) {
      notify("error", "Intelligence failed", error instanceof Error ? error.message : "Unable to run", "errors");
    } finally {
      setBusy(false);
    }
  };

  const onContinue = async () => {
    setBusy(true);
    try {
      deepIntelligenceEngine.continueToStep3();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "Phase 3 Step 2 complete",
        "Master Product Intelligence Input saved. Opening Product Research.",
        "production-complete",
      );
      switchWorkspace("market-research");
    } catch (error) {
      notify("error", "Cannot continue", error instanceof Error ? error.message : "Incomplete", "errors");
    } finally {
      setBusy(false);
    }
  };

  const pkg = snap.package;
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  if (!pkg && !snap.progress.running && snap.recommendation.includes("No Visual")) {
    return (
      <div className="deep-intelligence">
        <header className="di-hero">
          <div>
            <span className="di-kicker">Phase 3 · Step 2</span>
            <h1>Deep Product Intelligence</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="di-panel">
          <button type="button" onClick={() => switchWorkspace("visual-analysis")}>Open AI Visual Analysis</button>
        </section>
      </div>
    );
  }

  return (
    <div className="deep-intelligence">
      <header className="di-hero">
        <div>
          <span className="di-kicker">Phase 3 · Step 2 · Product Intelligence Center</span>
          <h1>Deep Product Intelligence & Cross-Validation</h1>
          <p>
            Combines verified Product Profile data with Step 1 visual analysis.
            User-confirmed facts stay authoritative — AI observations and inferences stay separate.
          </p>
        </div>
        <div className="di-hero-stats">
          <div><b>{pkg?.scores.overall ?? "—"}%</b><span>Intelligence</span></div>
          <div><b>{pkg?.versionLabel ?? "—"}</b><span>Version</span></div>
          <div><b>{pkg?.warnings.length ?? 0}</b><span>Warnings</span></div>
          <div><b>{pkg?.coveragePercent ?? "—"}%</b><span>Coverage</span></div>
        </div>
      </header>

      <section className="di-toolbar">
        <div>
          <strong>{pkg?.productName || "Product intelligence"}</strong>
          <span>{snap.recommendation}</span>
          {!snap.serviceAvailable && <span className="di-warn-inline"> · Local cross-validation mode</span>}
        </div>
        <div className="di-toolbar-actions">
          <button type="button" onClick={() => void run(false)} disabled={busy || snap.progress.running}>
            <Play size={15} /> {pkg ? "Re-run Intelligence" : "Start Intelligence"}
          </button>
          <button type="button" onClick={() => void run(true)} disabled={busy || snap.progress.running}>
            <RefreshCw size={15} /> New Version
          </button>
          <button type="button" onClick={() => switchWorkspace("visual-analysis")}>Back to Visual Analysis</button>
          <button
            type="button"
            className="di-primary"
            disabled={busy || !pkg || (pkg.status !== "complete" && pkg.status !== "partial")}
            onClick={() => void onContinue()}
          >
            Save & Open Product Research
          </button>
        </div>
      </section>

      {(snap.progress.running || snap.progress.percent > 0) && (
        <section className="di-progress">
          <div className="di-progress-head">
            <h3><Brain size={16} /> Deep Product Intelligence</h3>
            <p>
              Cross-validating · {snap.progress.completed} / {snap.progress.total} · {snap.progress.percent}%
            </p>
          </div>
          <div className="di-progress-bar"><i style={{ width: `${snap.progress.percent}%` }} /></div>
          <p className="di-muted">{snap.progress.currentLabel}</p>
          <div className="di-stages">
            {INTEL_STAGES.map((stage) => (
              <span key={stage} className={snap.progress.currentStage === stage ? "active" : (snap.progress.percent >= 100 || (snap.progress.completed > INTEL_STAGES.indexOf(stage))) ? "done" : ""}>
                {INTEL_STAGE_LABELS[stage]}
              </span>
            ))}
          </div>
        </section>
      )}

      {pkg && (
        <>
          <Section title="Complete Product Intelligence" open={open.overview} onToggle={() => toggle("overview")}>
            <div className="di-summary">
              <div><span>Product</span><b>{pkg.productName}</b></div>
              <div><span>Category</span><b>{pkg.verifiedFacts.find((f) => f.field === "Category")?.value ?? "—"}</b></div>
              <div><span>Intelligence Score</span><b>{pkg.scores.overall}%</b></div>
              <div><span>Identity</span><b>{pkg.scores.identity}%</b></div>
              <div><span>Visual Understanding</span><b>{pkg.scores.visualUnderstanding}%</b></div>
              <div><span>Specification Support</span><b>{pkg.scores.specificationSupport}%</b></div>
              <div><span>Image Coverage</span><b>{pkg.scores.imageCoverage}%</b></div>
              <div><span>Consistency</span><b>{pkg.scores.consistency}%</b></div>
            </div>
            <p className="di-muted">{pkg.scores.explanation}</p>
          </Section>

          <Section title="Verified Facts" open={open.verified} onToggle={() => toggle("verified")}>
            <ItemList items={pkg.verifiedFacts} />
          </Section>

          <Section title="Visual Observations" open={open.observations} onToggle={() => toggle("observations")}>
            <ItemList items={pkg.visualObservations} />
          </Section>

          <Section title="AI Inferences" open={open.inferences} onToggle={() => toggle("inferences")}>
            <p className="di-muted">Never treat these as verified product claims.</p>
            <ItemList
              items={pkg.inferences}
              onReview={(id, s) => deepIntelligenceEngine.setItemReview(id, s)}
            />
          </Section>

          <Section title="Identity (User vs Visual)" open={Boolean(open.identity)} onToggle={() => toggle("identity")}>
            {pkg.identity.map((row) => (
              <p key={row.field} className={row.mark === "conflict" ? "di-warn" : "di-fact"}>
                <strong>{row.field}:</strong> User {row.userValue} · Visual {row.visualValue} · {markLabel(row.mark)} · {Math.round(row.confidence * 100)}%
              </p>
            ))}
          </Section>

          <Section title="Cross-Validation" open={open.cross} onToggle={() => toggle("cross")}>
            <CheckList checks={pkg.crossValidation} onReview={(id, s) => deepIntelligenceEngine.setCrossReview(id, s)} />
          </Section>

          <Section title="Specification Cross-Check" open={Boolean(open.specs)} onToggle={() => toggle("specs")}>
            <CheckList checks={pkg.specificationChecks} onReview={(id, s) => deepIntelligenceEngine.setCrossReview(id, s)} />
          </Section>

          <Section title="Logo & Text Cross-Validation" open={Boolean(open.logo)} onToggle={() => toggle("logo")}>
            <CheckList checks={pkg.logoTextChecks} onReview={(id, s) => deepIntelligenceEngine.setCrossReview(id, s)} />
          </Section>

          <Section title="Features" open={Boolean(open.features)} onToggle={() => toggle("features")}>
            <ItemList items={pkg.features} />
          </Section>

          <Section title="Characteristics" open={Boolean(open.chars)} onToggle={() => toggle("chars")}>
            <ItemList items={pkg.characteristics} />
          </Section>

          <Section title="Possible Differentiators" open={open.differentiators} onToggle={() => toggle("differentiators")}>
            <p className="di-muted">Not market-wide USPs — candidates for later Marketing Intelligence.</p>
            <ItemList items={pkg.differentiators} onReview={(id, s) => deepIntelligenceEngine.setItemReview(id, s)} />
          </Section>

          <Section title="Benefit Signals" open={Boolean(open.benefits)} onToggle={() => toggle("benefits")}>
            <ItemList items={pkg.benefits} onReview={(id, s) => deepIntelligenceEngine.setItemReview(id, s)} />
          </Section>

          <Section title="Variant Intelligence" open={Boolean(open.variants)} onToggle={() => toggle("variants")}>
            {!pkg.variants.length && <p className="di-muted">No variants declared.</p>}
            {pkg.variants.map((v, i) => (
              <p key={`${v.declared}-${i}`} className="di-fact">
                <strong>{v.label}:</strong> {v.declared} · {v.status === "visually-supported" ? `✓ Supported (${v.visualSupport})` : "USER-PROVIDED / NOT VISUALLY VERIFIED"}
              </p>
            ))}
          </Section>

          <Section title="Consistency" open={open.consistency} onToggle={() => toggle("consistency")}>
            <p className="di-fact"><strong>Product:</strong> {markLabel(pkg.consistency.product)}</p>
            <p className="di-fact"><strong>Images:</strong> {markLabel(pkg.consistency.images)}</p>
            <p className="di-fact"><strong>Specifications:</strong> {markLabel(pkg.consistency.specifications)}</p>
            <p className="di-fact"><strong>Variants:</strong> {markLabel(pkg.consistency.variants)}</p>
            <p className="di-muted">{pkg.consistency.note}</p>
          </Section>

          <Section title="Image Coverage" open={Boolean(open.coverage)} onToggle={() => toggle("coverage")}>
            <div className="di-coverage">
              {pkg.coverage.map((row) => (
                <span key={row.view} className={row.status === "available" ? "ok" : row.need === "required" ? "critical" : "miss"}>
                  {row.status === "available" ? "✓" : row.need === "optional" ? "○" : "⚠"} {row.view}
                  <small>{row.need}</small>
                </span>
              ))}
            </div>
            <p className="di-muted">Coverage {pkg.coveragePercent}% — unnecessary views are not required.</p>
          </Section>

          <Section title="Missing / Unknown" open={open.unknown} onToggle={() => toggle("unknown")}>
            <ItemList items={pkg.unknown} onReview={(id, s) => deepIntelligenceEngine.setItemReview(id, s)} />
          </Section>

          <Section title="Warnings" open={Boolean(open.warnings)} onToggle={() => toggle("warnings")}>
            {!pkg.warnings.length && <p className="di-ok"><CheckCircle2 size={14} /> No warnings.</p>}
            {pkg.warnings.map((w) => (
              <p key={w.id} className={w.severity === "critical" ? "di-err" : "di-warn"}>
                {w.severity === "critical" ? "✕" : "⚠"} {w.title}: {w.detail}
              </p>
            ))}
          </Section>

          <Section title="Version History" open={Boolean(open.history)} onToggle={() => toggle("history")}>
            <p className="di-fact"><strong>Current:</strong> {pkg.versionLabel} · {pkg.intelligenceId}</p>
            {!pkg.history.length && <p className="di-muted">No prior versions.</p>}
            {pkg.history.map((h) => (
              <p key={h.intelligenceId} className="di-muted">{h.versionLabel} · score {h.overallScore}% · {h.createdAt}</p>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function markLabel(mark: string): string {
  if (mark === "consistent") return "CONSISTENT ✓";
  if (mark === "conflict") return "POSSIBLE CONFLICT ⚠";
  if (mark === "not-visually-verified") return "NOT VISUALLY VERIFIED";
  return "UNCERTAIN";
}

function ItemList({
  items,
  onReview,
}: {
  items: LayeredItem[];
  onReview?: (id: string, status: ReviewStatus) => void;
}) {
  return (
    <ul className="di-item-list">
      {items.map((it) => (
        <li key={it.id}>
          <div>
            <strong>{it.kind === "verified" ? "✓" : it.kind === "ai-inference" ? "⚠" : "•"} {it.field}:</strong> {it.value}
            <small> {Math.round(it.confidence * 100)}% · {it.band.toUpperCase()} · {it.kind}</small>
            <p className="di-muted">{it.reason}</p>
            {it.evidence[0] && (
              <p className="di-muted">
                Evidence: {it.evidence[0].fileName ?? "profile"} · {it.evidence[0].detection} · {it.evidence[0].engineId}
              </p>
            )}
          </div>
          {onReview && (
            <div className="di-review-actions">
              <button type="button" onClick={() => onReview(it.id, "accepted")}>Accept</button>
              <button type="button" onClick={() => onReview(it.id, "rejected")}>Reject</button>
              <button type="button" onClick={() => onReview(it.id, "keep-user")}>Keep User Value</button>
              <button type="button" onClick={() => onReview(it.id, "reviewed")}>Mark Reviewed</button>
              <span className="di-muted">{it.reviewStatus}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function CheckList({
  checks,
  onReview,
}: {
  checks: CrossCheck[];
  onReview: (id: string, status: ReviewStatus) => void;
}) {
  if (!checks.length) return <p className="di-muted">No checks.</p>;
  return (
    <ul className="di-item-list">
      {checks.map((c) => (
        <li key={c.id}>
          <div>
            <strong>{c.field}:</strong> User {c.userValue} · Visual {c.visualValue} · {markLabel(c.mark)}
            <p className={c.mark === "conflict" ? "di-warn" : "di-muted"}>{c.detail}</p>
          </div>
          <div className="di-review-actions">
            <button type="button" onClick={() => onReview(c.id, "accepted")}>Accept</button>
            <button type="button" onClick={() => onReview(c.id, "rejected")}>Reject</button>
            <button type="button" onClick={() => onReview(c.id, "keep-user")}>Keep User Value</button>
            <button type="button" onClick={() => onReview(c.id, "reviewed")}>Mark Reviewed</button>
            <span className="di-muted">{c.reviewStatus}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="di-panel">
      <button type="button" className="di-section-head" onClick={onToggle}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3>{title}</h3>
      </button>
      {open && <div className="di-section-body">{children}</div>}
    </section>
  );
}
