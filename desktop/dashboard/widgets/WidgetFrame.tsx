import { EyeOff, GripVertical, Lock, Pin, PinOff, Unlock } from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardWidgetId, WidgetPlacement } from "../types";

interface WidgetFrameProps {
  widget: WidgetPlacement;
  title: string;
  detail: string;
  onPin: () => void;
  onLock: () => void;
  onHide: () => void;
  onDragStart: (event: React.MouseEvent) => void;
  onResizeStart: (event: React.MouseEvent) => void;
  children: ReactNode;
}

export function WidgetFrame({
  widget, title, detail, onPin, onLock, onHide, onDragStart, onResizeStart, children,
}: WidgetFrameProps) {
  return (
    <section
      className={`dash-widget ${widget.compact ? "compact" : ""} ${widget.pinned ? "pinned" : ""} ${widget.locked ? "locked" : ""}`}
      style={{
        gridColumn: `${widget.x} / span ${widget.w}`,
        gridRow: `${widget.y} / span ${widget.h}`,
      }}
      data-widget-id={widget.id}
    >
      <header className="dash-widget-header">
        <button
          type="button"
          className="dash-widget-drag"
          title={widget.locked ? "Widget locked" : "Drag widget"}
          onMouseDown={widget.locked ? undefined : onDragStart}
          disabled={widget.locked}
        >
          <GripVertical size={14} />
        </button>
        <div className="dash-widget-title">
          <span>{detail.toUpperCase()}</span>
          <h3>{title}</h3>
        </div>
        <div className="dash-widget-controls">
          <button type="button" title={widget.pinned ? "Unpin" : "Pin"} onClick={onPin}>
            {widget.pinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
          <button type="button" title={widget.locked ? "Unlock" : "Lock"} onClick={onLock}>
            {widget.locked ? <Unlock size={13} /> : <Lock size={13} />}
          </button>
          <button type="button" title="Hide widget" onClick={onHide}><EyeOff size={13} /></button>
        </div>
      </header>
      <div className="dash-widget-body">{children}</div>
      {!widget.locked && (
        <button
          type="button"
          className="dash-widget-resize"
          aria-label="Resize widget"
          onMouseDown={onResizeStart}
        />
      )}
    </section>
  );
}

export function gridCellFromPointer(
  container: HTMLElement,
  clientX: number,
  clientY: number,
  columns: number,
): { x: number; y: number } {
  const rect = container.getBoundingClientRect();
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  const cellW = rect.width / columns;
  const cellH = 88;
  return {
    x: Math.max(1, Math.min(columns, Math.floor(relX / cellW) + 1)),
    y: Math.max(1, Math.floor(relY / cellH) + 1),
  };
}

export type { DashboardWidgetId };
