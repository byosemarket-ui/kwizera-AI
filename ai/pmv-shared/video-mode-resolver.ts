/**
 * Phase 10 — PMV video-mode resolver and the one execution contract all three modes share.
 * Pure: it decides the production route from capability readiness supplied by the server
 * (CapabilityRuntime / Admin Feature Mapping); it never executes generation or calls providers.
 */
import { resolvePmvDestination, sceneBudgetSeconds, validateDuration, type PmvPlatform } from "./destination.js";
import {
  PMV_VIDEO_MODE_COPY,
  PMV_VIDEO_MODES,
  productionModeForVideoMode,
  type PmvVideoMode,
} from "./modes.js";
import type { ProductionModeId } from "../video-production/production-mode-types.js";

/** Capabilities a PMV mode can depend on. Admin-routed ones are asked for by capability, never by provider or model. */
export type PmvModeCapability =
  | "PRODUCT_INTELLIGENCE"
  | "PRODUCT_IDENTITY_LOCK"
  | "CREATIVE_REASONING"
  | "TEXT_RENDERING"
  | "VIDEO_RENDERING"
  | "QA"
  | "PRODUCT_3D_GENERATION"
  | "VIDEO_IMAGE_TO_VIDEO"
  | "IMAGE_SEGMENTATION"
  | "IMAGE_EDITING"
  | "IMAGE_ENHANCEMENT"
  | "MUSIC_GENERATION"
  | "TEXT_TO_SPEECH"
  | "AUDIO_INTELLIGENCE"
  | "BEAT_SYNC";

/**
 * How a capability is satisfied:
 * - INTERNAL: in-house deterministic system (or host tooling) — readiness comes from the server.
 * - ADMIN: Admin Feature Mapping key executed through CapabilityRuntime.
 * - NOT_BUILT: no PMV pipeline stage exists yet, so it can never be READY whatever Admin maps.
 */
export const PMV_CAPABILITY_SOURCE: Record<PmvModeCapability, { kind: "INTERNAL" | "ADMIN" | "NOT_BUILT"; adminFeature?: string }> = {
  PRODUCT_INTELLIGENCE: { kind: "INTERNAL" },
  PRODUCT_IDENTITY_LOCK: { kind: "INTERNAL" },
  CREATIVE_REASONING: { kind: "ADMIN", adminFeature: "CREATIVE_REASONING" },
  TEXT_RENDERING: { kind: "INTERNAL" },
  VIDEO_RENDERING: { kind: "INTERNAL" },
  QA: { kind: "INTERNAL" },
  PRODUCT_3D_GENERATION: { kind: "NOT_BUILT", adminFeature: "PRODUCT_3D_GENERATION" },
  VIDEO_IMAGE_TO_VIDEO: { kind: "ADMIN", adminFeature: "VIDEO_IMAGE_TO_VIDEO" },
  IMAGE_SEGMENTATION: { kind: "ADMIN", adminFeature: "IMAGE_SEGMENTATION" },
  IMAGE_EDITING: { kind: "ADMIN", adminFeature: "IMAGE_EDITING" },
  IMAGE_ENHANCEMENT: { kind: "ADMIN", adminFeature: "IMAGE_UPSCALE" },
  MUSIC_GENERATION: { kind: "ADMIN", adminFeature: "MUSIC_GENERATION" },
  TEXT_TO_SPEECH: { kind: "ADMIN", adminFeature: "TEXT_TO_SPEECH" },
  AUDIO_INTELLIGENCE: { kind: "INTERNAL" },
  BEAT_SYNC: { kind: "INTERNAL" },
};

