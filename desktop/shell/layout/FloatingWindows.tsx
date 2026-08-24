import { useRef } from "react";
import {
  Maximize2, Minimize2, Pin, PinOff, Square, X, GripHorizontal, Dock,
} from "lucide-react";
import type { DockEdge, PanelDefinition } from "../types";
import { useShell } from "../ShellContext";
import { panelEngine } from "./panel-engine";
import { HardwareMonitorPanel } from "../performance/HardwareMonitorPanel";

export function FloatingWindowsLayer() {
  const { layout } = useShell();
  const floating = panelEngine.getFloatingPanels(layout);

  if (!floating.length) return null;

  return (
    <div className="floating-windows-layer" aria-label="Floating panels">
      {floating.map((panel) => (
        <FloatingWindow key={panel.id} panel={panel} />
      ))}
    </div>
  );
}

function FloatingWindow({ panel }: { panel: PanelDefinition }) {
  const { layout, setLayout, notify } = useShell();
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);

  const apply = (next: typeof layout) => {
    setLayout({
      panels: next.panels,
      leftCollapsed: next.leftCollapsed,
      rightOpen: next.rightOpen,
      rightCollapsed: next.rightCollapsed,
      bottomExpanded: next.bottomExpanded,
      bottomHeight: next.bottomHeight,
    });
  };

  const dock = (edge: DockEdge) => {
    apply(panelEngine.dockPanel(layout, panel.id, edge));
    notify("info", `${panel.label} docked`, `Docked to ${edge}.`, "updates");
  };

  const onDragStart = (event: React.MouseEvent) => {
    if (panel.locked || panel.maximized) return;
    event.preventDefault();
    dragRef.current = {
      ox: event.clientX,
      oy: event.clientY,
      sx: panel.floatX ?? 0,
      sy: panel.floatY ?? 0,
    };
    const move = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const x = dragRef.current.sx + (e.clientX - dragRef.current.ox);
      const y = dragRef.current.sy + (e.clientY - dragRef.current.oy);
      apply(panelEngine.moveFloating(layoutRef.current, panel.id, x, y));
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      apply(panelEngine.autoDock(layoutRef.current, panel.id, { width: window.innerWidth, height: window.innerHeight }));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onResizeStart = (event: React.MouseEvent) => {
    if (panel.locked || panel.maximized) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = panel.width ?? 360;
    const startH = panel.height ?? 320;
    const move = (e: MouseEvent) => {
      apply(panelEngine.resizePanel(layoutRef.current, panel.id, {
        width: startW + (e.clientX - startX),
        height: startH + (e.clientY - startY),
      }));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const style: React.CSSProperties = panel.maximized
    ? { left: 48, top: 72, width: "calc(100vw - 96px)", height: "calc(100vh - 140px)", zIndex: panel.zIndex ?? 40 }
    : {
        left: panel.floatX ?? 96,
        top: panel.floatY ?? 96,
        width: panel.width ?? 360,
        height: panel.collapsed ? 40 : (panel.height ?? 320),
        zIndex: panel.zIndex ?? 40,
      };

  return (
    <section
      className={`floating-window ${panel.collapsed ? "collapsed" : ""} ${panel.maximized ? "maximized" : ""}`}
      style={style}
      data-panel-id={panel.id}
    >
      <header className="floating-window-header" onMouseDown={onDragStart}>
        <GripHorizontal size={14} />
        <strong>{panel.label}</strong>
        <div className="floating-window-actions" onMouseDown={(e) => e.stopPropagation()}>
          <button type="button" title="Dock left" onClick={() => dock("left")}><Dock size={12} /></button>
          <button type="button" title={panel.pinned ? "Unpin" : "Pin"} onClick={() => apply(panelEngine.togglePin(layout, panel.id))}>
            {panel.pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          <button type="button" title="Minimize" onClick={() => apply(panelEngine.minimizePanel(layout, panel.id))}><Minimize2 size={12} /></button>
          <button type="button" title={panel.collapsed ? "Expand" : "Collapse"} onClick={() => apply(panel.collapsed ? panelEngine.expandPanel(layout, panel.id) : panelEngine.collapsePanel(layout, panel.id))}>
            <Square size={12} />
          </button>
          <button type="button" title="Maximize" onClick={() => apply(panelEngine.maximizePanel(layout, panel.id))}><Maximize2 size={12} /></button>
          <button type="button" title="Close" onClick={() => apply(panelEngine.hidePanel(layout, panel.id))}><X size={12} /></button>
        </div>
      </header>
      {!panel.collapsed && (
        <div className="floating-window-body">
          {panel.id === "hardware-monitor" ? (
            <HardwareMonitorPanel />
          ) : (
            <>
              <p className="floating-placeholder">{panel.label} is synchronized with the workspace. Production logic mounts in later steps.</p>
              <div className="floating-dock-row">
                {(["left", "right", "top", "bottom", "center"] as DockEdge[]).map((edge) => (
                  <button key={edge} type="button" onClick={() => dock(edge)}>Dock {edge}</button>
                ))}
                <button type="button" onClick={() => apply(panelEngine.restoreDefaultSize(layout, panel.id))}>Restore size</button>
              </div>
            </>
          )}
          {panel.id === "hardware-monitor" && (
            <div className="floating-dock-row">
              {(["left", "right", "top", "bottom", "center"] as DockEdge[]).map((edge) => (
                <button key={edge} type="button" onClick={() => dock(edge)}>Dock {edge}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {!panel.locked && !panel.maximized && !panel.collapsed && (
        <button type="button" className="floating-resize-handle" aria-label="Resize" onMouseDown={onResizeStart} />
      )}
    </section>
  );
}
