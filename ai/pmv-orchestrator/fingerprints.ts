/**
 * Phase 8 — per-step input fingerprints for idempotency and smallest-scope invalidation.
 * Each step fingerprint folds in its upstream fingerprints, so a change cascades only downstream:
 *   product images  → intelligence, lock, plan, scenes, timeline, render, QA, delivery
 *   CTA / brand text → timeline, render, QA, delivery
 *   music           → audio, timeline, render, QA, delivery
 */
import { createHash } from "node:crypto";
import type { WorkflowStepId } from "./types.js";

export interface FingerprintInputs {
  assetFingerprint: string;
  lockVersion: string | null;
  lockStatus: string | null;
  mode: string;
  creativeTone: string;
  durationSeconds: number;
  aspectRatio: string;
  creativeRequest: string;
  text: {
    brandName: string;
    cta: string;
    website: string;
    phone: string;
    logoAssetId: string | null;
    language: string;
  };
  audio: {
    selectedAudioAssetId: string | null;
    beatSyncMode: string;
    audioVolume: number | null;
  };
  planId: string | null;
  planVersion: number | null;
}

function h(...parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

export function computeStepFingerprints(input: FingerprintInputs): Record<WorkflowStepId, string> {
  const intelligence = h("pi", input.assetFingerprint);
  const lock = h("lock", intelligence);
  const plan = h("plan", lock, input.lockVersion, input.mode, input.creativeTone, input.durationSeconds, input.aspectRatio);
  const planRef = h("planRef", plan, input.planId, input.planVersion);
  const media = h("media", planRef, input.creativeRequest);
  const scenes = h("scenes", media);
  const audio = h("audio", input.audio.selectedAudioAssetId, input.audio.beatSyncMode, input.audio.audioVolume);
  const timeline = h("timeline", planRef, audio, input.text);
  const render = h("render", timeline, scenes);
  const qa = h("qa", render);
  return {
    PRODUCT_INTELLIGENCE: intelligence,
    PRODUCT_LOCK: lock,
    CREATIVE_PLANNING: plan,
    MEDIA_PREPARATION: media,
    VIDEO_GENERATION: scenes,
    AUDIO: audio,
    TIMELINE: timeline,
    RENDER: render,
    QA: qa,
    REPAIR: qa,
    DELIVERY: h("delivery", qa),
  };
}
