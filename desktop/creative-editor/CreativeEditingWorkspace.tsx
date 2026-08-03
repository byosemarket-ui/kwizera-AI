import { useEffect, useState } from "react";
import { AudioLines, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Eye, EyeOff, Film, Image, Layers3, Lightbulb, Lock, Maximize2, MonitorPlay, Move3D, PanelsTopLeft, Pause, Play, RotateCcw, SlidersHorizontal, Sparkles, Sun, TimerReset, Unlock, Volume2, X } from "lucide-react";
import { EditingLayoutManager } from "./layout-store";
import type { EditingLayout, EditingStatus, EditorLayer, EditorScene } from "./types";
import "./creative-editor.css";
import "./editor-resize.css";

const layoutManager = new EditingLayoutManager();
const scenes: EditorScene[] = [
  { id: "scene-1", title: "Hook", duration: 3, status: "ready", description: "Product introduction and campaign hook" },
  { id: "scene-2", title: "Product proof", duration: 6, status: "draft", description: "Benefit demonstration and detail framing" },
  { id: "scene-3", title: "Brand close", duration: 4, status: "waiting", description: "Closing brand and call to action" },
];
const initialLayers: EditorLayer[] = [
  { id: "product", name: "Product layer", kind: "product", visible: true, locked: false }, { id: "background", name: "Background layer", kind: "background", visible: true, locked: true }, { id: "text", name: "Campaign headline", kind: "text", visible: true, locked: false }, { id: "logo", name: "Brand logo", kind: "logo", visible: true, locked: false }, { id: "effects", name: "Effects layer", kind: "effects", visible: false, locked: false }, { id: "camera", name: "Camera path", kind: "camera", visible: true, locked: false }, { id: "audio", name: "Audio bed", kind: "audio", visible: true, locked: false },
];
const layerIcon = { product: Image, background: PanelsTopLeft, text: Clapperboard, logo: Sparkles, effects: Lightbulb, camera: Move3D, audio: AudioLines } as const;

