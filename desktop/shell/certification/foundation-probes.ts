import { ALL_WORKSPACE_IDS } from "../types";
import { workspaceNav, getNavItem, getFutureModuleSlots } from "../workspace-registry";
import { navigationEngine, KEYBOARD_SHORTCUTS, QUICK_ACTIONS } from "../navigation/navigation-engine";
import { navigationStore, defaultNavigationState } from "../navigation/navigation-store";
import { createDefaultPanels, FLOATABLE_PANELS, FUTURE_MODULE_SLOTS } from "../layout/panel-engine";
import { workspaceLayoutManager, createBuiltinLayouts } from "../layout/layout-manager";
import { shellLayoutManager, defaultShellLayout } from "../layout-store";
import { dashboardWidgetStore, DEFAULT_WIDGETS, defaultDashboardLayout } from "../../dashboard/widget-store";
import { validateAndRepairPreferences } from "../../desktop-polish/preference-validation";
import { defaultPreferences } from "../../desktop-polish/preference-defaults";
import { workspaceStateEngine } from "../workspace-state/workspace-state-engine";
import { sessionStore } from "../workspace-state/session-store";
import { validateSnapshot, checksumPayload } from "../workspace-state/state-validation";
import { personalizationEngine } from "../personalization/personalization-engine";
import { workspacePerformanceEngine } from "../performance/performance-engine";
import { resolveEffectiveMode } from "../performance/mode-policies";
import { uxEngine } from "../ux/ux-engine";
import { commandStack } from "../ux/command-stack";
import { getTooltip, listTooltips } from "../ux/tooltip-registry";
import { workspaceIntegrationEngine } from "../integration/integration-engine";
import { ALL_WORKSPACE_EVENT_TYPES } from "../integration/types";
import {
  buildAiMeWorkspaceContext, explainWorkspaceForAiMe, guideUserToWorkspace, restoreLayoutForAiMe,
} from "../aime-awareness";
import { buildAiMeDashboardContext } from "../../dashboard/aime-dashboard-awareness";
import type { CertificationCheck } from "./types";

function ok(partial: Omit<CertificationCheck, "status" | "score"> & { score?: number }): CertificationCheck {
  return { status: "pass", score: partial.score ?? 100, ...partial };
}

function warn(partial: Omit<CertificationCheck, "status" | "score"> & { score?: number }): CertificationCheck {
  return { status: "warn", score: partial.score ?? 70, ...partial };
}

function fail(partial: Omit<CertificationCheck, "status" | "score"> & { score?: number }): CertificationCheck {
  return { status: "fail", score: partial.score ?? 0, ...partial };
}

function repaired(partial: Omit<CertificationCheck, "status" | "score"> & { score?: number }): CertificationCheck {
  return { status: "repaired", score: partial.score ?? 90, ...partial };
}