export const PMV_MODE_REQUIREMENTS: Record<PmvVideoMode, { required: PmvModeCapability[]; optional: PmvModeCapability[] }> = {
  PRODUCT_SLIDESHOW: {
    // Creative reasoning improves the plan when Admin routes it; the deterministic planner covers it otherwise.
    required: ["PRODUCT_INTELLIGENCE", "TEXT_RENDERING", "VIDEO_RENDERING", "QA"],
    optional: ["CREATIVE_REASONING", "TEXT_TO_SPEECH", "MUSIC_GENERATION", "AUDIO_INTELLIGENCE", "BEAT_SYNC"],
  },
  PRODUCT_3D_SHOWCASE: {
    required: ["PRODUCT_INTELLIGENCE", "PRODUCT_IDENTITY_LOCK", "PRODUCT_3D_GENERATION", "VIDEO_RENDERING", "QA"],
    optional: ["MUSIC_GENERATION", "TEXT_TO_SPEECH", "AUDIO_INTELLIGENCE", "BEAT_SYNC"],
  },
  CINEMATIC_AI: {
    required: ["PRODUCT_INTELLIGENCE", "PRODUCT_IDENTITY_LOCK", "CREATIVE_REASONING", "VIDEO_IMAGE_TO_VIDEO", "VIDEO_RENDERING", "QA"],
    optional: ["IMAGE_SEGMENTATION", "IMAGE_EDITING", "IMAGE_ENHANCEMENT", "MUSIC_GENERATION", "TEXT_TO_SPEECH", "AUDIO_INTELLIGENCE", "BEAT_SYNC"],
  },
};

/** Why a capability is or is not executable right now (internal; never shown to customers). */
export type CapabilityReadinessState =
  | "READY"
  | "NOT_CONFIGURED"
  | "DISABLED"
  | "NOT_IMPLEMENTED"
  | "CREDENTIAL_MISSING"
  | "AUTH_FAILED"
  | "PROVIDER_ERROR"
  | "UNVERIFIED"
  | "NOT_BUILT";

export interface CapabilityReadiness {
  capability: PmvModeCapability;
  state: CapabilityReadinessState;
  executable: boolean;
}

export type CapabilityReadinessMap = Partial<Record<PmvModeCapability, CapabilityReadiness>>;

export type PmvModeAvailabilityState = "READY" | "UNAVAILABLE" | "COMING_SOON";

export type SceneStrategy = "SLIDESHOW_STILLS" | "THREE_D_ASSET" | "GENERATIVE_IMAGE_TO_VIDEO";

export interface VideoModeResolution {
  mode: PmvVideoMode;
  requiredCapabilities: PmvModeCapability[];
  optionalCapabilities: PmvModeCapability[];
  readiness: CapabilityReadiness[];
  unavailableCapabilities: PmvModeCapability[];
  /** Optional capabilities that can execute now (only these may ever run for this mode). */
  enabledOptionalCapabilities: PmvModeCapability[];
  sceneStrategy: SceneStrategy;
  renderEngine: ProductionModeId | null;
  /** Deterministic slideshow may run without optional AI; the other modes never degrade into another mode. */
  fallbackPolicy: "DETERMINISTIC_BASELINE" | "NO_SILENT_FALLBACK";
  availability: PmvModeAvailabilityState;
  /** Customer-safe explanation when not READY. */
  customerMessage: string | null;
}

const SCENE_STRATEGY: Record<PmvVideoMode, SceneStrategy> = {
  PRODUCT_SLIDESHOW: "SLIDESHOW_STILLS",
  PRODUCT_3D_SHOWCASE: "THREE_D_ASSET",
  CINEMATIC_AI: "GENERATIVE_IMAGE_TO_VIDEO",
};

function readinessFor(capability: PmvModeCapability, map: CapabilityReadinessMap): CapabilityReadiness {
  if (PMV_CAPABILITY_SOURCE[capability].kind === "NOT_BUILT") return { capability, state: "NOT_BUILT", executable: false };
  return map[capability] ?? { capability, state: "NOT_CONFIGURED", executable: false };
}

