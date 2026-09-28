import { useEffect, useMemo, useRef, useState } from "react";
import {
  adminApi,
  type AdminKnowledgeFlowItem,
  type AdminTrainingActivation,
  type AdminTrainingCatalog,
  type AdminTrainingDataset,
  type AdminTrainingDatasetDetail,
  type AdminTrainingDocumentPreview,
  type AdminTrainingEvaluation,
  type AdminTrainingJob,
  type AdminTrainingOverview,
  type AdminTrainingProfile,
  type AdminTrainingRecord,
  type AdminTrainingRuntimeTest,
  type AdminTrainingValidation,
  type AdminTrainingVersionItem,
} from "../admin-api";
import { adminAuthErrorMessage, isAdminAuthError } from "../admin-auth";
import {
  AuthLockedState, DataTable, Drawer, EmptyState, ErrorState, FormField, LoadingState, PageHeader, SectionCard, Select,
  StatCard, StatusBadge, Tabs, Toast,
} from "../components/ui";
import { KnowledgeLibrary, LearnPanel, MaterialLibrary } from "./TrainingLearnPanels";

type TabId = "overview" | "learn" | "datasets" | "teach" | "examples" | "materials" | "jobs" | "evaluations" | "versions" | "knowledge" | "settings";
const TAB_IDS: TabId[] = ["overview", "learn", "datasets", "teach", "examples", "materials", "jobs", "evaluations", "versions", "knowledge", "settings"];
type Capability = AdminTrainingCatalog["capabilities"][number];
type Notify = (message: string, tone?: "info" | "success" | "error") => void;

const ACTIVE_JOB = new Set(["QUEUED", "PREPARING", "RUNNING", "EVALUATING"]);
const TERMINAL_JOB = new Set(["COMPLETED", "FAILED", "CANCELLED", "BLOCKED"]);
/** Server request limit is 70 MB; base64 inflates files by 4/3. */
const MAX_UPLOAD_BASE64 = 68 * 1024 * 1024;

const KIND_LABELS: Record<string, string> = {
  TEXT: "Text / rules",
  INSTRUCTION: "Instruction",
  EXAMPLE: "Input → expected output",
  DOCUMENT: "Document (TXT, Markdown, PDF)",
  CODE: "Code (never executed)",
  IMAGE: "Image",
  VIDEO: "Video",
  AUDIO: "Audio",
  AUDIO_VIDEO_PAIR: "Audio + video pair",
  BEFORE_AFTER: "Before / after pair",
  EVALUATION_CASE: "Evaluation example (regression test)",
};

const MEDIA_ACCEPT = {
  image: "image/png,image/jpeg,image/webp,image/gif",
  video: "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v",
  audio: "audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/flac,.mp3,.wav,.m4a,.aac,.ogg,.flac",
};
const ANY_MEDIA = `${MEDIA_ACCEPT.image},${MEDIA_ACCEPT.video},${MEDIA_ACCEPT.audio}`;

const FILE_SLOTS: Record<string, Array<{ role: string; label: string; accept: string; required: boolean }>> = {
  EXAMPLE: [
    { role: "SOURCE", label: "Source media (optional)", accept: ANY_MEDIA, required: false },
    { role: "REFERENCE_RESULT", label: "Reference result (optional)", accept: ANY_MEDIA, required: false },
  ],
  IMAGE: [{ role: "IMAGE", label: "Image", accept: MEDIA_ACCEPT.image, required: true }],
  VIDEO: [{ role: "VIDEO", label: "Video", accept: MEDIA_ACCEPT.video, required: true }],
  AUDIO: [{ role: "AUDIO", label: "Audio", accept: MEDIA_ACCEPT.audio, required: true }],
  AUDIO_VIDEO_PAIR: [
    { role: "VIDEO", label: "Video", accept: MEDIA_ACCEPT.video, required: true },
    { role: "AUDIO", label: "Audio", accept: MEDIA_ACCEPT.audio, required: true },
  ],
  BEFORE_AFTER: [
    { role: "BEFORE", label: "Before", accept: ANY_MEDIA, required: true },
    { role: "AFTER", label: "After", accept: ANY_MEDIA, required: true },
  ],
};

function tabFromLocation(): TabId {
  const sub = window.location.pathname.replace(/^\/admin\/training\/?/, "").split("/")[0] as TabId;
  return TAB_IDS.includes(sub) ? sub : "overview";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;base64,/, ""));
    reader.onerror = () => reject(new Error(`${file.name} could not be read`));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

async function pollJob(jobId: string, onUpdate?: (job: AdminTrainingJob) => void): Promise<AdminTrainingJob> {
  for (let i = 0; i < 400; i += 1) {
    const { job } = await adminApi.trainingJob(jobId);
    onUpdate?.(job);
    if (TERMINAL_JOB.has(job.status)) return job;
    await new Promise((r) => window.setTimeout(r, 1_500));
  }
  throw new Error("The job is still running; check Training Jobs.");
}

function jobSummary(job: AdminTrainingJob): string {
  if (job.error) return `${job.error.code}: ${job.error.message}`;
  const result = job.result ?? {};
  if (job.kind === "PUBLISH" && typeof result.version === "number") return `Published version ${result.version} (${String(result.records ?? "?")} records)`;
  if (job.kind === "EVALUATE" && result.status) {
    const s = result.summary as { passed?: number; failed?: number; skipped?: number } | undefined;
    return `${String(result.status)} · ${s?.passed ?? 0} passed · ${s?.failed ?? 0} failed · ${s?.skipped ?? 0} skipped`;
  }
  const last = job.stages[job.stages.length - 1];
  return last?.note ?? "—";
}

