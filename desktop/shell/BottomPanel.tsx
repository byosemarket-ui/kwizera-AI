import {
  Activity, AlertTriangle, ChevronDown, ChevronUp, Cpu, ScrollText, Terminal, XCircle,
} from "lucide-react";
import type { BottomPanelTab } from "./types";
import { useShell } from "./ShellContext";

const tabs: Array<{ id: BottomPanelTab; label: string; icon: typeof Activity }> = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "console", label: "Console", icon: Terminal },
  { id: "status", label: "Production Status", icon: Cpu },
  { id: "errors", label: "Errors", icon: XCircle },
  { id: "warnings", label: "Warnings", icon: AlertTriangle },
];

export function BottomPanel() {
  const { layout, core, setLayout } = useShell();
  const expanded = layout.bottomExpanded;
  const height = layout.bottomHeight;

  return (
    <section
      className={`bottom-panel ${expanded ? "expanded" : "collapsed"}`}
      style={{ "--bottom-panel-height": `${expanded ? height : 28}px` } as React.CSSProperties}
      aria-label="Bottom panel"
    >
      <div className="bottom-panel-header">
        <div className="bottom-panel-tabs" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={layout.bottomTab === tab.id}
                className={`bottom-tab ${layout.bottomTab === tab.id ? "active" : ""}`}
                onClick={() => setLayout({ bottomTab: tab.id, bottomExpanded: true })}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="bottom-panel-controls">
          {expanded && (
            <button
              className="icon-button"
              title="Resize panel"
              onMouseDown={(event) => {
                event.preventDefault();
                const startY = event.clientY;
                const startH = layout.bottomHeight;
                const move = (e: MouseEvent) => {
                  const next = Math.min(400, Math.max(120, startH + (startY - e.clientY)));
                  setLayout({ bottomHeight: next });
                };
                const up = () => {
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
            >
              <span className="resize-grip" />
            </button>
          )}
          <button
            className="icon-button"
            title={expanded ? "Collapse panel" : "Expand panel"}
            onClick={() => setLayout({ bottomExpanded: !expanded })}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="bottom-panel-body" role="tabpanel">
          <BottomPanelContent tab={layout.bottomTab} core={core} />
        </div>
      )}
    </section>
  );
}

function BottomPanelContent({ tab, core }: { tab: BottomPanelTab; core: ReturnType<typeof useShell>["core"] }) {
  const { performanceSnapshot, integrationSnapshot } = useShell();
  const m = performanceSnapshot?.metrics;
  const lastEvents = integrationSnapshot?.lastEvents.slice(0, 4) ?? [];
  const placeholders: Record<BottomPanelTab, { title: string; lines: string[] }> = {
    activity: {
      title: "Activity Timeline",
      lines: [
        "Workspace architecture initialized",
        "Integration event bus online",
        core?.activeProject ? `Project context: ${core.activeProject}` : "No active project session",
        performanceSnapshot ? `Perf mode: ${performanceSnapshot.effectiveMode} · ${m?.fps ?? "—"} FPS` : "Performance monitor warming up",
        ...lastEvents.map((e) => `${e.type} ← ${e.source}`),
      ],
    },
    logs: {
      title: "System Logs",
      lines: [
        "[info] Shell layout engine loaded",
        "[info] Performance engine active",
        "[info] Integration orchestration active",
        `[info] Queue depth: ${integrationSnapshot?.queueDepth ?? 0}`,
        `[info] Cache entries: ${performanceSnapshot?.cache.entries ?? 0}`,
        "[info] Offline-first mode active",
      ],
    },
    console: {
      title: "Console",
      lines: ["> kwizera shell ready", "> integration bus online", "> performance monitor online", "> awaiting production modules"],
    },
    status: {
      title: "Production Status",
      lines: [
        `AI Core: ${core?.aiCore ? "online" : "offline"}`,
        `Communication bus: ${core?.communicationBus ? "ready" : "local shell only"}`,
        `Memory: ${m?.ramUsedMb ?? core?.runtimeMetrics?.memoryMb ?? "—"} MB (${m?.ramUsage ?? core?.runtimeMetrics?.ramUsage ?? "—"}%)`,
        `CPU / GPU: ${m?.cpuUsage ?? "—"}% / ${m?.gpuUsage ?? "—"}%`,
        `Disk: ${m?.diskUsage ?? "—"}% · VRAM: ${m?.vramUsage ?? "—"}%`,
        `FPS: ${m?.fps ?? "—"} · Responsiveness: ${performanceSnapshot?.responsiveness ?? "—"}`,
        `Active jobs: ${m?.activeProductionTasks ?? core?.runtimeMetrics?.activeJobs ?? 0}`,
        `Workflow: ${integrationSnapshot?.workflow.filter((s) => s.status === "completed").length ?? 0}/${integrationSnapshot?.workflow.length ?? 0} · progress ${integrationSnapshot?.shared.progress ?? 0}%`,
        `Mode: ${performanceSnapshot?.effectiveMode ?? "balanced"}${performanceSnapshot?.productionActive ? " · production priority" : ""}`,
      ],
    },
    errors: {
      title: "Errors",
      lines: (() => {
        const errs = (integrationSnapshot?.lastEvents ?? []).filter((e) => e.type.includes("error"));
        return errs.length
          ? errs.map((e) => `${e.type}: ${String(e.payload.error ?? "error")}`)
          : ["No errors recorded"];
      })(),
    },
    warnings: {
      title: "Warnings",
      lines: performanceSnapshot?.alerts.length
        ? performanceSnapshot.alerts.map((a) => a.message)
        : ["No warnings recorded"],
    },
  };

  const content = placeholders[tab];
  return (
    <div className="bottom-panel-content">
      <h3>{content.title}</h3>
      <ul>
        {content.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
