/** Assemble Creative Review views from Phase 5 finalization — no duplicate engines. */

import type { Phase5CompleteHandoff } from "../production-final/final-engine";
import type {
  FinalizationState,
  FinalOutputPackage,
  MasterTimeline,
  ProductionHistoryEntry,
  QualityControlReport,
} from "../production-final/types";
import type { PipelineArtifact } from "../production-pipeline/types";
import type {
  AttentionItem,
  AudioTrackCard,
  CreativeReviewAiMeContract,
  CreativeReviewState,
  CreativeReviewStatus,
  CreativeScoreView,
  ImageAssetCard,
  ReviewFeedback,
  ReviewNote,
  SceneReviewCard,
  TextReviewLine,
  TimestampComment,
  VideoPreviewMeta,
  VersionHistoryItem,
} from "./types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatSize(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export { formatSize };

export function versionKey(productionId: string, versionLabel: string): string {
  return `${productionId}::${versionLabel}`;
}

export function isPlayableMediaPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return /^(https?:|blob:|file:|data:)/i.test(path) || path.startsWith("/");
}

export function buildVideoMeta(
  pkg: FinalOutputPackage | null,
  final: FinalizationState | null,
): VideoPreviewMeta {
  const videoOut = pkg?.outputs.find((o) => o.kind === "Video") ?? null;
  const render = final?.render ?? null;
  const path = render?.outputPath || videoOut?.path || null;
  const playable = isPlayableMediaPath(path);
  return {
    available: Boolean(path) && (playable || Boolean(render || videoOut)),
    unavailableReason: !path
      ? "Final video output was not found in the Production Package."
      : !playable
        ? "Video file is registered locally but is not directly streamable in this browser preview (path metadata only). Open Outputs for package details."
        : null,
    path,
    resolution: render?.resolution ?? null,
    frameRate: render?.frameRate ?? null,
    durationSec: render?.durationSec ?? final?.timeline?.totalDurationSec ?? null,
    format: videoOut?.format ?? render?.container ?? null,
    fileSizeBytes: videoOut?.sizeBytes ?? render?.fileSizeBytes ?? null,
    version: pkg?.versionLabel ?? render?.version ?? null,
    checksum: videoOut?.checksum ?? render?.checksum ?? null,
  };
}

export function buildSceneCards(final: FinalizationState | null): SceneReviewCard[] {
  const timeline = final?.timeline;
  const scenes = final?.pipelineState.snapshot.scenes?.length
    ? final.pipelineState.snapshot.scenes
    : final?.pipelineState.snapshot.plan.scenes ?? [];
  if (timeline?.clips.length) {
    return timeline.clips.map((clip, idx) => {
      const plan = scenes.find((s) => s.id === clip.sceneId) ?? scenes[idx];
      return {
        sceneId: clip.sceneId,
        sceneNumber: clip.order || idx + 1,
        name: clip.sceneName,
        startSec: clip.startSec,
        endSec: clip.endSec,
        durationSec: clip.durationSec,
        hasVisual: Boolean(clip.visualRef),
        hasVoice: Boolean(clip.voiceRef),
        hasText: Boolean(clip.textRef) || Boolean(plan?.onScreenText || plan?.narration),
        visualRef: clip.visualRef,
        voiceRef: clip.voiceRef,
        textRef: clip.textRef,
        narration: plan?.narration || "",
        onScreenText: plan?.onScreenText || "",
        transition: clip.transition,
        productFocus: plan?.productFocus || "",
        status: "COMPLETED",
      };
    });
  }
  return scenes.map((s, idx) => ({
    sceneId: s.id,
    sceneNumber: s.sceneNumber || idx + 1,
    name: s.name,
    startSec: s.startSec,
    endSec: s.endSec,
    durationSec: s.durationSec,
    hasVisual: true,
    hasVoice: Boolean(s.narration),
    hasText: Boolean(s.onScreenText),
    visualRef: null,
    voiceRef: null,
    textRef: null,
    narration: s.narration,
    onScreenText: s.onScreenText,
    transition: s.transition,
    productFocus: s.productFocus,
    status: "FROM SNAPSHOT",
  }));
}

