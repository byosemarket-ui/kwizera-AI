/**
 * STEP 2F — AudioVisualQualityGate
 */
import type { AudioVisualCreativePlan, AvQualityGateResult } from "./types.js";

export function runAudioVisualQualityGate(plan: AudioVisualCreativePlan | null | undefined): AvQualityGateResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  if (!plan) {
    return { passed: false, failures: ["Audio-Visual Creative Plan is missing."], warnings };
  }
  if (plan.projectId == null || plan.projectId === "") {
    failures.push("Plan projectId is missing.");
  }
  if (!plan.scenes.length) {
    failures.push("Plan has no scenes — storyboard binding required.");
  }
  const ids = new Set<string>();
  for (const scene of plan.scenes) {
    if (ids.has(scene.sceneId)) failures.push(`Duplicate sceneId: ${scene.sceneId}`);
    ids.add(scene.sceneId);
    if (scene.duration <= 0 || scene.endTime < scene.startTime) {
      failures.push(`Invalid timing for scene ${scene.sceneId}`);
    }
  }
  // Overlaps / gaps (soft gap warning, hard overlap fail)
  const ordered = [...plan.scenes].sort((a, b) => a.startTime - b.startTime);
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!;
    const cur = ordered[i]!;
    if (cur.startTime < prev.endTime - 1) {
      failures.push(`Scene overlap: ${prev.sceneId} / ${cur.sceneId}`);
    } else if (cur.startTime > prev.endTime + 50) {
      warnings.push(`Gap between ${prev.sceneId} and ${cur.sceneId}`);
    }
  }
  for (const win of plan.textSafetyWindows) {
    const scene = plan.scenes.find((s) => s.sceneId === win.sceneId);
    if (!scene) {
      failures.push(`Text safety window references missing scene ${win.sceneId}`);
      continue;
    }
    if (scene.duration + 1 < win.minDurationMs * 0.75) {
      failures.push(`Text window too short for readable ${win.kind} on ${win.sceneId}`);
    }
  }
  for (const cta of plan.CTAEvents) {
    if (cta.endMs - cta.startMs < cta.minReadableMs * 0.75) {
      failures.push("CTA duration below readable minimum.");
    }
  }
  if (plan.endCardTiming) {
    const d = plan.endCardTiming.endMs - plan.endCardTiming.startMs;
    if (d < plan.endCardTiming.minReadableMs * 0.7) {
      failures.push("End card duration below readable minimum.");
    }
  }
  if (plan.audioAssetId && plan.confidence === "LOW" && !plan.fallbackReason) {
    warnings.push("Low confidence without explicit fallback reason.");
  }
  if (!plan.audioAssetId) {
    warnings.push("No audio asset selected — visual-only director plan.");
  }
  return { passed: failures.length === 0, failures, warnings };
}
