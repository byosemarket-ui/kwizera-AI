import {
  loadFinalCompleteHandoff,
  loadFinalizationStore,
  listProductionHistory,
} from "../production-final/final-engine";
import type { FinalizationState } from "../production-final/types";
import {
  assembleReviewState,
  buildAiMeContract,
  versionKey,
} from "./assemble";
import type {
  CreativeReviewAiMeContract,
  CreativeReviewStatus,
  CreativeReviewUiSnapshot,
  FeedbackCategory,
  ReviewFeedback,
  ReviewNote,
  ReviewPersistedBlob,
  TimestampComment,
} from "./types";
import { REVIEW_HANDOFF_KEY, REVIEW_STORE_KEY } from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;
type Listener = (snap: CreativeReviewUiSnapshot) => void;

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadBlob(): ReviewPersistedBlob {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_STORE_KEY) ?? '{"byVersion":{}}') as ReviewPersistedBlob;
  } catch {
    return { byVersion: {} };
  }
}

function saveBlob(blob: ReviewPersistedBlob): void {
  localStorage.setItem(REVIEW_STORE_KEY, JSON.stringify(blob));
}

export class CreativeReviewEngine {
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private recommendation = "Complete Phase 5 production, then open AI Creative Review.";
  private state: ReturnType<typeof assembleReviewState> | null = null;
  private blob = loadBlob();

