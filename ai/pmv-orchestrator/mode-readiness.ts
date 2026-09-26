/**
 * Phase 10 — executable readiness for every capability a PMV mode can need.
 * Admin-routed capabilities come from CapabilityRuntime.readiness (mapping + adapter + vault secret +
 * recorded provider health); internal ones from the host systems. Never exposes providers or models.
 */
import type { CapabilityRuntime } from "../admin-control-plane/capability-runtime.js";
import {
  allModeCapabilities,
  PMV_CAPABILITY_SOURCE,
  type CapabilityReadiness,
  type CapabilityReadinessMap,
  type PmvModeCapability,
} from "../pmv-shared/video-mode-resolver.js";

export interface ModeReadinessDeps {
  runtime: () => CapabilityRuntime | null;
  /** FFmpeg (or the configured renderer) can produce the final MP4. */
  rendererAvailable: () => Promise<boolean>;
  productIntelligenceAvailable: () => boolean;
  /** The render pipeline's image-to-video client can run a clip (in addition to Admin readiness). */
  imageToVideoPipelineReady: () => Promise<boolean>;
}

export type ModeReadinessProbe = () => Promise<CapabilityReadinessMap>;

function ready(capability: PmvModeCapability, executable: boolean, notReadyState: CapabilityReadiness["state"] = "NOT_CONFIGURED"): CapabilityReadiness {
  return { capability, state: executable ? "READY" : notReadyState, executable };
}

export function createModeReadinessProbe(deps: ModeReadinessDeps): ModeReadinessProbe {
  return async () => {
    const runtime = deps.runtime();
    const renderer = await deps.rendererAvailable().catch(() => false);
    const map: CapabilityReadinessMap = {};
    for (const capability of allModeCapabilities()) {
      const source = PMV_CAPABILITY_SOURCE[capability];
      if (source.kind === "NOT_BUILT") {
        map[capability] = { capability, state: "NOT_BUILT", executable: false };
        continue;
      }
      if (source.kind === "INTERNAL") {
        if (capability === "VIDEO_RENDERING" || capability === "TEXT_RENDERING") map[capability] = ready(capability, renderer, "NOT_IMPLEMENTED");
        else if (capability === "PRODUCT_INTELLIGENCE") map[capability] = ready(capability, deps.productIntelligenceAvailable(), "NOT_IMPLEMENTED");
        else map[capability] = ready(capability, true);
        continue;
      }
      const admin = runtime ? runtime.readiness(source.adminFeature!) : null;
      let readiness: CapabilityReadiness = admin
        ? { capability, state: admin.state, executable: admin.executable }
        : { capability, state: "NOT_CONFIGURED", executable: false };
      if (capability === "VIDEO_IMAGE_TO_VIDEO" && readiness.executable) {
        const pipeline = await deps.imageToVideoPipelineReady().catch(() => false);
        if (!pipeline) readiness = { capability, state: "NOT_IMPLEMENTED", executable: false };
      }
      map[capability] = readiness;
    }
    return map;
  };
}