/** Decide the production route for a mode. Does not execute anything. */
export function resolveVideoMode(mode: PmvVideoMode, readinessMap: CapabilityReadinessMap): VideoModeResolution {
  const { required, optional } = PMV_MODE_REQUIREMENTS[mode];
  const readiness = [...required, ...optional].map((cap) => readinessFor(cap, readinessMap));
  const byCap = new Map(readiness.map((r) => [r.capability, r]));
  const unavailable = required.filter((cap) => !byCap.get(cap)!.executable);
  const notBuilt = unavailable.some((cap) => byCap.get(cap)!.state === "NOT_BUILT");
  const availability: PmvModeAvailabilityState = unavailable.length === 0 ? "READY" : notBuilt ? "COMING_SOON" : "UNAVAILABLE";
  return {
    mode,
    requiredCapabilities: [...required],
    optionalCapabilities: [...optional],
    readiness,
    unavailableCapabilities: unavailable,
    enabledOptionalCapabilities: optional.filter((cap) => byCap.get(cap)!.executable),
    sceneStrategy: SCENE_STRATEGY[mode],
    renderEngine: productionModeForVideoMode(mode),
    fallbackPolicy: mode === "PRODUCT_SLIDESHOW" ? "DETERMINISTIC_BASELINE" : "NO_SILENT_FALLBACK",
    availability,
    customerMessage: availability === "READY"
      ? null
      : availability === "COMING_SOON"
        ? `${PMV_VIDEO_MODE_COPY[mode].label} is coming soon.`
        : `${PMV_VIDEO_MODE_COPY[mode].label} is not available yet. Choose another video style.`,
  };
}

/** Customer-safe availability card data — labels and states only, never capabilities, providers or models. */
export interface PmvModeAvailability {
  mode: PmvVideoMode;
  label: string;
  description: string;
  availability: PmvModeAvailabilityState;
  selectable: boolean;
  note: string | null;
}

export function toCustomerModeAvailability(resolution: VideoModeResolution): PmvModeAvailability {
  const copy = PMV_VIDEO_MODE_COPY[resolution.mode];
  return {
    mode: resolution.mode,
    label: copy.label,
    description: copy.description,
    availability: resolution.availability,
    selectable: resolution.availability === "READY",
    note: resolution.availability === "READY" ? null : resolution.availability === "COMING_SOON" ? "Coming soon" : "Not available yet",
  };
}

export function listModeAvailability(readinessMap: CapabilityReadinessMap): PmvModeAvailability[] {
  return PMV_VIDEO_MODES.map((mode) => toCustomerModeAvailability(resolveVideoMode(mode, readinessMap)));
}

/** Every capability any mode may need — the server probes exactly this set. */
export function allModeCapabilities(): PmvModeCapability[] {
  const caps = new Set<PmvModeCapability>();
  for (const mode of PMV_VIDEO_MODES) {
    for (const cap of [...PMV_MODE_REQUIREMENTS[mode].required, ...PMV_MODE_REQUIREMENTS[mode].optional]) caps.add(cap);
  }
  return [...caps];
}

/* —— Shared execution contract —— */

export interface ProductionConfigurationInput {
  projectId: string;
  mode: PmvVideoMode;
  sourceAssetIds: string[];
  heroAssetId: string | null;
  identityLock: { version: string | null; status: string | null };
  platform: PmvPlatform | null;
  aspectRatio: string;
  projectPlatform: string | null;
  durationSeconds: number;
  audio: { selectedAudioAssetId: string | null; beatSyncMode: string; volume: number | null };
  voice: { narrationRequested: boolean };
  creativePlan: { id: string | null; version: number | null };
  creativeRequest: string;
}

export interface VideoModeExecutionPlan {
  mode: PmvVideoMode;
  projectId: string;
  productProjectId: string;
  sourceAssets: { assetIds: string[]; heroAssetId: string | null };
  productIdentityLock: { version: string | null; status: string | null; enforced: true };
  platform: PmvPlatform;
  output: { aspectRatio: string; width: number; height: number; profileId: string; formatAdjusted: boolean };
  duration: { totalSeconds: number; sceneBudgetSeconds: number; problem: string | null };
  audio: {
    selectedAudioAssetId: string | null;
    beatSync: string;
    volume: number | null;
    musicGeneration: boolean;
  };
  voice: { narration: boolean };
  creativePlan: { id: string | null; version: number | null };
  requiredCapabilities: PmvModeCapability[];
  optionalCapabilities: PmvModeCapability[];
  capabilityReadiness: CapabilityReadiness[];
  sceneStrategy: SceneStrategy;
  audioStrategy: "SELECTED_TRACK" | "NO_MUSIC";
  timelineStrategy: "SHARED_TIMELINE";
  renderStrategy: { engine: ProductionModeId | null; generative: boolean };
  qaStrategy: { expectedMode: PmvVideoMode; checks: string[] };
  fallbackPolicy: VideoModeResolution["fallbackPolicy"];
  availability: PmvModeAvailabilityState;
  customerMessage: string | null;
}