/** Admin AI Training & Teaching Center: datasets, teaching wizard, validation, evaluation, versioned activation. */
export function TrainingPage({ onGoToApiAccess, onGoToKnowledge }: { onGoToApiAccess?: () => void; onGoToKnowledge?: () => void }) {
  const [overview, setOverview] = useState<AdminTrainingOverview | null>(null);
  const [catalog, setCatalog] = useState<AdminTrainingCatalog | null>(null);
  const [datasets, setDatasets] = useState<AdminTrainingDataset[]>([]);
  const [archivedDatasets, setArchivedDatasets] = useState<AdminTrainingDataset[] | null>(null);
  const [jobs, setJobs] = useState<AdminTrainingJob[]>([]);
  const [evaluations, setEvaluations] = useState<AdminTrainingEvaluation[]>([]);
  const [versions, setVersions] = useState<AdminTrainingVersionItem[]>([]);
  const [activations, setActivations] = useState<AdminTrainingActivation[]>([]);
  const [profiles, setProfiles] = useState<AdminTrainingProfile[]>([]);
  const [knowledgeFlow, setKnowledgeFlow] = useState<AdminKnowledgeFlowItem[]>([]);
  const [tab, setTabState] = useState<TabId>(() => tabFromLocation());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authLocked, setAuthLocked] = useState(false);
  const [authDetail, setAuthDetail] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; tone: "info" | "success" | "error" } | null>(null);

  const notify: Notify = (message, tone = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 5_000);
  };

  const setTab = (id: TabId) => {
    setTabState(id);
    const next = id === "overview" ? "/admin/training" : `/admin/training/${id}`;
    if (window.location.pathname !== next) window.history.replaceState({ adminRoute: "training" }, "", next);
  };

  const load = (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
      setAuthLocked(false);
    }
    return Promise.all([
      adminApi.trainingOverview(),
      adminApi.trainingCatalog(),
      adminApi.trainingDatasets(),
      adminApi.trainingJobs(),
      adminApi.trainingEvaluations(),
      adminApi.trainingVersions(),
      adminApi.trainingActivations(),
      adminApi.trainingProfiles(),
      adminApi.trainingKnowledgeFlow().catch(() => ({ items: [] as AdminKnowledgeFlowItem[] })),
    ])
      .then(([o, c, d, j, e, v, a, p, f]) => {
        setKnowledgeFlow(f.items);
        setOverview(o.overview);
        setCatalog(c.catalog);
        setDatasets(d.items);
        setJobs(j.items);
        setEvaluations(e.items);
        setVersions(v.items);
        setActivations(a.items);
        setProfiles(p.items);
        setRefreshKey((k) => k + 1);
      })
      .catch((err: unknown) => {
        if (isAdminAuthError(err)) {
          setAuthLocked(true);
          setAuthDetail(adminAuthErrorMessage(err));
          return;
        }
        if (!silent) setError(errorText(err, "Training Center failed to load"));
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    void load();
  }, []);

  const hasActiveJobs = jobs.some((j) => ACTIVE_JOB.has(j.status));
  useEffect(() => {
    if (!hasActiveJobs) return undefined;
    const timer = window.setInterval(() => void load(true), 3_000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs]);

  const run = (label: string, action: () => Promise<unknown>) => {
    action()
      .then(() => {
        notify(label);
        void load(true);
      })
      .catch((err: unknown) => {
        notify(errorText(err, "Action failed"), "error");
        void load(true);
      });
  };

  const datasetKey = (id: string | null) => datasets.find((d) => d.datasetId === id)?.key ?? (id ? id.slice(0, 8) : "—");

  return (
    <div className="acc-page">
      <PageHeader
        title="AI Training & Teaching"
        description="Teach KWIZERA AI with knowledge, instructions, examples and styles. Teaching is validated, versioned, evaluated and activated through the Knowledge Base; it never changes model weights."
        breadcrumbs={[{ label: "Admin" }, { label: "AI Control" }, { label: "AI Training" }]}
        actions={(
          <>
            <button type="button" className="acc-button ghost" onClick={() => setTab("learn")}>Learn from material</button>
            <button type="button" className="acc-button ghost" onClick={() => setTab("teach")}>Teach AI</button>
            <button type="button" className="acc-button" onClick={() => void load()}>Reload</button>
          </>
        )}
      />
      <Toast message={toast?.message ?? null} tone={toast?.tone} />
      {loading && <LoadingState />}
      {authLocked && !loading && <AuthLockedState detail={authDetail ?? undefined} onGoToApiAccess={onGoToApiAccess} />}
      {error && !authLocked && <ErrorState title="Training Center failed to load" detail={error} onRetry={() => void load()} />}
      {!loading && !error && !authLocked && overview && catalog && (
        <>
          <Tabs
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "learn", label: "Learn from material" },
              { id: "datasets", label: `Datasets (${datasets.length})` },
              { id: "teach", label: "Teach AI" },
              { id: "examples", label: "Examples & records" },
              { id: "materials", label: `Material library (${overview.sources.total})` },
              { id: "jobs", label: `Training jobs${hasActiveJobs ? " •" : ""}` },
              { id: "evaluations", label: `Evaluations (${evaluations.length})` },
              { id: "versions", label: "Models / versions" },
              { id: "knowledge", label: "Knowledge" },
              { id: "settings", label: "Settings" },
            ]}
            active={tab}
            onChange={(id) => setTab(id as TabId)}
          />

          {tab === "overview" && (
            <>
              <div className="acc-stat-grid">
                <StatCard label="Datasets" value={overview.datasets.total} hint={`${overview.records.total} records`} />
                <StatCard label="Published versions" value={overview.versions.total} hint={`${overview.versions.active} active`} />
                <StatCard label="Evaluations" value={overview.evaluations.total} hint={Object.entries(overview.evaluations.byStatus).map(([k, v]) => `${k} ${v}`).join(" · ") || "none yet"} />
                <StatCard label="Jobs" value={overview.jobs.total} hint={Object.entries(overview.jobs.byStatus).map(([k, v]) => `${k} ${v}`).join(" · ") || "none yet"} />
                <StatCard label="Knowledge Base" value={overview.knowledgeBaseReady ? "Ready" : "Unavailable"} hint={overview.creativePatternsAvailable ? "Creative patterns available" : "Creative patterns unavailable"} />
                <StatCard label="Learned knowledge" value={overview.learnedRecords} hint={`${overview.sessions.total} teaching sessions · ${overview.sources.total} sources`} />
              </div>
              <SectionCard title="Material analysis" description="What the server can actually measure or interpret right now. Unavailable analysis is reported, never simulated.">
                <p style={{ fontSize: 13 }}>
                  Measured on the server: video scenes, motion, framing, transitions and pacing (FFmpeg); audio BPM, beats, energy, silence and fades; image composition, colour and contrast; document, book and code structure.
                </p>
                <p style={{ fontSize: 13 }}>
                  Vision interpretation <StatusBadge status={overview.analysis.vision} /> · Reasoning-assisted extraction <StatusBadge status={overview.analysis.reasoning} /> · Speech transcription <StatusBadge status={overview.analysis.transcription} />
                  {" "}· URL learning <StatusBadge status={overview.analysis.urlLearning ? "ENABLED" : "DISABLED"} />
                </p>
              </SectionCard>
              <SectionCard title="Model training / fine-tuning" description="Shown truthfully: nothing on this page changes model weights.">
                <p><StatusBadge status="UNAVAILABLE" /> {overview.modelTraining.reason}</p>
              </SectionCard>
              <SectionCard title="Active teaching" description="Dataset versions currently delivered to runtime planners through the Knowledge Base.">
                <DataTable
                  emptyTitle="No teaching is active yet"
                  columns={[{ key: "key", label: "Dataset" }, { key: "capability", label: "Capability" }, { key: "version", label: "Version", className: "numeric" }, { key: "scope", label: "Scope" }, { key: "open", label: "" }]}
                  rows={overview.activeTeaching.map((a) => ({
                    id: a.datasetId,
                    cells: {
                      key: a.name ? `${a.key} — ${a.name}` : a.key,
                      capability: a.capability,
                      version: `v${a.version}`,
                      scope: a.projectId ? `${a.scope} (${a.projectId})` : a.scope,
                      open: <button type="button" className="acc-button ghost" onClick={() => setSelectedDataset(a.datasetId)}>Open</button>,
                    },
                  }))}
                />
              </SectionCard>
              <ActivationTable activations={overview.recentActivations} datasetKey={datasetKey} title="Recent activations" />
            </>
          )}

          {tab === "datasets" && (
            <SectionCard
              title="Teaching datasets"
              description="Draft records are editable; published versions are immutable. Each dataset teaches exactly one capability."
              actions={(
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={archivedDatasets !== null}
                      onChange={(e) => {
                        if (!e.target.checked) { setArchivedDatasets(null); return; }
                        adminApi.trainingDatasets(true)
                          .then(({ items }) => setArchivedDatasets(items.filter((d) => d.archived)))
                          .catch((err: unknown) => notify(errorText(err, "Archived datasets failed to load"), "error"));
                      }}
                    /> Include archived ({overview.archivedDatasets})
                  </label>
                  <button type="button" className="acc-button" onClick={() => setTab("teach")}>New teaching</button>
                </div>
              )}
            >
              <DatasetTable datasets={archivedDatasets ? [...datasets, ...archivedDatasets] : datasets} onOpen={setSelectedDataset} />
            </SectionCard>
          )}

          {tab === "learn" && (
            <LearnPanel catalog={catalog} datasets={datasets} notify={notify} onChanged={() => void load(true)} onOpenDataset={setSelectedDataset} />
          )}

          {tab === "materials" && (
            <MaterialLibrary refreshKey={refreshKey} notify={notify} onChanged={() => void load(true)} />
          )}

          {tab === "teach" && (
            <TeachWizard
              catalog={catalog}
              datasets={datasets}
              notify={notify}
              onChanged={() => void load(true)}
              onOpenDataset={setSelectedDataset}
            />
          )}

          {tab === "examples" && (
            <ExamplesPanel datasets={datasets} refreshKey={refreshKey} notify={notify} onChanged={() => void load(true)} />
          )}

          {tab === "jobs" && (
            <SectionCard title="Training jobs" description="Real job states from the server. Media processing, publishing, evaluation and activation run as queued jobs.">
              <DataTable
                emptyTitle="No jobs yet"
                columns={[
                  { key: "kind", label: "Job" },
                  { key: "dataset", label: "Dataset" },
                  { key: "version", label: "Version", className: "numeric" },
                  { key: "status", label: "Status" },
                  { key: "counts", label: "Processed / failed / total" },
                  { key: "result", label: "Result" },
                  { key: "updated", label: "Updated" },
                  { key: "action", label: "" },
                ]}
                rows={jobs.map((j) => ({
                  id: j.jobId,
                  cells: {
                    kind: j.kind,
                    dataset: datasetKey(j.datasetId),
                    version: j.version ? `v${j.version}` : "—",
                    status: <StatusBadge status={j.status} />,
                    counts: `${j.counts.processed} / ${j.counts.failed} / ${j.counts.total}`,
                    result: <span style={{ fontSize: 12 }}>{jobSummary(j)}</span>,
                    updated: new Date(j.updatedAt).toLocaleString(),
                    action: j.status === "QUEUED"
                      ? <button type="button" className="acc-button ghost" onClick={() => run("Job cancelled", () => adminApi.cancelTrainingJob(j.jobId))}>Cancel</button>
                      : null,
                  },
                }))}
              />
            </SectionCard>
          )}

          {tab === "evaluations" && (
            <SectionCard title="Evaluations" description="Measured checks run before activation: retrieval, guidance, isolation, planner regressions and media measurements. No decorative scores.">
              <DataTable
                emptyTitle="No evaluations yet"
                columns={[
                  { key: "dataset", label: "Dataset" },
                  { key: "version", label: "Version", className: "numeric" },
                  { key: "status", label: "Result" },
                  { key: "summary", label: "Passed / failed / skipped" },
                  { key: "at", label: "When" },
                  { key: "open", label: "" },
                ]}
                rows={evaluations.map((e) => ({
                  id: e.evaluationId,
                  cells: {
                    dataset: datasetKey(e.datasetId),
                    version: `v${e.version}`,
                    status: <StatusBadge status={e.status} />,
                    summary: `${e.summary.passed} / ${e.summary.failed} / ${e.summary.skipped}`,
                    at: new Date(e.createdAt).toLocaleString(),
                    open: <button type="button" className="acc-button ghost" onClick={() => setSelectedEvaluation(e.evaluationId)}>Checks</button>,
                  },
                }))}
              />
            </SectionCard>
          )}

          {tab === "versions" && (
            <>
              <SectionCard title="Model training" description="Model weights are never changed by this Training Center.">
                <p><StatusBadge status="UNAVAILABLE" /> {catalog.modelTraining.reason}</p>
              </SectionCard>
              <SectionCard title="Dataset versions" description="Immutable published versions. Activating one makes the previous version INACTIVE (kept for rollback).">
                <DataTable
                  emptyTitle="No versions published yet"
                  columns={[
                    { key: "dataset", label: "Dataset" },
                    { key: "version", label: "Version", className: "numeric" },
                    { key: "records", label: "Records", className: "numeric" },
                    { key: "strategy", label: "Strategy" },
                    { key: "evaluation", label: "Latest evaluation" },
                    { key: "activation", label: "Activation" },
                    { key: "published", label: "Published" },
                    { key: "open", label: "" },
                  ]}
                  rows={versions.map((v) => ({
                    id: `${v.datasetId}-${v.version}`,
                    cells: {
                      dataset: v.datasetKey,
                      version: `v${v.version}`,
                      records: v.recordCount,
                      strategy: v.strategy,
                      evaluation: v.latestEvaluation ? <StatusBadge status={v.latestEvaluation.status} /> : "Not evaluated",
                      activation: <StatusBadge status={v.activation} />,
                      published: `${new Date(v.publishedAt).toLocaleString()} · ${v.publishedBy}`,
                      open: <button type="button" className="acc-button ghost" onClick={() => setSelectedDataset(v.datasetId)}>Open</button>,
                    },
                  }))}
                />
              </SectionCard>
              <ActivationTable activations={activations} datasetKey={datasetKey} title="Activation history" />
            </>
          )}

          {tab === "knowledge" && <KnowledgeLibrary catalog={catalog} refreshKey={refreshKey} />}

          {tab === "knowledge" && (
            <SectionCard
              title="Knowledge flow: extracted → activated → consumed"
              description="Creative patterns extracted into each dataset's latest version, the ones in its active version, and the ones a real plan has used (with the last use)."
            >
              <DataTable
                emptyTitle="No creative patterns yet"
                columns={[{ key: "dataset", label: "Dataset" }, { key: "extracted", label: "Extracted", className: "numeric" }, { key: "activated", label: "Activated", className: "numeric" }, { key: "consumed", label: "Consumed", className: "numeric" }, { key: "patterns", label: "Active patterns (uses)" }]}
                rows={knowledgeFlow.filter((f) => f.extracted || f.activated).map((f) => ({
                  id: f.datasetId,
                  cells: {
                    dataset: `${f.key}${f.activeVersion !== null ? ` v${f.activeVersion}` : ""}`,
                    extracted: f.extracted,
                    activated: f.activated,
                    consumed: f.consumed,
                    patterns: <span style={{ fontSize: 12 }}>{f.patterns.slice(0, 6).map((p) => `${p.family.toLowerCase()}: ${p.name} (${p.uses}${p.lastUsedAt ? `, last ${new Date(p.lastUsedAt).toLocaleDateString()}` : ""})`).join(" · ") || "—"}</span>,
                  },
                }))}
              />
            </SectionCard>
          )}

          {tab === "knowledge" && (
            <SectionCard
              title="Delivery to the Knowledge Base"
              description="Active teaching is delivered as a Training Center knowledge source (and, for style teaching, abstract creative patterns). Draft or unevaluated material never reaches runtime."
              actions={onGoToKnowledge ? <button type="button" className="acc-button ghost" onClick={onGoToKnowledge}>Open Knowledge</button> : undefined}
            >
              <DataTable
                emptyTitle="No teaching delivered yet"
                columns={[{ key: "dataset", label: "Dataset" }, { key: "version", label: "Version", className: "numeric" }, { key: "action", label: "Action" }, { key: "delivery", label: "Delivery" }, { key: "at", label: "When" }]}
                rows={activations.filter((a) => a.action !== "DEACTIVATE").map((a) => ({
                  id: a.activationId,
                  cells: {
                    dataset: datasetKey(a.datasetId),
                    version: `v${a.version}`,
                    action: a.action,
                    delivery: <span style={{ fontSize: 12 }}>{a.delivery.map((d) => `${d.channel}: ${d.detail}`).join(" · ")}</span>,
                    at: new Date(a.at).toLocaleString(),
                  },
                }))}
              />
            </SectionCard>
          )}

          {tab === "settings" && (
            <SettingsPanel catalog={catalog} datasets={datasets} profiles={profiles} onAction={run} />
          )}
        </>
      )}
      <Drawer open={Boolean(selectedDataset)} title="Teaching dataset" onClose={() => setSelectedDataset(null)}>
        {selectedDataset
          ? <DatasetDetail datasetId={selectedDataset} refreshKey={refreshKey} notify={notify} onChanged={() => void load(true)} onOpenEvaluation={setSelectedEvaluation} />
          : <EmptyState title="Dataset not found" />}
      </Drawer>
      <Drawer open={Boolean(selectedEvaluation)} title="Evaluation" onClose={() => setSelectedEvaluation(null)}>
        {selectedEvaluation ? <EvaluationDetail evaluation={evaluations.find((e) => e.evaluationId === selectedEvaluation) ?? null} /> : null}
      </Drawer>
    </div>
  );
}

