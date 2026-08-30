/** Product Creation Workspace — shell & navigation types */

export type WorkspaceId =
  | "home"
  | "new-project"
  | "video-requirements"
  | "video-style"
  | "final-video-review"
  | "open-project"
  | "recent-projects"
  | "knowledge-center"
  | "knowledge-packs"
  | "knowledge-search"
  | "ai-me"
  | "production"
  | "pipeline"
  | "queue"
  | "active-production"
  | "command-center"
  | "storyboard"
  | "marketing"
  | "asset-library"
  | "image-organization"
  | "product-information"
  | "product-validation"
  | "visual-analysis"
  | "deep-intelligence"
  | "market-research"
  | "master-intelligence"
  | "marketing-strategy"
  | "generated-images"
  | "generated-videos"
  | "generated-audio"
  | "output"
  | "exports"
  | "creative-review"
  | "reports"
  | "history"
  | "settings"
  | "system-health"
  | "help";

export const ALL_WORKSPACE_IDS: WorkspaceId[] = [
  "home", "new-project", "video-requirements", "video-style", "final-video-review", "open-project", "recent-projects",
  "knowledge-center", "knowledge-packs", "knowledge-search", "ai-me",
  "production", "pipeline", "queue", "active-production", "command-center",
  "storyboard", "marketing", "marketing-strategy",
  "asset-library", "image-organization", "product-information", "product-validation", "visual-analysis", "deep-intelligence", "market-research", "master-intelligence", "generated-images", "generated-videos", "generated-audio",
  "output", "exports", "creative-review", "reports", "history",
  "settings", "system-health", "help",
];

/** Legacy workspace IDs migrated on load */
export type LegacyWorkspaceId =
  | "dashboard"
  | "projects"
  | "products"
  | "media"
  | "brand"
  | "ai"
  | "editor"
  | "video"
  | "image"
  | "intelligence"
  | "knowledge"
  | "memory"
  | "platform";

export type PanelZone = "center" | "left" | "right" | "top" | "bottom" | "float";
export type PanelMode = "docked" | "floating" | "fullscreen" | "hidden" | "minimized" | "collapsed";
export type DockEdge = "left" | "right" | "top" | "bottom" | "center";
export type WorkspaceLayoutPresetId =
  | "default"
  | "product-input"
  | "marketing"
  | "creative"
  | "production"
  | "rendering"
  | "review"
  | "custom";

export type FutureModuleId =
  | "product-input"
  | "product-analysis"
  | "marketing"
  | "storyboard"
  | "image-generation"
  | "audio-generation"
  | "video-generation"
  | "rendering"
  | "output-preview";

export type FloatablePanelId =
  | "ai-assist"
  | "live-preview"
  | "product-analysis"
  | "asset-browser"
  | "timeline"
  | "logs"
  | "hardware-monitor";

export interface PanelDefinition {
  id: string;
  label: string;
  zone: PanelZone;
  mode: PanelMode;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  floatX?: number;
  floatY?: number;
  locked: boolean;
  pinned?: boolean;
  autoHide?: boolean;
  collapsed?: boolean;
  maximized?: boolean;
  order: number;
  moduleSlot?: FutureModuleId;
  floatable?: boolean;
  monitorId?: number;
  zIndex?: number;
}

export interface WorkspaceLayoutPreset {
  id: string;
  name: string;
  preset: WorkspaceLayoutPresetId;
  createdAt: string;
  updatedAt: string;
  shell: Pick<ShellLayoutState, "leftCollapsed" | "rightOpen" | "rightCollapsed" | "bottomExpanded" | "bottomHeight" | "zen">;
  panels: PanelDefinition[];
  isBuiltin?: boolean;
}

export interface LayoutManagerState {
  activeLayoutId: string;
  layouts: WorkspaceLayoutPreset[];
  history: Array<{ layoutId: string; at: string; action: string }>;
}

export interface MultiMonitorConfig {
  enabled: boolean;
  primaryId: number;
  secondaryPrepared: boolean;
  displays: Array<{ id: number; label: string; primary: boolean }>;
}

export type BottomPanelTab = "activity" | "logs" | "console" | "status" | "errors" | "warnings";

export type SaveState = "saved" | "saving" | "unsaved" | "error";

export type ProjectStatus = "idle" | "draft" | "in-production" | "review" | "complete";

export type NavGroupId =
  | "dashboard"
  | "projects"
  | "knowledge"
  | "production"
  | "creative"
  | "assets"
  | "outputs"
  | "system";

export type SearchCategory =
  | "projects"
  | "products"
  | "assets"
  | "videos"
  | "images"
  | "knowledge"
  | "reports"
  | "commands"
  | "navigation";

export type QuickActionId =
  | "new-project"
  | "import-images"
  | "analyze-product"
  | "generate-story"
  | "generate-images"
  | "generate-video"
  | "render"
  | "export"
  | "save";

export type NotificationCategory =
  | "information"
  | "warnings"
  | "errors"
  | "production-complete"
  | "updates"
  | "ai-suggestions";

export interface ShellLayoutState {
  workspace: WorkspaceId;
  leftCollapsed: boolean;
  rightOpen: boolean;
  rightCollapsed: boolean;
  bottomExpanded: boolean;
  bottomHeight: number;
  bottomTab: BottomPanelTab;
  zen: boolean;
  panels: PanelDefinition[];
}

