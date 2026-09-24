/**
 * Phase 6 — route QA failures to the smallest responsible subsystem.
 * Does not invent new engines; maps to existing scene regen / audio / timeline / render paths.
 */

import type { PmvVideoQaResult } from "./types";

export type PmvQaFailureDomain =
  | "none"
  | "scene"
  | "product_identity"
  | "audio"
  | "timeline"
  | "text"
  | "branding"
  | "render";

export interface PmvQaFailureRoute {
  domain: PmvQaFailureDomain;
  sceneId: string | null;
  recommendedAction: string;
  customerMessage: string;
}

export function classifyPmvQaFailure(qa: PmvVideoQaResult): PmvQaFailureRoute {
  const failedScene = qa.scenes.find((s) => s.status === "FAIL");
  if (failedScene) {
    return {
      domain: "scene",
      sceneId: failedScene.sceneId,
      recommendedAction: `Regenerate only scene ${failedScene.order} (${failedScene.sceneId}).`,
      customerMessage: "Video needs another improvement pass on one scene.",
    };
  }

  if (qa.technicalStatus === "FAIL") {
    return {
      domain: "render",
      sceneId: null,
      recommendedAction: "Re-render the final video after correcting the technical issue.",
      customerMessage: "Video needs another improvement pass.",
    };
  }

  if (qa.productIdentityStatus === "FAIL") {
    return {
      domain: "product_identity",
      sceneId: null,
      recommendedAction: "Refresh Product Identity Lock or regenerate affected scenes with stronger identity constraints.",
      customerMessage: "Video needs another improvement pass to protect the real product.",
    };
  }

  if (qa.audioStatus === "FAIL" || qa.failures.some((f) => /audio/i.test(f))) {
    return {
      domain: "audio",
      sceneId: null,
      recommendedAction: "Rebuild audio mix / remux without regenerating video scenes.",
      customerMessage: "Video needs another improvement pass on audio.",
    };
  }

  if (qa.textStatus === "FAIL") {
    return {
      domain: "text",
      sceneId: null,
      recommendedAction: "Rebuild timeline typography with approved CTA/text.",
      customerMessage: "Video needs another improvement pass on text.",
    };
  }

  if (qa.brandingStatus === "FAIL") {
    return {
      domain: "branding",
      sceneId: null,
      recommendedAction: "Rebuild branding/end-card from verified brand and contact fields.",
      customerMessage: "Video needs another improvement pass on branding.",
    };
  }

  if (qa.timingStatus === "FAIL" || qa.failures.some((f) => /timeline|duration/i.test(f))) {
    return {
      domain: "timeline",
      sceneId: null,
      recommendedAction: "Rebuild timeline timing without regenerating I2V scenes.",
      customerMessage: "Video needs another improvement pass on timing.",
    };
  }

  if (qa.overallStatus === "QA_PASSED") {
    return {
      domain: "none",
      sceneId: null,
      recommendedAction: "Ready for delivery.",
      customerMessage: "Quality checks passed.",
    };
  }

  return {
    domain: "product_identity",
    sceneId: null,
    recommendedAction: qa.recommendedActions[0] ?? "Review uncertain QA checks before delivery.",
    customerMessage: "Video needs another improvement pass.",
  };
}
