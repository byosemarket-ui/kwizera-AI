import { useState } from "react";
import {
  Copy, LayoutTemplate, Plus, RotateCcw, Save, Trash2, X,
} from "lucide-react";
import { useShell } from "../ShellContext";
import { FLOATABLE_PANELS, panelEngine } from "./panel-engine";
import { workspaceLayoutManager } from "./layout-manager";

interface LayoutManagerPanelProps {
  open: boolean;
  onClose: () => void;
}

export function LayoutManagerPanel({ open, onClose }: LayoutManagerPanelProps) {
  const { layout, setLayout, layoutManager, setLayoutManager, notify } = useShell();
  const [name, setName] = useState("");

  if (!open || !layoutManager || !setLayoutManager) return null;

  const applyPreset = (layoutId: string) => {
    const nextState = workspaceLayoutManager.loadLayout(layoutManager, layoutId);
    const preset = workspaceLayoutManager.getActive(nextState);
    const nextShell = workspaceLayoutManager.applyToShell(layout, preset);
    setLayoutManager(nextState);
    setLayout({
      ...nextShell,
      workspace: layout.workspace,
    });
    notify("success", `${preset.name} loaded`, "Workspace layout applied without interrupting production.", "production-complete");
  };

  const saveCurrent = () => {
    const label = name.trim() || `Layout ${new Date().toLocaleTimeString()}`;
    const next = workspaceLayoutManager.saveLayout(layoutManager, layout, { name: label });
    setLayoutManager(next);
    setName("");
    notify("success", "Layout saved", `"${label}" stored locally.`, "updates");
  };

  const reset = () => {
    const next = workspaceLayoutManager.resetToDefault(layoutManager);
    const preset = workspaceLayoutManager.getActive(next);
    setLayoutManager(next);
    setLayout(workspaceLayoutManager.applyToShell(layout, preset));
    notify("info", "Default layout restored", "Builtin Default Workspace is active.", "information");
  };

  return (
    <aside className="layout-manager-panel" aria-label="Layout manager">
      <header>
        <div>
          <span>LAYOUT MANAGER</span>
          <h2>Workspace layouts</h2>
        </div>
        <button type="button" onClick={onClose} title="Close"><X size={16} /></button>
      </header>

      <section>
        <h3><LayoutTemplate size={14} />Presets & saved</h3>
        <div className="layout-list">
          {layoutManager.layouts.map((item) => (
            <div key={item.id} className={`layout-list-item ${layoutManager.activeLayoutId === item.id ? "active" : ""}`}>
              <button type="button" className="layout-load" onClick={() => applyPreset(item.id)}>
                <b>{item.name}</b>
                <small>{item.preset}{item.isBuiltin ? " · builtin" : " · custom"}</small>
              </button>
              <div className="layout-item-actions">
                <button type="button" title="Duplicate" onClick={() => {
                  setLayoutManager(workspaceLayoutManager.duplicateLayout(layoutManager, item.id));
                  notify("info", "Layout duplicated", "A custom copy was created.", "updates");
                }}><Copy size={12} /></button>
                {!item.isBuiltin && (
                  <button type="button" title="Delete" onClick={() => {
                    setLayoutManager(workspaceLayoutManager.deleteLayout(layoutManager, item.id));
                    notify("warning", "Layout deleted", item.name, "warnings");
                  }}><Trash2 size={12} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3><Save size={14} />Save current</h3>
        <div className="layout-save-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Layout name" />
          <button type="button" onClick={saveCurrent}><Plus size={14} />Save</button>
        </div>
      </section>

      <section>
        <h3>Floating panels</h3>
        <div className="layout-float-toggles">
          {FLOATABLE_PANELS.map((p) => {
            const panel = panelEngine.getPanel(layout, p.id);
            const visible = panel?.mode === "floating" || (panel?.mode === "docked" && panel.zone !== "center");
            return (
              <button
                key={p.id}
                type="button"
                className={visible ? "active" : ""}
                onClick={() => {
                  if (panel?.mode === "floating" || panel?.mode === "docked") {
                    setLayout(panelEngine.hidePanel(layout, p.id));
                  } else {
                    setLayout(panelEngine.floatPanel(layout, p.id));
                  }
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      <footer>
        <button type="button" onClick={reset}><RotateCcw size={14} />Reset to default</button>
        <span>{layoutManager.history.length} history entries</span>
      </footer>
    </aside>
  );
}