export function buildImageCards(final: FinalizationState | null, pkg: FinalOutputPackage | null): ImageAssetCard[] {
  const cards: ImageAssetCard[] = [];
  const arts: PipelineArtifact[] = final?.pipelineState.artifacts ?? [];
  for (const a of arts.filter((x) => x.kind === "Image" || x.kind === "Scene" || x.kind === "Thumbnail")) {
    cards.push({
      assetId: a.artifactId,
      label: a.kind === "Thumbnail" ? "THUMBNAIL" : a.kind === "Scene" ? "SCENE IMAGE" : "PRODUCT / SCENE IMAGE",
      type: a.kind,
      path: a.outputPath,
      resolution: null,
      source: a.engine,
      sceneUsage: a.sceneId,
      validationStatus: a.validationState,
    });
  }
  if (pkg) {
    for (const o of pkg.outputs.filter((x) => x.kind === "Thumbnail" || x.kind === "Image")) {
      if (cards.some((c) => c.path === o.path)) continue;
      cards.push({
        assetId: o.outputId,
        label: o.kind === "Thumbnail" ? "THUMBNAIL" : "IMAGE",
        type: o.kind,
        path: o.path,
        resolution: final?.thumbnail ? `${final.thumbnail.width}×${final.thumbnail.height}` : null,
        source: "Final Output Package",
        sceneUsage: null,
        validationStatus: o.validationStatus,
      });
    }
  }
  if (final?.thumbnail) {
    cards.push({
      assetId: final.thumbnail.thumbnailId,
      label: "THUMBNAIL",
      type: "Thumbnail",
      path: final.thumbnail.outputPath,
      resolution: `${final.thumbnail.width}×${final.thumbnail.height}`,
      source: "Thumbnail Engine",
      sceneUsage: null,
      validationStatus: final.thumbnail.validationState,
    });
  }
  // de-dupe by path
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (seen.has(c.path)) return false;
    seen.add(c.path);
    return true;
  });
}

export function buildAudioTracks(final: FinalizationState | null, pkg: FinalOutputPackage | null): AudioTrackCard[] {
  const tracks: AudioTrackCard[] = [];
  const arts = final?.pipelineState.artifacts.filter((a) => a.kind === "Audio") ?? [];
  for (const a of arts) {
    const kind: AudioTrackCard["kind"] = /MUSIC/i.test(a.taskId + a.source) ? "Music"
      : /SFX/i.test(a.taskId + a.source) ? "SFX"
        : "Voice";
    tracks.push({
      id: a.artifactId,
      name: `${kind} · ${a.version}`,
      kind,
      path: a.outputPath,
      durationSec: null,
      status: a.validationState,
    });
  }
  if (final?.audioMix) {
    tracks.push({
      id: final.audioMix.mixId,
      name: "Final Mix",
      kind: "Final Mix",
      path: final.audioMix.outputPath,
      durationSec: final.audioMix.durationSec,
      status: final.audioMix.validationState,
    });
  } else if (pkg) {
    const audio = pkg.outputs.find((o) => o.kind === "Audio");
    if (audio) {
      tracks.push({
        id: audio.outputId,
        name: "Final Mix",
        kind: "Final Mix",
        path: audio.path,
        durationSec: null,
        status: audio.validationStatus,
      });
    }
  }
  return tracks;
}

export function buildTextLines(final: FinalizationState | null): TextReviewLine[] {
  const composed = final?.textComposition?.lines ?? [];
  if (composed.length) {
    return composed.map((l) => ({
      id: l.id,
      sceneId: l.sceneId,
      kind: l.kind,
      text: l.text,
      startSec: l.startSec,
      endSec: l.endSec,
      highlight: /cta/i.test(l.kind) ? "cta"
        : /promo|promotion/i.test(l.text) ? "promo"
          : /product/i.test(l.text) ? "product"
            : /narration/i.test(l.kind) ? "narration"
              : "other",
    }));
  }
  const script = final?.pipelineState.snapshot.script?.length
    ? final.pipelineState.snapshot.script
    : final?.pipelineState.snapshot.plan.script ?? [];
  return script.flatMap((line, i) => {
    const out: TextReviewLine[] = [];
    if (line.narration) {
      out.push({
        id: `n-${i}`, sceneId: line.sceneId, kind: "narration", text: line.narration,
        startSec: 0, endSec: line.durationSec, highlight: "narration",
      });
    }
    if (line.onScreenText) {
      out.push({
        id: `t-${i}`, sceneId: line.sceneId, kind: "on-screen", text: line.onScreenText,
        startSec: 0, endSec: line.durationSec, highlight: "other",
      });
    }
    if (line.cta) {
      out.push({
        id: `c-${i}`, sceneId: line.sceneId, kind: "cta", text: line.cta,
        startSec: 0, endSec: line.durationSec, highlight: "cta",
      });
    }
    return out;
  });
}