function DatasetTable({ datasets, onOpen }: { datasets: AdminTrainingDataset[]; onOpen: (id: string) => void }) {
  return (
    <DataTable
      emptyTitle="No teaching datasets yet"
      columns={[
        { key: "key", label: "Dataset" },
        { key: "capability", label: "Capability" },
        { key: "mode", label: "Teaching type / strategy" },
        { key: "scope", label: "Scope" },
        { key: "draft", label: "Draft records" },
        { key: "versions", label: "Versions" },
        { key: "runtime", label: "Runtime" },
        { key: "open", label: "" },
      ]}
      rows={datasets.map((d) => ({
        id: d.datasetId,
        cells: {
          key: <><strong>{d.key}</strong>{d.archived ? <> <StatusBadge status="ARCHIVED" /></> : null}<br /><span className="acc-muted">{d.name}</span></>,
          capability: d.capabilityLabel,
          mode: `${d.mode} · ${d.strategy}`,
          scope: d.projectId ? `${d.scope} (${d.projectId})` : d.scope,
          draft: `${d.draft.records} (${d.draft.counts.VALID} valid, ${d.draft.counts.NEEDS_REVIEW} review, ${d.draft.counts.INVALID} invalid)`,
          versions: d.latestVersion ? `latest v${d.latestVersion} · active ${d.activeVersion ? `v${d.activeVersion}` : "none"}` : "none",
          runtime: d.runtimeWired ? <StatusBadge status="WIRED" /> : <StatusBadge status="NOT WIRED" />,
          open: <button type="button" className="acc-button ghost" onClick={() => onOpen(d.datasetId)}>Open</button>,
        },
      }))}
    />
  );
}

function ActivationTable({ activations, datasetKey, title }: { activations: AdminTrainingActivation[]; datasetKey: (id: string) => string; title: string }) {
  return (
    <SectionCard title={title} description="Every activation, rollback and deactivation. Model weights changed: always no.">
      <DataTable
        emptyTitle="No activations yet"
        columns={[
          { key: "dataset", label: "Dataset" },
          { key: "action", label: "Action" },
          { key: "version", label: "Version" },
          { key: "strategy", label: "Strategy" },
          { key: "weights", label: "Model weights changed" },
          { key: "by", label: "By" },
          { key: "at", label: "When" },
        ]}
        rows={activations.map((a) => ({
          id: a.activationId,
          cells: {
            dataset: datasetKey(a.datasetId),
            action: <StatusBadge status={a.action} />,
            version: a.previousVersion ? `v${a.previousVersion} → v${a.version}` : `v${a.version}`,
            strategy: a.strategy,
            weights: a.modelWeightsChanged ? "yes" : "no",
            by: a.by,
            at: new Date(a.at).toLocaleString(),
          },
        }))}
      />
    </SectionCard>
  );
}

function EvaluationDetail({ evaluation }: { evaluation: AdminTrainingEvaluation | null }) {
  if (!evaluation) return <EmptyState title="Evaluation not found" />;
  return (
    <div className="acc-page">
      <p><StatusBadge status={evaluation.status} /> v{evaluation.version} · {evaluation.capability} · {evaluation.summary.passed} passed · {evaluation.summary.failed} failed · {evaluation.summary.skipped} skipped</p>
      <p className="acc-muted">Evaluated {new Date(evaluation.createdAt).toLocaleString()} by {evaluation.evaluatedBy}. Skipped checks are capabilities this server cannot measure; they never count as passed.</p>
      <DataTable
        columns={[{ key: "category", label: "Category" }, { key: "label", label: "Check" }, { key: "status", label: "Result" }, { key: "detail", label: "Detail" }]}
        rows={evaluation.checks.map((c, i) => ({
          id: `${c.id}-${i}`,
          cells: {
            category: c.category,
            label: c.label,
            status: <StatusBadge status={c.status} />,
            detail: <span style={{ fontSize: 12 }}>{c.detail}{c.measured ? ` — ${Object.entries(c.measured).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(", ")}` : ""}</span>,
          },
        }))}
      />
    </div>
  );
}

function IssueList({ issues }: { issues: Array<{ code: string; severity: string; message: string }> }) {
  if (!issues.length) return <span className="acc-muted">No issues</span>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
      {issues.map((issue, i) => <li key={`${issue.code}-${i}`}><strong>{issue.severity}</strong> {issue.code}: {issue.message}</li>)}
    </ul>
  );
}

function recordSummary(r: AdminTrainingRecord): string {
  const parts: string[] = [];
  if (r.instruction) parts.push(r.instruction);
  if (r.text) parts.push(r.text);
  if (r.input) parts.push(`Input: ${r.input}`);
  if (r.expectedOutput) parts.push(`Expected: ${r.expectedOutput}`);
  if (r.code) parts.push(`${r.code.language} code, ${r.code.code.length} chars`);
  if (r.document) parts.push(`${r.document.fileName}: ${r.document.pages ? `${r.document.pages} pages, ` : ""}${r.document.headings.length} headings, ${r.document.chars} chars`);
  for (const m of r.media) {
    const a = m.analysis;
    const measured = a ? [a.width && a.height ? `${a.width}×${a.height}` : "", a.durationSec ? `${a.durationSec.toFixed(1)} s` : "", a.audio?.bpm ? `${a.audio.bpm} BPM` : "", a.sceneCount ? `${a.sceneCount} scenes` : ""].filter(Boolean).join(", ") : "";
    parts.push(`${m.role} ${m.fileName} [${m.status}${measured ? `: ${measured}` : ""}${m.error ? `: ${m.error.code}` : ""}]`);
  }
  if (r.evalCase) parts.push(`Evaluation: ${r.evalCase.check}`);
  if (r.guidance.length) parts.push(`Guidance: ${r.guidance.map((g) => `${g.key}=${g.value}`).join(", ")}`);
  return parts.join(" · ").slice(0, 400);
}

function RecordTable({ datasetId, records, notify, onChanged }: { datasetId: string; records: AdminTrainingRecord[]; notify: Notify; onChanged: () => void }) {
  const act = (label: string, action: () => Promise<unknown>) => {
    action().then(() => { notify(label); onChanged(); }).catch((err: unknown) => notify(errorText(err, "Action failed"), "error"));
  };
  return (
    <DataTable
      emptyTitle="No draft records"
      columns={[{ key: "kind", label: "Type" }, { key: "title", label: "Record" }, { key: "state", label: "Validation" }, { key: "issues", label: "Issues" }, { key: "actions", label: "" }]}
      rows={records.map((r) => ({
        id: r.recordId,
        cells: {
          kind: KIND_LABELS[r.kind] ?? r.kind,
          title: <><strong>{r.title || "(untitled)"}</strong><br /><span style={{ fontSize: 12 }}>{recordSummary(r)}</span></>,
          state: <>{<StatusBadge status={r.validation.state} />}{r.review ? <div className="acc-muted" style={{ fontSize: 12 }}>{r.review.decision} by {r.review.by}</div> : null}</>,
          issues: <IssueList issues={r.validation.issues} />,
          actions: (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {r.validation.state === "NEEDS_REVIEW" || r.review?.decision === "REJECTED"
                ? <button type="button" className="acc-button ghost" onClick={() => act("Record approved", () => adminApi.reviewTrainingRecord(datasetId, r.recordId, "APPROVED"))}>Approve</button>
                : null}
              {r.review?.decision !== "REJECTED"
                ? <button type="button" className="acc-button ghost" onClick={() => act("Record rejected", () => adminApi.reviewTrainingRecord(datasetId, r.recordId, "REJECTED"))}>Reject</button>
                : null}
              {r.media.some((m) => m.status === "FAILED")
                ? <button type="button" className="acc-button ghost" onClick={() => act("Reprocessing queued", () => adminApi.reprocessTrainingRecord(datasetId, r.recordId))}>Reprocess</button>
                : null}
              <button type="button" className="acc-button ghost" onClick={() => act("Draft record removed", () => adminApi.removeTrainingRecord(datasetId, r.recordId))}>Remove</button>
            </div>
          ),
        },
      }))}
    />
  );
}