export interface CoreStatus {
  aiCore: boolean;
  workflowEngine: boolean;
  communicationBus: boolean;
  moduleManager: boolean;
  memoryFoundation: boolean;
  knowledgeFoundation: boolean;
  productIntelligence?: boolean;
  imageIntelligence?: boolean;
  videoIntelligence?: boolean;
  automationEngine?: boolean;
  taskScheduler?: boolean;
  activeProject: string;
  activeProjectId?: string | null;
  runtimeMetrics?: {
    memoryMb: number;
    cpuUserMs: number;
    gpu: string;
    activeJobs: number;
    cpuUsage?: number;
    gpuUsage?: number;
    ramUsage?: number;
    ramTotalMb?: number;
    vramUsage?: number;
    diskUsage?: number;
    diskUsedGb?: number;
    diskTotalGb?: number;
    activeAiModels?: number;
  };
}

export interface WorkspaceNavItem {
  id: WorkspaceId;
  label: string;
  group: NavGroupId;
  groupLabel: string;
  keywords: string[];
  action?: "navigate" | "modal";
  shortcut?: string;
  /** When false, the item stays routable and searchable but is omitted from the primary sidebar. */
  inSidebar?: boolean;
}

export interface WorkspaceModuleSlot {
  id: FutureModuleId;
  label: string;
  description: string;
  reserved: true;
}

export interface BreadcrumbSegment {
  id: string;
  label: string;
  workspace?: WorkspaceId;
}

export interface SearchResult {
  id: string;
  label: string;
  category: SearchCategory;
  detail: string;
  workspace?: WorkspaceId;
  commandId?: QuickActionId | string;
  score: number;
}

export interface NavigationState {
  favorites: WorkspaceId[];
  recent: WorkspaceId[];
  pinned: boolean;
  collapsedGroups: NavGroupId[];
  history: Array<{ workspace: WorkspaceId; at: string }>;
  /** Step 6 — navigation memory */
  visitCounts: Partial<Record<WorkspaceId, number>>;
  lastVisitedAt: Partial<Record<WorkspaceId, string>>;
  recentPanels: string[];
  quickAccess: WorkspaceId[];
  commandCounts: Partial<Record<QuickActionId, number>>;
  frequentProjects: string[];
  frequentAssets: string[];
  frequentAiActions: string[];
  favoriteTemplates: string[];
  selectedViews: Record<string, string>;
}

export interface WorkspaceStatusSnapshot {
  mode: string;
  production: string;
  ai: string;
  offline: boolean;
  hardware: string;
}

export interface AiMeWorkspaceContext {
  structure: {
    regions: Array<{ id: string; label: string; visible: boolean }>;
    activeWorkspace: WorkspaceId;
    activeWorkspaceLabel: string;
  };
  layout: {
    leftCollapsed: boolean;
    rightOpen: boolean;
    bottomExpanded: boolean;
    zen: boolean;
    panelCount: number;
    visiblePanels: string[];
  };
  panels: Array<{ id: string; zone: PanelZone; mode: PanelMode; locked: boolean }>;
  project: {
    name: string;
    status: ProjectStatus;
    saveState: SaveState;
  };
  navigation: {
    currentPage: string;
    breadcrumb: string[];
    recent: WorkspaceId[];
    favorites: WorkspaceId[];
    historyCount: number;
  };
  futureModules: FutureModuleId[];
  layoutEngine?: {
    activeLayoutId: string;
    activeLayoutName: string;
    floatingPanels: string[];
    dockedPanels: string[];
    recommendation: string;
  };
  workspaceState?: {
    sessionId: string | null;
    sessionDurationLabel: string;
    autoSaveEnabled: boolean;
    dirty: boolean;
    lastSavedAt: string | null;
    projectName: string | null;
    restoreExplanation: string;
    historyCount: number;
    recommendation: string;
  };
  personalization?: {
    startupMode: string;
    activeProfile: string;
    language: string;
    quickAccessMode: string;
    topWorkspaces: WorkspaceId[];
    startupExplanation: string;
    recommendation: string;
  };
  performance?: {
    mode: string;
    effectiveMode: string;
    fps: number;
    ramUsage: number;
    gpuUsage: number;
    productionActive: boolean;
    alertCount: number;
    recommendation: string;
    bottleneck: string | null;
  };
  ux?: {
    tooltipsEnabled: boolean;
    undoDepth: number;
    redoDepth: number;
    tourCompleted: boolean;
    highContrast: boolean;
    recommendation: string;
  };
  integration?: {
    busOnline: boolean;
    aiBusBridged: boolean;
    queueDepth: number;
    lastEventType: string | null;
    workflowSummary: string;
    recommendation: string;
  };
  productIntake?: {
    projectId: string | null;
    projectName: string;
    assetCount: number;
    importPercent: number;
    warningCount: number;
    errorCount: number;
    canContinue: boolean;
    recommendation: string;
  };
  imageOrganization?: {
    projectId: string | null;
    projectName: string;
    imageCount: number;
    coverageScore: number;
    missingViews: string[];
    warningCount: number;
    canContinue: boolean;
    recommendation: string;
  };
  certification?: {
    certified: boolean;
    readiness: string;
    overallScore: number;
    stabilityScore: number;
    performanceScore: number;
    uxScore: number;
    recommendation: string;
  };
  explanation: string;
}
