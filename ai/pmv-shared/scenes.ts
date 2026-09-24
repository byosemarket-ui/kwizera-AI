/**
 * PMV storyboard scene view derived from a Creative Plan.
 * Shared by the Studio UI and the server-side PMV workflow orchestrator.
 */

export interface PmvStoryboardSceneView {
  sceneId: string;
  order: number;
  durationSeconds: number;
  purpose: string;
  visual: string;
  camera: string;
  motion: string;
  transition: string;
  text: string;
  assetId: string | null;
  status: "PLANNED" | "READY" | "GENERATING" | "GENERATED" | "FAILED" | "STALE";
}

/** Structural subset of a Creative Plan scene (server CreativePlan and client DTO both satisfy it). */
export interface PlanSceneLike {
  id: string;
  order: number;
  durationSeconds?: number;
  durationMs?: number;
  purpose?: string;
  beat?: string;
  visual?: string;
  visualPurpose?: string;
  camera?: string;
  cameraDirection?: string;
  motion?: string;
  animation?: string;
  transition?: string;
  text?: string;
  copy?: { headline?: string; callToAction?: string };
  narration?: string;
  assetId?: string | null;
}

export function scenesFromPlan(plan: { scenes?: PlanSceneLike[] } | null): PmvStoryboardSceneView[] {
  if (!plan?.scenes?.length) return [];
  return plan.scenes.map((scene) => ({
    sceneId: scene.id,
    order: scene.order,
    durationSeconds: scene.durationSeconds
      || (scene.durationMs ? Math.round(scene.durationMs / 1000) : 0),
    purpose: scene.purpose || scene.beat || "Scene",
    visual: scene.visual || scene.visualPurpose || "",
    camera: scene.camera || scene.cameraDirection || "",
    motion: scene.motion || scene.animation || "",
    transition: scene.transition || "cut",
    text: scene.text
      || scene.copy?.headline
      || scene.copy?.callToAction
      || scene.narration
      || "",
    assetId: scene.assetId ?? null,
    status: "PLANNED",
  }));
}
