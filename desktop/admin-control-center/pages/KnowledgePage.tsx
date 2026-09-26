import { useEffect, useState } from "react";
import {
  adminApi,
  type AdminKnowledgeContext,
  type AdminKnowledgeItem,
  type AdminKnowledgeJob,
  type AdminKnowledgeOverview,
  type AdminKnowledgeRetrieval,
  type AdminKnowledgeSource,
} from "../admin-api";
import { adminAuthErrorMessage, isAdminAuthError } from "../admin-auth";
import {
  AuthLockedState, DataTable, Drawer, EmptyState, ErrorState, FormField, LoadingState, PageHeader, SectionCard, Select,
  StatCard, StatusBadge, Tabs, Toast,
} from "../components/ui";

type TabId = "sources" | "jobs" | "retrievals" | "search" | "add";

const REGISTRABLE_TYPES = ["OFFICIAL_DOCUMENTATION", "PUBLIC_WEB", "RESEARCH_REFERENCE", "STRUCTURED_REFERENCE", "INTERNAL_DOCUMENT"];

/** Admin Knowledge Base: sources, provenance, trust, ingestion jobs, index health and retrieval observability. */
export function KnowledgePage({ onGoToApiAccess }: { onGoToApiAccess?: () => void }) {
  const [overview, setOverview] = useState<AdminKnowledgeOverview | null>(null);
  const [sources, setSources] = useState<AdminKnowledgeSource[]>([]);
  const [jobs, setJobs] = useState<AdminKnowledgeJob[]>([]);
  const [retrievals, setRetrievals] = useState<AdminKnowledgeRetrieval[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [tab, setTab] = useState<TabId>("sources");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authLocked, setAuthLocked] = useState(false);
  const [authDetail, setAuthDetail] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "success" | "error" } | null>(null);

  const notify = (message: string, tone: "info" | "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4_000);
  };

  const load = () => {
    setLoading(true);
    setError(null);
    setAuthLocked(false);
    Promise.all([
      adminApi.knowledgeOverview(),
      adminApi.knowledgeSources(),
      adminApi.knowledgeJobs(),
      adminApi.knowledgeRetrievals(),
      adminApi.knowledgeDomains(),
    ])
      .then(([o, s, j, r, d]) => {
        setOverview(o.overview);
        setSources(s.items);
        setJobs(j.items);
        setRetrievals(r.items);
        setDomains(d.domains.map((x) => x.id));
        setTasks(d.tasks);
      })
      .catch((err: unknown) => {
        if (isAdminAuthError(err)) {
          setAuthLocked(true);
          setAuthDetail(adminAuthErrorMessage(err));
          return;
        }
        setError(err instanceof Error ? err.message : "Knowledge failed to load");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const run = (label: string, action: () => Promise<unknown>) => {
    action()
      .then(() => {
        notify(label);
        load();
      })
      .catch((err: unknown) => notify(err instanceof Error ? err.message : "Action failed", "error"));
  };

  const index = overview?.index;

  return (
    <div className="acc-page">
      <PageHeader
        title="Knowledge"
        description="Curated reference knowledge used as guidance by planners. Sources carry provenance and trust; web content is never trusted automatically."
        breadcrumbs={[{ label: "Admin" }, { label: "AI Control" }, { label: "Knowledge" }]}
        actions={(
          <>
            <button type="button" className="acc-button ghost" onClick={() => run("Stale sources queued for refresh", adminApi.refreshStaleKnowledge)}>Refresh stale</button>
            <button type="button" className="acc-button ghost" onClick={() => run("Index rebuilt", adminApi.reindexKnowledge)}>Reindex</button>
            <button type="button" className="acc-button" onClick={load}>Reload</button>
          </>
        )}
      />
      <Toast message={toast?.message ?? null} tone={toast?.tone} />
      {loading && <LoadingState />}
      {authLocked && !loading && <AuthLockedState detail={authDetail ?? undefined} onGoToApiAccess={onGoToApiAccess} />}
      {error && !authLocked && <ErrorState title="Knowledge failed to load" detail={error} onRetry={load} />}
      {!loading && !error && !authLocked && overview && index && (
        <>
          <div className="acc-stat-grid">
            <StatCard label="Active items" value={index.active} hint={`${index.legacy} legacy records`} />
            <StatCard label="Sources" value={overview.sources.total} hint={`${overview.sources.failing} with errors`} />
            <StatCard label="Needs review" value={index.needsReview} />
            <StatCard label="Retrieval mode" value={overview.retrievalMode} hint={overview.onlineRetrieval ? "Online retrieval enabled" : "Online retrieval off"} />
            <StatCard label="Avg retrieval" value={`${overview.retrieval.averageDurationMs} ms`} hint={`${overview.retrieval.recentCount} recent`} />
          </div>
          <p className="acc-muted">{overview.semanticNote}</p>
          <SectionCard title="Index composition">
            <DataTable
              columns={[{ key: "group", label: "Group" }, { key: "values", label: "Counts" }]}
              rows={[
                ["Domain", index.byDomain],
                ["Source type", index.bySourceType],
                ["Trust", index.byTrust],
                ["Freshness", index.byFreshness],
                ["Jobs", overview.jobs.byStatus],
                ["Feedback", overview.feedback],
              ].map(([group, values]) => ({
                id: String(group),
                cells: {
                  group: String(group),
                  values: Object.entries(values as Record<string, number>).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—",
                },
              }))}
            />
          </SectionCard>
          <Tabs
            tabs={[
              { id: "sources", label: `Sources (${sources.length})` },
              { id: "jobs", label: `Ingestion jobs (${jobs.length})` },
              { id: "retrievals", label: "Retrieval log" },
              { id: "search", label: "Diagnostic search" },
              { id: "add", label: "Add source" },
            ]}
            active={tab}
            onChange={(id) => setTab(id as TabId)}
          />
          {tab === "sources" && (
            <SectionCard title="Sources" description="Provenance, trust, freshness and version for every registered source.">
              <DataTable
                emptyTitle="No knowledge sources"
                columns={[
                  { key: "title", label: "Title" },
                  { key: "type", label: "Type" },
                  { key: "domain", label: "Domain" },
                  { key: "scope", label: "Scope" },
                  { key: "trust", label: "Trust" },
                  { key: "status", label: "Status" },
                  { key: "freshness", label: "Freshness" },
                  { key: "version", label: "Version", className: "numeric" },
                  { key: "open", label: "" },
                ]}
                rows={sources.map((s) => ({
                  id: s.sourceId,
                  cells: {
                    title: s.title,
                    type: s.sourceType,
                    domain: s.domain,
                    scope: s.scope,
                    trust: <StatusBadge status={s.trust} />,
                    status: s.lastError ? <StatusBadge status={`ERROR · ${s.lastError.code}`} /> : <StatusBadge status={s.status} />,
                    freshness: s.freshness,
                    version: s.currentVersion,
                    open: <button type="button" className="acc-button ghost" onClick={() => setSelectedId(s.sourceId)}>Inspect</button>,
                  },
                }))}
              />
            </SectionCard>
          )}
          {tab === "jobs" && (
            <SectionCard title="Ingestion jobs" description="RESEARCH_REQUEST → … → INDEXING → READY. Failed jobs can be retried.">
              <DataTable
                emptyTitle="No jobs yet"
                columns={[
                  { key: "source", label: "Source" },
                  { key: "kind", label: "Kind" },
                  { key: "status", label: "Status" },
                  { key: "stage", label: "Stage" },
                  { key: "result", label: "Result" },
                  { key: "updated", label: "Updated" },
                  { key: "action", label: "" },
                ]}
                rows={jobs.map((j) => ({
                  id: j.jobId,
                  cells: {
                    source: sources.find((s) => s.sourceId === j.sourceId)?.title ?? j.sourceId,
                    kind: j.kind,
                    status: <StatusBadge status={j.status} />,
                    stage: j.error ? `${j.stage} · ${j.error.code}` : j.stage,
                    result: j.result ? `v${j.result.version} · ${j.result.stored} stored · ${j.result.linked} linked · ${j.result.rejected} rejected` : j.error?.message ?? "—",
                    updated: new Date(j.updatedAt).toLocaleString(),
                    action: j.status === "FAILED"
                      ? <button type="button" className="acc-button ghost" onClick={() => run("Job re-queued", () => adminApi.retryKnowledgeJob(j.jobId))}>Retry</button>
                      : null,
                  },
                }))}
              />
            </SectionCard>
          )}
          {tab === "retrievals" && (
            <SectionCard title="Retrieval log" description="Every knowledge retrieval by planners and tools. External retrieval never happens at query time.">
              <DataTable
                emptyTitle="No retrievals yet"
                columns={[
                  { key: "at", label: "When" },
                  { key: "task", label: "Task" },
                  { key: "caller", label: "Caller" },
                  { key: "query", label: "Query" },
                  { key: "items", label: "Items", className: "numeric" },
                  { key: "domains", label: "Domains" },
                  { key: "chars", label: "Context", className: "numeric" },
                  { key: "ms", label: "ms", className: "numeric" },
                ]}
                rows={retrievals.map((r, i) => ({
                  id: `${r.at}-${i}`,
                  cells: {
                    at: new Date(r.at).toLocaleString(),
                    task: r.task,
                    caller: r.caller,
                    query: r.query,
                    items: r.itemIds.length,
                    domains: r.domains.join(", ") || "—",
                    chars: r.contextChars,
                    ms: r.durationMs,
                  },
                }))}
              />
            </SectionCard>
          )}
          {tab === "search" && <DiagnosticSearch tasks={tasks} />}
          {tab === "add" && (
            <AddSourceForm
              domains={domains}
              onSubmit={(body) => run("Source registered and ingestion queued", () => adminApi.registerKnowledgeSource(body))}
            />
          )}
        </>
      )}
      <Drawer open={Boolean(selectedId)} title="Knowledge source" onClose={() => setSelectedId(null)}>
        {selectedId ? <SourceDetail sourceId={selectedId} onAction={(label, action) => run(label, action)} /> : <EmptyState title="Source not found" />}
      </Drawer>
    </div>
  );
}

function SourceDetail({ sourceId, onAction }: { sourceId: string; onAction: (label: string, action: () => Promise<unknown>) => void }) {
  const [data, setData] = useState<{ source: AdminKnowledgeSource; items: AdminKnowledgeItem[]; jobs: AdminKnowledgeJob[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    adminApi.knowledgeSource(sourceId).then(setData).catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [sourceId]);

  if (error) return <ErrorState title="Source failed to load" detail={error} />;
  if (!data) return <LoadingState />;
  const { source, items } = data;
  const act = (label: string, action: "approve" | "reject" | "disable" | "enable" | "refresh") =>
    onAction(label, () => adminApi.knowledgeSourceAction(sourceId, action, action === "refresh" ? { force: true } : {}));

  return (
    <div className="acc-page">
      <p><strong>{source.title}</strong> · <StatusBadge status={source.trust} /> · <StatusBadge status={source.status} /></p>
      <p>{source.sourceType} · {source.domain} · {source.scope}{source.projectId ? ` (${source.projectId})` : ""} · retention {source.retention}</p>
      {source.url ? <p>URL: <code>{source.url}</code></p> : null}
      <p>Publisher: {source.publisher ?? "—"} · Author: {source.author ?? "—"} · Published: {source.publicationDate ?? "—"} · License: {source.license ?? "—"}</p>
      <p>Freshness: {source.freshness} · Last retrieved: {source.lastRetrievedAt ? new Date(source.lastRetrievedAt).toLocaleString() : "never"}</p>
      <p>Trust basis: {source.trustBasis.join("; ") || "—"}</p>
      {source.lastError ? <p>Last error: {source.lastError.code} — {source.lastError.message}</p> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="acc-button" onClick={() => act("Source approved (VERIFIED)", "approve")}>Approve</button>
        <button type="button" className="acc-button ghost" onClick={() => act("Source rejected", "reject")}>Reject</button>
        {source.status === "DISABLED"
          ? <button type="button" className="acc-button ghost" onClick={() => act("Source enabled", "enable")}>Enable</button>
          : <button type="button" className="acc-button ghost" onClick={() => act("Source disabled", "disable")}>Disable</button>}
        <button type="button" className="acc-button ghost" onClick={() => act("Refresh queued", "refresh")}>Refresh</button>
      </div>
      <SectionCard title="Versions">
        <DataTable
          emptyTitle="Not ingested yet"
          columns={[{ key: "v", label: "Version" }, { key: "at", label: "Retrieved" }, { key: "chunks", label: "Chunks", className: "numeric" }, { key: "stored", label: "Stored / linked" }]}
          rows={source.versions.map((v) => ({
            id: String(v.version),
            cells: { v: v.version, at: new Date(v.retrievedAt).toLocaleString(), chunks: v.chunkCount, stored: `${v.stored} / ${v.linked}` },
          }))}
        />
      </SectionCard>
      <SectionCard title={`Indexed items (${items.length})`} description="Preview only. Source text is treated as data and never executed.">
        <DataTable
          emptyTitle="No indexed items"
          columns={[{ key: "section", label: "Section" }, { key: "validation", label: "Validation" }, { key: "active", label: "Current" }, { key: "preview", label: "Preview" }]}
          rows={items.map((i) => ({
            id: i.itemId,
            cells: {
              section: i.section ?? "—",
              validation: <StatusBadge status={i.validationStatus} />,
              active: i.active ? "yes" : "archived",
              preview: <span style={{ fontSize: 12 }}>{i.preview}{i.guidance.length ? ` [guidance: ${i.guidance.map((g) => `${g.key}=${g.value}`).join(", ")}]` : ""}</span>,
            },
          }))}
        />
      </SectionCard>
    </div>
  );
}

function DiagnosticSearch({ tasks }: { tasks: string[] }) {
  const [query, setQuery] = useState("");
  const [task, setTask] = useState("GENERAL");
  const [projectId, setProjectId] = useState("");
  const [result, setResult] = useState<AdminKnowledgeContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = () => {
    setBusy(true);
    setError(null);
    adminApi.searchKnowledge({ query, task, projectId: projectId.trim() || undefined })
      .then((r) => setResult(r.context))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Search failed"))
      .finally(() => setBusy(false));
  };

  return (
    <SectionCard title="Diagnostic search" description="Runs the same task-aware retrieval planners use. Logged as admin-diagnostic.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <FormField label="Query"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. text contrast on product images" /></FormField>
        <Select label="Task" value={task} onChange={setTask} options={tasks.map((t) => ({ value: t, label: t }))} />
        <FormField label="Project scope (optional)"><input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="project id" /></FormField>
        <button type="button" className="acc-button" disabled={busy || query.trim().length < 2} onClick={search}>Search</button>
      </div>
      {error ? <ErrorState title="Search failed" detail={error} /> : null}
      {result ? (
        <>
          <p className="acc-muted">{result.retrievalMode} · {result.items.length} items · {result.contextChars} chars · {result.durationMs} ms</p>
          <DataTable
            emptyTitle="No matching knowledge"
            columns={[{ key: "title", label: "Item" }, { key: "meta", label: "Domain / trust / freshness" }, { key: "rel", label: "Relevance", className: "numeric" }, { key: "excerpt", label: "Excerpt" }]}
            rows={result.items.map((i) => ({
              id: i.id,
              cells: {
                title: i.title,
                meta: `${i.domain} · ${i.trust} · ${i.freshness}`,
                rel: i.relevance.toFixed(3),
                excerpt: <span style={{ fontSize: 12 }}>{i.excerpt}</span>,
              },
            }))}
          />
          {result.guidance.length ? (
            <p>Guidance: {result.guidance.map((g) => `${g.key}=${String(g.value)} (${g.basis})`).join(" · ")}</p>
          ) : null}
          {result.disagreements.length ? (
            <p>Disagreements: {result.disagreements.map((d) => `${d.key}: ${d.resolution}`).join(" · ")}</p>
          ) : null}
        </>
      ) : null}
    </SectionCard>
  );
}

function AddSourceForm({ domains, onSubmit }: { domains: string[]; onSubmit: (body: Record<string, unknown>) => void }) {
  const [sourceType, setSourceType] = useState("OFFICIAL_DOCUMENTATION");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [domain, setDomain] = useState("GENERAL");
  const [publisher, setPublisher] = useState("");
  const [license, setLicense] = useState("");

  return (
    <SectionCard
      title="Add source"
      description="Registers one source and queues ingestion. URLs are retrieved once (robots.txt respected, no crawling); web sources start UNVERIFIED and keep bounded excerpts only."
    >
      <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
        <Select label="Source type" value={sourceType} onChange={setSourceType} options={REGISTRABLE_TYPES.map((t) => ({ value: t, label: t }))} />
        <FormField label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} /></FormField>
        <Select label="Domain" value={domain} onChange={setDomain} options={domains.map((d) => ({ value: d, label: d }))} />
        <FormField label="URL" hint="Leave empty to paste document text instead."><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></FormField>
        {!url.trim() ? (
          <FormField label="Document text (markdown, plain text or HTML)"><textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} /></FormField>
        ) : null}
        <FormField label="Publisher"><input value={publisher} onChange={(e) => setPublisher(e.target.value)} /></FormField>
        <FormField label="License / usage terms"><input value={license} onChange={(e) => setLicense(e.target.value)} /></FormField>
        <button
          type="button"
          className="acc-button"
          disabled={title.trim().length < 3 || (!url.trim() && content.trim().length < 40)}
          onClick={() => onSubmit({
            sourceType, title, domain, publisher, license,
            ...(url.trim() ? { url: url.trim() } : { content, mimeType: "text/markdown" }),
          })}
        >
          Register and ingest
        </button>
      </div>
    </SectionCard>
  );
}