function DatasetDetail({ datasetId, refreshKey, notify, onChanged, onOpenEvaluation }: {
  datasetId: string; refreshKey: number; notify: Notify; onChanged: () => void; onOpenEvaluation: (id: string) => void;
}) {
  const [data, setData] = useState<AdminTrainingDatasetDetail | null>(null);
  const [validation, setValidation] = useState<AdminTrainingValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [test, setTest] = useState<AdminTrainingRuntimeTest | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const [testProject, setTestProject] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const reload = () => {
    adminApi.trainingDataset(datasetId).then(setData).catch((err: unknown) => setError(errorText(err, "Failed to load")));
    adminApi.trainingValidation(datasetId).then((r) => setValidation(r.validation)).catch(() => setValidation(null));
  };
  useEffect(reload, [datasetId, refreshKey]);

  const runJob = (label: string, start: () => Promise<{ job: AdminTrainingJob }>) => {
    setBusy(label);
    start()
      .then(({ job }) => pollJob(job.jobId))
      .then((job) => {
        notify(`${label}: ${job.status === "COMPLETED" ? jobSummary(job) : `${job.status} — ${jobSummary(job)}`}`, job.status === "COMPLETED" ? "success" : "error");
      })
      .catch((err: unknown) => notify(errorText(err, `${label} failed`), "error"))
      .finally(() => {
        setBusy(null);
        reload();
        onChanged();
      });
  };

  const runtimeTest = () => {
    setBusy("Runtime test");
    adminApi.trainingRuntimeTest(datasetId, { query: testQuery.trim() || undefined, projectId: testProject.trim() || undefined })
      .then((r) => setTest(r.test))
      .catch((err: unknown) => notify(errorText(err, "Runtime test failed"), "error"))
      .finally(() => setBusy(null));
  };

  const requestModelTraining = () => {
    adminApi.requestModelTraining(datasetId, data?.dataset.latestVersion ?? null)
      .then(() => notify("Unexpected: model training reported success", "error"))
      .catch((err: unknown) => notify(`Model training blocked: ${errorText(err, "unavailable")}`, "info"))
      .finally(onChanged);
  };

  if (error) return <ErrorState title="Dataset failed to load" detail={error} />;
  if (!data) return <LoadingState />;
  const { dataset, records } = data;
  const datasetVersions = data.versions.filter((v): v is NonNullable<typeof v> => Boolean(v)).sort((a, b) => b.version - a.version);

  return (
    <div className="acc-page">
      <p><strong>{dataset.key}</strong> — {dataset.name}</p>
      <p>{dataset.capabilityLabel} ({dataset.target}) · {dataset.mode} · strategy {dataset.strategy} · scope {dataset.scope}{dataset.projectId ? ` (${dataset.projectId})` : ""}</p>
      {dataset.description ? <p className="acc-muted">{dataset.description}</p> : null}
      <p>Active version: {dataset.activeVersion ? `v${dataset.activeVersion}` : "none"} · Runtime: {dataset.runtimeWired ? "wired to planners" : "not wired to a runtime caller yet"}</p>
      {busy ? <p className="acc-muted">{busy}… (running on the server)</p> : null}

      <SectionCard title="Draft validation" description="Publishing is only possible when every draft record is VALID.">
        {validation ? (
          <>
            <p><StatusBadge status={validation.status} /> {validation.records.length} records{validation.guidance.length ? ` · guidance ${validation.guidance.map((g) => `${g.key}=${g.value}`).join(", ")}` : ""}</p>
            <IssueList issues={validation.issues} />
          </>
        ) : <p className="acc-muted">Validation unavailable.</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 8 }}>
          <FormField label="Version note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed" /></FormField>
          <button type="button" className="acc-button" disabled={Boolean(busy) || !records.length} onClick={() => runJob("Publish", () => adminApi.publishTrainingDataset(datasetId, note))}>Publish new version</button>
        </div>
      </SectionCard>

      <SectionCard title={`Draft records (${records.length})`}>
        <RecordTable datasetId={datasetId} records={records} notify={notify} onChanged={() => { reload(); onChanged(); }} />
      </SectionCard>

      <SectionCard
        title="Versions"
        description="Evaluate a version before activating it. Activation keeps previous versions for rollback."
        actions={(
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="acc-button ghost" disabled={Boolean(busy) || datasetVersions.length < 2} onClick={() => runJob("Rollback", () => adminApi.rollbackTrainingDataset(datasetId))}>Roll back</button>
            <button type="button" className="acc-button ghost" disabled={Boolean(busy) || !dataset.activeVersion} onClick={() => runJob("Deactivate", () => adminApi.deactivateTrainingDataset(datasetId))}>Deactivate</button>
            <button
              type="button"
              className="acc-button ghost"
              disabled={Boolean(busy) || (!dataset.archived && dataset.activeVersion !== null)}
              title={dataset.activeVersion !== null ? "Deactivate before archiving" : undefined}
              onClick={() => adminApi.archiveTrainingDataset(datasetId, !dataset.archived)
                .then(() => { notify(dataset.archived ? "Dataset restored" : "Dataset archived (hidden from libraries; nothing deleted)"); reload(); onChanged(); })
                .catch((err: unknown) => notify(errorText(err, "Archive failed"), "error"))}
            >
              {dataset.archived ? "Restore" : "Archive"}
            </button>
          </div>
        )}
      >
        <DataTable
          emptyTitle="No versions published yet"
          columns={[{ key: "v", label: "Version" }, { key: "records", label: "Records", className: "numeric" }, { key: "eval", label: "Evaluation" }, { key: "activation", label: "Activation" }, { key: "actions", label: "" }]}
          rows={datasetVersions.map((v) => ({
            id: String(v.version),
            cells: {
              v: <>v{v.version}<br /><span className="acc-muted" style={{ fontSize: 12 }}>{new Date(v.publishedAt).toLocaleString()}{v.note ? ` · ${v.note}` : ""}</span></>,
              records: v.recordCount,
              eval: v.latestEvaluation
                ? <button type="button" className="acc-button ghost" onClick={() => onOpenEvaluation(v.latestEvaluation!.evaluationId)}><StatusBadge status={v.latestEvaluation.status} /></button>
                : "Not evaluated",
              activation: <StatusBadge status={v.activation} />,
              actions: (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" className="acc-button ghost" disabled={Boolean(busy)} onClick={() => runJob(`Evaluate v${v.version}`, () => adminApi.evaluateTrainingVersion(datasetId, v.version))}>Evaluate</button>
                  {v.activation !== "ACTIVE" ? (
                    <button type="button" className="acc-button" disabled={Boolean(busy) || v.latestEvaluation?.status !== "PASSED"} onClick={() => runJob(`Activate v${v.version}`, () => adminApi.activateTrainingVersion(datasetId, v.version))}>Activate</button>
                  ) : null}
                </div>
              ),
            },
          }))}
        />
      </SectionCard>

      <SectionCard title="Runtime test" description="Runs the capability's real runtime retrieval and shows exactly what the planner receives from the Knowledge Base.">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <FormField label="Query (optional)"><input value={testQuery} onChange={(e) => setTestQuery(e.target.value)} placeholder="Defaults to the runtime query for this task" /></FormField>
          {dataset.scope !== "PROJECT" ? <FormField label="Project (optional)"><input value={testProject} onChange={(e) => setTestProject(e.target.value)} placeholder="project id" /></FormField> : null}
          <button type="button" className="acc-button" disabled={Boolean(busy)} onClick={runtimeTest}>Run runtime test</button>
        </div>
        {test ? <RuntimeTestResult test={test} /> : null}
      </SectionCard>

      <SectionCard title="Model training" description="Requests are recorded as BLOCKED jobs so the audit trail stays truthful.">
        <p><StatusBadge status="UNAVAILABLE" /> No training infrastructure is configured on this server; teaching is delivered through knowledge retrieval.</p>
        <button type="button" className="acc-button ghost" onClick={requestModelTraining}>Request model training</button>
      </SectionCard>
    </div>
  );
}