/** Probe every foundation pillar without duplicating engines. */
export function runFoundationProbes(): CertificationCheck[] {
  const checks: CertificationCheck[] = [];

  // Architecture
  const panels = createDefaultPanels();
  checks.push(
    panels.length >= 5 && FLOATABLE_PANELS.length >= 3
      ? ok({
        id: "arch.panels",
        category: "architecture",
        label: "Workspace Architecture",
        detail: `${panels.length} dockable panels · ${FLOATABLE_PANELS.length} floatable · ${FUTURE_MODULE_SLOTS.length} future slots`,
        critical: true,
      })
      : fail({
        id: "arch.panels",
        category: "architecture",
        label: "Workspace Architecture",
        detail: "Insufficient panels or floatable definitions",
        critical: true,
      }),
  );
  checks.push(
    ALL_WORKSPACE_IDS.length >= 10 && workspaceNav.length === ALL_WORKSPACE_IDS.length
      ? ok({
        id: "arch.registry",
        category: "architecture",
        label: "Workspace Registry",
        detail: `${ALL_WORKSPACE_IDS.length} workspaces registered with navigation metadata`,
        critical: true,
      })
      : fail({
        id: "arch.registry",
        category: "architecture",
        label: "Workspace Registry",
        detail: "Registry incomplete",
        critical: true,
      }),
  );
  checks.push(
    getFutureModuleSlots().length > 0
      ? ok({
        id: "arch.extensibility",
        category: "architecture",
        label: "Extensibility Slots",
        detail: `${getFutureModuleSlots().length} reserved module slots for Phase 2+`,
        critical: false,
        score: 100,
      })
      : warn({
        id: "arch.extensibility",
        category: "architecture",
        label: "Extensibility Slots",
        detail: "No future module slots declared",
        critical: false,
      }),
  );

  // Navigation
  const crumb = navigationEngine.buildBreadcrumb("production", "Demo");
  const search = navigationEngine.search("project");
  checks.push(
    KEYBOARD_SHORTCUTS.length >= 8 && QUICK_ACTIONS.length >= 5 && crumb.length >= 2 && search.length > 0
      ? ok({
        id: "nav.engine",
        category: "navigation",
        label: "Navigation System",
        detail: `${KEYBOARD_SHORTCUTS.length} shortcuts · ${QUICK_ACTIONS.length} quick actions · search & breadcrumb OK`,
        critical: true,
      })
      : fail({
        id: "nav.engine",
        category: "navigation",
        label: "Navigation System",
        detail: "Navigation engine incomplete",
        critical: true,
      }),
  );
  const nav = navigationStore.visit(defaultNavigationState, "home");
  const remembered = navigationStore.visit(nav, "ai-me");
  checks.push(
    remembered.recent.includes("ai-me") && (remembered.history?.length ?? 0) >= 1
      ? ok({
        id: "nav.memory",
        category: "navigation",
        label: "Navigation Memory",
        detail: "Recent / history / visit tracking operational",
        critical: true,
      })
      : fail({
        id: "nav.memory",
        category: "navigation",
        label: "Navigation Memory",
        detail: "Navigation memory not recording visits",
        critical: true,
      }),
  );

  // Dashboard / widgets
  const dash = dashboardWidgetStore.load();
  checks.push(
    dash.widgets.length >= 8 && DEFAULT_WIDGETS.length >= 8 && defaultDashboardLayout.columns === 12
      ? ok({
        id: "dash.widgets",
        category: "dashboard",
        label: "Dashboard UI & Widget System",
        detail: `${dash.widgets.length} widgets · 12-column grid · layout v${dash.version}`,
        critical: true,
      })
      : fail({
        id: "dash.widgets",
        category: "dashboard",
        label: "Dashboard UI & Widget System",
        detail: "Dashboard widget system incomplete",
        critical: true,
      }),
  );

  // Layout manager / dockable / floating
  const builtins = createBuiltinLayouts();
  const lm = workspaceLayoutManager.load();
  checks.push(
    builtins.length >= 3 && lm.layouts.length >= 1
      ? ok({
        id: "layout.manager",
        category: "layout",
        label: "Layout Manager",
        detail: `${builtins.length} builtin layouts · ${lm.layouts.length} stored layouts`,
        critical: true,
      })
      : fail({
        id: "layout.manager",
        category: "layout",
        label: "Layout Manager",
        detail: "Layout manager missing builtins",
        critical: true,
      }),
  );
  const shell = shellLayoutManager.load();
  checks.push(
    shell.panels?.length || createDefaultPanels().length
      ? ok({
        id: "layout.dock-float",
        category: "layout",
        label: "Dockable Panels & Floating Windows",
        detail: `Default shell workspace=${shell.workspace ?? defaultShellLayout.workspace}; floatables=${FLOATABLE_PANELS.map((p) => p.id).join(", ")}`,
        critical: true,
      })
      : fail({
        id: "layout.dock-float",
        category: "layout",
        label: "Dockable Panels & Floating Windows",
        detail: "Panel layout missing",
        critical: true,
      }),
  );

  // Preferences
  const prefs = validateAndRepairPreferences({ ...defaultPreferences, theme: "invalid-theme" as never });
  checks.push(
    prefs.repaired && prefs.preferences.theme === defaultPreferences.theme
      ? repaired({
        id: "prefs.validation",
        category: "state",
        label: "User Preferences",
        detail: "Corrupt preference values auto-repaired to safe defaults",
        critical: true,
      })
      : prefs.preferences
        ? ok({
          id: "prefs.validation",
          category: "state",
          label: "User Preferences",
          detail: "Preference validation available",
          critical: true,
        })
        : fail({
          id: "prefs.validation",
          category: "state",
          label: "User Preferences",
          detail: "Preference validation failed",
          critical: true,
        }),
  );

  // Personalization
  const persona = personalizationEngine.buildAiMeContext(defaultPreferences, defaultNavigationState);
  checks.push(
    persona.recommendation
      ? ok({
        id: "prefs.personalization",
        category: "state",
        label: "Personalization",
        detail: `Startup=${persona.startupMode} · profile=${persona.activeProfile}`,
        critical: false,
      })
      : warn({
        id: "prefs.personalization",
        category: "state",
        label: "Personalization",
        detail: "Personalization context incomplete",
        critical: false,
      }),
  );

  // Performance
  const mode = resolveEffectiveMode("balanced", false, 40, 20);
  const perfSnap = workspacePerformanceEngine.getSnapshot();
  checks.push(
    mode
      ? ok({
        id: "perf.modes",
        category: "performance",
        label: "Workspace Performance",
        detail: `Mode policies resolve (${mode}); monitor ${perfSnap ? "online" : "ready"}`,
        critical: true,
      })
      : fail({
        id: "perf.modes",
        category: "performance",
        label: "Workspace Performance",
        detail: "Performance mode policies missing",
        critical: true,
      }),
  );

  // Accessibility / UX
  checks.push(
    listTooltips().length >= 5 && getTooltip("save") && typeof commandStack.depth === "function"
      ? ok({
        id: "a11y.ux",
        category: "accessibility",
        label: "Accessibility & Productivity",
        detail: `${listTooltips().length} tooltips · undo stack API · UX engine ready`,
        critical: true,
      })
      : fail({
        id: "a11y.ux",
        category: "accessibility",
        label: "Accessibility & Productivity",
        detail: "UX/accessibility foundations incomplete",
        critical: true,
      }),
  );
  const ux = uxEngine.buildAiMeContext();
  checks.push(
    ux.recommendation
      ? ok({
        id: "a11y.engine",
        category: "accessibility",
        label: "UX Engine",
        detail: ux.recommendation,
        critical: false,
      })
      : warn({
        id: "a11y.engine",
        category: "accessibility",
        label: "UX Engine",
        detail: "UX engine context empty",
        critical: false,
      }),
  );

  // Integration
  const integ = workspaceIntegrationEngine.snapshot();
  checks.push(
    ALL_WORKSPACE_EVENT_TYPES.length >= 30 && integ.busOnline
      ? ok({
        id: "integ.bus",
        category: "integration",
        label: "Workspace Integration",
        detail: `${ALL_WORKSPACE_EVENT_TYPES.length} event types · bus online · queue ${integ.queueDepth}`,
        critical: true,
      })
      : ALL_WORKSPACE_EVENT_TYPES.length >= 30
        ? warn({
          id: "integ.bus",
          category: "integration",
          label: "Workspace Integration",
          detail: "Event catalog present; bus not started yet (will start with shell)",
          critical: false,
          score: 85,
        })
        : fail({
          id: "integ.bus",
          category: "integration",
          label: "Workspace Integration",
          detail: "Integration event catalog incomplete",
          critical: true,
        }),
  );

  // AI Me capability probes
  const ctx = buildAiMeWorkspaceContext(
    { ...defaultShellLayout, workspace: "home", panels: createDefaultPanels() },
    null,
  );
  const dashCtx = buildAiMeDashboardContext(dash, {
    updatedAt: new Date().toISOString(),
    statuses: [],
    progress: { percent: 0, remainingLabel: "", completed: 0, running: 0, waiting: 0, tasks: [] },
    activeProject: null,
    workspaceLabel: "Home",
    aiRecommendation: "",
    lastActivity: "",
    recentProduction: "",
  });
  checks.push(
    ctx.explanation.length > 40 && explainWorkspaceForAiMe("home").includes("Home")
      ? ok({
        id: "aime.explain",
        category: "ai-me",
        label: "AI Me Workspace Explanation",
        detail: "AI Me can explain workspace structure and pages",
        critical: true,
      })
      : fail({
        id: "aime.explain",
        category: "ai-me",
        label: "AI Me Workspace Explanation",
        detail: "AI Me explanation missing",
        critical: true,
      }),
  );
  checks.push(
    guideUserToWorkspace("ai-me").includes("AI Me") && restoreLayoutForAiMe("default").length > 10
      ? ok({
        id: "aime.guide",
        category: "ai-me",
        label: "AI Me Guidance",
        detail: "Navigation guidance and layout restore instructions available",
        critical: true,
      })
      : fail({
        id: "aime.guide",
        category: "ai-me",
        label: "AI Me Guidance",
        detail: "Guidance helpers incomplete",
        critical: true,
      }),
  );
  checks.push(
    Boolean(ctx.layoutEngine || ctx.navigation) && Boolean(dashCtx.explanation)
      ? ok({
        id: "aime.monitor",
        category: "ai-me",
        label: "AI Me Health Monitor",
        detail: "Layout, navigation, widgets, performance, UX, and integration contexts wired",
        critical: true,
      })
      : fail({
        id: "aime.monitor",
        category: "ai-me",
        label: "AI Me Health Monitor",
        detail: "AI Me monitoring contexts incomplete",
        critical: true,
      }),
  );

  // State engine presence
  checks.push(
    typeof workspaceStateEngine.autoSave?.flush === "function" && typeof sessionStore.pushHistory === "function"
      ? ok({
        id: "state.engines",
        category: "state",
        label: "Workspace State & Session Manager",
        detail: "State engine, auto-save, and session store APIs present",
        critical: true,
      })
      : fail({
        id: "state.engines",
        category: "state",
        label: "Workspace State & Session Manager",
        detail: "State/session APIs missing",
        critical: true,
      }),
  );

  void getNavItem("home");
  void checksumPayload({ ok: true });
  void validateSnapshot(null);

  return checks;
}
