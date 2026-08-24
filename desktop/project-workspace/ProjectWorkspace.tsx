import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { Archive, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, Copy, FileAudio, FileImage, FileText, FileVideo, Folder, FolderOpen, Heart, History, Image, LayoutGrid, List, MoreHorizontal, Move, Plus, Search, SlidersHorizontal, Star, Tag, Trash2, X } from "lucide-react";
import { AssetIndexManager } from "./asset-index";
import type { AssetKind, AssetRecord, AssetView, WorkspacePayload } from "./types";
import "./project-workspace.css";

const index = new AssetIndexManager();
const FAVORITES_KEY = "kwizera.project-workspace.favorites.v1";
const RECENTS_KEY = "kwizera.project-workspace.recents.v1";
const kinds: AssetKind[] = ["product", "generated", "video", "audio", "logo", "document", "ai", "marketing", "export"];
const typeIcon = { product: FileImage, generated: Image, video: FileVideo, audio: FileAudio, logo: Star, document: FileText, ai: Tag, marketing: Tag, export: Folder } as const;
const formatBytes = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
const dateLabel = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
function readIds(key: string): string[] { try { return JSON.parse(localStorage.getItem(key) ?? "[]") as string[]; } catch { return []; } }
async function fetchWorkspace(): Promise<WorkspacePayload | null> {
  try {
    const response = await fetch("/api/workspace");
    return response.ok ? await response.json() as WorkspacePayload : null;
  } catch {
    return null;
  }
}