/** Scores only when existing QC check data can be mapped — never invent percentages. */
export function buildCreativeScore(qc: QualityControlReport | null): CreativeScoreView {
  if (!qc) {
    return { available: false, overall: null, visual: null, audio: null, text: null, product: null, label: "NOT AVAILABLE" };
  }
  // Existing QC does not provide numeric creative scores — do not invent.
  return {
    available: false,
    overall: null,
    visual: null,
    audio: null,
    text: null,
    product: null,
    label: "NOT AVAILABLE",
  };
}

export function buildAttention(qc: QualityControlReport | null, scenes: SceneReviewCard[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (!qc) {
    items.push({ id: "qc-missing", severity: "warning", message: "Quality Control report is not loaded.", sceneId: null });
    return items;
  }
  for (const c of qc.checks) {
    if (c.status === "FAIL") {
      items.push({ id: `fail-${c.id}`, severity: "error", message: `${c.label}: ${c.detail}`, sceneId: null });
    } else if (c.status === "WARNING") {
      items.push({ id: `warn-${c.id}`, severity: "warning", message: `${c.label}: ${c.detail}`, sceneId: null });
    }
  }
  for (const reason of qc.blockingReasons) {
    items.push({ id: uid("block"), severity: "error", message: reason, sceneId: null });
  }
  for (const sc of scenes.filter((s) => !s.hasVisual)) {
    items.push({ id: `vis-${sc.sceneId}`, severity: "warning", message: `Scene ${sc.sceneNumber} visual reference is missing.`, sceneId: sc.sceneId });
  }
  if (!items.length) {
    items.push({ id: "all-good", severity: "ok", message: "ALL CHECKS LOOK GOOD ✓", sceneId: null });
  }
  return items;
}

export function buildAiReviewPanel(qc: QualityControlReport | null): CreativeReviewState["aiReview"] {
  // Step 1: AI review assistant belongs to Step 2 — do not pretend it ran.
  return {
    availability: "NOT_AVAILABLE",
    looksGood: qc?.checks.filter((c) => c.status === "PASS").map((c) => c.label) ?? [],
    issues: [],
    suggestions: [],
    warnings: qc?.checks.filter((c) => c.status === "WARNING" || c.status === "CHECK_NOT_AVAILABLE").map((c) => `${c.label}: ${c.detail}`) ?? [],
    attention: qc?.blockingReasons ?? [],
    note: "AI REVIEW NOT AVAILABLE — full AI Creative Assistant is Phase 6 Step 2. QC facts above come from Phase 5.",
  };
}

export function buildVersionHistory(
  history: ProductionHistoryEntry[],
  productionId: string,
  reviewStatus: CreativeReviewStatus,
): VersionHistoryItem[] {
  return history
    .filter((h) => h.productionId === productionId)
    .map((h) => ({
      versionLabel: h.versionLabel,
      packageId: h.packageId,
      productionId: h.productionId,
      status: h.versionLabel ? reviewStatus === "APPROVED" && h === history[0] ? "APPROVED" : "READY FOR REVIEW" : "COMPLETED",
      qcResult: h.qcResult,
      completedAt: h.completedAt,
      finalVideoPath: h.finalVideoPath,
    }));
}

export function assembleReviewState(args: {
  handoff: Phase5CompleteHandoff | null;
  final: FinalizationState | null;
  history: ProductionHistoryEntry[];
  reviewStatus: CreativeReviewStatus;
  feedback: ReviewFeedback[];
  notes: ReviewNote[];
  timestampComments: TimestampComment[];
  selectedSceneId: string | null;
  aiReview?: CreativeReviewState["aiReview"] | null;
}): CreativeReviewState {
  const { handoff, final, history, reviewStatus, feedback, notes, timestampComments, selectedSceneId } = args;
  const pkg = handoff?.package ?? final?.package ?? null;
  const qc = handoff?.qc ?? final?.qcReport ?? null;
  const productionId = pkg?.productionId ?? final?.productionId ?? handoff?.history.productionId ?? "";
  const versionLabel = pkg?.versionLabel ?? final?.package?.versionLabel ?? handoff?.history.versionLabel ?? "v1.0";
  const scenes = buildSceneCards(final);
  const images = buildImageCards(final, pkg);
  const productImg = images.find((i) => /PRODUCT|Image/i.test(i.label + i.type));
  const processed = images.find((i) => i !== productImg && /Scene|Image|THUMBNAIL/i.test(i.type));
  const now = new Date().toISOString();

  return {
    version: 1,
    projectId: pkg?.projectId ?? final?.projectId ?? "",
    projectName: pkg?.projectName ?? final?.projectName ?? handoff?.history.projectName ?? "—",
    productionId,
    runId: pkg?.runId ?? final?.runId ?? handoff?.history.runId ?? "",
    versionLabel,
    packageId: pkg?.packageId ?? handoff?.history.packageId ?? "",
    productionStatus: final?.status === "COMPLETED" || handoff?.status === "PRODUCTION COMPLETE" ? "COMPLETED" : final?.status ?? "UNKNOWN",
    reviewStatus,
    package: pkg,
    qc,
    timeline: final?.timeline ?? null,
    video: buildVideoMeta(pkg, final),
    scenes,
    images,
    audioTracks: buildAudioTracks(final, pkg),
    textLines: buildTextLines(final),
    creativeScore: buildCreativeScore(qc),
    attention: buildAttention(qc, scenes),
    aiReview: args.aiReview ?? buildAiReviewPanel(qc),
    qcChecks: qc?.checks ?? [],
    feedback: feedback.filter((f) => f.productionId === productionId && f.versionLabel === versionLabel),
    notes: notes.filter((n) => n.productionId === productionId && n.versionLabel === versionLabel),
    timestampComments: timestampComments.filter((c) => c.productionId === productionId && c.versionLabel === versionLabel),
    versionHistory: buildVersionHistory(history, productionId, reviewStatus),
    selectedSceneId: selectedSceneId || scenes[0]?.sceneId || null,
    comparisonBefore: productImg ?? images[0] ?? null,
    comparisonAfter: processed ?? images[1] ?? images[0] ?? null,
    mediaError: null,
    createdAt: pkg?.createdAt ?? now,
    updatedAt: now,
    recommendation: reviewStatus === "APPROVED"
      ? `Version ${versionLabel} is APPROVED. Files were not modified.`
      : "Inspect video, scenes, audio, timeline and QC. Approve or request changes. Open AI Me for the Creative Assistant.",
  };
}

export function buildAiMeContract(state: CreativeReviewState | null): CreativeReviewAiMeContract {
  if (!state) {
    return {
      version: 1,
      step: "phase-6-step-2-ai-assistant",
      projectId: "",
      projectName: "",
      productionId: "",
      runId: "",
      versionLabel: "",
      reviewStatus: "NOT_REVIEWED",
      qcOverall: null,
      creativeScore: buildCreativeScore(null),
      attentionItems: [],
      feedback: [],
      timestampComments: [],
      notes: [],
      selectedSceneId: null,
      videoAvailable: false,
      packageId: null,
      explanation: "No production is loaded in the Creative Review Center. Complete Phase 5 first.",
    };
  }
  const issues = state.attention.filter((a) => a.severity !== "ok");
  const comments = state.timestampComments.map((c) => `${c.timestampSec.toFixed(1)}s: ${c.comment}`).join("; ");
  return {
    version: 1,
    step: "phase-6-step-2-ai-assistant",
    projectId: state.projectId,
    projectName: state.projectName,
    productionId: state.productionId,
    runId: state.runId,
    versionLabel: state.versionLabel,
    reviewStatus: state.reviewStatus,
    qcOverall: state.qc?.overall ?? null,
    creativeScore: state.creativeScore,
    attentionItems: state.attention,
    feedback: state.feedback,
    timestampComments: state.timestampComments,
    notes: state.notes,
    selectedSceneId: state.selectedSceneId,
    videoAvailable: Boolean(state.video.path),
    packageId: state.packageId || null,
    explanation: [
      `Reviewing ${state.projectName} production ${state.productionId} version ${state.versionLabel}.`,
      `Review status: ${state.reviewStatus}. QC: ${state.qc?.overall ?? "NOT AVAILABLE"}.`,
      `Creative score: ${state.creativeScore.label}.`,
      issues.length ? `Needs attention: ${issues.map((i) => i.message).join(" | ")}.` : "No critical attention items.",
      state.selectedSceneId ? `Selected scene: ${state.selectedSceneId}.` : "",
      comments ? `Timestamp comments: ${comments}.` : "No timestamp comments yet.",
      state.feedback.length ? `${state.feedback.length} change request(s) saved.` : "",
      "Full AI Creative Assistant answers belong to Phase 6 Step 2 — this is the data contract only.",
    ].filter(Boolean).join(" "),
  };
}

export function formatClock(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
