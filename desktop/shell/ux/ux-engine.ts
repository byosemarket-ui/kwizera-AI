import type { DesktopPreferences } from "../../desktop-polish/types";
import type { ConfirmKind, FeedbackTone, UxSnapshot } from "./types";
import { commandStack } from "./command-stack";
import { confirmationService } from "./confirmation";
import { listTooltips, explainToolForAiMe } from "./tooltip-registry";
import { listProductivityActions, recordAction, toggleFavoriteAction, workspaceTourSteps } from "./productivity";
import { ensureSkipLink, installFocusModeListeners, applyFocusMode } from "./focus";
import { buildAiMeUxContext } from "./aime-ux-awareness";

const TOUR_KEY = "kwizera.ux-tour.v1";

export class UxEngine {
  private multiSelected = new Set<string>();
  private focusMode: "mouse" | "keyboard" = "mouse";
  private liveMessage = "";
  private uninstallFocus: (() => void) | null = null;
  private prefs: Pick<DesktopPreferences, "highContrast" | "reducedMotion" | "fontScale" | "tooltipsEnabled" | "confirmDestructive" | "showKeyboardHints" | "tourCompleted"> | null = null;

  start(prefs?: DesktopPreferences): void {
    ensureSkipLink();
    this.uninstallFocus = installFocusModeListeners();
    if (prefs) this.applyPreferences(prefs);
  }

  stop(): void {
    this.uninstallFocus?.();
    this.uninstallFocus = null;
  }

  applyPreferences(prefs: DesktopPreferences): void {
    this.prefs = prefs;
    document.documentElement.classList.toggle("ux-tooltips", prefs.tooltipsEnabled !== false);
    document.documentElement.classList.toggle("ux-keyboard-hints", prefs.showKeyboardHints !== false);
    document.documentElement.dataset.fontScale = String(prefs.fontScale);
  }

  snapshot(): UxSnapshot {
    const depth = commandStack.depth();
    const prod = listProductivityActions();
    return {
      version: 1,
      tooltipsEnabled: this.prefs?.tooltipsEnabled !== false,
      confirmDestructive: this.prefs?.confirmDestructive !== false,
      showKeyboardHints: this.prefs?.showKeyboardHints !== false,
      tourCompleted: Boolean(this.prefs?.tourCompleted || this.isTourCompleted()),
      undoDepth: depth.undo,
      redoDepth: depth.redo,
      recentActions: prod.recent,
      favoriteActions: prod.favorites.map((a) => a.id),
      multiSelectCount: this.multiSelected.size,
      focusMode: this.focusMode,
    };
  }

  async confirm(
    kind: ConfirmKind,
    title: string,
    detail: string,
    options?: { force?: boolean },
  ): Promise<boolean> {
    const destructive = kind === "delete" || kind === "reset" || kind === "cancel-production" || kind === "replace-output";
    if (!options?.force && destructive && this.prefs?.confirmDestructive === false) {
      return true;
    }
    const result = await confirmationService.ask({ kind, title, detail });
    return result.confirmed;
  }

  undo(): string | null {
    const entry = commandStack.undo();
    if (entry) this.announce(`Undid: ${entry.label}`, "success");
    return entry?.label ?? null;
  }

  redo(): string | null {
    const entry = commandStack.redo();
    if (entry) this.announce(`Redid: ${entry.label}`, "success");
    return entry?.label ?? null;
  }

  trackAction(id: string): void {
    recordAction(id);
  }

  toggleFavorite(id: string): string[] {
    return toggleFavoriteAction(id);
  }

  setMultiSelect(ids: string[]): void {
    this.multiSelected = new Set(ids);
  }

  toggleMultiSelect(id: string): string[] {
    if (this.multiSelected.has(id)) this.multiSelected.delete(id);
    else this.multiSelected.add(id);
    return [...this.multiSelected];
  }

  clearMultiSelect(): void {
    this.multiSelected.clear();
  }

  getMultiSelect(): string[] {
    return [...this.multiSelected];
  }

  announce(message: string, tone: FeedbackTone = "info"): void {
    this.liveMessage = message;
    const region = document.getElementById("kwizera-live-region");
    if (region) {
      region.dataset.tone = tone;
      region.textContent = "";
      // Force announce
      window.setTimeout(() => {
        region.textContent = message;
      }, 20);
    }
  }

  getLiveMessage(): string {
    return this.liveMessage;
  }

  setFocusMode(mode: "mouse" | "keyboard"): void {
    this.focusMode = mode;
    applyFocusMode(mode);
  }

  markTourCompleted(): void {
    localStorage.setItem(TOUR_KEY, JSON.stringify({ completedAt: new Date().toISOString() }));
  }

  isTourCompleted(): boolean {
    try {
      return Boolean(JSON.parse(localStorage.getItem(TOUR_KEY) ?? "null")?.completedAt);
    } catch {
      return false;
    }
  }

  getTourSteps() {
    return workspaceTourSteps();
  }

  listTooltips() {
    return listTooltips();
  }

  explainTool(id: string) {
    return explainToolForAiMe(id);
  }

  getProductivity() {
    return listProductivityActions();
  }

  buildAiMeContext() {
    return buildAiMeUxContext(this.snapshot(), this.prefs, confirmationService.getPending()?.title ?? null);
  }
}

export const uxEngine = new UxEngine();
