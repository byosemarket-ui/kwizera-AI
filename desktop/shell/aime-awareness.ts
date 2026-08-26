import type { DesktopPreferences } from "../desktop-polish/types";
import type {
  AiMeWorkspaceContext, CoreStatus, LayoutManagerState, NavigationState, ProjectStatus, SaveState,
  ShellLayoutState, WorkspaceId,
} from "./types";
import { panelEngine } from "./panel-engine";
import { getFutureModuleSlots, getNavItem } from "./workspace-registry";
import { navigationEngine } from "./navigation/navigation-engine";
import { buildAiMeDashboardContext, serializeAiMeDashboardContext } from "../dashboard/aime-dashboard-awareness";
import { dashboardWidgetStore } from "../dashboard/widget-store";
import { buildAiMeLayoutContext } from "./layout/aime-layout-awareness";
import { workspaceLayoutManager } from "./layout/layout-manager";
import { buildAiMeStateContext } from "./workspace-state/aime-state-awareness";
import { workspaceStateEngine } from "./workspace-state/workspace-state-engine";
import type { RestoreReport } from "./workspace-state/types";
import { personalizationEngine } from "./personalization/personalization-engine";
import { workspacePerformanceEngine } from "./performance/performance-engine";
import { uxEngine } from "./ux/ux-engine";
import { workspaceIntegrationEngine } from "./integration/integration-engine";
import { workspaceCertificationEngine } from "./certification/certification-engine";
import { productIntakeEngine } from "../product-intake/intake-engine";
import { imageOrganizationEngine } from "../image-organization/organization-engine";
import { productProfileEngine } from "../product-profile/profile-engine";
import { marketingInputEngine } from "../marketing-input/marketing-engine";
import { productValidationEngine } from "../product-validation/validation-engine";
import { visualAnalysisEngine } from "../visual-analysis/visual-analysis-engine";
import { deepIntelligenceEngine } from "../deep-intelligence/deep-intelligence-engine";
import { marketResearchEngine } from "../market-research/research-engine";
import { masterIntelligenceEngine } from "../master-intelligence/master-engine";
import { marketingStrategyEngine } from "../marketing-strategy/strategy-engine";
import { creativePlannerEngine } from "../creative-planner/planner-engine";
import { productionPlanEngine } from "../production-plan/plan-engine";
import { productionQueueEngine } from "../production-queue/queue-engine";
import { productionPipelineEngine } from "../production-pipeline/pipeline-engine";
import { productionCommandCenterEngine } from "../production-command-center/command-center-engine";
import { productionFinalEngine } from "../production-final/final-engine";
import { creativeReviewEngine } from "../creative-review/review-engine";
import { creativeAssistantEngine } from "../creative-assistant/assistant-engine";
import { creativeDecisionEngine } from "../creative-decision/decision-engine";
import { creativeMemoryEngine } from "../creative-memory/memory-engine";

