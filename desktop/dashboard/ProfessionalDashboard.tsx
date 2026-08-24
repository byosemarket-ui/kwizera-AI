import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, Bot, ChevronRight, Cpu, FolderKanban, Gauge, Image, LayoutDashboard,
  Lightbulb, MonitorCog, Plus, RefreshCw, Settings, Sparkles, Video, X,
} from "lucide-react";
import type {
  DashboardCoreStatus, DashboardLayoutV2, DashboardLiveSnapshot,
  DashboardProject, DashboardWidgetId, DashboardWorkspace, WidgetPlacement,
} from "./types";
import { dashboardWidgetStore, WIDGET_LABELS } from "./widget-store";
import { dashboardLiveEngine } from "./live-engine";
import { WidgetFrame, gridCellFromPointer } from "./widgets/WidgetFrame";
import {
  AICard, ActionCard, InfoCard, LiveProgressPanel, LiveStatusRow,
  NotificationCard, PreviewCard, ProgressCard, StatCard,
} from "./widgets/cards";
import { ProductionModuleGrid, ReservedPanelGrid } from "./widgets/module-slots";
import "./dashboard.css";

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path);
    return response.ok ? (await response.json()) as T : null;
  } catch {
    return null;
  }
}

function bytes(value: number) {
  return value ? `${(value / 1024 / 1024).toFixed(1)} MB` : "--";
}

interface ProfessionalDashboardProps {
  onNavigate: (workspace: string) => void;
  workspaceLabel?: string;
}

