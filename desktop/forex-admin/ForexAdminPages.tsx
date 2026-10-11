import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PATTERN_DETECTION_DISCLAIMER,
  emptyPatternFields,
  patternFieldsFromUnknown,
  serializePatternContent,
  type ForexPatternKnowledgeFields,
} from "../../ai/forex-knowledge/pattern-content";
import {
  forexAdminApi,
  forexProvidersApi,
  type ForexAdminCategory,
  type ForexAdminDocument,
  type ForexAdminOverview,
  type ForexAdminRetrieveHit,
  type ForexAdminTopic,
} from "./api";
import type { ForexAdminViewId } from "./forex-admin-routes";
import {
  ForexAdminJournalDetailPage,
  ForexAdminJournalPage,
  ForexAdminLearningPage,
  ForexAdminMemoryPage,
  ForexAdminMistakesPage,
  ForexAdminOutcomesPage,
} from "./ForexAdminMemoryPages";
import {
  ForexAdminAiConfigurationPage,
  ForexAdminRetrievalDiagnosticsPage,
  ForexAdminSystemHealthPage,
} from "./ForexAdminIntelligencePages";
import { ForexAdminInstrumentsPage } from "./ForexAdminInstrumentsPage";
import { ForexAdminHistoricalPage } from "./ForexAdminHistoricalPage";
import { ForexAdminStreamPage } from "./ForexAdminStreamPage";
import { ForexAdminForexConnectPage } from "./ForexAdminForexConnectPage";

const KNOWLEDGE_TYPES = [
  "DEFINITION", "CONCEPT", "RULE", "EXPLANATION", "PROCEDURE", "PATTERN",
  "INDICATOR", "STRATEGY_CONCEPT", "RISK_RULE", "EXAMPLE", "WARNING", "AI_GUIDELINE",
];

function toneForStatus(status: string): "ok" | "warn" | "danger" | "neutral" {
  if (status === "PUBLISHED" || status === "INDEXED") return "ok";
  if (status === "DRAFT" || status === "STALE" || status === "INDEXING" || status === "NOT_INDEXED") return "warn";
  if (status === "FAILED" || status === "ARCHIVED") return "danger";
  return "neutral";
}

function Badge({ value }: { value: string }) {
  const tone = toneForStatus(value);
  return <span className="fxa-badge" data-tone={tone === "neutral" ? undefined : tone}>{value}</span>;
}