function RuntimeTestResult({ test }: { test: AdminTrainingRuntimeTest }) {
  return (
    <div style={{ marginTop: 12 }}>
      <p>
        Task <strong>{test.task}</strong> · {test.items.length} items retrieved · <strong>{test.teachingItemsRetrieved}</strong> from the active teaching version
        {test.activeVersion ? ` (v${test.activeVersion})` : " (no active version)"} · consumers: {test.runtimeConsumers.join(", ") || "none"}
      </p>
      {!test.runtimeWired ? <p className="acc-muted">{test.runtimeNote}</p> : null}
      <DataTable
        emptyTitle="Nothing retrieved"
        columns={[{ key: "title", label: "Item" }, { key: "section", label: "Section" }, { key: "trust", label: "Trust" }, { key: "rel", label: "Relevance", className: "numeric" }, { key: "teaching", label: "From teaching" }]}
        rows={test.items.map((i) => ({
          id: i.id,
          cells: { title: i.title, section: i.section ?? "—", trust: i.trust, rel: i.relevance.toFixed(3), teaching: i.fromActiveTeaching ? <StatusBadge status="ACTIVE TEACHING" /> : "—" },
        }))}
      />
      {test.guidance.length ? (
        <p>Planner guidance: {test.guidance.map((g) => `${g.key}=${String(g.value)} (${g.basis}${g.fromActiveTeaching ? ", from teaching" : ""})`).join(" · ")}</p>
      ) : <p className="acc-muted">No planner guidance resolved for this task.</p>}
      {test.canvasPlanWithRuntimeGuidance ? (
        <p>Canvas plan (1:1 photo → 9:16): {test.canvasPlanWithRuntimeGuidance.strategy}, source coverage {test.canvasPlanWithRuntimeGuidance.sourceCoverage.toFixed(2)} — {test.canvasPlanWithRuntimeGuidance.reason}</p>
      ) : null}
      {test.consumption.map((c) => (
        <div key={c.consumer} style={{ marginTop: 8 }}>
          <p><StatusBadge status={c.usesTeaching ? "USES TEACHING" : "NOT USING TEACHING"} /> <strong>{c.consumer}</strong> — {c.detail}</p>
          {c.excerpts?.length ? (
            <ul style={{ fontSize: 12 }}>{c.excerpts.slice(0, 5).map((e) => <li key={e}>{e}</li>)}</ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ExamplesPanel({ datasets, refreshKey, notify, onChanged }: { datasets: AdminTrainingDataset[]; refreshKey: number; notify: Notify; onChanged: () => void }) {
  const [datasetId, setDatasetId] = useState(datasets[0]?.datasetId ?? "");
  const [data, setData] = useState<AdminTrainingDatasetDetail | null>(null);
  const [jsonl, setJsonl] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; errors: Array<{ line: number; message: string }> } | null>(null);

  const reload = () => {
    if (!datasetId) return;
    adminApi.trainingDataset(datasetId).then(setData).catch((err: unknown) => notify(errorText(err, "Failed to load dataset"), "error"));
  };
  useEffect(reload, [datasetId, refreshKey]);
  useEffect(() => {
    if (!datasets.some((d) => d.datasetId === datasetId) && datasets[0]) setDatasetId(datasets[0].datasetId);
  }, [datasets]);

  if (!datasets.length) return <EmptyState title="No datasets yet" detail="Create one with Teach AI first." />;
  const doImport = () => {
    adminApi.importTrainingRecords(datasetId, jsonl)
      .then((r) => {
        setImportResult(r.result);
        notify(`${r.result.imported} records imported${r.result.errors.length ? `, ${r.result.errors.length} rejected` : ""}`, r.result.errors.length ? "info" : "success");
        reload();
        onChanged();
      })
      .catch((err: unknown) => notify(errorText(err, "Import failed"), "error"));
  };

  return (
    <>
      <SectionCard title="Examples & records" description="Draft records of a dataset, including evaluation examples that act as regression tests.">
        <Select label="Dataset" value={datasetId} onChange={setDatasetId} options={datasets.map((d) => ({ value: d.datasetId, label: `${d.key} — ${d.capabilityLabel}` }))} />
        {data ? <RecordTable datasetId={datasetId} records={data.records} notify={notify} onChanged={() => { reload(); onChanged(); }} /> : <LoadingState />}
      </SectionCard>
      <SectionCard title="Import instructional records (JSON Lines)" description='One object per line: {"instruction","input","expectedOutput","domain","targetCapability"}. Files cannot be imported this way. Every line is validated like a wizard record.'>
        <FormField label="JSON Lines"><textarea rows={6} value={jsonl} onChange={(e) => setJsonl(e.target.value)} placeholder='{"instruction":"Keep the product fully visible","input":"Square product photo for a 9:16 ad","expectedOutput":"Extend the canvas instead of cropping the product"}' /></FormField>
        <button type="button" className="acc-button" disabled={!jsonl.trim()} onClick={doImport}>Import to draft</button>
        {importResult?.errors.length ? (
          <ul style={{ fontSize: 12 }}>{importResult.errors.map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}</ul>
        ) : null}
      </SectionCard>
    </>
  );
}

function SettingsPanel({ catalog, datasets, profiles, onAction }: {
  catalog: AdminTrainingCatalog; datasets: AdminTrainingDataset[]; profiles: AdminTrainingProfile[]; onAction: (label: string, action: () => Promise<unknown>) => void;
}) {
  const [capability, setCapability] = useState(catalog.capabilities[0]?.id ?? "");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const eligible = datasets.filter((d) => d.capability === capability && d.latestVersion);

  return (
    <>
      <SectionCard title="Teaching strategies" description="Only strategies this server really supports can be used.">
        <DataTable
          columns={[{ key: "label", label: "Strategy" }, { key: "status", label: "Availability" }, { key: "description", label: "How it works" }]}
          rows={catalog.strategies.map((s) => ({
            id: s.id,
            cells: { label: s.label, status: <StatusBadge status={s.available ? "AVAILABLE" : "UNAVAILABLE"} />, description: s.available ? s.description : s.unavailableReason ?? s.description },
          }))}
        />
      </SectionCard>
      <SectionCard title="Capabilities & runtime consumers">
        <DataTable
          columns={[{ key: "cap", label: "Capability" }, { key: "target", label: "AI" }, { key: "guidance", label: "Teachable planner guidance" }, { key: "runtime", label: "Runtime" }]}
          rows={catalog.capabilities.map((c) => ({
            id: c.id,
            cells: {
              cap: <><strong>{c.label}</strong><br /><span className="acc-muted" style={{ fontSize: 12 }}>{c.id}</span></>,
              target: c.target,
              guidance: c.guidance.map((g) => `${g.label} (${g.min}–${g.max})`).join("; ") || "—",
              runtime: <span style={{ fontSize: 12 }}>{c.runtimeWired ? c.runtimeConsumers.join(", ") : c.runtimeNote}</span>,
            },
          }))}
        />
      </SectionCard>
      <SectionCard title="Scopes" description="Private project teaching never becomes global knowledge.">
        <DataTable
          columns={[{ key: "label", label: "Scope" }, { key: "status", label: "Availability" }, { key: "description", label: "Description" }]}
          rows={catalog.scopes.map((s) => ({
            id: s.id,
            cells: { label: s.label, status: <StatusBadge status={s.available ? "AVAILABLE" : "UNAVAILABLE"} />, description: s.available ? s.description : s.unavailableReason ?? s.description },
          }))}
        />
      </SectionCard>
      <SectionCard title="Training profiles" description="A profile pins dataset versions for one capability. Activating it activates each pinned (evaluated) version.">
        <DataTable
          emptyTitle="No profiles yet"
          columns={[{ key: "name", label: "Profile" }, { key: "capability", label: "Capability" }, { key: "entries", label: "Pinned versions" }, { key: "action", label: "" }]}
          rows={profiles.map((p) => ({
            id: p.profileId,
            cells: {
              name: p.name,
              capability: p.capability,
              entries: p.entries.map((e) => `${e.datasetKey ?? e.datasetId.slice(0, 8)} v${e.version}${e.active ? " (active)" : ""}${e.evaluation ? ` · ${e.evaluation}` : " · not evaluated"}`).join("; "),
              action: <button type="button" className="acc-button ghost" onClick={() => onAction("Profile activation queued", () => adminApi.activateTrainingProfile(p.profileId))}>Activate</button>,
            },
          }))}
        />
        <div style={{ display: "grid", gap: 12, maxWidth: 640, marginTop: 12 }}>
          <Select label="Capability" value={capability} onChange={(v) => { setCapability(v); setPicked({}); }} options={catalog.capabilities.map((c) => ({ value: c.id, label: c.label }))} />
          <FormField label="Profile name"><input value={name} onChange={(e) => setName(e.target.value)} /></FormField>
          {eligible.length ? eligible.map((d) => (
            <Select
              key={d.datasetId}
              label={d.key}
              value={picked[d.datasetId] ?? ""}
              onChange={(v) => setPicked((prev) => ({ ...prev, [d.datasetId]: v }))}
              options={[{ value: "", label: "Not included" }, ...d.versions.map((v) => ({ value: String(v), label: `v${v}` }))]}
            />
          )) : <p className="acc-muted">No published versions for this capability yet.</p>}
          <button
            type="button"
            className="acc-button"
            disabled={!Object.values(picked).some(Boolean)}
            onClick={() => onAction("Profile created", () => adminApi.createTrainingProfile({
              capability, name,
              entries: Object.entries(picked).filter(([, v]) => v).map(([datasetId, v]) => ({ datasetId, version: Number(v) })),
            }))}
          >
            Create profile
          </button>
        </div>
      </SectionCard>
    </>
  );
}

// ---------- Teach AI wizard ----------

const WIZARD_STEPS = ["Select AI", "Teaching type", "Dataset", "Material", "Preview", "Instructions", "Validate & add", "Publish & evaluate", "Activate"];

interface Material {
  kind: string;
  title: string;
  text: string;
  instruction: string;
  rules: string;
  input: string;
  expectedOutput: string;
  explanation: string;
  docText: string;
  docFile: File | null;
  files: Record<string, File | null>;
  projectAssetId: string;
  code: { language: string; framework: string; topic: string; version: string; source: string; expectedBehavior: string; code: string };
  declared: { aspectRatio: string; durationSec: string; bpm: string };
  evalCase: Record<string, string>;
  guidance: Record<string, string>;
  tags: string;
}

const emptyMaterial = (kind: string): Material => ({
  kind, title: "", text: "", instruction: "", rules: "", input: "", expectedOutput: "", explanation: "", docText: "", docFile: null, files: {},
  projectAssetId: "",
  code: { language: "typescript", framework: "", topic: "", version: "", source: "", expectedBehavior: "", code: "" },
  declared: { aspectRatio: "", durationSec: "", bpm: "" },
  evalCase: { check: "RETRIEVAL" }, guidance: {}, tags: "",
});

function TeachWizard({ catalog, datasets, notify, onChanged, onOpenDataset }: {
  catalog: AdminTrainingCatalog; datasets: AdminTrainingDataset[]; notify: Notify; onChanged: () => void; onOpenDataset: (id: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<string>(catalog.targets[0]?.id ?? "");
  const [capabilityId, setCapabilityId] = useState("");
  const [mode, setMode] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [newDataset, setNewDataset] = useState({ key: "", name: "", description: "", scope: "ADMIN", projectId: "" });
  const [material, setMaterial] = useState<Material>(emptyMaterial("TEXT"));
  const [docPreview, setDocPreview] = useState<AdminTrainingDocumentPreview | null>(null);
  const [added, setAdded] = useState<AdminTrainingRecord | null>(null);
  const [validation, setValidation] = useState<AdminTrainingValidation | null>(null);
  const [jobStatus, setJobStatus] = useState<AdminTrainingJob | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [evaluation, setEvaluation] = useState<{ status: string; summary: string; evaluationId: string } | null>(null);
  const [activation, setActivation] = useState<AdminTrainingJob | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const capabilities = catalog.capabilities.filter((c) => c.target === target);
  const capability: Capability | undefined = catalog.capabilities.find((c) => c.id === capabilityId);
  const matchingDatasets = datasets.filter((d) => d.capability === capabilityId && d.mode === mode);
  const dataset = datasets.find((d) => d.datasetId === datasetId);
  const slots = FILE_SLOTS[material.kind] ?? [];

  useEffect(() => {
    if (!capabilities.some((c) => c.id === capabilityId)) setCapabilityId(capabilities[0]?.id ?? "");
  }, [target]);
  useEffect(() => {
    if (capability && !capability.kinds.includes(material.kind as never)) setMaterial(emptyMaterial(capability.kinds[0] ?? "TEXT"));
  }, [capabilityId]);

  const patch = (next: Partial<Material>) => setMaterial((m) => ({ ...m, ...next }));
  const fail = (message: string) => { setStepError(message); setBusy(null); };

  const createOrSelectDataset = async () => {
    setStepError(null);
    if (datasetId) { setStep(3); return; }
    setBusy("Creating dataset");
    try {
      const { dataset: created } = await adminApi.createTrainingDataset({
        key: newDataset.key, name: newDataset.name, description: newDataset.description, target, capability: capabilityId, mode,
        scope: newDataset.scope, projectId: newDataset.scope === "PROJECT" ? newDataset.projectId : undefined,
      });
      setDatasetId(created.datasetId);
      onChanged();
      notify(`Dataset ${created.key} created`);
      setBusy(null);
      setStep(3);
    } catch (err) {
      fail(errorText(err, "Dataset could not be created"));
    }
  };

  const buildPayload = async (): Promise<Record<string, unknown>> => {
    const m = material;
    let total = 0;
    const media: Array<Record<string, unknown>> = [];
    for (const slot of slots) {
      const file = m.files[slot.role];
      if (!file) continue;
      const dataBase64 = await fileToBase64(file);
      total += dataBase64.length;
      media.push({ role: slot.role, fileName: file.name, mimeType: file.type, dataBase64 });
    }
    if (m.projectAssetId.trim() && dataset?.scope === "PROJECT") media.push({ role: m.kind === "IMAGE" ? "IMAGE" : "SOURCE", projectAssetId: m.projectAssetId.trim() });
    let document: Record<string, unknown> | undefined;
    if (m.kind === "DOCUMENT") {
      if (m.docFile) {
        const isPdf = m.docFile.type === "application/pdf" || /\.pdf$/i.test(m.docFile.name);
        if (isPdf) {
          const dataBase64 = await fileToBase64(m.docFile);
          total += dataBase64.length;
          document = { fileName: m.docFile.name, mimeType: "application/pdf", dataBase64 };
        } else {
          document = { fileName: m.docFile.name, mimeType: m.docFile.type || (/\.md$/i.test(m.docFile.name) ? "text/markdown" : "text/plain"), text: await m.docFile.text() };
        }
      } else if (m.docText.trim()) {
        document = { fileName: "pasted.md", mimeType: "text/markdown", text: m.docText };
      }
    }
    if (total > MAX_UPLOAD_BASE64) throw new Error(`The files total ${formatBytes(total * 0.75)}; upload at most about 50 MB per record.`);
    const guidance = Object.entries(m.guidance).filter(([, v]) => v.trim() !== "").map(([key, v]) => ({ key, value: Number(v) }));
    const declared = {
      ...(m.declared.aspectRatio ? { aspectRatio: m.declared.aspectRatio } : {}),
      ...(m.declared.durationSec ? { durationSec: Number(m.declared.durationSec) } : {}),
      ...(m.declared.bpm ? { bpm: Number(m.declared.bpm) } : {}),
    };
    const e = m.evalCase;
    const evalCase = m.kind === "EVALUATION_CASE" ? {
      check: e.check,
      ...(e.check === "PRODUCT_VISIBILITY" ? { sourceWidth: Number(e.sourceWidth), sourceHeight: Number(e.sourceHeight), aspect: e.aspect || "9:16" } : {}),
      ...(e.check === "AUDIO_COVERAGE" ? { sourceDurationSec: Number(e.sourceDurationSec), targetDurationSec: Number(e.targetDurationSec), bpm: e.bpm ? Number(e.bpm) : null, voice: e.voice === "yes" } : {}),
      ...(e.check === "TYPOGRAPHY_HIERARCHY" ? { productName: e.productName, price: e.price, cta: e.cta, aspect: e.aspect || "9:16" } : {}),
      ...(e.check === "RETRIEVAL" ? { query: e.query } : {}),
      ...(e.check === "TEXT_GROUNDING" ? { input: e.input, output: e.output } : {}),
    } : undefined;
    return {
      kind: m.kind, title: m.title, text: m.text, instruction: m.instruction, input: m.input, expectedOutput: m.expectedOutput, explanation: m.explanation,
      rules: m.rules.split(/\r?\n/).map((r) => r.trim()).filter(Boolean),
      tags: m.tags.split(",").map((t) => t.trim()).filter(Boolean),
      targetCapability: capabilityId,
      guidance,
      ...(Object.keys(declared).length ? { declared } : {}),
      ...(m.kind === "CODE" ? { code: m.code } : {}),
      ...(document ? { document } : {}),
      ...(media.length ? { media } : {}),
      ...(evalCase ? { evalCase } : {}),
    };
  };

  const preview = async () => {
    setStepError(null);
    setDocPreview(null);
    if (material.kind === "DOCUMENT") {
      setBusy("Extracting document");
      try {
        const body = material.docFile
          ? (/\.pdf$/i.test(material.docFile.name) || material.docFile.type === "application/pdf"
            ? { fileName: material.docFile.name, mimeType: "application/pdf", dataBase64: await fileToBase64(material.docFile) }
            : { fileName: material.docFile.name, mimeType: material.docFile.type, text: await material.docFile.text() })
          : { fileName: "pasted.md", mimeType: "text/markdown", text: material.docText };
        const { preview: result } = await adminApi.previewTrainingDocument(body);
        setDocPreview(result);
        setBusy(null);
      } catch (err) {
        fail(errorText(err, "Preview failed"));
        return;
      }
    }
    setStep(4);
  };

  const validateAndAdd = async () => {
    setStepError(null);
    setBusy("Uploading and validating");
    try {
      const payload = await buildPayload();
      const result = await adminApi.addTrainingRecord(datasetId, payload);
      setAdded(result.record);
      if (result.job) {
        setBusy("Processing media on the server");
        const job = await pollJob(result.job.jobId, (j) => mounted.current && setJobStatus(j));
        setJobStatus(job);
        const detail = await adminApi.trainingDataset(datasetId);
        setAdded(detail.records.find((r) => r.recordId === result.record.recordId) ?? result.record);
      }
      setValidation((await adminApi.trainingValidation(datasetId)).validation);
      onChanged();
      setBusy(null);
    } catch (err) {
      fail(errorText(err, "The record could not be added"));
    }
  };

  const publishAndEvaluate = async () => {
    setStepError(null);
    setEvaluation(null);
    try {
      setBusy("Publishing an immutable version");
      const pub = await pollJob((await adminApi.publishTrainingDataset(datasetId, `Teach AI: ${material.title || material.kind}`)).job.jobId);
      const version = typeof pub.result?.version === "number" ? pub.result.version : null;
      if (pub.status !== "COMPLETED" || !version) {
        onChanged();
        fail(jobSummary(pub));
        return;
      }
      setPublishedVersion(version);
      setBusy(`Evaluating v${version}`);
      const ev = await pollJob((await adminApi.evaluateTrainingVersion(datasetId, version)).job.jobId);
      onChanged();
      if (ev.status !== "COMPLETED") { fail(jobSummary(ev)); return; }
      setEvaluation({ status: String(ev.result?.status ?? "FAILED"), summary: jobSummary(ev), evaluationId: String(ev.result?.evaluationId ?? "") });
      setBusy(null);
    } catch (err) {
      fail(errorText(err, "Publish or evaluation failed"));
    }
  };

  const activate = async () => {
    if (!publishedVersion) return;
    setStepError(null);
    setBusy(`Activating v${publishedVersion}`);
    try {
      const job = await pollJob((await adminApi.activateTrainingVersion(datasetId, publishedVersion)).job.jobId);
      setActivation(job);
      onChanged();
      if (job.status !== "COMPLETED") { fail(jobSummary(job)); return; }
      notify(`v${publishedVersion} is active`);
      setBusy(null);
    } catch (err) {
      fail(errorText(err, "Activation failed"));
    }
  };

  const restart = () => {
    setStep(3);
    setMaterial(emptyMaterial(capability?.kinds[0] ?? "TEXT"));
    setAdded(null); setValidation(null); setJobStatus(null); setPublishedVersion(null); setEvaluation(null); setActivation(null); setDocPreview(null); setStepError(null);
  };

  const materialReady = useMemo(() => {
    const m = material;
    if (slots.some((s) => s.required && !m.files[s.role]) && !(m.projectAssetId.trim() && dataset?.scope === "PROJECT")) return false;
    switch (m.kind) {
      case "TEXT": return m.text.trim().length > 0 || m.rules.trim().length > 0;
      case "INSTRUCTION": return m.instruction.trim().length > 0;
      case "EXAMPLE": return m.input.trim().length > 0 && m.expectedOutput.trim().length > 0;
      case "DOCUMENT": return Boolean(m.docFile) || m.docText.trim().length > 0;
      case "CODE": return m.code.code.trim().length > 0 && m.code.language.trim().length > 0;
      default: return true;
    }
  }, [material, slots, dataset]);

  return (
    <SectionCard title="Teach AI" description="Material is untrusted data: it is validated, neutralised against instruction hijacking, versioned and evaluated before any runtime can use it.">
      <ol className="acc-muted" style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", listStyle: "none", padding: 0, margin: "0 0 12px" }}>
        {WIZARD_STEPS.map((label, i) => (
          <li key={label} style={{ fontWeight: i === step ? 700 : 400, opacity: i > step ? 0.55 : 1 }}>{i + 1}. {label}</li>
        ))}
      </ol>
      {busy ? <p className="acc-muted">{busy}…{jobStatus && ACTIVE_JOB.has(jobStatus.status) ? ` (${jobStatus.status}, ${jobStatus.counts.processed}/${jobStatus.counts.total})` : ""}</p> : null}
      {stepError ? <ErrorState title="This step did not complete" detail={stepError} /> : null}

      {step === 0 && (
        <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
          <Select label="AI to teach" value={target} onChange={setTarget} options={catalog.targets.map((t) => ({ value: t.id, label: `${t.label} (${t.id})` }))} />
          <Select label="Capability" value={capabilityId} onChange={setCapabilityId} options={capabilities.map((c) => ({ value: c.id, label: c.label }))} />
          {capability ? (
            <p className="acc-muted">
              Runtime: {capability.runtimeWired ? `consumed by ${capability.runtimeConsumers.join(", ")}` : capability.runtimeNote}
              {capability.guidance.length ? ` · Teachable planner guidance: ${capability.guidance.map((g) => g.label).join("; ")}` : ""}
            </p>
          ) : null}
          <button type="button" className="acc-button" disabled={!capabilityId} onClick={() => setStep(1)}>Next</button>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
          {catalog.modes.map((m) => (
            <label key={m.id} className="acc-form-field" style={{ opacity: m.available ? 1 : 0.6 }}>
              <span>
                <input type="radio" name="teach-mode" disabled={!m.available} checked={mode === m.id} onChange={() => setMode(m.id)} />{" "}
                <strong>{m.label}</strong> {m.available ? `— ${m.description} (strategy: ${m.strategies[0]})` : <><StatusBadge status="UNAVAILABLE" /> {m.unavailableReason}</>}
              </span>
            </label>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="acc-button ghost" onClick={() => setStep(0)}>Back</button>
            <button type="button" className="acc-button" disabled={!mode} onClick={() => { setDatasetId(""); setStep(2); }}>Next</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
          <Select
            label="Dataset"
            value={datasetId}
            onChange={setDatasetId}
            options={[{ value: "", label: "Create a new dataset" }, ...matchingDatasets.map((d) => ({ value: d.datasetId, label: `${d.key} (${d.scope}${d.projectId ? ` ${d.projectId}` : ""})` }))]}
          />
          {!datasetId ? (
            <>
              <FormField label="Dataset key" hint="Letters, digits and underscores, e.g. PRODUCT_VIDEO_DESIGN"><input value={newDataset.key} onChange={(e) => setNewDataset({ ...newDataset, key: e.target.value })} /></FormField>
              <FormField label="Name"><input value={newDataset.name} onChange={(e) => setNewDataset({ ...newDataset, name: e.target.value })} /></FormField>
              <FormField label="Description"><input value={newDataset.description} onChange={(e) => setNewDataset({ ...newDataset, description: e.target.value })} /></FormField>
              <Select
                label="Scope"
                value={newDataset.scope}
                onChange={(v) => setNewDataset({ ...newDataset, scope: v })}
                options={catalog.scopes.filter((s) => s.available).map((s) => ({ value: s.id, label: s.label }))}
              />
              <p className="acc-muted" style={{ fontSize: 12 }}>Unavailable scopes: {catalog.scopes.filter((s) => !s.available).map((s) => `${s.label} — ${s.unavailableReason}`).join(" · ")}</p>
              {newDataset.scope === "PROJECT" ? <FormField label="Project id"><input value={newDataset.projectId} onChange={(e) => setNewDataset({ ...newDataset, projectId: e.target.value })} /></FormField> : null}
            </>
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="acc-button ghost" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="acc-button" disabled={Boolean(busy) || (!datasetId && newDataset.key.trim().length < 3)} onClick={() => void createOrSelectDataset()}>{datasetId ? "Use this dataset" : "Create dataset"}</button>
          </div>
        </div>
      )}

      {step === 3 && capability && (
        <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
          <Select label="Material format" value={material.kind} onChange={(k) => setMaterial(emptyMaterial(k))} options={capability.kinds.map((k) => ({ value: k, label: KIND_LABELS[k] ?? k }))} />
          <FormField label="Title"><input value={material.title} onChange={(e) => patch({ title: e.target.value })} /></FormField>
          <MaterialFields material={material} patch={patch} slots={slots} projectScoped={dataset?.scope === "PROJECT"} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="acc-button ghost" onClick={() => setStep(2)}>Back</button>
            <button type="button" className="acc-button" disabled={!materialReady || Boolean(busy)} onClick={() => void preview()}>Preview</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
          {docPreview ? (
            docPreview.ok ? (
              <>
                <p>{docPreview.format}{docPreview.pages ? ` · ${docPreview.pagesWithText}/${docPreview.pages} pages with text` : ""} · {docPreview.chars} chars · {docPreview.headings.length} headings</p>
                {docPreview.headings.length ? <p style={{ fontSize: 12 }}>Headings: {docPreview.headings.slice(0, 20).join(" · ")}</p> : null}
                <pre style={{ whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto", fontSize: 12 }}>{docPreview.preview}</pre>
              </>
            ) : <ErrorState title={docPreview.errorCode ?? "Extraction failed"} detail={docPreview.message} />
          ) : null}
          <p>Dataset <strong>{dataset?.key}</strong> · {KIND_LABELS[material.kind]} · {material.title || "(untitled)"}</p>
          <ul style={{ fontSize: 12 }}>
            {material.text ? <li>Text: {material.text.slice(0, 300)}</li> : null}
            {material.instruction ? <li>Instruction: {material.instruction.slice(0, 300)}</li> : null}
            {material.input ? <li>Input: {material.input.slice(0, 300)}</li> : null}
            {material.expectedOutput ? <li>Expected output: {material.expectedOutput.slice(0, 300)}</li> : null}
            {material.kind === "CODE" ? <li>{material.code.language} code, {material.code.code.length} chars — stored as data, never executed</li> : null}
            {Object.entries(material.files).filter(([, f]) => f).map(([role, f]) => <li key={role}>{role}: {f!.name} ({formatBytes(f!.size)}) — measured on the server after upload</li>)}
            {material.docFile ? <li>Document file: {material.docFile.name} ({formatBytes(material.docFile.size)})</li> : null}
          </ul>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="acc-button ghost" onClick={() => setStep(3)}>Back</button>
            <button type="button" className="acc-button" disabled={Boolean(docPreview && !docPreview.ok)} onClick={() => setStep(5)}>Next</button>
          </div>
        </div>
      )}

      {step === 5 && capability && (
        <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
          {material.kind !== "INSTRUCTION" ? (
            <FormField label="Rules to follow (one per line, optional)"><textarea rows={4} value={material.rules} onChange={(e) => patch({ rules: e.target.value })} /></FormField>
          ) : null}
          <FormField label="Why (optional explanation)"><textarea rows={3} value={material.explanation} onChange={(e) => patch({ explanation: e.target.value })} /></FormField>
          {capability.guidance.map((g) => (
            <FormField key={g.key} label={`${g.label} (${g.min}–${g.max} ${g.unit}, default ${g.default})`} hint="Optional bounded planner value. Leave empty to keep the runtime default.">
              <input type="number" step={g.integer ? 1 : 0.01} min={g.min} max={g.max} value={material.guidance[g.key] ?? ""} onChange={(e) => patch({ guidance: { ...material.guidance, [g.key]: e.target.value } })} />
            </FormField>
          ))}
          {["IMAGE", "VIDEO", "AUDIO", "AUDIO_VIDEO_PAIR", "BEFORE_AFTER", "EXAMPLE"].includes(material.kind) ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Select label="Declared aspect ratio" value={material.declared.aspectRatio} onChange={(v) => patch({ declared: { ...material.declared, aspectRatio: v } })} options={[{ value: "", label: "Not declared" }, ...["9:16", "16:9", "1:1", "4:5"].map((a) => ({ value: a, label: a }))]} />
              <FormField label="Declared duration (s)"><input type="number" value={material.declared.durationSec} onChange={(e) => patch({ declared: { ...material.declared, durationSec: e.target.value } })} /></FormField>
              <FormField label="Declared BPM"><input type="number" value={material.declared.bpm} onChange={(e) => patch({ declared: { ...material.declared, bpm: e.target.value } })} /></FormField>
            </div>
          ) : null}
          <FormField label="Tags (comma separated)"><input value={material.tags} onChange={(e) => patch({ tags: e.target.value })} /></FormField>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="acc-button ghost" onClick={() => setStep(4)}>Back</button>
            <button type="button" className="acc-button" onClick={() => setStep(6)}>Next</button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
          {!added ? (
            <button type="button" className="acc-button" disabled={Boolean(busy)} onClick={() => void validateAndAdd()}>Validate and add to draft</button>
          ) : (
            <>
              <p>Record <strong>{added.title || added.kind}</strong>: <StatusBadge status={added.validation.state} /></p>
              <IssueList issues={added.validation.issues} />
              {added.media.length ? <p style={{ fontSize: 12 }}>{recordSummary(added)}</p> : null}
              {validation ? <p>Dataset draft: <StatusBadge status={validation.status} /> ({validation.records.length} records)</p> : null}
              {validation ? <IssueList issues={validation.issues} /> : null}
              {added.validation.state === "NEEDS_REVIEW" ? (
                <button type="button" className="acc-button ghost" onClick={() => {
                  adminApi.reviewTrainingRecord(datasetId, added.recordId, "APPROVED", "Reviewed in Teach AI")
                    .then(async (r) => { setAdded(r.record); setValidation((await adminApi.trainingValidation(datasetId)).validation); onChanged(); })
                    .catch((err: unknown) => notify(errorText(err, "Review failed"), "error"));
                }}>Approve after review</button>
              ) : null}
            </>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="acc-button ghost" disabled={Boolean(added)} onClick={() => setStep(5)}>Back</button>
            <button type="button" className="acc-button ghost" disabled={!added} onClick={restart}>Add another record</button>
            <button type="button" className="acc-button" disabled={!validation || validation.status !== "VALID"} onClick={() => setStep(7)}>Next: publish</button>
          </div>
        </div>
      )}

      {step === 7 && (
        <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
          <p className="acc-muted">Publishing freezes every draft record of {dataset?.key} into a new immutable version, then runs the evaluation suite for {capability?.label}.</p>
          {!evaluation ? (
            <button type="button" className="acc-button" disabled={Boolean(busy)} onClick={() => void publishAndEvaluate()}>Publish and evaluate</button>
          ) : (
            <>
              <p>Version v{publishedVersion}: <StatusBadge status={evaluation.status} /> {evaluation.summary}</p>
              {evaluation.status !== "PASSED" ? <p className="acc-muted">This version cannot be activated. Open the dataset to inspect the failed checks, fix the draft and publish again.</p> : null}
            </>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="acc-button ghost" onClick={() => onOpenDataset(datasetId)}>Open dataset</button>
            <button type="button" className="acc-button" disabled={evaluation?.status !== "PASSED"} onClick={() => setStep(8)}>Next: activate</button>
          </div>
        </div>
      )}

      {step === 8 && (
        <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
          <p className="acc-muted">
            Activation delivers v{publishedVersion} to runtime planners through the Knowledge Base
            {dataset?.scope === "PROJECT" ? ` for project ${dataset.projectId} only` : " for every project"}. The previous active version becomes INACTIVE and stays available for rollback. No model weights change.
          </p>
          {!activation || activation.status !== "COMPLETED" ? (
            <button type="button" className="acc-button" disabled={Boolean(busy)} onClick={() => void activate()}>Activate v{publishedVersion}</button>
          ) : (
            <>
              <p><StatusBadge status="ACTIVE" /> v{publishedVersion} of {dataset?.key} is active.</p>
              <p style={{ fontSize: 12 }}>{Array.isArray((activation.result as { delivery?: unknown[] } | null)?.delivery)
                ? ((activation.result as { delivery: Array<{ channel: string; detail: string }> }).delivery).map((d) => `${d.channel}: ${d.detail}`).join(" · ")
                : jobSummary(activation)}</p>
            </>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="acc-button ghost" onClick={() => onOpenDataset(datasetId)}>Open dataset (runtime test, rollback)</button>
            <button type="button" className="acc-button ghost" onClick={restart}>Teach more</button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function MaterialFields({ material, patch, slots, projectScoped }: {
  material: Material; patch: (next: Partial<Material>) => void; slots: Array<{ role: string; label: string; accept: string; required: boolean }>; projectScoped: boolean;
}) {
  const m = material;
  const e = m.evalCase;
  const setEval = (key: string, value: string) => patch({ evalCase: { ...e, [key]: value } });
  return (
    <>
      {m.kind === "TEXT" ? <FormField label="Text / knowledge"><textarea rows={6} value={m.text} onChange={(ev) => patch({ text: ev.target.value })} /></FormField> : null}
      {m.kind === "INSTRUCTION" ? (
        <>
          <FormField label="Instruction"><textarea rows={4} value={m.instruction} onChange={(ev) => patch({ instruction: ev.target.value })} /></FormField>
          <FormField label="Rules (one per line, optional)"><textarea rows={4} value={m.rules} onChange={(ev) => patch({ rules: ev.target.value })} /></FormField>
        </>
      ) : null}
      {m.kind === "EXAMPLE" ? (
        <>
          <FormField label="Instruction (optional)"><input value={m.instruction} onChange={(ev) => patch({ instruction: ev.target.value })} /></FormField>
          <FormField label="Input"><textarea rows={4} value={m.input} onChange={(ev) => patch({ input: ev.target.value })} /></FormField>
          <FormField label="Expected output"><textarea rows={4} value={m.expectedOutput} onChange={(ev) => patch({ expectedOutput: ev.target.value })} /></FormField>
        </>
      ) : null}
      {m.kind === "DOCUMENT" ? (
        <>
          <FormField label="Document file (TXT, Markdown or PDF)" hint="PDF text is extracted on the server; scanned PDFs without a text layer are rejected (no OCR installed).">
            <input type="file" accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf" onChange={(ev) => patch({ docFile: ev.target.files?.[0] ?? null })} />
          </FormField>
          {!m.docFile ? <FormField label="…or paste text"><textarea rows={6} value={m.docText} onChange={(ev) => patch({ docText: ev.target.value })} /></FormField> : null}
        </>
      ) : null}
      {m.kind === "CODE" ? (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <FormField label="Language"><input value={m.code.language} onChange={(ev) => patch({ code: { ...m.code, language: ev.target.value } })} /></FormField>
            <FormField label="Framework"><input value={m.code.framework} onChange={(ev) => patch({ code: { ...m.code, framework: ev.target.value } })} /></FormField>
            <FormField label="Version"><input value={m.code.version} onChange={(ev) => patch({ code: { ...m.code, version: ev.target.value } })} /></FormField>
          </div>
          <FormField label="Topic"><input value={m.code.topic} onChange={(ev) => patch({ code: { ...m.code, topic: ev.target.value } })} /></FormField>
          <FormField label="Source / reference"><input value={m.code.source} onChange={(ev) => patch({ code: { ...m.code, source: ev.target.value } })} /></FormField>
          <FormField label="Expected behaviour"><textarea rows={2} value={m.code.expectedBehavior} onChange={(ev) => patch({ code: { ...m.code, expectedBehavior: ev.target.value } })} /></FormField>
          <FormField label="Code" hint="Stored and retrieved as reference text only. It is never executed."><textarea rows={10} style={{ fontFamily: "monospace" }} value={m.code.code} onChange={(ev) => patch({ code: { ...m.code, code: ev.target.value } })} /></FormField>
        </>
      ) : null}
      {["IMAGE", "VIDEO", "AUDIO", "AUDIO_VIDEO_PAIR", "BEFORE_AFTER"].includes(m.kind) ? (
        <FormField label="Description (optional)"><textarea rows={3} value={m.text} onChange={(ev) => patch({ text: ev.target.value })} /></FormField>
      ) : null}
      {slots.map((slot) => (
        <FormField key={slot.role} label={slot.label} hint="Measured on the server (dimensions, duration, scenes, tempo, beats, loudness). Measurements are authoritative.">
          <input type="file" accept={slot.accept} onChange={(ev) => patch({ files: { ...m.files, [slot.role]: ev.target.files?.[0] ?? null } })} />
        </FormField>
      ))}
      {projectScoped && ["IMAGE", "EXAMPLE"].includes(m.kind) ? (
        <FormField label="…or a product image asset id from this project"><input value={m.projectAssetId} onChange={(ev) => patch({ projectAssetId: ev.target.value })} /></FormField>
      ) : null}
      {m.kind === "EVALUATION_CASE" ? (
        <>
          <Select label="Check" value={e.check ?? "RETRIEVAL"} onChange={(v) => patch({ evalCase: { check: v } })} options={["RETRIEVAL", "PRODUCT_VISIBILITY", "AUDIO_COVERAGE", "TYPOGRAPHY_HIERARCHY", "TEXT_GROUNDING"].map((c) => ({ value: c, label: c }))} />
          {e.check === "RETRIEVAL" ? <FormField label="Query that must retrieve this teaching"><input value={e.query ?? ""} onChange={(ev) => setEval("query", ev.target.value)} /></FormField> : null}
          {e.check === "PRODUCT_VISIBILITY" ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <FormField label="Source width"><input type="number" value={e.sourceWidth ?? ""} onChange={(ev) => setEval("sourceWidth", ev.target.value)} /></FormField>
              <FormField label="Source height"><input type="number" value={e.sourceHeight ?? ""} onChange={(ev) => setEval("sourceHeight", ev.target.value)} /></FormField>
              <Select label="Target aspect" value={e.aspect ?? "9:16"} onChange={(v) => setEval("aspect", v)} options={["9:16", "16:9", "1:1", "4:5"].map((a) => ({ value: a, label: a }))} />
            </div>
          ) : null}
          {e.check === "AUDIO_COVERAGE" ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <FormField label="Audio duration (s)"><input type="number" value={e.sourceDurationSec ?? ""} onChange={(ev) => setEval("sourceDurationSec", ev.target.value)} /></FormField>
              <FormField label="Video duration (s)"><input type="number" value={e.targetDurationSec ?? ""} onChange={(ev) => setEval("targetDurationSec", ev.target.value)} /></FormField>
              <FormField label="BPM (optional)"><input type="number" value={e.bpm ?? ""} onChange={(ev) => setEval("bpm", ev.target.value)} /></FormField>
              <Select label="Voice-over" value={e.voice ?? "no"} onChange={(v) => setEval("voice", v)} options={[{ value: "no", label: "Music" }, { value: "yes", label: "Voice" }]} />
            </div>
          ) : null}
          {e.check === "TYPOGRAPHY_HIERARCHY" ? (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <FormField label="Product name"><input value={e.productName ?? ""} onChange={(ev) => setEval("productName", ev.target.value)} /></FormField>
              <FormField label="Price"><input value={e.price ?? ""} onChange={(ev) => setEval("price", ev.target.value)} /></FormField>
              <FormField label="CTA"><input value={e.cta ?? ""} onChange={(ev) => setEval("cta", ev.target.value)} /></FormField>
            </div>
          ) : null}
          {e.check === "TEXT_GROUNDING" ? (
            <>
              <FormField label="Input facts"><textarea rows={3} value={e.input ?? ""} onChange={(ev) => setEval("input", ev.target.value)} /></FormField>
              <FormField label="Output that must stay grounded"><textarea rows={3} value={e.output ?? ""} onChange={(ev) => setEval("output", ev.target.value)} /></FormField>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