export function ProfessionalDashboard({ onNavigate, workspaceLabel = "Home" }: ProfessionalDashboardProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<DashboardLayoutV2>(() => dashboardWidgetStore.load());
  const [core, setCore] = useState<DashboardCoreStatus | null>(null);
  const [workspace, setWorkspace] = useState<DashboardWorkspace | null>(null);
  const [live, setLive] = useState<DashboardLiveSnapshot | null>(null);
  const [tick, setTick] = useState(0);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [dragId, setDragId] = useState<DashboardWidgetId | null>(null);

  const refresh = useCallback(async () => {
    const [nextCore, nextWorkspace] = await Promise.all([
      fetchJson<DashboardCoreStatus>("/api/desktop-workspace/status"),
      fetchJson<DashboardWorkspace>("/api/workspace"),
    ]);
    setCore(nextCore);
    setWorkspace(nextWorkspace);
  }, []);

  useEffect(() => { void refresh(); const t = window.setInterval(() => void refresh(), 15_000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { const t = window.setInterval(() => setTick((n) => n + 1), 4_000); return () => clearInterval(t); }, []);
  useEffect(() => { dashboardWidgetStore.save(layout); }, [layout]);
  useEffect(() => {
    setLive(dashboardLiveEngine.buildSnapshot(core, workspace, workspaceLabel, tick));
  }, [core, workspace, workspaceLabel, tick]);

  const patch = (id: DashboardWidgetId, changes: Partial<WidgetPlacement>) =>
    setLayout((current) => dashboardWidgetStore.updateWidget(current, id, changes));

  const onDragStart = (id: DashboardWidgetId) => (event: React.MouseEvent) => {
    event.preventDefault();
    setDragId(id);
    const move = (e: MouseEvent) => {
      if (!gridRef.current) return;
      const cell = gridCellFromPointer(gridRef.current, e.clientX, e.clientY, layout.columns);
      setLayout((current) => dashboardWidgetStore.moveWidget(current, id, cell.x, cell.y));
    };
    const up = () => {
      setDragId(null);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onResizeStart = (id: DashboardWidgetId) => (event: React.MouseEvent) => {
    event.preventDefault();
    const widget = layout.widgets.find((w) => w.id === id);
    if (!widget) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = widget.w;
    const startH = widget.h;
    const move = (e: MouseEvent) => {
      const dx = Math.round((e.clientX - startX) / 80);
      const dy = Math.round((e.clientY - startY) / 60);
      setLayout((current) => dashboardWidgetStore.resizeWidget(current, id, startW + dx, startH + dy));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const storage = workspace?.projects.reduce(
    (sum, p) => sum + p.productImages.reduce((t, i) => t + i.sizeBytes, 0), 0,
  ) ?? 0;
  const notifications = buildNotifications(core, workspace?.activeProject ?? null);

  const renderWidget = (widget: WidgetPlacement) => {
    if (widget.hidden || !live) return null;
    const meta = WIDGET_LABELS[widget.id];
    const frame = (body: React.ReactNode) => (
      <WidgetFrame
        key={widget.id}
        widget={widget}
        title={meta.title}
        detail={meta.detail}
        onPin={() => setLayout((c) => dashboardWidgetStore.togglePin(c, widget.id))}
        onLock={() => setLayout((c) => dashboardWidgetStore.toggleLock(c, widget.id))}
        onHide={() => setLayout((c) => dashboardWidgetStore.toggleHidden(c, widget.id))}
        onDragStart={onDragStart(widget.id)}
        onResizeStart={onResizeStart(widget.id)}
      >
        {body}
      </WidgetFrame>
    );

    switch (widget.id) {
      case "live-status":
        return frame(<LiveStatusRow cards={live.statuses} />);
      case "active-project":
        return frame(
          <InfoCard
            label="Project"
            value={live.activeProject ?? "No project"}
            detail={workspace?.activeProject ? `${workspace.activeProject.productImages.length} source assets` : "Open or create a project"}
            icon={<FolderKanban size={16} />}
          />,
        );
      case "current-workspace":
        return frame(
          <InfoCard
            label="Workspace"
            value={live.workspaceLabel}
            detail="Dashboard control center · offline-first"
            icon={<MonitorCog size={16} />}
          />,
        );
      case "ai-recommendation":
        return frame(<AICard title="AI Me suggests" body={live.aiRecommendation} ready={core?.aiCore} />);
      case "last-activity":
        return frame(<ActivityFeed projects={workspace?.projects ?? []} fallback={live.lastActivity} />);
      case "recent-production":
        return frame(<RecentProduction projects={workspace?.projects ?? []} onNavigate={onNavigate} />);
      case "system-health":
        return frame(<HealthGrid core={core} storage={storage} />);
      case "statistics":
        return frame(
          <div className="dash-stat-grid">
            <StatCard label="Projects" value={workspace?.projects.length ?? 0} trend="Local" />
            <StatCard label="AI Tasks" value={core?.aiCore ? "Ready" : "--"} />
            <StatCard label="Images" value="--" />
            <StatCard label="Videos" value="--" />
            <StatCard label="Campaigns" value="--" />
            <StatCard label="Storage" value={bytes(storage)} />
          </div>,
        );
      case "quick-actions":
        return frame(
          <div className="dash-action-grid">
            <ActionCard label="New project" onClick={() => onNavigate("new-project")} />
            <ActionCard label="Open project" onClick={() => onNavigate("open-project")} />
            <ActionCard label="AI Me" onClick={() => onNavigate("ai-me")} />
            <ActionCard label="Production" onClick={() => onNavigate("production")} />
            <ActionCard label="Images" onClick={() => onNavigate("generated-images")} />
            <ActionCard label="Settings" onClick={() => onNavigate("settings")} />
          </div>,
        );
      case "production-modules":
        return frame(<ProductionModuleGrid />);
      case "reserved-panels":
        return frame(<ReservedPanelGrid />);
      case "notifications":
        return frame(
          <div className="dash-notifications">
            {notifications.map((n) => (
              <NotificationCard key={n.title} title={n.title} detail={n.detail} tone={n.tone} />
            ))}
          </div>,
        );
      default:
        return null;
    }
  };

  return (
    <div className="professional-dashboard" data-dragging={dragId ?? undefined}>
      <header className="dash-header">
        <div>
          <span>PROFESSIONAL DASHBOARD</span>
          <h2>Welcome back, <strong>creator.</strong></h2>
          <p>
            {live?.activeProject ?? "No active project"} · {live?.lastActivity}
            {live && <> · Updated {new Date(live.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>}
          </p>
        </div>
        <div className="dash-header-actions">
          <button type="button" className="dash-btn" onClick={() => void refresh()}><RefreshCw size={15} />Refresh</button>
          <button type="button" className="dash-btn icon" onClick={() => setPersonalizeOpen(!personalizeOpen)} title="Personalize dashboard">
            <LayoutDashboard size={16} />
          </button>
        </div>
      </header>

      {!layout.widgets.find((w) => w.id === "live-status")?.hidden && live && (
        <section className="dash-quick-overview" aria-label="Quick overview">
          <ProgressCard label="Live production" percent={live.progress.percent} detail={live.progress.remainingLabel} />
          <LiveProgressPanel progress={live.progress} />
        </section>
      )}

      <div ref={gridRef} className="dash-widget-grid" style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}>
        {layout.widgets.map(renderWidget)}
      </div>

      {personalizeOpen && (
        <aside className="dash-personalize">
          <header>
            <div><span>DASHBOARD PERSONALIZATION</span><h3>Widgets</h3></div>
            <button type="button" onClick={() => setPersonalizeOpen(false)}><X size={15} /></button>
          </header>
          {layout.widgets.map((widget) => (
            <label key={widget.id}>
              <span>
                {WIDGET_LABELS[widget.id].title}
                <small>{widget.compact ? "Compact" : "Expanded"}{widget.pinned ? " · Pinned" : ""}{widget.locked ? " · Locked" : ""}</small>
              </span>
              <div>
                <button type="button" title="Toggle density" onClick={() => setLayout((c) => dashboardWidgetStore.toggleCompact(c, widget.id))}>···</button>
                <input
                  type="checkbox"
                  checked={!widget.hidden}
                  onChange={() => setLayout((c) => dashboardWidgetStore.toggleHidden(c, widget.id))}
                />
              </div>
            </label>
          ))}
        </aside>
      )}
    </div>
  );
}

function ActivityFeed({ projects, fallback }: { projects: DashboardProject[]; fallback: string }) {
  const events = projects.slice(0, widgetLimit(4)).map((p) => ({
    icon: <FolderKanban size={14} />,
    title: `${p.name} updated`,
    detail: "Project workspace sync",
    when: new Date(p.modifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));
  const entries = events.length
    ? events
    : [{ icon: <Activity size={14} />, title: "Dashboard ready", detail: fallback, when: "Now" }];
  return (
    <div className="dash-feed">
      {entries.map((e) => (
        <article key={e.title}><span>{e.icon}</span><div><b>{e.title}</b><p>{e.detail}</p></div><small>{e.when}</small></article>
      ))}
    </div>
  );
}

function RecentProduction({ projects, onNavigate }: { projects: DashboardProject[]; onNavigate: (w: string) => void }) {
  if (!projects.length) {
    return <PreviewCard title="No production yet" detail="Open a project to see recent work here." />;
  }
  return (
    <div className="dash-feed">
      {projects.slice(0, 4).map((p) => (
        <button key={p.id} type="button" className="dash-preview-btn" onClick={() => onNavigate("open-project")}>
          <PreviewCard title={p.name} detail={`${p.productImages.length} assets`} meta={new Date(p.modifiedAt).toLocaleDateString()} />
          <ChevronRight size={14} />
        </button>
      ))}
    </div>
  );
}

function HealthGrid({ core, storage }: { core: DashboardCoreStatus | null; storage: number }) {
  const items = [
    { label: "AI engine", value: core?.aiCore ? "Ready" : "Offline", good: core?.aiCore },
    { label: "Workflow", value: core?.workflowEngine ? "Ready" : "Idle", good: core?.workflowEngine },
    { label: "Memory", value: core?.memoryFoundation ? "Connected" : "Standby", good: core?.memoryFoundation },
    { label: "Knowledge", value: core?.knowledgeFoundation ? "Indexed" : "Awaiting", good: core?.knowledgeFoundation },
    { label: "RAM", value: core?.runtimeMetrics ? `${core.runtimeMetrics.memoryMb} MB` : "Local", good: true },
    { label: "Storage", value: bytes(storage), good: true },
  ];
  return (
    <div className="dash-health-grid">
      {items.map((item) => (
        <div key={item.label} className={item.good ? "good" : ""}><span>{item.label}</span><b>{item.value}</b></div>
      ))}
    </div>
  );
}

function buildNotifications(core: DashboardCoreStatus | null, project: DashboardProject | null) {
  return [
    { tone: core?.aiCore ? "success" : "warning", title: core?.aiCore ? "AI Core connected" : "AI Core waiting", detail: core?.aiCore ? "Live cards update from runtime." : "Dashboard runs in local mode." },
    { tone: project ? "info" : "warning", title: project ? "Project synchronized" : "No active project", detail: project ? `${project.name} is active.` : "Create or open a project." },
    { tone: "info", title: "Widget memory active", detail: "Positions, sizes, and visibility restore on startup." },
  ];
}

function widgetLimit(n: number) { return n; }
