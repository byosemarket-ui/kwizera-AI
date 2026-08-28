import { Bot, ChevronLeft, ChevronRight, Lightbulb, PanelRightClose, Sparkles } from "lucide-react";
import { useShell } from "./ShellContext";
import { buildAiMeWorkspaceContext, primaryAiMeRecommendation } from "./aime-awareness";
import { getActiveWorkspaceLabel } from "./LeftSidebar";
import { panelEngine } from "./panel-engine";

interface RightSidebarProps {
  onClose: () => void;
}

export function RightSidebar({ onClose }: RightSidebarProps) {
  const { layout, core, saveState, setLayout, switchWorkspace, navigation, projectStatus, layoutManager, restoreReport, preferences } = useShell();
  const aiContext = buildAiMeWorkspaceContext(layout, core, saveState, projectStatus, navigation, layoutManager, restoreReport, preferences);
  const activeLabel = getActiveWorkspaceLabel(layout.workspace);

  return (
    <aside className="right-sidebar shell-right-sidebar" aria-label="AI assistance">
      <div className="inspector-header">
        <div>
          <span className="sidebar-caption">AI Assistance</span>
          <h2>AI Me</h2>
        </div>
        <div className="right-sidebar-controls">
          <button
            className="icon-button"
            title="Collapse panel"
            onClick={() => setLayout({ rightCollapsed: !layout.rightCollapsed })}
          >
            {layout.rightCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <button className="icon-button" onClick={onClose} title="Close AI panel">
            <PanelRightClose size={16} />
          </button>
        </div>
      </div>

      {!layout.rightCollapsed && (
        <div className="inspector-content ai-assist-content">
          <section>
            <span className="inspector-label">RECOMMENDATION</span>
            <p className="ai-context-summary">{primaryAiMeRecommendation(aiContext)}</p>
          </section>

          <section>
            <span className="inspector-label">WORKSPACE AWARENESS</span>
            <p className="ai-context-summary">{aiContext.explanation}</p>
          </section>

          <section>
            <span className="inspector-label">LAYOUT ENGINE</span>
            <div className="inspector-metric">
              <span>Active layout</span>
              <b>{aiContext.layoutEngine?.activeLayoutName ?? "Default"}</b>
            </div>
            <div className="inspector-metric">
              <span>Floating</span>
              <b>{aiContext.layoutEngine?.floatingPanels.length ?? 0}</b>
            </div>
            <p className="ai-context-summary">{aiContext.layoutEngine?.recommendation}</p>
          </section>

          <section>
            <span className="inspector-label">IMAGE ORGANIZATION</span>
            <div className="inspector-metric">
              <span>Coverage</span>
              <b>{aiContext.imageOrganization?.coverageScore ?? 0}%</b>
            </div>
            <div className="inspector-metric">
              <span>Images / Missing</span>
              <b>{aiContext.imageOrganization?.imageCount ?? 0} · {(aiContext.imageOrganization?.missingViews ?? []).length}</b>
            </div>
            <p className="ai-context-summary">{aiContext.imageOrganization?.recommendation}</p>
          </section>

          <section>
            <span className="inspector-label">PRODUCT INTAKE</span>
            <div className="inspector-metric">
              <span>Project</span>
              <b>{aiContext.productIntake?.projectName || "—"}</b>
            </div>
            <div className="inspector-metric">
              <span>Assets / Import</span>
              <b>{aiContext.productIntake?.assetCount ?? 0} · {aiContext.productIntake?.importPercent ?? 0}%</b>
            </div>
            <div className="inspector-metric">
              <span>Warnings / Errors</span>
              <b>{aiContext.productIntake?.warningCount ?? 0} · {aiContext.productIntake?.errorCount ?? 0}</b>
            </div>
            <p className="ai-context-summary">{aiContext.productIntake?.recommendation}</p>
          </section>

          <section>
            <span className="inspector-label">FOUNDATION CERTIFICATION</span>
            <div className="inspector-metric">
              <span>Status</span>
              <b>{aiContext.certification?.certified ? "Certified 1.0" : "Review"}</b>
            </div>
            <div className="inspector-metric">
              <span>Overall / Stability</span>
              <b>{aiContext.certification?.overallScore ?? "—"} · {aiContext.certification?.stabilityScore ?? "—"}</b>
            </div>
            <div className="inspector-metric">
              <span>Perf / UX</span>
              <b>{aiContext.certification?.performanceScore ?? "—"} · {aiContext.certification?.uxScore ?? "—"}</b>
            </div>
            <p className="ai-context-summary">{aiContext.certification?.recommendation}</p>
          </section>

          <section>
            <span className="inspector-label">INTEGRATION</span>
            <div className="inspector-metric">
              <span>Event bus</span>
              <b>{aiContext.integration?.busOnline ? (aiContext.integration.aiBusBridged ? "Bridged" : "Local") : "Offline"}</b>
            </div>
            <div className="inspector-metric">
              <span>Queue / Workflow</span>
              <b>{aiContext.integration?.queueDepth ?? 0} · {aiContext.integration?.workflowSummary ?? "—"}</b>
            </div>
            <div className="inspector-metric">
              <span>Last event</span>
              <b>{aiContext.integration?.lastEventType ?? "—"}</b>
            </div>
            <p className="ai-context-summary">{aiContext.integration?.recommendation}</p>
          </section>

          <section>
            <span className="inspector-label">UX & ACCESSIBILITY</span>
            <div className="inspector-metric">
              <span>Undo / Redo</span>
              <b>{aiContext.ux?.undoDepth ?? 0} / {aiContext.ux?.redoDepth ?? 0}</b>
            </div>
            <div className="inspector-metric">
              <span>Tooltips</span>
              <b>{aiContext.ux?.tooltipsEnabled ? "On" : "Off"}</b>
            </div>
            <p className="ai-context-summary">{aiContext.ux?.recommendation}</p>
          </section>

          <section>
            <span className="inspector-label">PERFORMANCE</span>
            <div className="inspector-metric">
              <span>Mode</span>
              <b>{aiContext.performance?.effectiveMode ?? "balanced"}</b>
            </div>
            <div className="inspector-metric">
              <span>FPS</span>
              <b>{aiContext.performance?.fps ?? "—"}</b>
            </div>
            <div className="inspector-metric">
              <span>RAM / GPU</span>
              <b>{aiContext.performance?.ramUsage ?? 0}% / {aiContext.performance?.gpuUsage ?? 0}%</b>
            </div>
            <p className="ai-context-summary">{aiContext.performance?.recommendation}</p>
          </section>

          <section>
            <span className="inspector-label">PERSONALIZATION</span>
            <div className="inspector-metric">
              <span>Startup</span>
              <b>{aiContext.personalization?.startupMode ?? "restore-session"}</b>
            </div>
            <div className="inspector-metric">
              <span>Profile</span>
              <b>{aiContext.personalization?.activeProfile ?? "default"}</b>
            </div>
            <p className="ai-context-summary">{aiContext.personalization?.startupExplanation}</p>
            <p className="ai-context-summary">{aiContext.personalization?.recommendation}</p>
          </section>

          <section>
            <span className="inspector-label">WORKSPACE STATE</span>
            <div className="inspector-metric">
              <span>Session</span>
              <b>{aiContext.workspaceState?.sessionDurationLabel ?? "—"}</b>
            </div>
            <div className="inspector-metric">
              <span>Auto save</span>
              <b>{aiContext.workspaceState?.autoSaveEnabled ? (aiContext.workspaceState.dirty ? "Pending" : "On") : "Off"}</b>
            </div>
            <div className="inspector-metric">
              <span>History</span>
              <b>{aiContext.workspaceState?.historyCount ?? 0}</b>
            </div>
            <p className="ai-context-summary">{aiContext.workspaceState?.recommendation}</p>
          </section>

          <section>
            <span className="inspector-label">NAVIGATION</span>
            <div className="inspector-metric">
              <span>Current page</span>
              <b>{aiContext.navigation.currentPage}</b>
            </div>
            <div className="inspector-metric">
              <span>History</span>
              <b>{aiContext.navigation.historyCount}</b>
            </div>
            <p className="ai-context-summary">{aiContext.navigation.breadcrumb.join(" › ")}</p>
          </section>

          <section>
            <span className="inspector-label">ACTIVE WORKSPACE</span>
            <strong>{activeLabel}</strong>
            <div className="inspector-metric">
              <span>Panels visible</span>
              <b>{aiContext.layout.visiblePanels.length}</b>
            </div>
            <div className="inspector-metric">
              <span>Focus mode</span>
              <b>{layout.zen ? "On" : "Off"}</b>
            </div>
          </section>

          <section>
            <span className="inspector-label">AI ME MODULES</span>
            <ModuleSlot icon={<Sparkles size={14} />} label="Suggestions" detail="Context-aware recommendations" />
            <ModuleSlot icon={<Bot size={14} />} label="Live Analysis" detail="Production intelligence" />
            <ModuleSlot icon={<Lightbulb size={14} />} label="Progress" detail="Pipeline status tracking" />
          </section>

          <section>
            <span className="inspector-label">ENGINE STATUS</span>
            <div className="inspector-metric">
              <span>AI Engine</span>
              <b>{core?.aiCore ? "Ready" : "Offline"}</b>
            </div>
            <div className="inspector-metric">
              <span>Memory</span>
              <b>{core?.memoryFoundation ? "Ready" : "Offline"}</b>
            </div>
            <div className="inspector-metric">
              <span>Knowledge</span>
              <b>{core?.knowledgeFoundation ? "Ready" : "Offline"}</b>
            </div>
            <div className="inspector-metric">
              <span>Project</span>
              <b>{core?.activeProject && core.activeProject !== "No active project" ? core.activeProject : "None"}</b>
            </div>
            <div className="inspector-metric">
              <span>Active jobs</span>
              <b>{core?.runtimeMetrics?.activeJobs ?? 0}</b>
            </div>
          </section>

          <section className="ai-me-actions">
            <button className="soft-button ai-me-open" onClick={() => switchWorkspace("ai-me")}>
              <Sparkles size={15} />
              Open AI Me Studio
            </button>
            <button
              className="soft-button ai-me-open"
              onClick={() => setLayout(panelEngine.floatPanel(layout, "ai-assist"))}
              style={{ marginTop: 6 }}
            >
              Float AI Me
            </button>
          </section>
        </div>
      )}
    </aside>
  );
}

function ModuleSlot({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  return (
    <div className="ai-module-slot">
      <span className="ai-module-icon">{icon}</span>
      <div>
        <b>{label}</b>
        <small>{detail}</small>
      </div>
    </div>
  );
}

export function RightSidebarResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  return (
    <div
      className="panel-resize-handle panel-resize-right"
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(event) => {
        event.preventDefault();
        const startX = event.clientX;
        const move = (e: MouseEvent) => onResize(startX - e.clientX);
        const up = () => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      }}
    />
  );
}
