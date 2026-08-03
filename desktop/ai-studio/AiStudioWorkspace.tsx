import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, Bell, Bot, CheckCircle2, ChevronRight, CircleAlert, Clock3, Command, FileText, Lightbulb, LoaderCircle, MessageSquareText, Pause, Play, Plus, RefreshCw, Search, Send, Sparkles, Square, X } from "lucide-react";
import { AiStudioSessionManager } from "./session-store";
import type { AiStudioSession, AiStudioStatus, PipelineDashboard, PipelineJob, StudioMessage, StudioTask, TaskState } from "./types";
import "./ai-studio.css";
import "./ai-studio-live.css";

const sessionManager = new AiStudioSessionManager();
const pollIntervalMs = 15_000;

function taskState(status: PipelineJob["status"]): TaskState {
  if (status === "running") return "active";
  if (status === "completed") return "complete";
  if (status === "failed") return "failed";
  if (status === "queued") return "background";
  return "waiting";
}

function jobTask(job: PipelineJob): StudioTask {
  return { id: job.id, title: `Creative pipeline: ${job.stage.replace(/-/g, " ")}`, state: taskState(job.status), progress: job.progress, detail: job.error ?? `${job.completedStages.length} stage${job.completedStages.length === 1 ? "" : "s"} completed` };
}

function recommendations(status: AiStudioStatus | null, dashboard: PipelineDashboard | null): Array<[string, string]> {
  const active = dashboard?.jobs[0];
  if (active?.status === "failed") return [["Recovery", active.error ?? "Review the failed pipeline and retry it from its latest checkpoint."]];
  if (active?.status === "paused") return [["Workflow", "Resume the paused creative pipeline when its inputs are ready."]];
  if (active) return [["Pipeline", `The current pipeline is in ${active.stage.replace(/-/g, " ")} at ${active.progress}%.`]];
  if (!status?.aiCore) return [["Runtime", "Start the local runtime before requesting a creative workflow."]];
  return [["Workspace", "Open a project with source media, then ask AI Me to prepare a creative workflow."]];
}