export function ProjectWorkspace({ mediaOnly = false }: { mediaOnly?: boolean }) {
  const [payload, setPayload] = useState<WorkspacePayload | null>(null);
  const [favorites, setFavorites] = useState(() => new Set(readIds(FAVORITES_KEY)));
  const [recents, setRecents] = useState(() => readIds(RECENTS_KEY));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AssetKind | "all" | "favorites" | "recent">(mediaOnly ? "product" : "all");
  const [view, setView] = useState<AssetView>("grid");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<AssetRecord | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const [history, setHistory] = useState<string[]>(["All assets"]);
  const [historyCursor, setHistoryCursor] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  useEffect(() => { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); }, [favorites]);
  useEffect(() => { localStorage.setItem(RECENTS_KEY, JSON.stringify(recents)); }, [recents]);
  useEffect(() => {
    const sync = () => fetchWorkspace().then((data) => data ? setPayload(data) : setPayload(null));
    sync();
    const timer = window.setInterval(sync, 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const assets = payload ? index.build(payload, favorites) : [];
  const visible = assets.filter((asset) => {
    const needle = query.trim().toLowerCase();
    const matchesSearch = !needle || [asset.name, asset.category, asset.type, ...asset.tags].join(" ").toLowerCase().includes(needle);
    const matchesFilter = filter === "all" || filter === "favorites" && asset.favorite || filter === "recent" && recents.includes(asset.id) || asset.type === filter;
    return matchesSearch && matchesFilter;
  });
  const choose = (asset: AssetRecord, multi = false) => {
    setSelected((current) => multi ? current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id] : [asset.id]);
    setPreview(asset);
    setRecents((current) => [asset.id, ...current.filter((id) => id !== asset.id)].slice(0, 24));
  };
  const toggleFavorite = (id: string) => setFavorites((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const navigate = (label: string) => { const next = [...history.slice(0, historyCursor + 1), label]; setHistory(next); setHistoryCursor(next.length - 1); };
  const moveHistory = (direction: -1 | 1) => setHistoryCursor((current) => Math.max(0, Math.min(history.length - 1, current + direction)));
  const openProject = async (projectId: string) => {
    await fetch(`/api/workspace/projects/${projectId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "open" }) });
    const next = await fetchWorkspace();
    if (next) setPayload(next);
  };
  const createProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setCreatingProject(true);
    try {
      const response = await fetch("/api/workspace/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      if (response.ok) { setNewProjectName(""); const next = await fetchWorkspace(); if (next) setPayload(next); }
    } finally { setCreatingProject(false); }
  };
  return <div className="project-workspace">
    <aside className="project-explorer"><div className="explorer-heading"><span>PROJECT EXPLORER</span><button title="Project options"><MoreHorizontal size={16} /></button></div><div className="new-project"><input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createProject()} placeholder="New project name" /><button onClick={createProject} disabled={creatingProject || !newProjectName.trim()} title="Create project"><Plus size={15} /></button></div><button className="explorer-root active" onClick={() => { setFilter("all"); navigate("All assets"); }}><FolderOpen size={16} />All Projects <b>{payload?.projects.length ?? 0}</b></button><div className="project-list">{payload?.projects.map((project) => <button className={`tree-project ${project.id === payload.activeProject?.id ? "current" : ""}`} key={project.id} onClick={() => openProject(project.id)}><Folder size={16} />{project.name}</button>)}</div><button className="tree-project" onClick={() => setTreeOpen(!treeOpen)}><ChevronDown className={treeOpen ? "" : "tree-closed"} size={15} /><Folder size={16} />{payload?.activeProject?.name ?? "No active project"}</button>{treeOpen && <div className="tree-children"><TreeButton icon={<Image size={15} />} label="Product images" count={assets.filter((asset) => asset.type === "product").length} onClick={() => { setFilter("product"); navigate("Product images"); }} /><TreeButton icon={<History size={15} />} label="Recent assets" count={recents.length} onClick={() => { setFilter("recent"); navigate("Recent assets"); }} /><TreeButton icon={<Heart size={15} />} label="Favorites" count={assets.filter((asset) => asset.favorite).length} onClick={() => { setFilter("favorites"); navigate("Favorites"); }} /></div>}<div className="explorer-section"><span>PROJECT VIEWS</span><TreeButton icon={<Archive size={15} />} label="Archived projects" count={0} onClick={() => navigate("Archived projects")} /><TreeButton icon={<Star size={15} />} label="Project categories" count={0} onClick={() => navigate("Project categories")} /></div><div className="explorer-sync"><i />Synced with workspace<br /><small>{payload?.integrations?.aiCore ? "Core context connected" : "Local index active"}</small></div></aside>
    <section className="asset-browser" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const files = event.dataTransfer.files;
      if (!files?.length) return;
      // Reuse Product Intake engine — do not create a parallel upload path
      window.dispatchEvent(new CustomEvent("kwizera:navigate-workspace", { detail: { workspace: "new-project" } }));
      void import("../product-intake/intake-engine").then(async ({ productIntakeEngine }) => {
        const activeId = payload?.activeProject?.id;
        if (activeId) await productIntakeEngine.openExisting(activeId).catch(() => undefined);
        else if (payload?.activeProject?.name) productIntakeEngine.setProjectNameLocal(payload.activeProject.name);
        productIntakeEngine.enqueueFiles(files);
      });
    }}>
      <div className="asset-breadcrumb"><button disabled={historyCursor === 0} onClick={() => moveHistory(-1)}><ArrowLeft size={15} /></button><button disabled={historyCursor === history.length - 1} onClick={() => moveHistory(1)}><ArrowRight size={15} /></button><span>Projects</span><ChevronRight size={13} /><b>{history[historyCursor]}</b></div>
      <div className="asset-head"><div><span className="asset-kicker">ASSET INDEX</span><h2>{mediaOnly ? "Media Library" : history[historyCursor]}</h2><p>{visible.length} indexed asset{visible.length === 1 ? "" : "s"} · import via Product Intake</p></div><div className="asset-actions"><button title="Open Product Intake" onClick={() => window.dispatchEvent(new CustomEvent("kwizera:navigate-workspace", { detail: { workspace: "new-project" } }))}><Plus size={15} /></button><button title="Rename (prepared only)"><FileText size={15} /></button><button title="Duplicate (prepared only)"><Copy size={15} /></button><button title="Move (prepared only)"><Move size={15} /></button><button title="Delete (prepared only)"><Trash2 size={15} /></button></div></div>
      <div className="asset-controls"><label className="asset-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets, tags, type, category..." /><kbd>⌘ K</kbd></label><button className="filter-button"><SlidersHorizontal size={15} />Filters</button><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All assets</option><option value="product">Images</option><option value="video">Videos</option><option value="audio">Audio</option><option value="marketing">Marketing</option><option value="ai">AI assets</option><option value="recent">Recent</option><option value="favorites">Favorites</option><option value="export">Exported</option></select><div className="view-switch"><button className={view === "grid" ? "selected" : ""} onClick={() => setView("grid")} title="Grid view"><LayoutGrid size={16} /></button><button className={view === "list" ? "selected" : ""} onClick={() => setView("list")} title="List view"><List size={16} /></button></div></div>
      <div className="asset-filter-row">{["all", ...kinds].map((kind) => <button key={kind} className={filter === kind ? "active" : ""} onClick={() => { setFilter(kind as typeof filter); navigate(kind === "all" ? "All assets" : index.label(kind as AssetKind)); }}>{kind === "all" ? "All" : index.label(kind as AssetKind)}</button>)}</div>
      {dragging && <div className="drop-zone">Drop files to import via Product Intake</div>}
      <AssetCollection assets={visible} selected={selected} view={view} onChoose={choose} onFavorite={toggleFavorite} />
    </section>
    <AssetMetadata asset={preview} selectedCount={selected.length} onClose={() => setPreview(null)} />
  </div>;
}

function TreeButton({ icon, label, count, onClick }: { icon: ReactNode; label: string; count: number; onClick: () => void }) { return <button className="tree-item" onClick={onClick}>{icon}<span>{label}</span><b>{count}</b></button>; }
function AssetCollection({ assets, selected, view, onChoose, onFavorite }: { assets: AssetRecord[]; selected: string[]; view: AssetView; onChoose: (asset: AssetRecord, multi?: boolean) => void; onFavorite: (id: string) => void }) { if (!assets.length) return <div className="asset-empty"><FolderOpen size={28} /><h3>No indexed assets yet</h3><p>Files will appear here when a project includes supported workspace assets.</p></div>; return <div className={`asset-collection ${view}`}>{assets.map((asset) => <AssetTile key={asset.id} asset={asset} selected={selected.includes(asset.id)} list={view === "list"} onChoose={onChoose} onFavorite={onFavorite} />)}</div>; }
function AssetTile({ asset, selected, list, onChoose, onFavorite }: { asset: AssetRecord; selected: boolean; list: boolean; onChoose: (asset: AssetRecord, multi?: boolean) => void; onFavorite: (id: string) => void }) { const Icon = typeIcon[asset.type]; return <article className={`asset-tile ${selected ? "selected" : ""} ${list ? "list" : ""}`} onClick={(event) => onChoose(asset, event.ctrlKey || event.metaKey)}><div className="asset-visual">{asset.url ? <img src={asset.url} alt="" /> : <Icon size={28} />}<button className="favorite-toggle" onClick={(event) => { event.stopPropagation(); onFavorite(asset.id); }} title="Toggle favorite"><Heart size={14} fill={asset.favorite ? "currentColor" : "none"} /></button>{selected && <span className="asset-selected"><Check size={12} /></span>}</div><div className="asset-name"><b>{asset.name}</b><small>{index.label(asset.type)} · {formatBytes(asset.sizeBytes)}</small></div>{list && <div className="asset-list-details"><span>{asset.category}</span><span>{dateLabel(asset.modifiedAt)}</span><span>{asset.status}</span></div>}</article>; }
function AssetMetadata({ asset, selectedCount, onClose }: { asset: AssetRecord | null; selectedCount: number; onClose: () => void }) { return <aside className="asset-metadata"><div className="metadata-heading"><div><span>ASSET METADATA</span><h3>{asset ? "Details" : "Inspector"}</h3></div>{asset && <button onClick={onClose}><X size={15} /></button>}</div>{asset ? <><div className="metadata-preview">{asset.url ? <img src={asset.url} alt="" /> : <FileText size={28} />}</div><strong className="metadata-name">{asset.name}</strong><span className="metadata-type">{index.label(asset.type)}</span><Metadata label="Size" value={formatBytes(asset.sizeBytes)} /><Metadata label="Resolution" value={asset.resolution ?? "Not available"} /><Metadata label="Duration" value={asset.duration ?? "Not applicable"} /><Metadata label="Created" value={dateLabel(asset.createdAt)} /><Metadata label="Modified" value={dateLabel(asset.modifiedAt)} /><Metadata label="Status" value={asset.status} /><Metadata label="AI information" value={asset.aiGenerated ? "AI generated" : "Source asset"} /><div className="metadata-tags"><span>Tags</span><div>{asset.tags.map((tag) => <button key={tag}>{tag}</button>)}<button className="tag-add">+</button></div></div></> : <div className="metadata-empty"><FileImage size={24} /><p>{selectedCount ? `${selectedCount} assets selected` : "Select an asset to inspect its properties."}</p></div>}</aside>; }
function Metadata({ label, value }: { label: string; value: string }) { return <div className="metadata-row"><span>{label}</span><b>{value}</b></div>; }