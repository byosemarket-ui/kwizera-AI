/**
 * PMV generation mode ↔ production mode mapping.
 * Shared by the Studio UI and the server-side PMV workflow orchestrator.
 */
import type { ProductionModeId } from "../video-production/production-mode-types.js";

export type PmvGenerationMode =
  | "EXACT_PRODUCT"
  | "CINEMATIC"
  | "ADVANCED_CREATIVE";

export function mapPmvModeToProduction(mode: PmvGenerationMode): ProductionModeId {
  if (mode === "CINEMATIC") return "CINEMATIC_3D";
  if (mode === "ADVANCED_CREATIVE") return "CLASSIC_SHOWCASE";
  return "AI_PRODUCT_MOTION";
}

export function mapProductionToPmvMode(mode: ProductionModeId | null | undefined): PmvGenerationMode {
  if (mode === "CINEMATIC_3D") return "CINEMATIC";
  if (mode === "CLASSIC_SHOWCASE") return "ADVANCED_CREATIVE";
  return "EXACT_PRODUCT";
}