export function AiStudioWorkspace() {
  const [allSessions, setAllSessions] = useState<AiStudioSession[]>(() => sessionManager.load());
  const [activeId, setActiveId] = useState(() => allSessions[0]?.id ?? "");
  const [status, setStatus] = useState<AiStudioStatus | null>(null);
  const [pipeline, setPipeline] = useState<PipelineDashboard | null>(null);
  const [pipelineAction, setPipelineAction] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const conversationEnd = useRef<HTMLDivElement>(null);
  const active = allSessions.find((session) => session.id === activeId) ?? allSessions[0];

  useEffect(() => { sessionManager.save(allSessions); }, [allSessions]);
  useEffect(() => { conversationEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.messages.length]);
  const synchronize = async () => {
    const [nextStatus, nextPipeline] = await Promise.all([
      fetch("/api/desktop-workspace/status").then((response) => response.ok ? response.json() as Promise<AiStudioStatus> : null),
      fetch("/api/pipeline").then((response) => response.ok ? response.json() as Promise<PipelineDashboard> : null),
    ]).catch(() => [null, null] as const);
    setStatus(nextStatus);
    setPipeline(nextPipeline);
  };
  useEffect(() => {
    void synchronize();
    const timer = window.setInterval(() => void synchronize(), pollIntervalMs);
    return () => window.clearInterval(timer);
  }, []);

  const updateSession = (next: AiStudioSession) => setAllSessions((current) => current.map((session) => session.id === next.id ? next : session));
  const startSession = () => {
    const next = sessionManager.create();
    setAllSessions((current) => [next, ...current]);
    setActiveId(next.id);
  };
  const send = async () => {
    const body = draft.trim();
    if (!body || !active) return;
    const user = sessionManager.append(active, { kind: "user", body });
    updateSession(user);
    setDraft("");
    try {
      const result = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: active.conversationId, message: body, projectId: status?.activeProjectId ?? undefined }),
      });
      const payload = await result.json() as { conversation?: { id: string }; response?: string; plan?: { intent: string } ; error?: string };
      if (!result.ok || !payload.response || !payload.conversation) throw new Error(payload.error ?? "Conversation service is unavailable");
      const current = { ...user, conversationId: payload.conversation.id };
      updateSession(sessionManager.append(current, { kind: "assistant", title: `AI Me · ${payload.plan?.intent ?? "response"}`, body: payload.response }));
    } catch (error) {
      updateSession(sessionManager.append(user, { kind: "assistant", title: "AI Me unavailable", body: error instanceof Error ? error.message : "The local conversation service is unavailable." }));
    }
  };
  const controlPipeline = async (job: PipelineJob, action: "pause" | "resume" | "cancel" | "retry") => {
    setPipelineAction(`${job.id}:${action}`);
    try {
      const url = action === "retry" ? `/api/pipeline/jobs/${job.id}/retry` : `/api/autonomous-executions/${job.id}/${action}`;
      const response = await fetch(url, { method: "POST" });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "Pipeline control request failed");
      const payload = await response.json() as { dashboard?: PipelineDashboard };
      setPipeline(payload.dashboard ?? null);
    } finally {
      setPipelineAction(null);
    }
  };
  const messages = active?.messages.filter((message) => !query || `${message.title ?? ""} ${message.body}`.toLowerCase().includes(query.toLowerCase())) ?? [];
  const connected = [status?.aiCore, status?.workflowEngine, status?.communicationBus, status?.memoryFoundation, status?.knowledgeFoundation, status?.automationEngine, status?.taskScheduler].filter(Boolean).length;
  const jobs = [...(pipeline?.jobs ?? []), ...(pipeline?.history ?? [])];
  const tasks = jobs.slice(0, 4).map(jobTask);
  const suggestions = recommendations(status, pipeline);
  const timeline = jobs.flatMap((job) => job.notifications.slice(-2).map((notification) => ({ id: `${job.id}:${notification.at}:${notification.message}`, label: notification.message, at: notification.at }))).sort((left, right) => right.at.localeCompare(left.at)).slice(0, 4);

  return <div className="ai-studio">
    <aside className="ai-sessions">
      <div className="ai-side-heading"><div><span>AI SESSIONS</span><h2>Collaboration</h2></div><button onClick={startSession} title="New session"><Plus size={16} /></button></div>
      <button className="new-ai-session" onClick={startSession}><Sparkles size={15} />New collaboration</button>
      <div className="ai-session-list">{allSessions.map((session) => <button className={session.id === active?.id ? "current" : ""} key={session.id} onClick={() => setActiveId(session.id)}><MessageSquareText size={15} /><span><b>{session.title}</b><small>{new Date(session.updatedAt).toLocaleDateString()}</small></span></button>)}</div>
      <div className="context-card"><span>CONTEXT</span><b>{status?.activeProject ?? "No active project"}</b><small>Project workspace linked</small></div>
    </aside>
    <section className="ai-conversation">
      <header className="conversation-heading"><div><span>AI INTERACTION CENTER</span><h1>{active?.title ?? "Collaboration"}</h1><p><i />{status?.aiCore ? "Ready to collaborate" : "Connecting to local runtime"}</p></div><div><button onClick={() => setSearchOpen(!searchOpen)} title="Search conversation"><Search size={16} /></button><button onClick={() => setNotificationsOpen(!notificationsOpen)} title="Notifications"><Bell size={16} /><i /></button></div></header>
      {searchOpen && <div className="conversation-search"><Search size={15} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this conversation" /><button onClick={() => { setQuery(""); setSearchOpen(false); }}><X size={15} /></button></div>}
      <div className="conversation-stream">{messages.map((message) => <MessageCard key={message.id} message={message} />)}<div ref={conversationEnd} /></div>
      <div className="composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Write a message for AI Me..." /><button onClick={() => void send()} disabled={!draft.trim()} title="Send message"><Send size={17} /></button><small>Local conversation engine · workflow execution requires confirmation</small></div>
    </section>
    <aside className="ai-insights">
      <div className="insights-tabs"><span>AI STATUS</span><button onClick={() => setNotificationsOpen(!notificationsOpen)} title="Notifications"><Bell size={15} /></button></div>
      <section className="assistant-status"><div className="assistant-orb"><Sparkles size={19} /></div><span>AI ASSISTANT</span><h3>{status?.aiCore ? "Creative team member online" : "Preparing collaboration context"}</h3><p>{status?.activeProject ?? "No active project"} · {connected}/7 services available</p><div><button onClick={() => void synchronize()} title="Refresh workspace status"><RefreshCw size={14} />Refresh</button><button title="Pipeline status">{pipeline?.monitor.estimatedCompletion ?? "Not available"}</button></div></section>
      <section className="task-monitor"><PanelTitle icon={<Activity size={15} />} title="Activity monitor" count={tasks.length} />{tasks.length ? tasks.map((task) => <TaskRow key={task.id} task={task} job={jobs.find((item) => item.id === task.id)} action={pipelineAction} onControl={controlPipeline} />) : <EmptyPanel detail="No creative pipeline is currently running." />}</section>
      <section className="recommendations"><PanelTitle icon={<Lightbulb size={15} />} title="Recommendations" />{suggestions.map(([kind, detail]) => <div className="recommendation-row" key={kind}><span>{kind}</span><p>{detail}</p><ChevronRight size={14} /></div>)}</section>
      <section className="decision-timeline"><PanelTitle icon={<Command size={15} />} title="Pipeline timeline" />{timeline.length ? timeline.map((item, index) => <div key={item.id}><i className={index === 0 ? "current" : ""} /><span>{item.label}</span><small>{new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>) : <EmptyPanel detail="Pipeline events will appear here when execution begins." />}</section>
    </aside>
    {notificationsOpen && <NotificationCenter status={status} pipeline={pipeline} onClose={() => setNotificationsOpen(false)} />}
  </div>;
}

function MessageCard({ message }: { message: StudioMessage }) {
  return <article className={`conversation-message ${message.kind}`}><div className="message-avatar">{message.kind === "user" ? "KA" : <Bot size={15} />}</div><div><div className="message-meta"><b>{message.title ?? (message.kind === "user" ? "You" : "AI Studio")}</b><span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div><p>{message.body}</p>{message.kind === "report" && <pre>STATUS: PREPARED{"\n"}SCOPE: INTERFACE ONLY</pre>}</div></article>;
}
function PanelTitle({ icon, title, count }: { icon: ReactNode; title: string; count?: number }) { return <div className="ai-panel-title">{icon}<b>{title}</b>{count !== undefined && <small>{count}</small>}</div>; }
function TaskRow({ task, job, action, onControl }: { task: StudioTask; job?: PipelineJob; action: string | null; onControl: (job: PipelineJob, action: "pause" | "resume" | "cancel" | "retry") => Promise<void> }) {
  const Icon = task.state === "complete" ? CheckCircle2 : task.state === "failed" ? CircleAlert : task.state === "active" ? LoaderCircle : Clock3;
  const busy = (next: "pause" | "resume" | "cancel" | "retry") => action === `${job?.id}:${next}`;
  return <div className="task-row"><Icon className={task.state} size={15} /><div><b>{task.title}</b><small>{task.detail}</small>{task.state === "active" && <i><em style={{ width: `${task.progress}%` }} /></i>}{job && <div className="pipeline-controls">{job.status === "running" && <button disabled={busy("pause")} onClick={() => void onControl(job, "pause")} title="Pause pipeline"><Pause size={11} /></button>}{job.status === "paused" && <button disabled={busy("resume")} onClick={() => void onControl(job, "resume")} title="Resume pipeline"><Play size={11} /></button>}{(job.status === "queued" || job.status === "running" || job.status === "paused") && <button disabled={busy("cancel")} onClick={() => void onControl(job, "cancel")} title="Cancel pipeline"><Square size={10} /></button>}{job.status === "failed" && <button disabled={busy("retry")} onClick={() => void onControl(job, "retry")} title="Retry pipeline"><RefreshCw size={11} /></button>}</div>}</div><span>{task.state === "active" ? `${task.progress}%` : task.state}</span></div>;
}
function EmptyPanel({ detail }: { detail: string }) { return <p className="ai-panel-empty">{detail}</p>; }
function NotificationCenter({ status, pipeline, onClose }: { status: AiStudioStatus | null; pipeline: PipelineDashboard | null; onClose: () => void }) {
  const pipelineItems = [...(pipeline?.jobs ?? []), ...(pipeline?.history ?? [])].flatMap((job) => job.notifications.slice(-2).map((notification) => ({ icon: notification.level === "error" ? CircleAlert : notification.level === "warning" ? Clock3 : CheckCircle2, title: `Pipeline ${job.stage.replace(/-/g, " ")}`, detail: notification.message, tone: notification.level === "error" || notification.level === "warning" ? "warning" : "success" }))).slice(0, 5);
  const items = pipelineItems.length ? pipelineItems : [
    { icon: status?.communicationBus ? CheckCircle2 : CircleAlert, title: "Communication bus", detail: status?.communicationBus ? "Connected to the workspace runtime" : "Awaiting local runtime", tone: status?.communicationBus ? "success" : "warning" },
    { icon: FileText, title: "Pipeline activity", detail: "No creative pipeline notifications are available yet.", tone: "neutral" },
  ];
  return <div className="notification-center"><header><div><span>NOTIFICATIONS</span><h3>Workspace events</h3></div><button onClick={onClose}><X size={15} /></button></header>{items.map((item) => { const Icon = item.icon; return <article key={item.title}><Icon className={item.tone} size={16} /><div><b>{item.title}</b><p>{item.detail}</p></div></article>; })}</div>;
}