  setNotify(fn: NotifyFn | null): void { this.notify = fn; }
  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void { this.emitEvents = fn; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): CreativeReviewUiSnapshot {
    return {
      version: 1,
      state: this.state,
      recommendation: this.recommendation,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const contract = buildAiMeContract(this.state);
    return {
      ...contract,
      recommendation: this.recommendation,
      explanation: contract.explanation,
    };
  }

  /** Phase 6 Step 2 data contract — Step 1 only. */
  getAiMeContract() {
    return buildAiMeContract(this.state);
  }

  hydrate(preferredVersion?: string): boolean {
    const handoff = loadFinalCompleteHandoff();
    const store = loadFinalizationStore();
    const history = listProductionHistory();
    let final: FinalizationState | null = null;

    if (handoff) {
      final = Object.values(store).find((s) => s.productionId === handoff.package.productionId) ?? null;
      if (!final) {
        final = Object.values(store).find((s) => s.status === "COMPLETED") ?? null;
      }
    } else {
      final = Object.values(store).find((s) => s.status === "COMPLETED" && s.package) ?? null;
    }

    if (!handoff && !final?.package) {
      this.state = null;
      this.recommendation = "No completed Production Package found. Finish Phase 5 Step 4 first.";
      this.emit();
      return false;
    }

    const productionId = handoff?.package.productionId ?? final!.productionId;
    const versionLabel = preferredVersion
      || handoff?.package.versionLabel
      || final?.package?.versionLabel
      || history.find((h) => h.productionId === productionId)?.versionLabel
      || "v1.0";

    const key = versionKey(productionId, versionLabel);
    const persisted = this.blob.byVersion[key];
    const reviewStatus: CreativeReviewStatus = persisted?.reviewStatus
      ?? "READY_FOR_REVIEW";

    this.state = assembleReviewState({
      handoff,
      final,
      history,
      reviewStatus,
      feedback: persisted?.feedback ?? [],
      notes: persisted?.notes ?? [],
      timestampComments: persisted?.timestampComments ?? [],
      selectedSceneId: persisted?.selectedSceneId ?? null,
      aiReview: persisted?.aiReview ?? null,
    });
    this.recommendation = this.state.recommendation;
    this.emitAction("ReviewUpdated", {
      productionId,
      versionLabel,
      reviewStatus,
    });
    this.writeStep2Handoff();
    this.emit();
    return true;
  }

  selectScene(sceneId: string): void {
    if (!this.state) return;
    this.state = { ...this.state, selectedSceneId: sceneId, updatedAt: new Date().toISOString() };
    this.persistLocal();
    this.emit();
  }

  selectVersion(versionLabel: string): void {
    this.hydrate(versionLabel);
  }

  setMediaError(message: string | null): void {
    if (!this.state) return;
    this.state = { ...this.state, mediaError: message };
    this.emit();
  }

  beginReview(): void {
    this.setStatus("IN_REVIEW");
  }

  approve(): void {
    if (!this.state) return;
    this.setStatus("APPROVED");
    this.notify?.("success", "Version approved", `${this.state.versionLabel} approved. Files unchanged.`, "production-complete");
    this.emitAction("ReviewUpdated", { reviewStatus: "APPROVED", versionLabel: this.state.versionLabel });
  }

  requestChanges(): void {
    this.setStatus("NEEDS_CHANGES");
    this.notify?.("warning", "Changes requested", "Feedback saved for later Creative Assistant.", "warnings");
  }

  reject(): void {
    this.setStatus("REJECTED");
  }

  addFeedback(input: {
    sceneId: string | null;
    category: FeedbackCategory;
    comment: string;
    timestampSec: number | null;
  }): ReviewFeedback | null {
    if (!this.state || !input.comment.trim()) return null;
    const item: ReviewFeedback = {
      feedbackId: uid("fb"),
      productionId: this.state.productionId,
      versionLabel: this.state.versionLabel,
      runId: this.state.runId,
      sceneId: input.sceneId,
      category: input.category,
      timestampSec: input.timestampSec,
      comment: input.comment.trim(),
      createdAt: new Date().toISOString(),
    };
    this.state = {
      ...this.state,
      feedback: [...this.state.feedback, item],
      reviewStatus: this.state.reviewStatus === "APPROVED" ? "NEEDS_CHANGES" : this.state.reviewStatus === "READY_FOR_REVIEW" ? "IN_REVIEW" : this.state.reviewStatus,
      updatedAt: new Date().toISOString(),
    };
    this.persistLocal();
    this.emitAction("FeedbackCreated", { feedbackId: item.feedbackId, sceneId: item.sceneId });
    this.writeStep2Handoff();
    this.emit();
    return item;
  }

  addTimestampComment(timestampSec: number, comment: string, sceneId: string | null): TimestampComment | null {
    if (!this.state || !comment.trim()) return null;
    const item: TimestampComment = {
      commentId: uid("tc"),
      productionId: this.state.productionId,
      versionLabel: this.state.versionLabel,
      runId: this.state.runId,
      timestampSec,
      sceneId,
      comment: comment.trim(),
      user: "local-user",
      createdAt: new Date().toISOString(),
    };
    this.state = {
      ...this.state,
      timestampComments: [...this.state.timestampComments, item],
      reviewStatus: this.state.reviewStatus === "READY_FOR_REVIEW" ? "IN_REVIEW" : this.state.reviewStatus,
      updatedAt: new Date().toISOString(),
    };
    this.persistLocal();
    this.emitAction("FeedbackCreated", { type: "timestamp", commentId: item.commentId, timestampSec });
    this.writeStep2Handoff();
    this.emit();
    return item;
  }

  /** Phase 6 Step 2 — fill AI Review panel from live assistant analysis (no invented scores). */
  applyAssistantReview(input: {
    looksGood: string[];
    issues: string[];
    suggestions: string[];
    warnings: string[];
    attention: string[];
  }): void {
    if (!this.state) return;
    this.state = {
      ...this.state,
      aiReview: {
        availability: "AVAILABLE",
        looksGood: input.looksGood,
        issues: input.issues,
        suggestions: input.suggestions,
        warnings: input.warnings,
        attention: input.attention,
        note: "AI Review generated by Phase 6 Step 2 Creative Assistant from live QC/review state.",
      },
      updatedAt: new Date().toISOString(),
      recommendation: "AI Me Creative Assistant reviewed this version using live application state.",
    };
    this.persistLocal();
    this.writeStep2Handoff();
    this.emitAction("AiReviewUpdated", { availability: "AVAILABLE" });
    this.emit();
  }

  addNote(body: string, sceneId: string | null, timestampSec: number | null): ReviewNote | null {
    if (!this.state || !body.trim()) return null;
    const now = new Date().toISOString();
    const item: ReviewNote = {
      noteId: uid("note"),
      productionId: this.state.productionId,
      versionLabel: this.state.versionLabel,
      runId: this.state.runId,
      sceneId,
      timestampSec,
      body: body.trim(),
      createdAt: now,
      updatedAt: now,
    };
    this.state = { ...this.state, notes: [...this.state.notes, item], updatedAt: now };
    this.persistLocal();
    this.writeStep2Handoff();
    this.emit();
    return item;
  }

  private setStatus(status: CreativeReviewStatus): void {
    if (!this.state) return;
    this.state = {
      ...this.state,
      reviewStatus: status,
      updatedAt: new Date().toISOString(),
      recommendation: status === "APPROVED"
        ? `Version ${this.state.versionLabel} is APPROVED. Files were not modified.`
        : status === "NEEDS_CHANGES"
          ? "Changes requested — correction workflow is Phase 6 Step 2+."
          : this.state.recommendation,
    };
    this.persistLocal();
    this.writeStep2Handoff();
    this.emit();
  }

  private persistLocal(): void {
    if (!this.state) return;
    const key = versionKey(this.state.productionId, this.state.versionLabel);
    this.blob.byVersion[key] = {
      reviewStatus: this.state.reviewStatus,
      feedback: this.state.feedback,
      notes: this.state.notes,
      timestampComments: this.state.timestampComments,
      selectedSceneId: this.state.selectedSceneId,
      aiReview: this.state.aiReview,
      updatedAt: this.state.updatedAt,
    };
    saveBlob(this.blob);
    void import("../shell/workspace-state/workspace-state-engine").then(({ workspaceStateEngine }) => {
      workspaceStateEngine.autoSave.markDirty();
    });
  }

  private writeStep2Handoff(): void {
    const contract = buildAiMeContract(this.state);
    localStorage.setItem(REVIEW_HANDOFF_KEY, JSON.stringify({
      ...contract,
      status: "READY FOR PHASE 6 STEP 2 AI ASSISTANT",
      note: "Open AI Me workspace for the Creative Assistant. Step 3 is not auto-started.",
      preparedAt: new Date().toISOString(),
    }));
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "creative-review", ...payload });
    this.emitEvents?.("product.updated", { action, module: "creative-review", ...payload });
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}

export const creativeReviewEngine = new CreativeReviewEngine();

export function loadStep2AssistantHandoff(): (CreativeReviewAiMeContract & { status?: string }) | null {
  try {
    const raw = JSON.parse(localStorage.getItem(REVIEW_HANDOFF_KEY) ?? "null") as (CreativeReviewAiMeContract & { status?: string }) | null;
    return raw?.version === 1 && raw.step === "phase-6-step-2-ai-assistant" ? raw : null;
  } catch {
    return null;
  }
}