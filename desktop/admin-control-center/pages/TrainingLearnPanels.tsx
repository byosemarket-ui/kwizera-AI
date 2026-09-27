import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  adminApi,
  type AdminLearnedKnowledgeItem,
  type AdminTeachingCommitResult,
  type AdminTeachingSessionDetail,
  type AdminTeachingSource,
  type AdminTrainingCatalog,
  type AdminTrainingDataset,
  type AdminTrainingJob,
  type AdminTrainingRuntimeTest,
} from "../admin-api";
import { DataTable, EmptyState, ErrorState, FormField, SectionCard, Select, StatusBadge } from "../components/ui";

type Notify = (message: string, tone?: "info" | "success" | "error") => void;

/** Server request limit is 70 MB; base64 inflates files by 4/3, so each file is uploaded in its own request. */
const MAX_FILE_BASE64 = 68 * 1024 * 1024;
const TERMINAL_JOB = new Set(["COMPLETED", "FAILED", "CANCELLED", "BLOCKED"]);
const RUNNING_SESSION = new Set(["QUEUED", "ANALYZING"]);

const TEACHING_TYPES = [
  { value: "KNOWLEDGE", label: "Knowledge — facts and principles" },
  { value: "EXAMPLE", label: "Example — what good output looks like" },
  { value: "STYLE", label: "Style — visual / tonal conventions" },
  { value: "INSTRUCTION", label: "Instruction — rules to follow" },
  { value: "WORKFLOW", label: "Workflow — ordered steps" },
  { value: "BEST_PRACTICE", label: "Best practice" },
  { value: "PATTERN", label: "Pattern — recurring structure" },
  { value: "MULTIMODAL_EXAMPLE", label: "Multimodal example — correlated media and text" },
];

const SOURCE_TYPES: Array<{ value: string; label: string; accept: string }> = [
  { value: "MULTIPLE", label: "Mixed material", accept: "" },
  { value: "VIDEO", label: "Video (MP4, WebM, MOV)", accept: "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" },
  { value: "AUDIO", label: "Audio (MP3, WAV, M4A, AAC, OGG)", accept: "audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg" },
  { value: "IMAGE", label: "Image (JPG, PNG, WebP)", accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" },
  { value: "DOCUMENT", label: "Document (PDF, DOCX, TXT, MD, CSV, EPUB)", accept: ".pdf,.docx,.txt,.md,.markdown,.csv,.epub,.html,.htm" },
  { value: "BOOK", label: "Book (split by chapter)", accept: ".pdf,.docx,.epub,.txt,.md" },
  { value: "TEXT", label: "Text / Markdown", accept: ".txt,.md,.markdown" },
  { value: "CODE", label: "Code (analysed statically, never executed)", accept: ".ts,.tsx,.js,.jsx,.mjs,.py,.css,.scss,.html,.json,.go,.rs,.java,.kt,.swift,.rb,.php,.c,.h,.cpp,.cs,.sql,.sh,.yaml,.yml,.vue,.svelte" },
  { value: "URL", label: "Web page (allowlisted URL)", accept: "" },
];

const RETENTION = [
  { value: "KEEP_SOURCE", label: "Keep the source file" },
  { value: "DELETE_AFTER_SUCCESSFUL_EXTRACTION", label: "Delete the file after successful extraction (knowledge and fingerprint kept)" },
  { value: "ARCHIVE_SOURCE", label: "Archive the source after extraction" },
];

const NOVELTY = ["NEW", "PARTIALLY_NEW", "KNOWN", "DUPLICATE", "CONTRADICTORY", "LOW_CONFIDENCE", "REQUIRES_REVIEW"];
const KNOWLEDGE_TYPES = ["rule", "principle", "example", "pattern", "workflow", "style", "constraint", "heuristic", "relationship", "multimodal_pattern"];
const SOURCE_KINDS = ["TEXT", "DOCUMENT", "BOOK", "IMAGE", "VIDEO", "AUDIO", "CODE", "URL"];

type Pending =
  | { key: string; type: "file"; file: File; title: string; description: string }
  | { key: string; type: "text"; text: string; title: string; description: string; code: boolean }
  | { key: string; type: "url"; url: string; title: string; description: string };

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatSec(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;base64,/, ""));
    reader.onerror = () => reject(new Error(`${file.name} could not be read`));
    reader.readAsDataURL(file);
  });
}

async function pollJob(jobId: string): Promise<AdminTrainingJob> {
  for (let i = 0; i < 400; i += 1) {
    const { job } = await adminApi.trainingJob(jobId);
    if (TERMINAL_JOB.has(job.status)) return job;
    await new Promise((r) => window.setTimeout(r, 1_500));
  }
  throw new Error("The job is still running; check Training Jobs.");
}

function jobError(job: AdminTrainingJob): string {
  if (job.error) return `${job.error.code}: ${job.error.message}`;
  return job.stages[job.stages.length - 1]?.note ?? job.status;
}

