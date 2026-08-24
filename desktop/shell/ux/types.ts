/** Accessibility, Professional UX, Smart Interaction & Productivity — Step 8 */

export type ConfirmKind =
  | "delete"
  | "reset"
  | "cancel-production"
  | "close-project"
  | "replace-output"
  | "restore-workspace"
  | "generic";

export type FeedbackTone = "success" | "warning" | "error" | "loading" | "saving" | "processing" | "info";

export interface TooltipSpec {
  id: string;
  purpose: string;
  usage: string;
  expectedResult: string;
  relatedActions: string[];
  shortcut?: string;
}

export interface ConfirmRequest {
  id: string;
  kind: ConfirmKind;
  title: string;
  detail: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface ConfirmResult {
  confirmed: boolean;
  id: string;
}

export interface UndoCommand {
  id: string;
  label: string;
  at: string;
  undo: () => void;
  redo: () => void;
}

export interface FormFieldState {
  name: string;
  value: string;
  required: boolean;
  error: string | null;
  touched: boolean;
  suggestions: string[];
}

export interface ProductivityAction {
  id: string;
  label: string;
  detail: string;
  shortcut?: string;
  favorite?: boolean;
  recentAt?: string;
  count?: number;
}

export interface TourStep {
  id: string;
  target: string;
  title: string;
  body: string;
}

export interface UxSnapshot {
  version: 1;
  tooltipsEnabled: boolean;
  confirmDestructive: boolean;
  showKeyboardHints: boolean;
  tourCompleted: boolean;
  undoDepth: number;
  redoDepth: number;
  recentActions: ProductivityAction[];
  favoriteActions: string[];
  multiSelectCount: number;
  focusMode: "mouse" | "keyboard";
}

export interface AiMeUxContext {
  tooltipsEnabled: boolean;
  undoDepth: number;
  redoDepth: number;
  tourCompleted: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  fontScale: number;
  pendingConfirm: string | null;
  recommendation: string;
  explanation: string;
}