const QA_CHECKS: Record<PmvVideoMode, string[]> = {
  PRODUCT_SLIDESHOW: ["SOURCE_IMAGE_FIDELITY", "TEXT", "TIMING", "BRANDING", "AUDIO", "COMPOSITION"],
  PRODUCT_3D_SHOWCASE: ["PRODUCT_IDENTITY", "GEOMETRY_CONSISTENCY", "CAMERA_MOTION", "COMPOSITION", "BRANDING", "AUDIO"],
  CINEMATIC_AI: ["PRODUCT_IDENTITY", "SCENE_CONSISTENCY", "GENERATED_MOTION", "TEXT", "BRANDING", "AUDIO", "TIMING"],
};

/**
 * One plan for all modes: the Phase 9 production configuration (platform, output, duration, audio)
 * plus the mode route. Only the scene strategy and render engine differ between modes.
 */
export function buildVideoModeExecutionPlan(
  config: ProductionConfigurationInput,
  readinessMap: CapabilityReadinessMap,
): VideoModeExecutionPlan {
  const resolution = resolveVideoMode(config.mode, readinessMap);
  const destination = resolvePmvDestination(config.platform, config.aspectRatio, config.projectPlatform);
  const durationProblem = validateDuration(config.durationSeconds, destination, config.mode);
  const optional = new Set(resolution.enabledOptionalCapabilities);
  return {
    mode: config.mode,
    projectId: config.projectId,
    productProjectId: config.projectId,
    sourceAssets: { assetIds: [...config.sourceAssetIds], heroAssetId: config.heroAssetId },
    productIdentityLock: { version: config.identityLock.version, status: config.identityLock.status, enforced: true },
    platform: destination.platform,
    output: {
      aspectRatio: destination.format.aspectRatio,
      width: destination.profile.width,
      height: destination.profile.height,
      profileId: destination.profile.id,
      formatAdjusted: destination.formatAdjusted,
    },
    duration: {
      totalSeconds: config.durationSeconds,
      sceneBudgetSeconds: sceneBudgetSeconds(config.durationSeconds, config.mode),
      problem: durationProblem,
    },
    audio: {
      selectedAudioAssetId: config.audio.selectedAudioAssetId,
      beatSync: config.audio.selectedAudioAssetId ? config.audio.beatSyncMode : "OFF",
      volume: config.audio.volume,
      // Generated music runs only when the customer asked for it in the existing AI music flow.
      musicGeneration: false,
    },
    voice: { narration: config.voice.narrationRequested && optional.has("TEXT_TO_SPEECH") },
    creativePlan: { ...config.creativePlan },
    requiredCapabilities: resolution.requiredCapabilities,
    optionalCapabilities: resolution.optionalCapabilities,
    capabilityReadiness: resolution.readiness,
    sceneStrategy: resolution.sceneStrategy,
    audioStrategy: config.audio.selectedAudioAssetId ? "SELECTED_TRACK" : "NO_MUSIC",
    timelineStrategy: "SHARED_TIMELINE",
    renderStrategy: { engine: resolution.renderEngine, generative: resolution.sceneStrategy === "GENERATIVE_IMAGE_TO_VIDEO" },
    qaStrategy: { expectedMode: config.mode, checks: QA_CHECKS[config.mode] },
    fallbackPolicy: resolution.fallbackPolicy,
    availability: resolution.availability,
    customerMessage: resolution.customerMessage,
  };
}