export function CreativeEditingWorkspace() {
  const [layout, setLayout] = useState<EditingLayout>(() => layoutManager.load());
  const [status, setStatus] = useState<EditingStatus | null>(null);
  const [activeScene, setActiveScene] = useState(scenes[0].id);
  const [activeLayer, setActiveLayer] = useState(initialLayers[0].id);
  const [layers, setLayers] = useState(initialLayers);
  const [cursor, setCursor] = useState(1.1);
  const [playing, setPlaying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const currentScene = scenes.find((scene) => scene.id === activeScene) ?? scenes[0];
  const currentLayer = layers.find((layer) => layer.id === activeLayer) ?? layers[0];
  useEffect(() => { layoutManager.save(layout); }, [layout]);
  useEffect(() => {
    const synchronize = async () => {
      try {
        const [statusResponse, workspaceResponse] = await Promise.all([fetch("/api/desktop-workspace/status"), fetch("/api/workspace")]);
        setStatus(statusResponse.ok ? await statusResponse.json() : null);
        const workspace = workspaceResponse.ok ? await workspaceResponse.json() : null;
        setPreviewUrl(workspace?.activeProject?.productImages?.[0]?.url ?? null);
      } catch { setStatus(null); setPreviewUrl(null); }
    };
    synchronize();
    const timer = window.setInterval(synchronize, 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const updateLayout = (changes: Partial<EditingLayout>) => setLayout((current) => ({ ...current, ...changes }));
  const toggleLayer = (id: string, key: "visible" | "locked") => setLayers((current) => current.map((layer) => layer.id === id ? { ...layer, [key]: !layer[key] } : layer));
  const sceneStart = scenes.slice(0, scenes.findIndex((scene) => scene.id === activeScene)).reduce((total, scene) => total + scene.duration, 0);
  const totalDuration = scenes.reduce((total, scene) => total + scene.duration, 0);
  return <div className="creative-editor" style={{ "--editor-left": layout.leftOpen ? `${layout.leftWidth}px` : "0px", "--editor-right": layout.rightOpen ? `${layout.rightWidth}px` : "0px", "--timeline-height": layout.timelineOpen ? "188px" : "0px" } as React.CSSProperties}>
    <aside className="editor-scenes">
      <PanelHeader title="Scenes" onToggle={() => updateLayout({ leftOpen: !layout.leftOpen })} open={layout.leftOpen} />
      <div className="scene-list">{scenes.map((scene, index) => <button key={scene.id} className={scene.id === activeScene ? "active" : ""} onClick={() => { setActiveScene(scene.id); setCursor(scenes.slice(0, index).reduce((total, item) => total + item.duration, 0)); }}><span className="scene-order">{String(index + 1).padStart(2, "0")}</span><span><b>{scene.title}</b><small>{scene.description}</small></span><em className={scene.status}>{scene.duration}s</em></button>)}</div>
      <label className="editor-resize-control">Scene panel<input type="range" min="190" max="340" value={layout.leftWidth} onChange={(event) => updateLayout({ leftWidth: Number(event.target.value) })} /></label>
      <div className="scene-footer"><span><i />Workspace synchronized</span><small>{status?.activeProject ?? "No active project"}</small></div>
    </aside>
    <section className="editor-center">
      <header className="editor-toolbar"><div><span>CREATIVE EDITOR</span><h2>{currentScene.title}</h2></div><div className="editor-toolbar-actions"><button title="Reset preview"><RotateCcw size={16} /></button><button title="Camera preview"><MonitorPlay size={16} /></button><button title="Fullscreen preview"><Maximize2 size={16} /></button></div></header>
      <div className="preview-stage"><div className="preview-frame">{previewUrl ? <img src={previewUrl} alt="Project preview" /> : <div className="preview-placeholder"><Film size={42} /><strong>Live preview prepared</strong><span>Source project media will appear here</span></div>}<div className="preview-overlay"><span><i />{status?.workflowEngine ? "Workflow context connected" : "Preview placeholder"}</span><span>Scene {scenes.findIndex((scene) => scene.id === activeScene) + 1} / {scenes.length}</span></div></div></div>
      <section className="timeline-workspace"><div className="timeline-header"><div><TimerReset size={15} /><b>Timeline</b><span>{totalDuration.toFixed(1)}s</span></div><div><button onClick={() => setPlaying(!playing)} title={playing ? "Pause timeline" : "Play timeline"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button><button onClick={() => updateLayout({ timelineOpen: !layout.timelineOpen })} title="Collapse timeline"><ChevronDown size={15} /></button></div></div><div className="timeline-ruler"><span>0s</span><span>3s</span><span>6s</span><span>9s</span><span>12s</span><i style={{ left: `${(cursor / totalDuration) * 100}%` }} /></div><div className="timeline-tracks"><Track icon={<Film size={14} />} label="Scenes">{scenes.map((scene, index) => <button key={scene.id} className={scene.id === activeScene ? "selected" : ""} style={{ width: `${(scene.duration / totalDuration) * 100}%` }} onClick={() => setActiveScene(scene.id)}>{index + 1}. {scene.title}</button>)}</Track><Track icon={<Sparkles size={14} />} label="AI tasks"><span className="track-placeholder">Prepared task markers</span></Track><Track icon={<Volume2 size={14} />} label="Audio"><span className="track-placeholder">Audio track foundation</span></Track><Track icon={<Move3D size={14} />} label="Camera"><span className="track-placeholder">Camera path foundation</span></Track></div><input className="timeline-scrubber" type="range" min="0" max={totalDuration} step="0.1" value={cursor} onChange={(event) => setCursor(Number(event.target.value))} /></section>
    </section>
    <aside className="editor-inspector">
      <PanelHeader title="Inspector" onToggle={() => updateLayout({ rightOpen: !layout.rightOpen })} open={layout.rightOpen} />
      <section className="layers-panel"><h3><Layers3 size={15} />Layers</h3>{layers.map((layer) => { const Icon = layerIcon[layer.kind]; return <button key={layer.id} className={layer.id === activeLayer ? "active" : ""} onClick={() => setActiveLayer(layer.id)}><Icon size={14} /><span>{layer.name}</span><i onClick={(event) => { event.stopPropagation(); toggleLayer(layer.id, "visible"); }}>{layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}</i><i onClick={(event) => { event.stopPropagation(); toggleLayer(layer.id, "locked"); }}>{layer.locked ? <Lock size={12} /> : <Unlock size={12} />}</i></button>; })}</section>
      <section className="properties-panel"><h3><SlidersHorizontal size={15} />Properties</h3><p className="property-target">{currentLayer.name}</p><Property label="Position" value="X 0 · Y 0 · Z 0" /><Property label="Size" value="100%" /><Property label="Rotation" value="0°" /><Property label="Opacity" value="100%" /><Property label="Lighting" value="Soft key" /><Property label="Animation" value="Prepared" /><div className="camera-panel"><h4>Camera preview</h4><Property label="Angle" value="35°" /><Property label="Focus" value="Product" /><Property label="Path" value="Orbit / prepared" /><Property label="Speed" value="Medium" /><small><i className={status?.cameraSimulation ? "ready" : ""} />Camera intelligence {status?.cameraSimulation ? "available" : "awaiting runtime"}</small></div></section>
      <label className="editor-resize-control inspector-resize">Inspector panel<input type="range" min="230" max="380" value={layout.rightWidth} onChange={(event) => updateLayout({ rightWidth: Number(event.target.value) })} /></label>
    </aside>
    <div className="editor-dock-controls"><button onClick={() => updateLayout({ leftOpen: !layout.leftOpen })} title="Toggle scenes">{layout.leftOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}</button><button onClick={() => updateLayout({ rightOpen: !layout.rightOpen })} title="Toggle inspector">{layout.rightOpen ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button></div>
  </div>;
}

function PanelHeader({ title, onToggle, open }: { title: string; onToggle: () => void; open: boolean }) { return <div className="editor-panel-header"><span>{title.toUpperCase()}</span><button onClick={onToggle} title={`Toggle ${title}`}>{open ? <X size={14} /> : <ChevronRight size={14} />}</button></div>; }
function Track({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) { return <div className="timeline-track"><span>{icon}{label}</span><div>{children}</div></div>; }
function Property({ label, value }: { label: string; value: string }) { return <div className="editor-property"><span>{label}</span><b>{value}</b></div>; }