function measuredText(m: AdminTeachingSource["measured"]): string {
  const parts: string[] = [];
  if (m.durationSec) parts.push(formatSec(m.durationSec));
  if (m.width && m.height) parts.push(`${m.width}×${m.height}`);
  if (m.pages) parts.push(`${m.pages} pages`);
  if (m.chapters) parts.push(`${m.chapters} chapters`);
  if (m.sections) parts.push(`${m.sections} sections`);
  if (m.rows) parts.push(`${m.rows} rows`);
  if (m.lines) parts.push(`${m.lines} lines`);
  return parts.join(" · ") || "—";
}

/** "Learn from this material": upload → real analysis job → review → dataset → publish → evaluate → activate. */
export function LearnPanel({ catalog, datasets, notify, onChanged, onOpenDataset }: {
  catalog: AdminTrainingCatalog; datasets: AdminTrainingDataset[]; notify: Notify; onChanged: () => void; onOpenDataset: (id: string) => void;
}) {
  const [target, setTarget] = useState<string>(catalog.targets[0]?.id ?? "");
  const [capabilityId, setCapabilityId] = useState("");
  const [teachingType, setTeachingType] = useState("KNOWLEDGE");
  const [sourceType, setSourceType] = useState("MULTIPLE");
  const [scope, setScope] = useState("ADMIN");
  const [projectId, setProjectId] = useState("");
  const [retention, setRetention] = useState("KEEP_SOURCE");
  const [pending, setPending] = useState<Pending[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [urlText, setUrlText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<AdminTeachingSessionDetail | null>(null);
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [commitTo, setCommitTo] = useState("");
  const [newKey, setNewKey] = useState("");
  const [committed, setCommitted] = useState<AdminTeachingCommitResult | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [evaluation, setEvaluation] = useState<{ status: string; passed: number; failed: number; skipped: number } | null>(null);
  const [activated, setActivated] = useState(false);
  const [runtime, setRuntime] = useState<AdminTrainingRuntimeTest | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const capabilities = catalog.capabilities.filter((c) => c.target === target);
  const capability = catalog.capabilities.find((c) => c.id === capabilityId);
  const accept = SOURCE_TYPES.find((s) => s.value === sourceType)?.accept || SOURCE_TYPES.filter((s) => s.accept).map((s) => s.accept).join(",");
  const running = session ? RUNNING_SESSION.has(session.status) : false;
  const commitTargets = datasets.filter((d) => d.capability === capabilityId && d.scope === scope && (scope !== "PROJECT" || d.projectId === projectId) && !d.archived);

  useEffect(() => {
    if (!capabilities.some((c) => c.id === capabilityId)) setCapabilityId(capabilities[0]?.id ?? "");
  }, [target]);

  useEffect(() => {
    if (!sessionId) return undefined;
    let stopped = false;
    const tick = async () => {
      try {
        const { session: next } = await adminApi.teachingSession(sessionId);
        if (stopped || !mounted.current) return;
        setSession(next);
        if (RUNNING_SESSION.has(next.status)) window.setTimeout(() => void tick(), 1_500);
        else onChanged();
      } catch (err) {
        if (!stopped) setError(errorText(err, "Progress could not be read"));
      }
    };
    void tick();
    return () => { stopped = true; };
  }, [sessionId]);

  const addFiles = (files: FileList | File[]) => {
    const next: Pending[] = [];
    for (const file of Array.from(files)) {
      next.push({ key: `${file.name}-${file.size}-${file.lastModified}`, type: "file", file, title: file.name.replace(/\.[^.]+$/, ""), description: "" });
    }
    setPending((p) => [...p, ...next.filter((n) => !p.some((x) => x.key === n.key))].slice(0, 12));
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    else {
      const text = e.dataTransfer.getData("text/plain");
      if (/^https?:\/\//i.test(text.trim())) setUrlText(text.trim());
      else if (text.trim()) setPasteText(text);
    }
  };

  const patchPending = (key: string, patch: Partial<{ title: string; description: string }>) =>
    setPending((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const addPaste = () => {
    if (pasteText.trim().length < 20) { setError("Paste at least a sentence of material."); return; }
    setPending((p) => [...p, { key: `text-${Date.now()}`, type: "text" as const, text: pasteText, title: sourceType === "CODE" ? "Pasted code" : "Pasted text", description: "", code: sourceType === "CODE" }].slice(0, 12));
    setPasteText("");
    setError(null);
  };

  const addUrl = () => {
    const url = urlText.trim();
    if (!/^https?:\/\//i.test(url)) { setError("Enter a full http(s) URL."); return; }
    setPending((p) => [...p, { key: `url-${url}`, type: "url" as const, url, title: "", description: "" }].slice(0, 12));
    setUrlText("");
    setError(null);
  };

  const learn = async () => {
    setError(null);
    setSession(null); setSessionId(null); setCommitted(null); setVersion(null); setEvaluation(null); setActivated(false); setRuntime(null);
    const scopeFields = { target, capability: capabilityId, scope, ...(scope === "PROJECT" ? { projectId } : {}) };
    const kindHint = ["BOOK", "CODE", "DOCUMENT"].includes(sourceType) ? sourceType : "";
    const sourceIds: string[] = [];
    try {
      for (const [i, item] of pending.entries()) {
        setBusy(`Uploading source ${i + 1} of ${pending.length}`);
        const common = { ...scopeFields, retention, title: item.title, description: item.description };
        let body: Record<string, unknown>;
        if (item.type === "url") body = { ...common, url: item.url };
        else if (item.type === "text") body = { ...common, text: item.text, kind: item.code ? "CODE" : kindHint, fileName: item.code ? "snippet.txt" : "pasted-text.md" };
        else {
          const dataBase64 = await fileToBase64(item.file);
          if (dataBase64.length > MAX_FILE_BASE64) throw new Error(`${item.file.name} is ${formatBytes(item.file.size)}; the upload limit is about 50 MB per file.`);
          body = { ...common, fileName: item.file.name, mimeType: item.file.type, dataBase64, kind: kindHint };
        }
        const { source } = await adminApi.addTeachingSource(body);
        sourceIds.push(source.sourceId);
      }
      setBusy("Starting analysis");
      const { session: created } = await adminApi.createTeachingSession({ ...scopeFields, teachingType, sourceIds, instructions });
      setSessionId(created.sessionId);
      setPending([]);
      setBusy(null);
      onChanged();
    } catch (err) {
      setBusy(null);
      setError(errorText(err, "The material could not be submitted"));
    }
  };

  const decide = async (ids: string[], decision: "ACCEPTED" | "REJECTED" | "PENDING") => {
    if (!sessionId || !ids.length) return;
    try {
      const { session: next } = await adminApi.decideTeachingKnowledge(sessionId, ids.map((id) => ({ id, decision })));
      setSession(next);
    } catch (err) {
      notify(errorText(err, "Decision failed"), "error");
    }
  };

  const commit = async () => {
    if (!sessionId || !session?.knowledge) return;
    setError(null);
    setBusy("Adding knowledge to the dataset");
    try {
      const accept = session.knowledge.filter((k) => !k.committedRecordId && k.decision === "ACCEPTED").map((k) => k.id);
      const body = commitTo ? { datasetId: commitTo } : { dataset: newKey.trim() ? { key: newKey.trim() } : {} };
      const { result } = await adminApi.commitTeachingSession(sessionId, accept.length ? { ...body, accept } : body);
      setCommitted(result);
      setSession((await adminApi.teachingSession(sessionId)).session);
      onChanged();
      notify(`${result.created} knowledge record(s) added to ${result.datasetKey}${result.merged ? `, ${result.merged} merged` : ""}`);
      setBusy(null);
    } catch (err) {
      setBusy(null);
      setError(errorText(err, "The knowledge could not be added"));
    }
  };

  const publishAndEvaluate = async () => {
    if (!committed) return;
    setError(null);
    try {
      setBusy("Publishing an immutable dataset version");
      const pub = await pollJob((await adminApi.publishTrainingDataset(committed.datasetId, `Learned from teaching session ${sessionId?.slice(0, 8) ?? ""}`)).job.jobId);
      const v = typeof pub.result?.version === "number" ? pub.result.version : null;
      if (pub.status !== "COMPLETED" || !v) { onChanged(); setBusy(null); setError(`${jobError(pub)} — open the dataset to review records that need approval.`); return; }
      setVersion(v);
      setBusy(`Evaluating v${v}`);
      const ev = await pollJob((await adminApi.evaluateTrainingVersion(committed.datasetId, v)).job.jobId);
      onChanged();
      if (ev.status !== "COMPLETED") { setBusy(null); setError(jobError(ev)); return; }
      const s = ev.result?.summary as { passed?: number; failed?: number; skipped?: number } | undefined;
      setEvaluation({ status: String(ev.result?.status ?? "FAILED"), passed: s?.passed ?? 0, failed: s?.failed ?? 0, skipped: s?.skipped ?? 0 });
      if (sessionId) setSession((await adminApi.teachingSession(sessionId)).session);
      setBusy(null);
    } catch (err) {
      setBusy(null);
      setError(errorText(err, "Publish or evaluation failed"));
    }
  };

  const activate = async () => {
    if (!committed || !version) return;
    setError(null);
    setBusy(`Activating v${version}`);
    try {
      const job = await pollJob((await adminApi.activateTrainingVersion(committed.datasetId, version)).job.jobId);
      onChanged();
      if (job.status !== "COMPLETED") { setBusy(null); setError(jobError(job)); return; }
      setActivated(true);
      setBusy("Checking runtime consumption");
      const { test } = await adminApi.trainingRuntimeTest(committed.datasetId, {});
      setRuntime(test);
      if (sessionId) setSession((await adminApi.teachingSession(sessionId)).session);
      notify(`v${version} is active`);
      setBusy(null);
    } catch (err) {
      setBusy(null);
      setError(errorText(err, "Activation failed"));
    }
  };

  const knowledge = session?.knowledge ?? [];
  const visible = recommendedOnly ? knowledge.filter((k) => k.recommended || k.decision === "ACCEPTED") : knowledge;
  const reviewable = session?.status === "READY_FOR_REVIEW" || session?.status === "COMMITTED";
  const p = session?.progress;

  return (
    <>
      <SectionCard
        title="Learn from material"
        description="Upload or link material; the server measures and extracts knowledge with provenance, checks what is new, and nothing reaches runtime until you review, publish, evaluate and activate it. Uploaded material is untrusted data and never becomes an instruction to the AI."
      >
        <div style={{ display: "grid", gap: 12, maxWidth: 860 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Select label="AI to teach" value={target} onChange={setTarget} options={catalog.targets.map((t) => ({ value: t.id, label: t.label }))} />
            <Select label="Capability" value={capabilityId} onChange={setCapabilityId} options={capabilities.map((c) => ({ value: c.id, label: c.label }))} />
            <Select label="Teaching type" value={teachingType} onChange={setTeachingType} options={TEACHING_TYPES} />
            <Select label="Source type" value={sourceType} onChange={setSourceType} options={SOURCE_TYPES.map((s) => ({ value: s.value, label: s.label }))} />
          </div>
          {capability ? <p className="acc-muted" style={{ fontSize: 12 }}>Runtime: {capability.runtimeWired ? `consumed by ${capability.runtimeConsumers.join(", ")}` : capability.runtimeNote}</p> : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Select label="Scope" value={scope} onChange={setScope} options={catalog.scopes.filter((s) => s.available).map((s) => ({ value: s.id, label: s.label }))} />
            {scope === "PROJECT" ? <FormField label="Project id"><input value={projectId} onChange={(e) => setProjectId(e.target.value)} /></FormField> : null}
            <Select label="Source retention" value={retention} onChange={setRetention} options={RETENTION} />
          </div>

          {sourceType !== "URL" ? (
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInput.current?.click(); }}
              style={{ border: `2px dashed ${dragOver ? "var(--acc-accent, #6c8cff)" : "var(--acc-border, #3a3f4b)"}`, borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer" }}
            >
              <strong>Drop files here</strong> or click to choose — several files at once, up to 12 per session.
              <br /><span className="acc-muted" style={{ fontSize: 12 }}>{SOURCE_TYPES.find((s) => s.value === sourceType)?.label}. Only upload material you have the rights to use; books are learned chapter by chapter, never stored as a copy in knowledge.</span>
              <input ref={fileInput} type="file" multiple accept={accept} style={{ display: "none" }} onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            {sourceType !== "URL" && !["VIDEO", "AUDIO", "IMAGE"].includes(sourceType) ? (
              <FormField label={sourceType === "CODE" ? "Paste code" : "Paste text or Markdown"}>
                <textarea rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
                <button type="button" className="acc-button ghost" style={{ marginTop: 6 }} disabled={!pasteText.trim()} onClick={addPaste}>Add pasted material</button>
              </FormField>
            ) : null}
            {["URL", "MULTIPLE", "DOCUMENT", "TEXT"].includes(sourceType) ? (
              <FormField label="Web page URL" hint="Fetched on the server with robots.txt and an allowlist; private and internal addresses are refused.">
                <input value={urlText} onChange={(e) => setUrlText(e.target.value)} placeholder="https://" />
                <button type="button" className="acc-button ghost" style={{ marginTop: 6 }} disabled={!urlText.trim()} onClick={addUrl}>Add URL</button>
              </FormField>
            ) : null}
          </div>

          {pending.length ? (
            <DataTable
              columns={[{ key: "item", label: "Material" }, { key: "title", label: "Title" }, { key: "desc", label: "Notes (metadata)" }, { key: "remove", label: "" }]}
              rows={pending.map((item) => ({
                id: item.key,
                cells: {
                  item: item.type === "file" ? `${item.file.name} (${formatBytes(item.file.size)})` : item.type === "url" ? item.url : `${item.code ? "Code" : "Text"}, ${item.text.length} characters`,
                  title: <input value={item.title} onChange={(e) => patchPending(item.key, { title: e.target.value })} placeholder="Title" />,
                  desc: <input value={item.description} onChange={(e) => patchPending(item.key, { description: e.target.value })} placeholder="What this material shows" />,
                  remove: <button type="button" className="acc-button ghost" onClick={() => setPending((p) => p.filter((x) => x.key !== item.key))}>Remove</button>,
                },
              }))}
            />
          ) : null}

          <FormField
            label="What should the AI learn from this?"
            hint="Your instructions steer extraction: focus topics are prioritised, 'ignore …' excludes topics, and media facets (framing, transitions, pacing, typography, CTA, audio, colour, layout) choose what is measured. Items outside the focus are shown but not recommended."
          >
            <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Learn the scene order, framing and transitions. Ignore the music." />
          </FormField>
          <div>
            <button type="button" className="acc-button" disabled={!capabilityId || !pending.length || Boolean(busy) || running || (scope === "PROJECT" && !projectId.trim())} onClick={() => void learn()}>
              Learn from this material
            </button>
          </div>
          {busy ? <p className="acc-muted">{busy}…</p> : null}
          {error ? <ErrorState title="This step did not complete" detail={error} /> : null}
        </div>
      </SectionCard>

      {session && p ? (
        <SectionCard title="Analysis progress" description="Real server stages. The percentage counts completed analysis steps and never reaches 100% before the job has finished.">
          <p>
            <StatusBadge status={session.status} /> <strong>{p.stageLabel}</strong>
            {p.currentSource ? ` · ${p.currentSource}` : ""}{p.currentItem ? ` · ${p.currentItem}` : ""}
          </p>
          <p>
            {p.completed} of {p.total} {p.unit}{p.percent !== null ? ` · ${p.percent}%` : ""} · elapsed {formatSec(p.elapsedSec)}
            {p.etaSec !== null ? ` · about ${formatSec(p.etaSec)} remaining` : running ? " · no reliable time estimate yet" : ""}
          </p>
          {p.percent !== null ? <progress max={100} value={p.percent} style={{ width: "100%", maxWidth: 560 }} /> : null}
          <p style={{ fontSize: 12 }}>
            Extracted {p.counts.extracted} · new {p.counts.new} · partially new {p.counts.partiallyNew} · known {p.counts.known} · duplicate {p.counts.duplicate}
            {" "}· contradictory {p.counts.contradictory} · low confidence {p.counts.lowConfidence} · needs review {p.counts.requiresReview}
          </p>
          {session.error ? <ErrorState title={session.error.code} detail={session.error.message} /> : null}
          <p className="acc-muted" style={{ fontSize: 12 }}>
            Vision analysis: {session.analysis.ai.vision} · Reasoning: {session.analysis.ai.reasoning} · Speech transcription: {session.analysis.ai.transcription}
          </p>
          {session.analysis.perSource.map((s) => (
            <details key={s.sourceId} style={{ fontSize: 12, marginBottom: 6 }}>
              <summary><StatusBadge status={s.status} /> {s.title}{s.unavailable.length ? ` — ${s.unavailable.length} aspect(s) unavailable` : ""}</summary>
              <ul>
                {s.notes.map((n) => <li key={n}>{n}</li>)}
                {s.unavailable.map((u) => <li key={u}><StatusBadge status="UNAVAILABLE" /> {u}</li>)}
              </ul>
            </details>
          ))}
          {session.analysis.notes.length ? <ul style={{ fontSize: 12 }}>{session.analysis.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
          <p style={{ fontSize: 12 }}>
            Sources: {session.sources.map((s) => s && `${s.title} (${s.kind}, ${s.retained ? s.status.toLowerCase() : "file not retained — fingerprint kept"})`).filter(Boolean).join(" · ")}
          </p>
          {session.status === "FAILED" ? <button type="button" className="acc-button ghost" onClick={() => adminApi.rerunTeachingSession(session.sessionId).then(({ session: s }) => setSessionId(s.sessionId)).catch((err: unknown) => setError(errorText(err, "Re-run failed")))}>Run the analysis again</button> : null}
        </SectionCard>
      ) : null}

      {session && reviewable ? (
        <SectionCard
          title={`Extracted knowledge (${knowledge.length})`}
          description="Review before anything is stored. Recommended items are in scope and new or partially new; accept or reject any item. Contradictions stay flagged and need approval in the dataset before publishing."
          actions={(
            <label style={{ fontSize: 12 }}><input type="checkbox" checked={recommendedOnly} onChange={(e) => setRecommendedOnly(e.target.checked)} /> Recommended / accepted only</label>
          )}
        >
          <p style={{ fontSize: 12 }}>
            {session.summary.recommended} recommended · {session.summary.accepted} accepted · {session.summary.rejected} rejected · {session.summary.committed} already in a dataset
          </p>
          {!knowledge.length ? <EmptyState title="No knowledge was extracted" detail="See the analysis notes above for what could and could not be measured." /> : null}
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <button type="button" className="acc-button ghost" onClick={() => void decide(knowledge.filter((k) => k.recommended && !k.committedRecordId).map((k) => k.id), "ACCEPTED")}>Accept all recommended</button>
            <button type="button" className="acc-button ghost" onClick={() => void decide(knowledge.filter((k) => !k.recommended && !k.committedRecordId).map((k) => k.id), "REJECTED")}>Reject everything not recommended</button>
          </div>
          <DataTable
            emptyTitle="Nothing to show"
            columns={[{ key: "k", label: "Knowledge" }, { key: "type", label: "Type / method" }, { key: "novelty", label: "Novelty" }, { key: "conf", label: "Confidence", className: "numeric" }, { key: "prov", label: "Provenance" }, { key: "decision", label: "Decision" }]}
            rows={visible.map((k) => ({
              id: k.id,
              cells: {
                k: (
                  <details>
                    <summary><strong>{k.title}</strong>{k.recommended ? " · recommended" : ""}</summary>
                    <p style={{ fontSize: 12 }}>{k.statement}</p>
                    {k.evidence.length ? <ul style={{ fontSize: 12 }}>{k.evidence.slice(0, 4).map((e, i) => <li key={i}>{e.kind.toLowerCase()}{e.location ? ` (${e.location})` : ""}: {e.text}</li>)}</ul> : null}
                    {k.scopeNote ? <p className="acc-muted" style={{ fontSize: 12 }}>{k.scopeNote}</p> : null}
                    {k.suggestedGuidance.length ? <p style={{ fontSize: 12 }}>Planner guidance: {k.suggestedGuidance.map((g) => `${g.key}=${g.value}`).join(", ")}</p> : null}
                    {k.flags.length ? <p style={{ fontSize: 12 }}>Flags: {k.flags.join(", ")}</p> : null}
                  </details>
                ),
                type: <span style={{ fontSize: 12 }}>{k.knowledgeType.replace("_", " ")}<br />{k.method.toLowerCase().replace("_", " ")}</span>,
                novelty: <span title={k.novelty.reason}><StatusBadge status={k.novelty.class} />{k.novelty.matched ? <><br /><span className="acc-muted" style={{ fontSize: 11 }}>vs {k.novelty.matched.title.slice(0, 60)}</span></> : null}</span>,
                conf: k.confidence.toFixed(2),
                prov: <span style={{ fontSize: 12 }}>{k.sourceLocations.slice(0, 3).map((l) => `${l.sourceTitle} — ${l.label}${l.sourceRetained ? "" : " (source not retained)"}`).join("; ")}</span>,
                decision: k.committedRecordId
                  ? <StatusBadge status="IN DATASET" />
                  : (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button type="button" className={`acc-button${k.decision === "ACCEPTED" ? "" : " ghost"}`} onClick={() => void decide([k.id], k.decision === "ACCEPTED" ? "PENDING" : "ACCEPTED")}>Accept</button>
                      <button type="button" className={`acc-button${k.decision === "REJECTED" ? "" : " ghost"}`} onClick={() => void decide([k.id], k.decision === "REJECTED" ? "PENDING" : "REJECTED")}>Reject</button>
                    </div>
                  ),
              },
            }))}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
            <Select
              label="Add to dataset"
              value={commitTo}
              onChange={setCommitTo}
              options={[{ value: "", label: "Create a new dataset" }, ...commitTargets.map((d) => ({ value: d.datasetId, label: `${d.key} — ${d.name}` }))]}
            />
            {!commitTo ? <FormField label="New dataset key (optional)"><input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="LEARNED_…" /></FormField> : null}
            <button type="button" className="acc-button" disabled={Boolean(busy) || !knowledge.some((k) => !k.committedRecordId && k.decision !== "REJECTED" && (k.decision === "ACCEPTED" || k.recommended))} onClick={() => void commit()}>
              Add {knowledge.some((k) => k.decision === "ACCEPTED" && !k.committedRecordId) ? "accepted" : "recommended"} knowledge to dataset
            </button>
          </div>
        </SectionCard>
      ) : null}

      {committed ? (
        <SectionCard title="Dataset version, evaluation and activation" description="Publishing creates an immutable version; evaluation runs real checks; only a passed version can be activated, and rollback stays available.">
          <p>
            Dataset <strong>{committed.datasetKey}</strong>: {committed.created} record(s) added{committed.merged ? `, ${committed.merged} merged into existing records (provenance extended)` : ""}
            {committed.skipped.length ? `, ${committed.skipped.length} skipped` : ""}.
          </p>
          {committed.skipped.length ? <ul style={{ fontSize: 12 }}>{committed.skipped.slice(0, 10).map((s) => <li key={s.id}>{s.reason}</li>)}</ul> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="acc-button" disabled={Boolean(busy) || version !== null} onClick={() => void publishAndEvaluate()}>Publish and evaluate</button>
            <button type="button" className="acc-button" disabled={Boolean(busy) || evaluation?.status !== "PASSED" || activated} onClick={() => void activate()}>Activate</button>
            <button type="button" className="acc-button ghost" onClick={() => onOpenDataset(committed.datasetId)}>Open dataset (review, rollback)</button>
          </div>
          {version ? <p>Published <strong>v{version}</strong>{session?.datasetVersionId ? ` (${session.datasetVersionId})` : ""}.</p> : null}
          {evaluation ? <p><StatusBadge status={evaluation.status} /> Evaluation: {evaluation.passed} passed · {evaluation.failed} failed · {evaluation.skipped} skipped</p> : null}
          {activated ? <p><StatusBadge status="ACTIVE" /> v{version} is delivered to runtime through the Knowledge Base. Model weights were not changed.</p> : null}
          {runtime ? (
            <div style={{ fontSize: 13 }}>
              <p>Runtime retrieval: {runtime.teachingItemsRetrieved} of {runtime.items.length} retrieved items come from this version.</p>
              {runtime.consumption.map((c) => (
                <div key={c.consumer}>
                  <p><StatusBadge status={c.usesTeaching ? "USES TEACHING" : "NOT USING TEACHING"} /> <strong>{c.consumer}</strong> — {c.detail}</p>
                  {c.excerpts?.length ? <ul style={{ fontSize: 12 }}>{c.excerpts.slice(0, 4).map((e) => <li key={e}>{e}</li>)}</ul> : null}
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>
      ) : null}
    </>
  );
}

/** Every learned knowledge unit, filterable, with provenance down to page / chapter / scene. */
export function KnowledgeLibrary({ catalog, refreshKey }: { catalog: AdminTrainingCatalog; refreshKey: number }) {
  const [filters, setFilters] = useState<Record<string, string>>({ target: "", capability: "", type: "", sourceKind: "", minConfidence: "", status: "", version: "", active: "", novelty: "", from: "", to: "", q: "" });
  const [items, setItems] = useState<AdminLearnedKnowledgeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (key: string) => (value: string) => setFilters((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      adminApi.knowledgeLibrary(filters)
        .then(({ items: next }) => { if (!cancelled) { setItems(next); setError(null); } })
        .catch((err: unknown) => { if (!cancelled) setError(errorText(err, "Knowledge library failed to load")); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [filters, refreshKey]);

  const any = { value: "", label: "Any" };
  return (
    <SectionCard title="Knowledge library" description="Knowledge learned from material, with its lifecycle status and exact provenance. Archived datasets are hidden.">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <Select label="AI" value={filters.target!} onChange={set("target")} options={[any, ...catalog.targets.map((t) => ({ value: t.id, label: t.label }))]} />
        <Select label="Capability" value={filters.capability!} onChange={set("capability")} options={[any, ...catalog.capabilities.filter((c) => !filters.target || c.target === filters.target).map((c) => ({ value: c.id, label: c.label }))]} />
        <Select label="Type" value={filters.type!} onChange={set("type")} options={[any, ...KNOWLEDGE_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))]} />
        <Select label="Source" value={filters.sourceKind!} onChange={set("sourceKind")} options={[any, ...SOURCE_KINDS.map((k) => ({ value: k, label: k }))]} />
        <Select label="Min confidence" value={filters.minConfidence!} onChange={set("minConfidence")} options={[any, ...["0.5", "0.7", "0.85"].map((v) => ({ value: v, label: `≥ ${v}` }))]} />
        <Select label="Status" value={filters.status!} onChange={set("status")} options={[any, ...["ACTIVE", "PUBLISHED", "DRAFT", "CANDIDATE", "REJECTED"].map((s) => ({ value: s, label: s }))]} />
        <Select label="Active" value={filters.active!} onChange={set("active")} options={[any, { value: "1", label: "Active only" }, { value: "0", label: "Not active" }]} />
        <Select label="Novelty" value={filters.novelty!} onChange={set("novelty")} options={[any, ...NOVELTY.map((n) => ({ value: n, label: n }))]} />
        <FormField label="Version"><input style={{ width: 70 }} value={filters.version} onChange={(e) => set("version")(e.target.value.replace(/\D/g, ""))} /></FormField>
        <FormField label="From"><input type="date" value={filters.from} onChange={(e) => set("from")(e.target.value)} /></FormField>
        <FormField label="To"><input type="date" value={filters.to} onChange={(e) => set("to")(e.target.value)} /></FormField>
        <FormField label="Search"><input value={filters.q} onChange={(e) => set("q")(e.target.value)} /></FormField>
      </div>
      {error ? <ErrorState title="Knowledge library failed to load" detail={error} /> : null}
      <DataTable
        emptyTitle={items === null ? "Loading…" : "No learned knowledge matches"}
        columns={[{ key: "k", label: "Knowledge" }, { key: "status", label: "Status" }, { key: "cap", label: "AI / capability" }, { key: "novelty", label: "Novelty" }, { key: "conf", label: "Confidence", className: "numeric" }, { key: "prov", label: "Provenance" }]}
        rows={(items ?? []).map((i) => ({
          id: i.id,
          cells: {
            k: (
              <details>
                <summary><strong>{i.record.title}</strong> <span className="acc-muted" style={{ fontSize: 11 }}>{i.record.knowledgeType.replace("_", " ")} · {i.record.method.toLowerCase().replace("_", " ")}</span></summary>
                <p style={{ fontSize: 12 }}>{i.record.statement}</p>
                {i.record.evidence.length ? <ul style={{ fontSize: 12 }}>{i.record.evidence.slice(0, 4).map((e, n) => <li key={n}>{e.location ? `${e.location}: ` : ""}{e.text}</li>)}</ul> : null}
                {i.record.relationships.length ? <p style={{ fontSize: 12 }}>Related: {i.record.relationships.slice(0, 4).map((r) => `${r.type.toLowerCase()} "${r.targetTitle.slice(0, 50)}"`).join("; ")}</p> : null}
              </details>
            ),
            status: <><StatusBadge status={i.status} />{i.version ? <><br /><span style={{ fontSize: 12 }}>v{i.version}</span></> : null}{i.datasetKey ? <><br /><span className="acc-muted" style={{ fontSize: 11 }}>{i.datasetKey}</span></> : null}</>,
            cap: <span style={{ fontSize: 12 }}>{i.record.targetAI}<br />{i.record.capability}</span>,
            novelty: <StatusBadge status={i.record.novelty} />,
            conf: i.record.confidence.toFixed(2),
            prov: (
              <span style={{ fontSize: 12 }}>
                {i.record.sourceLocations.slice(0, 3).map((l) => `${l.sourceTitle} — ${l.label}`).join("; ")}
                {i.sources.map((s) => s && !s.retained ? <span key={s.sourceId} className="acc-muted"><br />{s.title}: source not retained (fingerprint {s.fingerprint}…)</span> : null)}
              </span>
            ),
          },
        }))}
      />
    </SectionCard>
  );
}

/** Uploaded teaching material with retention state; deleting a file keeps the knowledge learned from it. */
export function MaterialLibrary({ refreshKey, notify, onChanged }: { refreshKey: number; notify: Notify; onChanged: () => void }) {
  const [items, setItems] = useState<AdminTeachingSource[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    adminApi.teachingSources(showArchived)
      .then(({ items: next }) => { setItems(next); setError(null); })
      .catch((err: unknown) => setError(errorText(err, "Material library failed to load")));
  }, [refreshKey, showArchived, tick]);

  const remove = (s: AdminTeachingSource) => {
    if (!window.confirm(`Delete the stored file for "${s.title}"? Knowledge already learned from it is kept, with provenance marked "source not retained".`)) return;
    adminApi.deleteTeachingSource(s.sourceId)
      .then(() => { notify("Source file deleted; learned knowledge kept"); setTick((t) => t + 1); onChanged(); })
      .catch((err: unknown) => notify(errorText(err, "Delete failed"), "error"));
  };

  return (
    <SectionCard
      title="Material library"
      description="Every source uploaded for teaching, what was measured and what it produced. Files are stored in the training store and never executed."
      actions={<label style={{ fontSize: 12 }}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Include archived</label>}
    >
      {error ? <ErrorState title="Material library failed to load" detail={error} /> : null}
      <DataTable
        emptyTitle={items === null ? "Loading…" : "No material uploaded yet"}
        columns={[{ key: "title", label: "Source" }, { key: "kind", label: "Kind" }, { key: "measured", label: "Measured" }, { key: "cap", label: "Capability / scope" }, { key: "retention", label: "Retention" }, { key: "status", label: "Status" }, { key: "knowledge", label: "Knowledge", className: "numeric" }, { key: "action", label: "" }]}
        rows={(items ?? []).map((s) => ({
          id: s.sourceId,
          cells: {
            title: <><strong>{s.title}</strong><br /><span className="acc-muted" style={{ fontSize: 11 }}>{s.url ?? s.fileName}{s.sizeBytes ? ` · ${formatBytes(s.sizeBytes)}` : ""} · {new Date(s.createdAt).toLocaleString()}</span></>,
            kind: `${s.kind} · ${s.format}`,
            measured: <span style={{ fontSize: 12 }}>{measuredText(s.measured)}</span>,
            cap: <span style={{ fontSize: 12 }}>{s.capability}<br />{s.scope}{s.projectId ? ` (${s.projectId})` : ""}</span>,
            retention: <span style={{ fontSize: 12 }}>{RETENTION.find((r) => r.value === s.retention)?.label.split(" (")[0] ?? s.retention}</span>,
            status: <>
              <StatusBadge status={s.status} />
              {!s.retained ? <><br /><span className="acc-muted" style={{ fontSize: 11 }}>file not retained · fingerprint {s.contentHash.slice(0, 16)}…</span></> : null}
              {s.error ? <><br /><span style={{ fontSize: 11 }}>{s.error.message}</span></> : null}
            </>,
            knowledge: s.knowledgeExtracted,
            action: s.retained && s.storage === "training-store"
              ? <button type="button" className="acc-button ghost" onClick={() => remove(s)}>Delete file</button>
              : null,
          },
        }))}
      />
    </SectionCard>
  );
}
