import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Globe, Play, RefreshCw } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { marketResearchEngine } from "./research-engine";
import type { MarketResearchSnapshot, SourceAction } from "./types";
import { RESEARCH_STAGES, RESEARCH_STAGE_LABELS } from "./types";
import "./market-research.css";

export function MarketResearchWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<MarketResearchSnapshot>(() => marketResearchEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    overview: true, sources: true, customer: true, market: true, angles: true, knowledge: false,
  });

  useEffect(() => {
    marketResearchEngine.setNotify(notify);
    marketResearchEngine.setEventEmitter((type, payload) => {
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
    const unsub = marketResearchEngine.subscribe(setSnap);
    marketResearchEngine.hydrate();
    return () => {
      unsub();
      marketResearchEngine.setNotify(null);
      marketResearchEngine.setEventEmitter(null);
    };
  }, [notify]);

  const run = async (force = false) => {
    setBusy(true);
    try {
      await marketResearchEngine.run({ force });
      workspaceStateEngine.autoSave.markDirty();
      notify("success", "Research complete", "Insights are recommendations — Marketing Brief was not overwritten.", "ai-suggestions");
    } catch (error) {
      notify("error", "Research failed", error instanceof Error ? error.message : "Unable to research", "errors");
    } finally {
      setBusy(false);
    }
  };

  const onContinue = async () => {
    setBusy(true);
    try {
      marketResearchEngine.continueToStep4();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "Phase 3 Step 3 complete",
        "Research Package saved. Opening Master Intelligence Report.",
        "production-complete",
      );
      switchWorkspace("master-intelligence");
    } catch (error) {
      notify("error", "Cannot continue", error instanceof Error ? error.message : "Incomplete", "errors");
    } finally {
      setBusy(false);
    }
  };

  const pkg = snap.package;
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  if (!pkg && !snap.progress.running && snap.recommendation.includes("No Master")) {
    return (
      <div className="market-research">
        <header className="mr-hero">
          <div>
            <span className="mr-kicker">Phase 3 · Step 3</span>
            <h1>AI Product Research Center</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="mr-panel">
          <button type="button" onClick={() => switchWorkspace("deep-intelligence")}>Open Product Intelligence</button>
        </section>
      </div>
    );
  }

  return (
    <div className="market-research">
      <header className="mr-hero">
        <div>
          <span className="mr-kicker">Phase 3 · Step 3 · Research Center</span>
          <h1>Online Knowledge Research, Market & Customer Intelligence</h1>
          <p>
            Targeted research from Product Intelligence + Marketing Brief + local Knowledge Base.
            Offline First. No invented statistics. Marketing Brief is not overwritten.
          </p>
        </div>
        <div className="mr-hero-stats">
          <div><b>{snap.internetAvailable == null ? "—" : snap.internetAvailable ? "ONLINE" : "OFFLINE"}</b><span>Internet</span></div>
          <div><b>{(snap.researchMode ?? "—").toString().toUpperCase()}</b><span>Mode</span></div>
          <div><b>{pkg?.queries.length ?? 0}</b><span>Queries</span></div>
          <div><b>{pkg?.sources.length ?? 0}</b><span>Sources</span></div>
          <div><b>{pkg?.knowledge.length ?? 0}</b><span>Knowledge</span></div>
        </div>
      </header>

      <section className="mr-toolbar">
        <div>
          <strong>{pkg?.productName || "Product research"}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="mr-toolbar-actions">
          <button type="button" onClick={() => void run(false)} disabled={busy || snap.progress.running}>
            <Play size={15} /> {pkg ? "Re-run Research" : "Start Research"}
          </button>
          <button type="button" onClick={() => void run(true)} disabled={busy || snap.progress.running}>
            <RefreshCw size={15} /> New Version
          </button>
          <button type="button" onClick={() => switchWorkspace("deep-intelligence")}>Back to Intelligence</button>
          <button
            type="button"
            className="mr-primary"
            disabled={busy || !pkg || (pkg.status !== "complete" && pkg.status !== "partial")}
            onClick={() => void onContinue()}
          >
            Save & Open Master Intelligence
          </button>
        </div>
      </section>

      {(snap.progress.running || snap.progress.percent > 0) && (
        <section className="mr-progress">
          <div className="mr-progress-head">
            <h3><Globe size={16} /> RESEARCH PROGRESS</h3>
            <p>{snap.progress.percent}% · {snap.progress.currentLabel}</p>
          </div>
          <div className="mr-progress-bar"><i style={{ width: `${snap.progress.percent}%` }} /></div>
          <div className="mr-stages">
            {RESEARCH_STAGES.map((stage, idx) => (
              <span key={stage} className={snap.progress.currentStage === stage ? "active" : snap.progress.completed > idx ? "done" : ""}>
                {RESEARCH_STAGE_LABELS[stage]}
              </span>
            ))}
          </div>
        </section>
      )}

      {pkg && (
        <>
          <Section title="Research Overview" open={open.overview} onToggle={() => toggle("overview")}>
            <div className="mr-summary">
              <div><span>Product</span><b>{pkg.productName}</b></div>
              <div><span>Mode</span><b>{pkg.researchMode.toUpperCase()}</b></div>
              <div><span>Queries</span><b>{pkg.queries.length}</b></div>
              <div><span>Sources</span><b>{pkg.sources.length}</b></div>
              <div><span>Knowledge</span><b>{pkg.knowledge.length}</b></div>
              <div><span>Customer Insights</span><b>{pkg.customerInsights.length}</b></div>
              <div><span>Market Insights</span><b>{pkg.marketInsights.length}</b></div>
              <div><span>Marketing Angles</span><b>{pkg.marketingAngles.length}</b></div>
              <div><span>Version</span><b>{pkg.versionLabel}</b></div>
              <div><span>Language</span><b>{pkg.workingLanguage}</b></div>
            </div>
            {pkg.localKnowledgeAge && <p className="mr-muted">LOCAL KNOWLEDGE · Knowledge Age/Version: {pkg.localKnowledgeAge}</p>}
            {pkg.insufficientMarketData && <p className="mr-warn">INSUFFICIENT VERIFIED MARKET DATA — no invented statistics.</p>}
            {pkg.noLocalKnowledge && <p className="mr-warn">NO LOCAL KNOWLEDGE AVAILABLE</p>}
            <p className="mr-muted">{pkg.audienceRefinement}</p>
            <div className="mr-queries">
              {pkg.queries.map((q) => <span key={q.id}>{q.text}</span>)}
            </div>
          </Section>

          <Section title="Sources" open={open.sources} onToggle={() => toggle("sources")}>
            {pkg.sources.map((s) => (
              <article key={s.id} className="mr-source">
                <strong>{s.title}</strong>
                <p className="mr-muted">{s.domain} · {s.sourceType} · Quality {s.quality} · Relevance {Math.round(s.relevance * 100)}%</p>
                <p>{s.extracted}</p>
                <p className="mr-muted">{s.url}</p>
                <div className="mr-review-actions">
                  {(["keep", "ignore", "important"] as SourceAction[]).map((a) => (
                    <button key={a} type="button" onClick={() => marketResearchEngine.setSourceAction(s.id, a)}>{a}</button>
                  ))}
                  <span className="mr-muted">{s.action}</span>
                </div>
              </article>
            ))}
          </Section>

          <Section title="Customer Intelligence" open={open.customer} onToggle={() => toggle("customer")}>
            <InsightBlock title="Insights" rows={pkg.customerInsights} />
            <InsightBlock title="Pain points" rows={pkg.painPoints} />
            <InsightBlock title="Desires" rows={pkg.desires} />
            <InsightBlock title="Motivations" rows={pkg.motivations} />
            <InsightBlock title="Objections" rows={pkg.objections} />
          </Section>

          <Section title="Market & Competitive Intelligence" open={open.market} onToggle={() => toggle("market")}>
            <InsightBlock title="Market" rows={pkg.marketInsights} />
            <InsightBlock title="Competitive (strategic only)" rows={pkg.competitiveInsights} />
            <InsightBlock title="Platform" rows={pkg.platformNotes} />
          </Section>

          <Section title="Marketing Insights (recommendations)" open={open.angles} onToggle={() => toggle("angles")}>
            {pkg.marketingAngles.map((a) => (
              <article key={a.id} className="mr-source">
                <strong>{a.name}</strong>
                <p><b>Problem:</b> {a.customerProblem}</p>
                <p><b>Benefit:</b> {a.productBenefit}</p>
                <p><b>Message:</b> {a.suggestedMessage}</p>
                <p className="mr-muted">Confidence {Math.round(a.confidence * 100)}% · {a.supportingEvidence}</p>
                {a.verificationFlag && <p className="mr-warn">{a.verificationFlag}</p>}
              </article>
            ))}
          </Section>

          <Section title="Knowledge items" open={open.knowledge} onToggle={() => toggle("knowledge")}>
            {pkg.knowledge.slice(0, 40).map((k) => (
              <p key={k.id} className="mr-fact">
                <strong>{k.kind}:</strong> {k.claim}
                <small> · {Math.round(k.confidence * 100)}% · {k.freshness}</small>
              </p>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function InsightBlock({ title, rows }: { title: string; rows: Array<{ id: string; label: string; detail: string; kind: string; confidence: number; evidenceLevel: string; sourceOrReason: string }> }) {
  if (!rows.length) return <p className="mr-muted">{title}: none.</p>;
  return (
    <div className="mr-block">
      <h4>{title}</h4>
      {rows.map((r) => (
        <p key={r.id} className="mr-fact">
          <strong>{r.label}:</strong> {r.detail}
          <small> · {r.kind} · {Math.round(r.confidence * 100)}% · {r.evidenceLevel} · {r.sourceOrReason}</small>
        </p>
      ))}
    </div>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="mr-panel">
      <button type="button" className="mr-section-head" onClick={onToggle}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3>{title}</h3>
      </button>
      {open && <div className="mr-section-body">{children}</div>}
    </section>
  );
}
