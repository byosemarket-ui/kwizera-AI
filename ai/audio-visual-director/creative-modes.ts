/**
 * STEP 2F — Creative mode policies (deterministic).
 */
import type { AvCreativeMode } from "./types.js";

export interface CreativeModePolicy {
  mode: AvCreativeMode;
  cutDensity: number;
  motionScale: number;
  cameraScale: number;
  transitionFadeBias: number;
  beatSensitivity: number;
  energySensitivity: number;
  textDurationScale: number;
  ctaHoldScale: number;
  revealBias: "immediate" | "beat" | "cinematic" | "gradual";
}

export function policyForMode(mode: AvCreativeMode): CreativeModePolicy {
  switch (mode) {
    case "CALM":
      return {
        mode, cutDensity: 0.35, motionScale: 0.45, cameraScale: 0.4,
        transitionFadeBias: 0.85, beatSensitivity: 0.35, energySensitivity: 0.4,
        textDurationScale: 1.2, ctaHoldScale: 1.15, revealBias: "gradual",
      };
    case "CINEMATIC":
      return {
        mode, cutDensity: 0.4, motionScale: 0.5, cameraScale: 0.45,
        transitionFadeBias: 0.9, beatSensitivity: 0.4, energySensitivity: 0.45,
        textDurationScale: 1.25, ctaHoldScale: 1.2, revealBias: "cinematic",
      };
    case "PRODUCT_FOCUSED":
      return {
        mode, cutDensity: 0.45, motionScale: 0.55, cameraScale: 0.5,
        transitionFadeBias: 0.7, beatSensitivity: 0.5, energySensitivity: 0.5,
        textDurationScale: 1.15, ctaHoldScale: 1.2, revealBias: "immediate",
      };
    case "ENERGETIC":
      return {
        mode, cutDensity: 0.7, motionScale: 0.9, cameraScale: 0.85,
        transitionFadeBias: 0.25, beatSensitivity: 0.85, energySensitivity: 0.9,
        textDurationScale: 1.0, ctaHoldScale: 1.0, revealBias: "beat",
      };
    case "AGGRESSIVE":
      return {
        mode, cutDensity: 0.85, motionScale: 1.0, cameraScale: 0.95,
        transitionFadeBias: 0.15, beatSensitivity: 0.95, energySensitivity: 1.0,
        textDurationScale: 0.95, ctaHoldScale: 1.0, revealBias: "beat",
      };
    case "CUSTOM":
    case "BALANCED":
    default:
      return {
        mode: mode === "CUSTOM" ? "CUSTOM" : "BALANCED",
        cutDensity: 0.55, motionScale: 0.7, cameraScale: 0.65,
        transitionFadeBias: 0.55, beatSensitivity: 0.65, energySensitivity: 0.65,
        textDurationScale: 1.05, ctaHoldScale: 1.1, revealBias: "beat",
      };
  }
}

export function normalizeCreativeMode(raw: unknown): AvCreativeMode {
  const u = String(raw ?? "BALANCED").toUpperCase();
  if (
    u === "CALM" || u === "BALANCED" || u === "ENERGETIC" || u === "AGGRESSIVE"
    || u === "CINEMATIC" || u === "PRODUCT_FOCUSED" || u === "CUSTOM"
  ) return u;
  return "BALANCED";
}
