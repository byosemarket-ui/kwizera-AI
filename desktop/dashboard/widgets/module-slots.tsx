import type { ProductionModuleId, ReservedPanelId } from "../types";

export const PRODUCTION_MODULES: Array<{ id: ProductionModuleId; label: string; detail: string }> = [
  { id: "product-upload", label: "Product Upload", detail: "UI reserved for asset intake" },
  { id: "product-analysis", label: "Product Analysis", detail: "UI reserved for AI understanding" },
  { id: "marketing", label: "Marketing", detail: "UI reserved for campaign planning" },
  { id: "storyboard", label: "Storyboard", detail: "UI reserved for scene boards" },
  { id: "image-generation", label: "Image Generation", detail: "UI reserved for visual output" },
  { id: "audio-generation", label: "Audio Generation", detail: "UI reserved for sound production" },
  { id: "video-generation", label: "Video Generation", detail: "UI reserved for motion output" },
  { id: "rendering", label: "Rendering", detail: "UI reserved for render pipeline" },
  { id: "export", label: "Export", detail: "UI reserved for delivery" },
];

export const RESERVED_PANELS: Array<{ id: ReservedPanelId; label: string; detail: string }> = [
  { id: "product-input", label: "Product Input", detail: "Future intake surface" },
  { id: "ai-analysis", label: "AI Analysis", detail: "Future intelligence panel" },
  { id: "live-preview", label: "Live Preview", detail: "Future preview surface" },
  { id: "timeline", label: "Timeline", detail: "Future timeline panel" },
  { id: "output", label: "Output", detail: "Future output panel" },
  { id: "ai-me", label: "AI Me", detail: "Future embedded assistant" },
];

export function ProductionModuleGrid() {
  return (
    <div className="dash-module-grid">
      {PRODUCTION_MODULES.map((mod) => (
        <div key={mod.id} className="dash-module-slot" data-module={mod.id}>
          <b>{mod.label}</b>
          <small>{mod.detail}</small>
        </div>
      ))}
    </div>
  );
}

export function ReservedPanelGrid() {
  return (
    <div className="dash-reserved-grid">
      {RESERVED_PANELS.map((panel) => (
        <div key={panel.id} className="dash-reserved-slot" data-panel={panel.id}>
          <b>{panel.label}</b>
          <small>{panel.detail}</small>
        </div>
      ))}
    </div>
  );
}