export function ForexAdminDashboardPage({ onOpen }: { onOpen: (path: string) => void }) {
  const [overview, setOverview] = useState<ForexAdminOverview | null>(null);
  const [fxcmHealth, setFxcmHealth] = useState<Record<string, unknown> | null>(null);
  const [fxcmAuth, setFxcmAuth] = useState<Record<string, unknown> | null>(null);
  const [unifiedProviders, setUnifiedProviders] = useState<Array<Record<string, unknown>>>([]);
  const [authBusy, setAuthBusy] = useState(false);
  const [authNote, setAuthNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFxcm = () => {
    void forexProvidersApi.fxcmStatus()
      .then((res) => {
        setFxcmHealth(res.health);
        setFxcmAuth((res.authentication as Record<string, unknown>) ?? null);
        setAuthNote(res.note ?? null);
      })
      .catch(() => setFxcmHealth({ status: "UNAVAILABLE", environmentLabel: "FXCM", liveStreamEnabled: false }));
    void forexProvidersApi.unifiedStatus()
      .then((res) => setUnifiedProviders(res.providers ?? []))
      .catch(() => setUnifiedProviders([]));
  };

  useEffect(() => {
    void forexAdminApi.overview()
      .then((res) => setOverview(res.overview))
      .catch((err: Error) => setError(err.message));
    loadFxcm();
  }, []);

  const testAuth = async () => {
    setAuthBusy(true);
    try {
      const res = await forexProvidersApi.fxcmAuthenticate();
      setFxcmAuth(res.authentication);
      setAuthNote(res.note ?? null);
      loadFxcm();
    } catch (err) {
      setAuthNote(err instanceof Error ? err.message : "FXCM authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  if (error) return <div className="fxa-error" role="alert">{error}</div>;
  if (!overview) return <p className="fxa-muted">Loading Forex AI admin overview…</p>;

  const authBlock = (fxcmAuth?.authentication as Record<string, unknown> | undefined) ?? null;
  const authState = String(authBlock?.state ?? (fxcmHealth?.authenticated ? "AUTHENTICATED" : "NOT_CONFIGURED"));
  const unifiedFxcm = unifiedProviders.find((p) => String(p.provider) === "FXCM");
  const unifiedBinance = unifiedProviders.find((p) => String(p.provider) === "BINANCE");
  const fxcmCaps = (unifiedFxcm?.capabilities as Record<string, boolean> | undefined) ?? {};
  const liveStreamLabel = fxcmHealth?.liveStreamEnabled
    ? "ENABLED"
    : fxcmCaps.streaming
      ? "CAPABLE (not LIVE until fresh quote)"
      : "DISABLED / NOT CONFIGURED";

  return (
    <div data-forex-admin-dashboard>
      <section className="fxa-card">
        <h2>FOREX AI ADMIN</h2>
        <p className="fxa-muted">
          Operational control for Forex intelligence + unified market data (BINANCE + FXCM).
          Trading execution is disabled. LIVE requires a genuine fresh provider event.
        </p>
      </section>
      <section className="fxa-card" data-forex-admin-unified-providers>
        <h3>UNIFIED MARKET DATA</h3>
        <p className="fxa-muted">Phase 31/32 provider registry health. No cross-provider fallback.</p>
        <ul>
          <li>
            BINANCE · {String(unifiedBinance?.authentication ?? "—")} · connection {String(unifiedBinance?.connection ?? "—")}
            · liveCandles={String((unifiedBinance?.capabilities as Record<string, boolean> | undefined)?.liveCandles ?? false)}
            · trading=false
          </li>
          <li>
            FXCM · {String(unifiedFxcm?.authentication ?? authState)} · connection {String(unifiedFxcm?.connection ?? fxcmHealth?.connectionState ?? "—")}
            · liveCandles={String(fxcmCaps.liveCandles ?? false)}
            · trading=false
          </li>
        </ul>
      </section>
      <section className="fxa-card" data-forex-admin-forexconnect-summary>
        <h3>FOREXCONNECT</h3>
        <p className="fxa-muted">
          DEMO / LIVE account profiles · SDK sidecar · trading disabled.
        </p>
        <button type="button" className="fxa-btn" onClick={() => onOpen("/admin/forex/forexconnect")}>
          Manage ForexConnect Accounts
        </button>
      </section>
      <section className="fxa-card" data-forex-admin-fxcm-status>
        <h3>FXCM SOCKET REST (legacy path)</h3>
        <p className="fxa-muted">
          Phases 26–30: authentication, discovery, historical, streaming, live candles via Socket REST.
          Trading disabled. CONNECTED ≠ LIVE. Prefer ForexConnect for live-account username/password auth.
          Socket REST still uses Trading Station Web access token (KWIZERA_FXCM_*).
        </p>
        <ul>
          <li>Provider: FXCM</li>
          <li>Environment: {String(fxcmAuth?.environmentLabel ?? fxcmHealth?.environmentLabel ?? "—")}</li>
          <li>Configuration: {(fxcmAuth?.configured ?? fxcmHealth?.configured) ? "CONFIGURED" : "NOT CONFIGURED"}</li>
          <li>Authentication: {authState}</li>
          <li>Last authentication: {String(authBlock?.authenticatedAt ?? "—")}</li>
          <li>Session: {String(authBlock?.session ?? "NONE")}</li>
          <li>API: {fxcmHealth?.status === "CONNECTED" ? "CONNECTED" : String(fxcmHealth?.status ?? "DISCONNECTED")}</li>
          <li>Instrument Discovery: {String(fxcmHealth?.instrumentDiscovery ?? "—")}</li>
          <li>Historical: {fxcmCaps.historical ? "ENABLED" : "NOT AVAILABLE"}</li>
          <li>Live Stream: {liveStreamLabel}</li>
          <li>Live Candles: {fxcmCaps.liveCandles ? "ENABLED" : "NOT AVAILABLE"}</li>
          <li>Trading: DISABLED</li>
          {authBlock?.lastErrorMessage
            ? <li>Safe error: {String(authBlock.lastErrorMessage)}</li>
            : null}
        </ul>
        {authNote ? <p className="fxa-muted">{authNote}</p> : null}
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="fxa-btn" disabled={authBusy} onClick={() => void testAuth()}>
            {authBusy ? "Authenticating…" : "Test FXCM Authentication"}
          </button>
          <button type="button" className="fxa-btn-secondary" onClick={() => onOpen("/admin/forex/instruments")}>
            FXCM Instruments
          </button>
          <button type="button" className="fxa-btn-secondary" onClick={() => onOpen("/admin/forex/historical-data")}>
            FXCM Historical
          </button>
          <button type="button" className="fxa-btn-secondary" onClick={() => onOpen("/admin/forex/stream")}>
            FXCM Stream
          </button>
          <button type="button" className="fxa-btn-secondary" onClick={() => onOpen("/admin/forex/ai-configuration")}>
            Open AI Configuration
          </button>
        </div>
      </section>
      <section className="fxa-grid">
        {[
          ["Documents", overview.documents],
          ["Published", overview.published],
          ["Drafts", overview.drafts],
          ["Indexed", overview.indexed],
          ["Stale", overview.stale],
          ["Failed", overview.failed],
          ["Categories", overview.categories],
          ["Topics", overview.topics],
        ].map(([label, value]) => (
          <article className="fxa-card fxa-stat" key={String(label)}>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>
      <section className="fxa-card">
        <div className="fxa-row" style={{ justifyContent: "space-between" }}>
          <h3>Recent knowledge updates</h3>
          <button type="button" className="fxa-btn" onClick={() => onOpen("/admin/forex/knowledge/new")}>
            New document
          </button>
        </div>
        {overview.recentUpdates.length === 0 ? (
          <p className="fxa-muted">No knowledge documents yet. Production may legitimately show zeros.</p>
        ) : (
          <div className="fxa-table-wrap">
            <table className="fxa-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Index</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentUpdates.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button type="button" className="fxa-btn-secondary" onClick={() => onOpen(`/admin/forex/knowledge/${item.id}`)}>
                        {item.title}
                      </button>
                    </td>
                    <td><Badge value={item.status} /></td>
                    <td><Badge value={item.indexingStatus} /></td>
                    <td className="fxa-muted">{new Date(item.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function ForexAdminKnowledgeListPage({
  onOpen,
  title = "AI Training",
  defaultType,
}: {
  onOpen: (path: string) => void;
  title?: string;
  defaultType?: string;
}) {
  const [items, setItems] = useState<ForexAdminDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [overview, setOverview] = useState<ForexAdminOverview | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [indexingStatus, setIndexingStatus] = useState("");
  const [knowledgeType, setKnowledgeType] = useState(defaultType ?? "");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfPublish, setPdfPublish] = useState(false);
  const [pdfNote, setPdfNote] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [res, ov] = await Promise.all([
        forexAdminApi.listKnowledge({
          q, status, indexingStatus, knowledgeType, page, pageSize: 20,
        }),
        forexAdminApi.overview(),
      ]);
      setItems(res.items);
      setTotal(res.total);
      setOverview(ov.overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void load();
  }, [page, status, indexingStatus, knowledgeType]);

  const onPdfFile = async (file: File | null) => {
    if (!file) return;
    setPdfBusy(true);
    setPdfNote(null);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
      const dataBase64 = btoa(binary);
      const res = await forexAdminApi.uploadPdf({
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        dataBase64,
        publish: pdfPublish,
      });
      const state = String(res.document.metadata?.ingestionState ?? "");
      if (state === "FAILED" || res.document.indexingStatus === "FAILED") {
        setPdfNote(res.document.indexingError || "PDF ingestion failed (no extractable text or invalid PDF).");
      } else {
        setPdfNote(`Ingested “${res.document.title}” · ${state || res.document.indexingStatus}`);
      }
      onOpen(`/admin/forex/knowledge/${res.document.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div data-forex-admin-knowledge-list>
      <section className="fxa-card">
        <div className="fxa-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>{title}</h2>
            <p className="fxa-muted">
              Keyword-indexed Forex knowledge for AI retrieval. Educational content only — not live trading signals.
            </p>
          </div>
          <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="fxa-btn" onClick={() => onOpen("/admin/forex/knowledge/new")}>
              Create document
            </button>
            <button
              type="button"
              className="fxa-btn-secondary"
              onClick={() => onOpen("/admin/forex/knowledge/new?type=PATTERN")}
            >
              New pattern
            </button>
          </div>
        </div>
      </section>
      {overview ? (
        <section className="fxa-grid" data-forex-ai-training-overview>
          {[
            ["Documents", overview.documents],
            ["Published", overview.published],
            ["Drafts", overview.drafts],
            ["Indexed", overview.indexed],
            ["Failed index", overview.failed],
            ["Failed ingest", overview.failedIngestion ?? 0],
            ["Chunks", overview.chunks],
            ["Last indexed", overview.lastIndexingAt ? new Date(overview.lastIndexingAt).toLocaleString() : "—"],
          ].map(([label, value]) => (
            <article className="fxa-card fxa-stat" key={String(label)}>
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </section>
      ) : null}
      <section className="fxa-card" data-forex-pdf-upload>
        <h3>Upload PDF</h3>
        <p className="fxa-muted">
          Extract searchable text from educational PDFs (max 15 MB). Scanned/image-only PDFs fail honestly — no OCR.
        </p>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={pdfBusy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void onPdfFile(f);
              e.target.value = "";
            }}
          />
          <label className="fxa-muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={pdfPublish} onChange={(e) => setPdfPublish(e.target.checked)} />
            Publish &amp; index after extract
          </label>
        </div>
        {pdfBusy ? <p className="fxa-muted">Uploading &amp; extracting…</p> : null}
        {pdfNote ? <p className="fxa-muted">{pdfNote}</p> : null}
      </section>
      <section className="fxa-card">
        <div className="fxa-row" style={{ marginTop: "0.25rem" }}>
          <input className="fxa-input" style={{ maxWidth: 260 }} placeholder="Search title, content, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="fxa-select" style={{ maxWidth: 160 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
          <select className="fxa-select" style={{ maxWidth: 180 }} value={indexingStatus} onChange={(e) => { setPage(1); setIndexingStatus(e.target.value); }}>
            <option value="">All index states</option>
            <option value="NOT_INDEXED">NOT_INDEXED</option>
            <option value="INDEXING">INDEXING</option>
            <option value="INDEXED">INDEXED</option>
            <option value="STALE">STALE</option>
            <option value="FAILED">FAILED</option>
          </select>
          <select className="fxa-select" style={{ maxWidth: 200 }} value={knowledgeType} onChange={(e) => { setPage(1); setKnowledgeType(e.target.value); }}>
            <option value="">All types</option>
            {KNOWLEDGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <button type="button" className="fxa-btn-secondary" onClick={() => { setPage(1); void load(); }}>Search</button>
          <span className="fxa-muted">{total} document(s)</span>
        </div>
      </section>
      {error ? <div className="fxa-error">{error}</div> : null}
      <section className="fxa-card fxa-table-wrap">
        <table className="fxa-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Index</th>
              <th>Ingest</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="fxa-muted">No documents match these filters.</td></tr>
            ) : items.map((doc) => (
              <tr key={doc.id}>
                <td>
                  <button type="button" className="fxa-btn-secondary" onClick={() => onOpen(`/admin/forex/knowledge/${doc.id}`)}>
                    {doc.title}
                  </button>
                </td>
                <td>{doc.knowledgeType}</td>
                <td><Badge value={doc.status} /></td>
                <td><Badge value={doc.indexingStatus} /></td>
                <td className="fxa-muted">{String(doc.metadata?.ingestionState ?? "—")}</td>
                <td className="fxa-muted">{new Date(doc.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="fxa-row" style={{ marginTop: "0.75rem" }}>
          <button type="button" className="fxa-btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
          <span className="fxa-muted">Page {page}</span>
          <button type="button" className="fxa-btn-secondary" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </section>
    </div>
  );
}

export function ForexAdminKnowledgeEditorPage({
  documentId,
  onOpen,
}: {
  documentId: string | null;
  onOpen: (path: string) => void;
}) {
  const editing = Boolean(documentId);
  const initialType = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("type") || "CONCEPT"
    : "CONCEPT";
  const [categories, setCategories] = useState<ForexAdminCategory[]>([]);
  const [topics, setTopics] = useState<ForexAdminTopic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pattern, setPattern] = useState<ForexPatternKnowledgeFields>(emptyPatternFields());
  const [form, setForm] = useState({
    title: "",
    summary: "",
    content: "",
    categoryId: "",
    topicId: "",
    tags: "",
    knowledgeType: initialType === "PATTERN" ? "PATTERN" : "CONCEPT",
    sourceType: "MANUAL",
    sourceName: "",
    sourceReference: "",
    sourceUrl: "",
    language: "en",
    status: "DRAFT",
  });

  useEffect(() => {
    void forexAdminApi.categories().then((res) => setCategories(res.categories)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!form.categoryId) {
      setTopics([]);
      return;
    }
    void forexAdminApi.topics(form.categoryId).then((res) => setTopics(res.topics)).catch(() => undefined);
  }, [form.categoryId]);

  useEffect(() => {
    if (!documentId) return;
    void forexAdminApi.getKnowledge(documentId)
      .then((res) => {
        const doc = res.document;
        setForm({
          title: doc.title,
          summary: doc.summary,
          content: doc.content,
          categoryId: doc.categoryId ?? "",
          topicId: doc.topicId ?? "",
          tags: doc.tags.join(", "),
          knowledgeType: doc.knowledgeType,
          sourceType: doc.sourceType,
          sourceName: doc.sourceName,
          sourceReference: doc.sourceReference,
          sourceUrl: doc.sourceUrl,
          language: doc.language,
          status: doc.status,
        });
        if (doc.knowledgeType === "PATTERN") {
          setPattern(patternFieldsFromUnknown(doc.metadata?.pattern ?? {
            patternName: doc.title,
            description: doc.summary,
            tags: doc.tags,
          }));
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [documentId]);

  const isPattern = form.knowledgeType === "PATTERN";

  const save = async (publishAfter = false) => {
    setSaving(true);
    setError(null);
    try {
      let title = form.title;
      let content = form.content;
      let tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      let metadata: Record<string, unknown> | undefined;
      if (isPattern) {
        const fields: ForexPatternKnowledgeFields = {
          ...pattern,
          patternName: pattern.patternName || form.title,
          detectionDisclaimer: pattern.detectionDisclaimer || DEFAULT_PATTERN_DETECTION_DISCLAIMER,
          tags: pattern.tags.length ? pattern.tags : tags,
        };
        content = serializePatternContent(fields);
        title = fields.patternName || title;
        tags = fields.tags.length ? fields.tags : tags;
        metadata = { pattern: fields };
      }
      const payload = {
        title,
        summary: form.summary,
        content,
        categoryId: form.categoryId || null,
        topicId: form.topicId || null,
        tags,
        knowledgeType: form.knowledgeType,
        sourceType: form.sourceType,
        sourceName: form.sourceName,
        sourceReference: form.sourceReference,
        sourceUrl: form.sourceUrl,
        language: form.language,
        status: publishAfter ? "PUBLISHED" : form.status === "ARCHIVED" ? "DRAFT" : form.status,
        metadata,
      };
      const res = editing
        ? await forexAdminApi.updateKnowledge(documentId!, payload)
        : await forexAdminApi.createKnowledge(payload);
      let doc = res.document;
      if (publishAfter && doc.status !== "PUBLISHED") {
        doc = (await forexAdminApi.publish(doc.id)).document;
      } else if (publishAfter && doc.indexingStatus !== "INDEXED") {
        doc = (await forexAdminApi.reindex(doc.id)).document;
      }
      onOpen(`/admin/forex/knowledge/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const setPat = <K extends keyof ForexPatternKnowledgeFields>(key: K, value: ForexPatternKnowledgeFields[K]) => {
    setPattern((p) => ({ ...p, [key]: value }));
  };

  return (
    <div data-forex-admin-editor>
      <section className="fxa-card">
        <h2>{editing ? "Edit AI Training entry" : "Create AI Training entry"}</h2>
        <p className="fxa-muted">Save as draft for editing only. Publish makes the document available for AI retrieval after indexing.</p>
      </section>
      {error ? <div className="fxa-error">{error}</div> : null}
      <section className="fxa-card fxa-form">
        <label>Title<input className="fxa-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></label>
        <label>Summary<textarea className="fxa-textarea" style={{ minHeight: 90 }} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} /></label>
        <div className="fxa-row">
          <label style={{ flex: 1 }}>Category
            <select className="fxa-select" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value, topicId: "" }))}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label style={{ flex: 1 }}>Topic
            <select className="fxa-select" value={form.topicId} onChange={(e) => setForm((f) => ({ ...f, topicId: e.target.value }))}>
              <option value="">None</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label style={{ flex: 1 }}>Knowledge type
            <select className="fxa-select" value={form.knowledgeType} onChange={(e) => setForm((f) => ({ ...f, knowledgeType: e.target.value }))}>
              {KNOWLEDGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        </div>
        {isPattern ? (
          <div data-forex-pattern-fields>
            <p className="fxa-muted" role="note">{DEFAULT_PATTERN_DETECTION_DISCLAIMER}</p>
            <label>Pattern name<input className="fxa-input" value={pattern.patternName} onChange={(e) => setPat("patternName", e.target.value)} /></label>
            <label>Aliases (comma-separated)<input className="fxa-input" value={pattern.aliases.join(", ")} onChange={(e) => setPat("aliases", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></label>
            <label>Pattern category<input className="fxa-input" value={pattern.category} onChange={(e) => setPat("category", e.target.value)} /></label>
            <label>Interpretation
              <select className="fxa-select" value={pattern.interpretation} onChange={(e) => setPat("interpretation", e.target.value as ForexPatternKnowledgeFields["interpretation"])}>
                <option value="">—</option>
                <option value="BULLISH">BULLISH</option>
                <option value="BEARISH">BEARISH</option>
                <option value="NEUTRAL">NEUTRAL</option>
              </select>
            </label>
            <label>Description<textarea className="fxa-textarea" value={pattern.description} onChange={(e) => setPat("description", e.target.value)} /></label>
            <label>Preconditions<textarea className="fxa-textarea" style={{ minHeight: 80 }} value={pattern.preconditions} onChange={(e) => setPat("preconditions", e.target.value)} /></label>
            <label>Market context<textarea className="fxa-textarea" style={{ minHeight: 80 }} value={pattern.marketContext} onChange={(e) => setPat("marketContext", e.target.value)} /></label>
            <label>Recognition criteria (educational)<textarea className="fxa-textarea" value={pattern.recognitionRules} onChange={(e) => setPat("recognitionRules", e.target.value)} /></label>
            <label>Confirmation requirements<textarea className="fxa-textarea" style={{ minHeight: 80 }} value={pattern.confirmationRequirements} onChange={(e) => setPat("confirmationRequirements", e.target.value)} /></label>
            <label>Invalidation<textarea className="fxa-textarea" style={{ minHeight: 80 }} value={pattern.invalidationConditions} onChange={(e) => setPat("invalidationConditions", e.target.value)} /></label>
            <label>Common false positives<textarea className="fxa-textarea" style={{ minHeight: 80 }} value={pattern.falsePositives} onChange={(e) => setPat("falsePositives", e.target.value)} /></label>
            <label>Timeframe notes<textarea className="fxa-textarea" style={{ minHeight: 80 }} value={pattern.timeframeNotes} onChange={(e) => setPat("timeframeNotes", e.target.value)} /></label>
            <label>Source references<textarea className="fxa-textarea" style={{ minHeight: 80 }} value={pattern.sourceReferences} onChange={(e) => setPat("sourceReferences", e.target.value)} /></label>
            <label>Pattern tags (comma-separated)<input className="fxa-input" value={pattern.tags.join(", ")} onChange={(e) => setPat("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></label>
          </div>
        ) : (
          <label>Content<textarea className="fxa-textarea" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} /></label>
        )}
        <label>Tags (comma-separated)<input className="fxa-input" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} /></label>
        <div className="fxa-row">
          <label style={{ flex: 1 }}>Source name<input className="fxa-input" value={form.sourceName} onChange={(e) => setForm((f) => ({ ...f, sourceName: e.target.value }))} /></label>
          <label style={{ flex: 1 }}>Source reference<input className="fxa-input" value={form.sourceReference} onChange={(e) => setForm((f) => ({ ...f, sourceReference: e.target.value }))} /></label>
          <label style={{ flex: 1 }}>Language<input className="fxa-input" value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} /></label>
        </div>
        <div className="fxa-row">
          <button type="button" className="fxa-btn-secondary" disabled={saving} onClick={() => void save(false)}>Save</button>
          <button type="button" className="fxa-btn" disabled={saving} onClick={() => void save(true)}>Publish &amp; index</button>
          <button type="button" className="fxa-btn-secondary" onClick={() => onOpen("/admin/forex/knowledge")}>Cancel</button>
        </div>
      </section>
    </div>
  );
}

export function ForexAdminKnowledgeDetailPage({
  documentId,
  onOpen,
}: {
  documentId: string;
  onOpen: (path: string) => void;
}) {
  const [doc, setDoc] = useState<ForexAdminDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrieveHits, setRetrieveHits] = useState<ForexAdminRetrieveHit[]>([]);

  const reload = async () => {
    const res = await forexAdminApi.getKnowledge(documentId);
    setDoc(res.document);
  };

  useEffect(() => {
    void reload().catch((err: Error) => setError(err.message));
  }, [documentId]);

  if (error && !doc) return <div className="fxa-error">{error}</div>;
  if (!doc) return <p className="fxa-muted">Loading document…</p>;

  const run = async (action: "publish" | "unpublish" | "archive" | "reindex") => {
    setError(null);
    try {
      const res = await forexAdminApi[action](doc.id);
      setDoc(res.document);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteDoc = async () => {
    if (!window.confirm(`Delete “${doc.title}”? This removes the document and its chunks permanently.`)) return;
    setError(null);
    try {
      await forexAdminApi.deleteKnowledge(doc.id);
      onOpen("/admin/forex/knowledge");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const ingestionState = String(doc.metadata?.ingestionState ?? "—");
  const contentHash = typeof doc.metadata?.contentHash === "string" ? String(doc.metadata.contentHash) : null;
  const isPdf = doc.sourceType === "PDF";

  return (
    <div data-forex-admin-detail>
      <section className="fxa-card">
        <div className="fxa-row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>{doc.title}</h2>
            <p className="fxa-muted">{doc.summary || "No summary"}</p>
            <div className="fxa-row">
              <Badge value={doc.status} />
              <Badge value={doc.indexingStatus} />
              <Badge value={doc.knowledgeType} />
              {isPdf ? <Badge value="PDF" /> : null}
              <span className="fxa-muted">v{doc.version}</span>
            </div>
          </div>
          <div className="fxa-row" style={{ flexWrap: "wrap" }}>
            <button type="button" className="fxa-btn-secondary" onClick={() => onOpen(`/admin/forex/knowledge/${doc.id}/edit`)}>Edit</button>
            {doc.status !== "PUBLISHED" ? <button type="button" className="fxa-btn" onClick={() => void run("publish")}>Publish</button> : null}
            {doc.status === "PUBLISHED" ? <button type="button" className="fxa-btn-secondary" onClick={() => void run("unpublish")}>Unpublish</button> : null}
            {doc.status === "PUBLISHED" || isPdf ? (
              <button type="button" className="fxa-btn-secondary" onClick={() => void run("reindex")} disabled={doc.status !== "PUBLISHED"}>
                {isPdf ? "Retry / re-index" : "Re-index"}
              </button>
            ) : null}
            {doc.status !== "ARCHIVED" ? <button type="button" className="fxa-btn-danger" onClick={() => void run("archive")}>Archive</button> : null}
            <button type="button" className="fxa-btn-danger" onClick={() => void deleteDoc()}>Delete</button>
          </div>
        </div>
      </section>
      {error ? <div className="fxa-error">{error}</div> : null}
      <section className="fxa-card">
        <h3>Content</h3>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{doc.content || "(empty)"}</pre>
      </section>
      <section className="fxa-card">
        <h3>Metadata</h3>
        <p className="fxa-muted">Slug: {doc.slug}</p>
        <p className="fxa-muted">Tags: {doc.tags.join(", ") || "—"}</p>
        <p className="fxa-muted">Source type: {doc.sourceType}</p>
        <p className="fxa-muted">Source: {doc.sourceName || "—"} / {doc.sourceReference || "—"}</p>
        <p className="fxa-muted">Ingestion state: {ingestionState}</p>
        {contentHash ? <p className="fxa-muted">Content hash: {contentHash.slice(0, 16)}…</p> : null}
        {doc.metadata?.pageCount != null ? <p className="fxa-muted">PDF pages: {String(doc.metadata.pageCount)}</p> : null}
        <p className="fxa-muted">Created: {new Date(doc.createdAt).toLocaleString()}</p>
        <p className="fxa-muted">Updated: {new Date(doc.updatedAt).toLocaleString()}</p>
        <p className="fxa-muted">Published: {doc.publishedAt ? new Date(doc.publishedAt).toLocaleString() : "—"}</p>
        <p className="fxa-muted">Indexed: {doc.indexedAt ? new Date(doc.indexedAt).toLocaleString() : "—"}</p>
        {doc.indexingError ? <p className="fxa-error">{doc.indexingError}</p> : null}
      </section>
      <section className="fxa-card">
        <h3>Retrieval probe</h3>
        <p className="fxa-muted">Draft/archived knowledge must not appear. Published + indexed knowledge should.</p>
        <button
          type="button"
          className="fxa-btn-secondary"
          onClick={() => {
            void forexAdminApi.retrieve({ query: doc.title, limit: 5 })
              .then((res) => setRetrieveHits(res.hits))
              .catch((err: Error) => setError(err.message));
          }}
        >
          Retrieve by title
        </button>
        {retrieveHits.length === 0 ? (
          <p className="fxa-muted">No retrieval hits yet.</p>
        ) : (
          <ul>
            {retrieveHits.map((hit, index) => (
              <li key={`${hit.chunkId ?? hit.title}-${index}`}>
                <strong>{hit.documentTitle || hit.title}</strong> · score {hit.relevanceScore.toFixed(2)}
                {hit.pageNumber != null ? <span className="fxa-muted"> · page {hit.pageNumber}</span> : null}
                {hit.sourceName ? <span className="fxa-muted"> · {hit.sourceName}</span> : null}
                <div className="fxa-muted">{hit.content.slice(0, 220)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ForexAdminTaxonomyPage({ kind }: { kind: "categories" | "topics" }) {
  const [categories, setCategories] = useState<ForexAdminCategory[]>([]);
  const [topics, setTopics] = useState<ForexAdminTopic[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const cats = await forexAdminApi.categories();
    setCategories(cats.categories);
    if (kind === "topics") {
      const tops = await forexAdminApi.topics(categoryId || undefined);
      setTopics(tops.topics);
    }
  };

  useEffect(() => {
    void reload().catch((err: Error) => setError(err.message));
  }, [kind, categoryId]);

  return (
    <div>
      <section className="fxa-card">
        <h2>{kind === "categories" ? "Categories" : "Topics"}</h2>
        <p className="fxa-muted">Dynamic Forex taxonomy for knowledge organization and future retrieval filters.</p>
      </section>
      {error ? <div className="fxa-error">{error}</div> : null}
      <section className="fxa-card fxa-form">
        {kind === "topics" ? (
          <label>Category
            <select className="fxa-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        ) : null}
        <label>Name<input className="fxa-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Description<input className="fxa-input" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <button
          type="button"
          className="fxa-btn"
          onClick={() => {
            void (async () => {
              setError(null);
              try {
                if (kind === "categories") {
                  await forexAdminApi.createCategory({ name, description });
                } else {
                  await forexAdminApi.createTopic({ categoryId, name, description });
                }
                setName("");
                setDescription("");
                await reload();
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            })();
          }}
        >
          Create {kind === "categories" ? "category" : "topic"}
        </button>
      </section>
      <section className="fxa-card fxa-table-wrap">
        <table className="fxa-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {(kind === "categories" ? categories : topics).map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td className="fxa-muted">{item.slug}</td>
                <td className="fxa-muted">{item.description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function ForexAdminStatusPage() {
  const [overview, setOverview] = useState<ForexAdminOverview | null>(null);
  useEffect(() => {
    void forexAdminApi.overview().then((res) => setOverview(res.overview)).catch(() => undefined);
  }, []);
  if (!overview) return <p className="fxa-muted">Loading status…</p>;
  return (
    <section className="fxa-card" data-forex-admin-status>
      <h2>Knowledge &amp; indexing status</h2>
      <p className="fxa-muted">Truthful pipeline states only — no fake “model trained” claims.</p>
      <ul>
        <li>Published: {overview.published}</li>
        <li>Indexed: {overview.indexed}</li>
        <li>Stale: {overview.stale}</li>
        <li>Failed: {overview.failed}</li>
        <li>Not indexed: {overview.notIndexed}</li>
        <li>Chunks: {overview.chunks}</li>
      </ul>
    </section>
  );
}

export function ForexAdminSettingsPage() {
  return (
    <section className="fxa-card" data-forex-admin-settings>
      <h2>Forex Admin settings</h2>
      <p className="fxa-muted">
        Forex Admin APIs require the same Admin API token as Admin Control Center when
        <code> KWIZERA_ADMIN_AUTH_MODE=require-admin-token</code>. Enter the token in ForexConnect /
        session storage (shared key with Admin Control Center → API Access). Development may use
        open access until the mode is tightened.
      </p>
      <p className="fxa-muted">
        Canonical entry: <code>/admin/forex</code>. This surface is independent from General Admin navigation.
      </p>
      <p className="fxa-muted">
        Ollama remains the shared Phase 17 provider. Market State remains the Phase 18 live-data domain. AI Training (keyword knowledge) is separate.
      </p>
    </section>
  );
}

export function ForexAdminNotFound({ onOpen }: { onOpen: (path: string) => void }) {
  return (
    <section className="fxa-card">
      <h2>Forex Admin page not found</h2>
      <button type="button" className="fxa-btn" onClick={() => onOpen("/admin/forex")}>Back to Forex Admin</button>
    </section>
  );
}

export function titleForView(view: ForexAdminViewId): string {
  const map: Record<string, string> = {
    dashboard: "Forex AI Admin Dashboard",
    forexconnect: "ForexConnect",
    instruments: "FXCM Instruments",
    "historical-data": "FXCM Historical Data",
    stream: "FXCM Real-Time Stream",
    knowledge: "AI Training",
    "ai-training": "AI Training",
    "knowledge-documents": "Documents",
    "knowledge-topics": "Topics",
    "knowledge-categories": "Categories",
    "knowledge-concepts": "Concepts",
    "knowledge-status": "AI Training Status",
    indexing: "Indexing",
    "ai-configuration": "AI Configuration",
    "retrieval-diagnostics": "Retrieval Diagnostics",
    "system-health": "System Health",
    settings: "Settings",
    "knowledge-new": "New AI Training",
    "knowledge-edit": "Edit AI Training",
    "knowledge-detail": "AI Training Detail",
    memory: "AI Memory",
    journal: "AI Journal",
    "journal-detail": "Journal Detail",
    outcomes: "Outcomes",
    mistakes: "Mistakes",
    learning: "Learning",
    "not-found": "Not Found",
  };
  return map[view] ?? "Forex Admin";
}

export function ForexAdminPageRouter({
  view,
  documentId,
  onOpen,
}: {
  view: ForexAdminViewId;
  documentId: string | null;
  onOpen: (path: string) => void;
}) {
  const body = useMemo(() => {
    switch (view) {
      case "dashboard":
        return <ForexAdminDashboardPage onOpen={onOpen} />;
      case "forexconnect":
        return <ForexAdminForexConnectPage />;
      case "instruments":
        return <ForexAdminInstrumentsPage onOpen={onOpen} />;
      case "historical-data":
        return <ForexAdminHistoricalPage onOpen={onOpen} />;
      case "stream":
        return <ForexAdminStreamPage onOpen={onOpen} />;
      case "knowledge":
      case "ai-training":
      case "knowledge-documents":
        return <ForexAdminKnowledgeListPage onOpen={onOpen} title="AI Training" />;
      case "knowledge-concepts":
        return <ForexAdminKnowledgeListPage onOpen={onOpen} title="Concepts" defaultType="CONCEPT" />;
      case "knowledge-new":
        return <ForexAdminKnowledgeEditorPage documentId={null} onOpen={onOpen} />;
      case "knowledge-edit":
        return documentId
          ? <ForexAdminKnowledgeEditorPage documentId={documentId} onOpen={onOpen} />
          : <ForexAdminNotFound onOpen={onOpen} />;
      case "knowledge-detail":
        return documentId
          ? <ForexAdminKnowledgeDetailPage documentId={documentId} onOpen={onOpen} />
          : <ForexAdminNotFound onOpen={onOpen} />;
      case "knowledge-categories":
        return <ForexAdminTaxonomyPage kind="categories" />;
      case "knowledge-topics":
        return <ForexAdminTaxonomyPage kind="topics" />;
      case "knowledge-status":
      case "indexing":
        return <ForexAdminStatusPage />;
      case "ai-configuration":
        return <ForexAdminAiConfigurationPage />;
      case "retrieval-diagnostics":
        return <ForexAdminRetrievalDiagnosticsPage />;
      case "system-health":
        return <ForexAdminSystemHealthPage />;
      case "settings":
        return <ForexAdminSettingsPage />;
      case "memory":
        return <ForexAdminMemoryPage onOpen={onOpen} />;
      case "journal":
        return <ForexAdminJournalPage onOpen={onOpen} />;
      case "journal-detail":
        return documentId
          ? <ForexAdminJournalDetailPage analysisId={documentId} onOpen={onOpen} />
          : <ForexAdminNotFound onOpen={onOpen} />;
      case "outcomes":
        return <ForexAdminOutcomesPage />;
      case "mistakes":
        return <ForexAdminMistakesPage />;
      case "learning":
        return <ForexAdminLearningPage />;
      default:
        return <ForexAdminNotFound onOpen={onOpen} />;
    }
  }, [view, documentId, onOpen]);

  return body;
}
