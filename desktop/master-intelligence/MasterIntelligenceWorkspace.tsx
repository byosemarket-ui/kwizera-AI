import { useEffect, useState, type ReactNode } from "react";
import {
  CheckCircle2, ChevronDown, ChevronRight, FileText, Play, RefreshCw, ShieldCheck,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { masterIntelligenceEngine } from "./master-engine";
import type { ClaimSafetyEntry, MasterIntelligenceSnapshot } from "./types";
import { MASTER_STAGES, MASTER_STAGE_LABELS } from "./types";
import "./master-intelligence.css";

export function MasterIntelligenceWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<MasterIntelligenceSnapshot>(() => masterIntelligenceEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    overview: true,
    facts: true,
    visual: false,
    features: false,
    benefits: true,
    customer: true,
    market: true,
    marketing: true,
    creative: true,
    claims: true,
    restrictions: true,
    missing: true,
    sources: false,
  });

  useEffect(() => {
    masterIntelligenceEngine.setNotify(notify);
    masterIntelligenceEngine.setEventEmitter((type, payload) => {
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
    const unsub = masterIntelligenceEngine.subscribe(setSnap);
    masterIntelligenceEngine.hydrate();
    return () => {
      unsub();
      masterIntelligenceEngine.setNotify(null);
      masterIntelligenceEngine.setEventEmitter(null);
    };
  }, [notify]);

  const run = async (force = false) => {
    setBusy(true);
    try {
      await masterIntelligenceEngine.run({ force });
      workspaceStateEngine.autoSave.markDirty();
      notify("success", "Master Intelligence drafted", "Review claims, then confirm. Nothing is finalized yet.", "ai-suggestions");
    } catch (error) {
      notify("error", "Compilation failed", error instanceof Error ? error.message : "Unable to compile", "errors");
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    setBusy(true);
    try {
      masterIntelligenceEngine.confirm();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "Phase 3 complete",
        "Master Product Intelligence confirmed. Opening Marketing Strategy.",
        "production-complete",
      );
      switchWorkspace("marketing-strategy");
    } catch (error) {
      notify("error", "Cannot confirm", error instanceof Error ? error.message : "Review required", "errors");
    } finally {
      setBusy(false);
    }
  };

  const pkg = snap.package;
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  if (!pkg && !snap.progress.running && snap.recommendation.includes("No Step 3")) {
    return (
      <div className="master-intel">
        <header className="mi-hero">
          <div>
            <span className="mi-kicker">Phase 3 · Step 4</span>
            <h1>Master Product Intelligence</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="mi-panel">
          <button type="button" onClick={() => switchWorkspace("market-research")}>Open Product Research</button>
        </section>
      </div>
    );
  }

  return (
    <div className="master-intel">
      <header className="mi-hero">
        <div>
          <span className="mi-kicker">Phase 3 · Step 4 · Final</span>
          <h1>Master Product Intelligence Review</h1>
          <p>
            Consolidates Visual Analysis, Product Intelligence, Research, Product Profile, and the Marketing Brief
            into one confirmed package. This is a creative brief — not a story, script, or video.
          </p>
        </div>
        <div className="mi-hero-stats">
          <div><b>{pkg?.productName || "—"}</b><span>PRODUCT</span></div>
          <div><b>{pkg?.identity.category || "—"}</b><span>CATEGORY</span></div>
          <div><b>{pkg ? `${pkg.scores.overall}%` : "—"}</b><span>INTELLIGENCE SCORE</span></div>
          <div><b>{pkg ? `${pkg.sectionConfidence.overall}%` : "—"}</b><span>CONFIDENCE</span></div>
        </div>
      </header>

      <section className="mi-toolbar">
        <div>
          <strong>{pkg?.versionLabel ? `Master Intelligence ${pkg.versionLabel}` : "Not compiled"}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="mi-toolbar-actions">
          <button type="button" onClick={() => void run(false)} disabled={busy || snap.progress.running}>
            <Play size={15} /> {pkg ? "Run Analysis Again" : "Compile Intelligence"}
          </button>
          <button type="button" onClick={() => void run(true)} disabled={busy || snap.progress.running}>
            <RefreshCw size={15} /> New Version
          </button>
          <button type="button" onClick={() => switchWorkspace("product-information")}>Edit Product</button>
          <button type="button" onClick={() => switchWorkspace("market-research")}>Edit Research</button>
          <button type="button" onClick={() => switchWorkspace("marketing")}>Edit Marketing</button>
          <button type="button" onClick={() => toggle("claims")}>Review Claims</button>
          <button
            type="button"
            className="mi-primary"
            disabled={busy || !pkg || pkg.userConfirmed || (pkg.status !== "review" && pkg.status !== "draft")}
            onClick={() => void onConfirm()}
          >
            <ShieldCheck size={15} /> Confirm Intelligence
          </button>
          {pkg?.userConfirmed && (
            <button type="button" className="mi-primary" onClick={() => switchWorkspace("marketing-strategy")}>
              Open Marketing Strategy
            </button>
          )}
        </div>
      </section>

      {(snap.progress.running || snap.progress.percent > 0) && (
        <section className="mi-progress">
          <div className="mi-progress-head">
            <h3><FileText size={16} /> COMPILATION PROGRESS</h3>
            <p>{snap.progress.percent}% · {snap.progress.currentLabel}</p>
          </div>
          <div className="mi-progress-bar"><i style={{ width: `${snap.progress.percent}%` }} /></div>
          <div className="mi-stages">
            {MASTER_STAGES.map((stage, idx) => (
              <span key={stage} className={snap.progress.currentStage === stage ? "active" : snap.progress.completed > idx ? "done" : ""}>
                {MASTER_STAGE_LABELS[stage]}
              </span>
            ))}
          </div>
        </section>
      )}

      {pkg && (
        <>
          <section className="mi-checklist">
            <CheckRow ok label="Verified Facts" />
            <CheckRow ok label="Visual Intelligence" />
            <CheckRow ok label="Customer Intelligence" />
            <CheckRow ok={!!pkg.marketIntelligence.length} label="Market Intelligence" />
            <CheckRow ok label="Marketing Insights" />
            <CheckRow ok label="Creative Direction" />
            <CheckRow ok={!!pkg.claimSafety.length} label="Claim Safety" />
            <CheckRow ok={!!pkg.restrictions.length} label="Restrictions" />
            <div><b>{pkg.missingInformation.length}</b><span>MISSING INFORMATION</span></div>
            {pkg.userConfirmed && (
              <div className="ok"><b>CONFIRMED</b><span>PHASE 3 COMPLETE</span></div>
            )}
          </section>

          <Panel id="overview" title="Product Identity" open={open.overview} onToggle={toggle}>
            <dl className="mi-dl">
              <dt>Name</dt><dd>{pkg.identity.name || "—"}</dd>
              <dt>Brand</dt><dd>{pkg.identity.brand || "—"}</dd>
              <dt>Category</dt><dd>{pkg.identity.category || "—"}</dd>
              <dt>Subcategory</dt><dd>{pkg.identity.subcategory || "—"}</dd>
              <dt>Model</dt><dd>{pkg.identity.model || "—"}</dd>
              <dt>Variants</dt><dd>{pkg.identity.variants.join(" · ") || "—"}</dd>
              <dt>Identity Confidence</dt><dd>{pkg.identity.identityConfidence}%</dd>
            </dl>
          </Panel>

          <Panel id="facts" title="Verified Product Facts" open={open.facts} onToggle={toggle}>
            <p className="mi-note">Copied from the confirmed Product Profile. Not rewritten.</p>
            <dl className="mi-dl">
              <dt>Price</dt><dd>{pkg.verifiedFacts.price == null ? "—" : `${pkg.verifiedFacts.price} ${pkg.verifiedFacts.currency}`}</dd>
              <dt>SKU</dt><dd>{pkg.verifiedFacts.sku || "—"}</dd>
              <dt>Barcode</dt><dd>{pkg.verifiedFacts.barcode || "—"}</dd>
              <dt>Materials</dt><dd>{pkg.verifiedFacts.materials.join(", ") || "—"}</dd>
              <dt>Colors</dt><dd>{pkg.verifiedFacts.colors.join(", ") || "—"}</dd>
              <dt>Sizes</dt><dd>{pkg.verifiedFacts.sizes.join(", ") || "—"}</dd>
              <dt>Warranty</dt><dd>{pkg.verifiedFacts.warranty || "—"}</dd>
              <dt>Description</dt><dd>{pkg.verifiedFacts.description || "—"}</dd>
            </dl>
          </Panel>

          <Panel id="visual" title="Visual Intelligence" open={open.visual} onToggle={toggle}>
            <p>Confidence {pkg.visualIntelligence.confidence}%</p>
            <ul>
              <li>Appearance: {pkg.visualIntelligence.appearance}</li>
              <li>Color: {pkg.visualIntelligence.color || "—"}</li>
              <li>Logo: {pkg.visualIntelligence.logo}</li>
              <li>Quality: {pkg.visualIntelligence.imageQuality}</li>
              <li>Coverage: {pkg.visualIntelligence.imageCoverage}</li>
              <li>Background: {pkg.visualIntelligence.background || "—"}</li>
            </ul>
          </Panel>

          <Panel id="features" title="Features, Differentiators & Benefits" open={open.features} onToggle={toggle}>
            {pkg.features.slice(0, 12).map((f) => (
              <article key={f.id} className="mi-row">
                <strong>{f.value}</strong>
                <span>{f.classification} · {Math.round(f.confidence <= 1 ? f.confidence * 100 : f.confidence)}% · {f.source}</span>
              </article>
            ))}
            {pkg.benefits.map((b) => (
              <article key={b.id} className="mi-row">
                <strong>Benefit: {b.benefit}</strong>
                <span>{b.classification} · {b.source}</span>
              </article>
            ))}
          </Panel>

          <Panel id="customer" title="Customer Intelligence" open={open.customer} onToggle={toggle}>
            <p className="mi-note">Category research is not a guaranteed fact about every customer.</p>
            {pkg.customerIntelligence.slice(0, 10).map((c) => (
              <article key={c.id} className="mi-row">
                <strong>{c.label}</strong>
                <span>{c.detail}</span>
                <em>{c.classification} · {c.source}</em>
              </article>
            ))}
          </Panel>

          <Panel id="market" title="Market & Competitive Intelligence" open={open.market} onToggle={toggle}>
            {pkg.marketIntelligence.map((m) => (
              <article key={m.id} className="mi-row">
                <strong>{m.label}</strong>
                <span>{m.detail}</span>
                <em>{m.classification}{m.freshness ? ` · ${m.freshness}` : ""}</em>
              </article>
            ))}
            {pkg.competitiveIntelligence.slice(0, 6).map((c) => (
              <article key={c.id} className="mi-row">
                <strong>{c.label}</strong>
                <span>{c.detail}</span>
              </article>
            ))}
          </Panel>

          <Panel id="marketing" title="Marketing Insights (AI Recommendation)" open={open.marketing} onToggle={toggle}>
            <p className="mi-note">These do not overwrite the Phase 2 Marketing Brief.</p>
            {pkg.marketingInsights.map((m) => (
              <article key={m.id} className="mi-row">
                <strong>{m.label}</strong>
                <span>{m.detail}</span>
                <em>{m.classification}</em>
              </article>
            ))}
            <p>CTA direction: {pkg.ctaDirection}</p>
          </Panel>

          <Panel id="creative" title="Creative Direction" open={open.creative} onToggle={toggle}>
            <p className="mi-note">{pkg.creativeDirection.note}</p>
            <dl className="mi-dl">
              <dt>Visual Style</dt><dd>{pkg.creativeDirection.visualStyle}</dd>
              <dt>Mood / Tone / Energy</dt><dd>{pkg.creativeDirection.mood} · {pkg.creativeDirection.tone} · {pkg.creativeDirection.energy}</dd>
              <dt>Story Direction</dt><dd>{pkg.creativeDirection.storyDirection}</dd>
              <dt>Presentation</dt><dd>{pkg.creativeDirection.productPresentation}</dd>
              <dt>Background</dt><dd>{pkg.creativeDirection.backgroundDirection}</dd>
              <dt>Lighting</dt><dd>{pkg.creativeDirection.lightingDirection}</dd>
              <dt>Brand Feeling</dt><dd>{pkg.creativeDirection.brandFeeling || "—"}</dd>
            </dl>
            <h4>Content opportunities</h4>
            {pkg.contentOpportunities.map((o) => (
              <article key={o.id} className="mi-row">
                <strong>{o.name}</strong>
                <span>{o.suggestedAngle}</span>
                <em>Confidence {Math.round(o.confidence <= 1 ? o.confidence * 100 : o.confidence)}%</em>
              </article>
            ))}
          </Panel>

          <Panel id="claims" title="Claim Safety Register" open={open.claims} onToggle={toggle}>
            {pkg.claimSafety.map((c) => (
              <article key={c.id} className="mi-row">
                <strong>{c.claim}</strong>
                <span className={`mi-tag ${claimClass(c.status)}`}>{c.status}</span>
                <span>{c.reason}</span>
                {!pkg.userConfirmed && (
                  <div className="mi-claim-actions">
                    <button type="button" onClick={() => masterIntelligenceEngine.setClaimDecision(c.id, "keep")}>Keep</button>
                    <button type="button" onClick={() => masterIntelligenceEngine.setClaimDecision(c.id, "avoid")}>Avoid</button>
                    <em>{c.userDecision}</em>
                  </div>
                )}
              </article>
            ))}
          </Panel>

          <Panel id="restrictions" title="Production Restrictions" open={open.restrictions} onToggle={toggle}>
            {pkg.restrictions.map((r) => (
              <article key={r.id} className="mi-row">
                <strong>{r.category}</strong>
                <span>{r.detail}</span>
              </article>
            ))}
          </Panel>

          <Panel id="missing" title="Missing Information" open={open.missing} onToggle={toggle}>
            {pkg.missingInformation.length === 0 && <p>No missing-information items recorded.</p>}
            {pkg.missingInformation.map((m) => (
              <article key={m.id} className="mi-row">
                <strong>{m.severity}</strong>
                <span>{m.detail}</span>
                <em>{m.blocksProduction ? "May block sales-style production" : "Does not block production"}</em>
              </article>
            ))}
          </Panel>

          <Panel id="sources" title="Sources, Freshness & Score" open={open.sources} onToggle={toggle}>
            <p>{pkg.scores.explanation}</p>
            {pkg.sources.slice(0, 12).map((s) => (
              <article key={s.id} className="mi-row">
                <strong>{s.title}</strong>
                <span>{s.domain} · {s.quality} · {s.freshness}</span>
              </article>
            ))}
            <p>Status: {pkg.status} · Confirmed: {pkg.userConfirmed ? "yes" : "no"} · Phase 3: {pkg.phase3Complete ? "complete" : "open"}</p>
          </Panel>
        </>
      )}
    </div>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={ok ? "ok" : ""}>
      <b>{ok ? "✓" : "—"}</b>
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
    <section className="mi-panel">
      <button type="button" className="mi-panel-toggle" onClick={() => onToggle(id)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {title}
      </button>
      {open && <div className="mi-panel-body">{children}</div>}
    </section>
  );
}

function claimClass(status: ClaimSafetyEntry["status"]): string {
  if (status === "SAFE / VERIFIED") return "ok";
  if (status === "SUPPORTED BUT REVIEW") return "warn";
  if (status === "DO NOT USE") return "err";
  return "muted";
}