export function buildAiMeWorkspaceContext(
  layout: ShellLayoutState,
  core: CoreStatus | null,
  saveState: SaveState = "saved",
  projectStatus: ProjectStatus = "idle",
  navigation?: NavigationState,
  layoutManager?: LayoutManagerState | null,
  restoreReport?: RestoreReport | null,
  preferences?: DesktopPreferences | null,
): AiMeWorkspaceContext {
  const active = getNavItem(layout.workspace);
  const visiblePanels = panelEngine.visiblePanelIds(layout);
  const breadcrumb = navigationEngine.buildBreadcrumb(layout.workspace, core?.activeProject);
  const recent = navigation?.recent ?? [];
  const favorites = navigation?.favorites ?? [];
  const historyCount = navigation?.history.length ?? 0;
  const lm = layoutManager ?? workspaceLayoutManager.load();
  const layoutCtx = buildAiMeLayoutContext(layout, lm);
  const stateCtx = buildAiMeStateContext(workspaceStateEngine.autoSave.getStatus(), restoreReport);
  const personalization = preferences && navigation
    ? personalizationEngine.buildAiMeContext(preferences, navigation)
    : null;
  const performance = workspacePerformanceEngine.buildAiMeContext();
  const ux = uxEngine.buildAiMeContext();
  const integration = workspaceIntegrationEngine.buildAiMeContext();
  const certification = workspaceCertificationEngine.buildAiMeContext();
  const productIntake = productIntakeEngine.buildAiMeContext();
  const imageOrganization = imageOrganizationEngine.buildAiMeContext();
  const productProfile = productProfileEngine.buildAiMeContext();
  const marketingInput = marketingInputEngine.buildAiMeContext();
  const productValidation = productValidationEngine.buildAiMeContext();
  const visualAnalysis = visualAnalysisEngine.buildAiMeContext();
  const deepIntelligence = deepIntelligenceEngine.buildAiMeContext();
  const marketResearch = marketResearchEngine.buildAiMeContext();
  const masterIntelligence = masterIntelligenceEngine.buildAiMeContext();
  const marketingStrategy = marketingStrategyEngine.buildAiMeContext();
  const creativePlanner = creativePlannerEngine.buildAiMeContext();
  const productionPlan = productionPlanEngine.buildAiMeContext();
  const productionQueue = productionQueueEngine.buildAiMeContext();
  const productionPipeline = productionPipelineEngine.buildAiMeContext();
  const productionCommandCenter = productionCommandCenterEngine.buildAiMeContext();
  const productionFinal = productionFinalEngine.buildAiMeContext();
  const creativeReview = creativeReviewEngine.buildAiMeContext();
  const creativeAssistant = creativeAssistantEngine.buildAiMeContext();
  const creativeDecision = creativeDecisionEngine.buildAiMeContext();
  const creativeMemory = creativeMemoryEngine.buildAiMeContext();

  const regions = [
    { id: "header", label: "Top Header", visible: true },
    { id: "left-sidebar", label: "Left Navigation", visible: !layout.zen && !layout.leftCollapsed },
    { id: "center", label: "Production Workspace", visible: true },
    { id: "right-sidebar", label: "AI Assistance", visible: !layout.zen && layout.rightOpen },
    { id: "bottom-panel", label: "Bottom Panel", visible: layout.bottomExpanded },
  ];

  const explanation = [
    "KWIZERA AI STUDIO layout engine is active.",
    `Current page: ${active.label} (${active.groupLabel}).`,
    `Breadcrumb: ${breadcrumb.map((s) => s.label).join(" > ")}.`,
    core?.activeProject ? `Current project: ${core.activeProject}.` : "No project is selected.",
    layoutCtx.explanation,
    stateCtx.explanation,
    personalization?.explanation ?? "",
    performance.explanation,
    ux.explanation,
    integration.explanation,
    certification.explanation,
    productIntake.explanation,
    imageOrganization.explanation,
    productProfile.explanation,
    marketingInput.explanation,
    productValidation.explanation,
    visualAnalysis.explanation,
    deepIntelligence.explanation,
    marketResearch.explanation,
    masterIntelligence.explanation,
    marketingStrategy.explanation,
    creativePlanner.explanation,
    productionPlan.explanation,
    productionQueue.explanation,
    productionPipeline.explanation,
    productionCommandCenter.explanation,
    productionFinal.explanation,
    creativeReview.explanation,
    creativeAssistant.explanation,
    creativeDecision.explanation,
    creativeMemory.explanation,
    layout.workspace === "home"
      ? buildAiMeDashboardContext(dashboardWidgetStore.load(), {
          updatedAt: new Date().toISOString(),
          statuses: [],
          progress: { percent: 0, remainingLabel: "", completed: 0, running: 0, waiting: 0, tasks: [] },
          activeProject: core?.activeProject ?? null,
          workspaceLabel: active.label,
          aiRecommendation: "",
          lastActivity: "",
          recentProduction: "",
        }).explanation
      : "",
    recent.length ? `Recently used: ${recent.slice(0, 4).map((id) => getNavItem(id).label).join(", ")}.` : "",
    core?.aiCore ? "The AI engine is online." : "Local offline mode is active.",
  ].filter(Boolean).join(" ");

  return {
    structure: {
      regions,
      activeWorkspace: layout.workspace,
      activeWorkspaceLabel: active.label,
    },
    layout: {
      leftCollapsed: layout.leftCollapsed,
      rightOpen: layout.rightOpen,
      bottomExpanded: layout.bottomExpanded,
      zen: layout.zen,
      panelCount: layout.panels.length,
      visiblePanels,
    },
    panels: layout.panels
      .filter((p) => p.mode !== "hidden")
      .map((p) => ({ id: p.id, zone: p.zone, mode: p.mode, locked: p.locked })),
    project: {
      name: core?.activeProject ?? "No project",
      status: projectStatus,
      saveState,
    },
    navigation: {
      currentPage: active.label,
      breadcrumb: breadcrumb.map((s) => s.label),
      recent,
      favorites,
      historyCount,
    },
    futureModules: getFutureModuleSlots().map((s) => s.id),
    layoutEngine: {
      activeLayoutId: layoutCtx.activeLayoutId,
      activeLayoutName: layoutCtx.activeLayoutName,
      floatingPanels: layoutCtx.floatingPanels,
      dockedPanels: layoutCtx.dockedPanels,
      recommendation: layoutCtx.recommendation,
    },
    workspaceState: {
      sessionId: stateCtx.sessionId,
      sessionDurationLabel: stateCtx.sessionDurationLabel,
      autoSaveEnabled: stateCtx.autoSaveEnabled,
      dirty: stateCtx.dirty,
      lastSavedAt: stateCtx.lastSavedAt,
      projectName: stateCtx.projectName,
      restoreExplanation: stateCtx.restoreExplanation,
      historyCount: stateCtx.historyCount,
      recommendation: stateCtx.recommendation,
    },
    personalization: personalization
      ? {
          startupMode: personalization.startupMode,
          activeProfile: personalization.activeProfile,
          language: personalization.language,
          quickAccessMode: personalization.quickAccessMode,
          topWorkspaces: personalization.topWorkspaces,
          startupExplanation: personalization.startupExplanation,
          recommendation: personalization.recommendation,
        }
      : undefined,
    performance: {
      mode: performance.mode,
      effectiveMode: performance.effectiveMode,
      fps: performance.fps,
      ramUsage: performance.ramUsage,
      gpuUsage: performance.gpuUsage,
      productionActive: performance.productionActive,
      alertCount: performance.alertCount,
      recommendation: performance.recommendation,
      bottleneck: performance.bottleneck,
    },
    ux: {
      tooltipsEnabled: ux.tooltipsEnabled,
      undoDepth: ux.undoDepth,
      redoDepth: ux.redoDepth,
      tourCompleted: ux.tourCompleted,
      highContrast: ux.highContrast,
      recommendation: ux.recommendation,
    },
    integration: {
      busOnline: integration.busOnline,
      aiBusBridged: integration.aiBusBridged,
      queueDepth: integration.queueDepth,
      lastEventType: integration.lastEventType,
      workflowSummary: integration.workflowSummary,
      recommendation: integration.recommendation,
    },
    certification: {
      certified: certification.certified,
      readiness: certification.readiness,
      overallScore: certification.overallScore,
      stabilityScore: certification.stabilityScore,
      performanceScore: certification.performanceScore,
      uxScore: certification.uxScore,
      recommendation: certification.recommendation,
    },
    productIntake: {
      projectId: productIntake.projectId,
      projectName: productIntake.projectName,
      assetCount: productIntake.assetCount,
      importPercent: productIntake.importPercent,
      warningCount: productIntake.warningCount,
      errorCount: productIntake.errorCount,
      canContinue: productIntake.canContinue,
      recommendation: productIntake.recommendation,
    },
    imageOrganization: {
      projectId: imageOrganization.projectId,
      projectName: imageOrganization.projectName,
      imageCount: imageOrganization.imageCount,
      coverageScore: imageOrganization.coverageScore,
      missingViews: imageOrganization.missingViews,
      warningCount: imageOrganization.warningCount,
      canContinue: imageOrganization.canContinue,
      recommendation: imageOrganization.recommendation,
    },
    explanation,
  };
}

