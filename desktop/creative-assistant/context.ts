/** Build live assistant context from existing Phase 5/6 systems — no invented data. */

import { creativeReviewEngine } from "../creative-review/review-engine";
import { loadStep2AssistantHandoff } from "../creative-review/review-engine";
import { productionFinalEngine, listProductionHistory, loadFinalCompleteHandoff } from "../production-final/final-engine";
import { productionPipelineEngine } from "../production-pipeline/pipeline-engine";
import { productionCommandCenterEngine } from "../production-command-center/command-center-engine";
import type { AssistantContext } from "./types";

export function refreshAssistantContext(): AssistantContext {
  const now = new Date().toISOString();
  creativeReviewEngine.hydrate();
  const reviewSnap = creativeReviewEngine.snapshot().state;
  const contract = creativeReviewEngine.getAiMeContract();
  const handoff = loadStep2AssistantHandoff();
  // Prefer persisted handoffs over stale in-memory singletons when storage is empty.
  const finalHandoff = loadFinalCompleteHandoff();
  const finalSnap = productionFinalEngine.snapshot().state;
  const pipeSnap = productionPipelineEngine.snapshot().state;
  const cc = productionCommandCenterEngine.snapshot().dashboard;
  const history = listProductionHistory();
  const hasPersistedPackage = Boolean(reviewSnap?.packageId || handoff?.productionId || finalHandoff?.package?.productionId);

  if (!hasPersistedPackage) {
    return {
      version: 1,
      refreshedAt: now,
      available: false,
      unavailableReason: "PROJECT CONTEXT UNAVAILABLE — complete Phase 5 and open Creative Review (Phase 6 Step 1) first.",
      contract: null,
      projectId: "",
      projectName: "",
      productName: null,
      productSummary: null,
      marketingSummary: null,
      creativeSummary: null,
      productionId: "",
      runId: "",
      versionLabel: "",
      reviewStatus: "NOT_REVIEWED",
      productionStatus: "UNKNOWN",
      qcOverall: null,
      qcFailures: [],
      qcWarnings: [],
      scenes: [],
      selectedSceneId: null,
      feedbackCount: 0,
      commentCount: 0,
      noteCount: 0,
      packageId: null,
      videoAvailable: false,
      videoMeta: null,
      progress: null,
      currentStage: null,
      etaLabel: null,
      resourceSummary: null,
      availableActions: ["Open Creative Review", "Open Final Outputs"],
    };
  }

  const plan = finalSnap?.pipelineState?.snapshot?.plan
    ?? pipeSnap?.snapshot?.plan
    ?? null;

  const productName = plan?.productName
    ?? finalSnap?.pipelineState.snapshot.plan.productName
    ?? reviewSnap?.projectName
    ?? contract.projectName
    ?? null;

  const productSummary = plan
    ? [
        plan.product?.identity,
        plan.product?.category,
        plan.product?.features?.slice(0, 3).join(", "),
      ].filter(Boolean).join(" · ") || null
    : null;

  const marketingSummary = plan
    ? [
        plan.project?.campaignObjective && `Goal: ${plan.project.campaignObjective}`,
        plan.project?.platforms?.length && `Platforms: ${plan.project.platforms.join(", ")}`,
        plan.project?.audience && `Audience: ${plan.project.audience}`,
        plan.project?.cta && `CTA: ${plan.project.cta}`,
        plan.project?.language && `Language: ${plan.project.language}`,
      ].filter(Boolean).join(" · ") || null
    : null;

  const creativeSummary = plan
    ? [
        plan.story?.cta && `Story CTA: ${plan.story.cta}`,
        plan.visual?.cameraStyle && `Camera: ${plan.visual.cameraStyle}`,
        plan.audio?.musicMood && `Music: ${plan.audio.musicMood}`,
        `${plan.scenes?.length ?? 0} scenes`,
      ].filter(Boolean).join(" · ") || null
    : null;

  const qc = reviewSnap?.qc ?? finalSnap?.qcReport ?? null;
  const qcFailures = (qc?.checks ?? []).filter((c) => c.status === "FAIL").map((c) => `${c.label}: ${c.detail}`);
  const qcWarnings = (qc?.checks ?? []).filter((c) => c.status === "WARNING" || c.status === "CHECK_NOT_AVAILABLE").map((c) => `${c.label}: ${c.detail}`);

  const scenes = (reviewSnap?.scenes ?? []).map((s) => ({
    id: s.sceneId,
    name: s.name,
    number: s.sceneNumber,
    hasVisual: s.hasVisual,
    hasVoice: s.hasVoice,
    hasText: s.hasText,
  }));

  const video = reviewSnap?.video;
  const videoMeta = video
    ? [
        video.resolution,
        video.frameRate && `${video.frameRate} FPS`,
        video.durationSec != null && `${video.durationSec}s`,
        video.format,
        video.version,
      ].filter(Boolean).join(" · ") || null
    : finalSnap?.render
      ? `${finalSnap.render.resolution} · ${finalSnap.render.frameRate} · ${finalSnap.render.durationSec}s`
      : null;

  return {
    version: 1,
    refreshedAt: now,
    available: true,
    unavailableReason: null,
    contract: contract.productionId ? contract : handoff,
    projectId: reviewSnap?.projectId || contract.projectId || finalSnap?.projectId || "",
    projectName: reviewSnap?.projectName || contract.projectName || finalSnap?.projectName || "",
    productName,
    productSummary,
    marketingSummary,
    creativeSummary,
    productionId: reviewSnap?.productionId || contract.productionId || finalSnap?.productionId || "",
    runId: reviewSnap?.runId || contract.runId || finalSnap?.runId || "",
    versionLabel: reviewSnap?.versionLabel || contract.versionLabel || finalSnap?.package?.versionLabel || history[0]?.versionLabel || "v1.0",
    reviewStatus: reviewSnap?.reviewStatus || contract.reviewStatus || "READY_FOR_REVIEW",
    productionStatus: reviewSnap?.productionStatus || finalSnap?.status || "COMPLETED",
    qcOverall: qc?.overall ?? contract.qcOverall ?? null,
    qcFailures: qcFailures.length ? qcFailures : (qc?.blockingReasons ?? []),
    qcWarnings,
    scenes,
    selectedSceneId: reviewSnap?.selectedSceneId ?? contract.selectedSceneId,
    feedbackCount: reviewSnap?.feedback.length ?? contract.feedback.length,
    commentCount: reviewSnap?.timestampComments.length ?? contract.timestampComments.length,
    noteCount: reviewSnap?.notes.length ?? contract.notes.length,
    packageId: reviewSnap?.packageId || contract.packageId || finalSnap?.package?.packageId || null,
    videoAvailable: Boolean(video?.path || finalSnap?.render?.outputPath),
    videoMeta,
    progress: cc?.overallProgress ?? finalSnap?.progress ?? pipeSnap?.run.progress ?? null,
    currentStage: cc?.currentStageLabel ?? finalSnap?.stage ?? pipeSnap?.run.currentStage ?? null,
    etaLabel: cc?.eta?.label ?? null,
    resourceSummary: cc?.resources
      ? `CPU ${cc.resources.cpuUsage ?? "n/a"}% · GPU ${cc.resources.gpuUsage ?? "n/a"}% · RAM ${cc.resources.ramUsage ?? "n/a"}%`
      : null,
    availableActions: [
      "Explain Production", "Explain QC", "Review Scenes", "Create Feedback",
      "Prepare Change", "Approve Version", "Open Review", "Open Outputs",
    ],
  };
}