export function serializeAiMeContext(context: AiMeWorkspaceContext): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    workspaceStructure: context.structure,
    layoutState: context.layout,
    panelLayout: context.panels,
    activeProject: context.project,
    navigationContext: context.navigation,
    layoutEngine: context.layoutEngine,
    workspaceState: context.workspaceState,
    personalization: context.personalization,
    performance: context.performance,
    ux: context.ux,
    integration: context.integration,
    certification: context.certification,
    productIntake: context.productIntake,
    imageOrganization: context.imageOrganization,
    reservedModules: context.futureModules,
    workspaceExplanation: context.explanation,
  };
  if (context.structure.activeWorkspace === "home") {
    Object.assign(payload, serializeAiMeDashboardContext(
      buildAiMeDashboardContext(dashboardWidgetStore.load(), {
        updatedAt: new Date().toISOString(),
        statuses: [],
        progress: { percent: 0, remainingLabel: "", completed: 0, running: 0, waiting: 0, tasks: [] },
        activeProject: context.project.name !== "No project" ? context.project.name : null,
        workspaceLabel: context.structure.activeWorkspaceLabel,
        aiRecommendation: "",
        lastActivity: "",
        recentProduction: "",
      }),
    ));
  }
  return payload;
}

export function explainWorkspaceForAiMe(workspaceId: WorkspaceId): string {
  const item = getNavItem(workspaceId);
  return `${item.label} (${item.groupLabel}): Use navigation, search, or ask AI Me to open this workspace. Keywords: ${item.keywords.join(", ")}.`;
}

export function guideUserToWorkspace(workspaceId: WorkspaceId): string {
  const item = getNavItem(workspaceId);
  const path = navigationEngine.buildBreadcrumb(workspaceId).map((s) => s.label).join(" > ");
  return `To reach ${item.label}, open Left Navigation → ${item.groupLabel} → ${item.label}, or press Ctrl+K and search “${item.label}”. Path: ${path}.`;
}

export function restoreLayoutForAiMe(layoutId: string): string {
  return `Open Layout Manager (Ctrl+Shift+L) and select "${layoutId}", or ask me to apply the ${layoutId} workspace layout. Production state will be preserved.`;
}
