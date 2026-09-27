/**
 * Phase 18 — Training & Teaching Center catalog.
 * Every capability is mapped to the Phase 17 knowledge task its runtime actually retrieves, the bounded
 * planner guidance it may carry, and the runtime callers that consume it. Nothing here trains a model.
 */
import type { KnowledgeTask } from "../knowledge-retrieval-engine/knowledge-taxonomy.js";

export const TRAINING_TARGETS = [
  "VIDEO_AI", "AUDIO_AI", "TEXT_AI", "COPYWRITING_AI", "TYPOGRAPHY_AI", "IMAGE_AI",
  "PRODUCT_INTELLIGENCE_AI", "DESIGN_AI", "CODE_AI", "CREATIVE_DIRECTOR_AI",
] as const;
export type TrainingTarget = typeof TRAINING_TARGETS[number];

export const TARGET_LABELS: Record<TrainingTarget, string> = {
  VIDEO_AI: "Video creation",
  AUDIO_AI: "Audio & music",
  TEXT_AI: "Text & writing",
  COPYWRITING_AI: "Advertising copy",
  TYPOGRAPHY_AI: "Typography",
  IMAGE_AI: "Image understanding",
  PRODUCT_INTELLIGENCE_AI: "Product understanding",
  DESIGN_AI: "Graphic design",
  CODE_AI: "Programming assistance",
  CREATIVE_DIRECTOR_AI: "Creative direction",
};

export type TeachingMode = "KNOWLEDGE" | "EXAMPLE" | "STYLE" | "INSTRUCTION" | "MODEL_TRAINING";
export const TEACHING_MODES: TeachingMode[] = ["KNOWLEDGE", "EXAMPLE", "STYLE", "INSTRUCTION", "MODEL_TRAINING"];

export type TrainingStrategy =
  | "KNOWLEDGE_RETRIEVAL" | "RAG" | "PROMPT_CONTEXT" | "EXAMPLE_LIBRARY" | "STYLE_LIBRARY" | "FINE_TUNING" | "MODEL_TRAINING";

export interface StrategyInfo {
  id: TrainingStrategy;
  label: string;
  available: boolean;
  description: string;
  unavailableReason?: string;
}

const NO_TRAINING_INFRA = "This server has no model training or fine-tuning infrastructure (no training runtime, GPU job queue "
  + "or trainable model endpoint is configured). Teaching is delivered through knowledge retrieval instead; no model weights change.";

export const STRATEGIES: Record<TrainingStrategy, StrategyInfo> = {
  KNOWLEDGE_RETRIEVAL: { id: "KNOWLEDGE_RETRIEVAL", label: "Knowledge retrieval", available: true, description: "Indexed in the Knowledge Base and retrieved by task at planning time." },
  RAG: { id: "RAG", label: "Retrieval-augmented context", available: true, description: "Retrieved items are passed to planners as cited, untrusted reference data." },
  PROMPT_CONTEXT: { id: "PROMPT_CONTEXT", label: "Instruction context", available: true, description: "Instructions are retrieved as reference context; bounded guidance values steer deterministic planners." },
  EXAMPLE_LIBRARY: { id: "EXAMPLE_LIBRARY", label: "Example library", available: true, description: "Input/expected-output examples and measured media references become retrievable examples." },
  STYLE_LIBRARY: { id: "STYLE_LIBRARY", label: "Style library", available: true, description: "Style rules become retrievable knowledge and abstract creative patterns for creative planning." },
  FINE_TUNING: { id: "FINE_TUNING", label: "Fine-tuning", available: false, description: "Adjust model weights on a dataset.", unavailableReason: NO_TRAINING_INFRA },
  MODEL_TRAINING: { id: "MODEL_TRAINING", label: "Model training", available: false, description: "Train a model from a dataset.", unavailableReason: NO_TRAINING_INFRA },
};

export const MODE_STRATEGY: Record<TeachingMode, TrainingStrategy[]> = {
  KNOWLEDGE: ["KNOWLEDGE_RETRIEVAL", "RAG"],
  INSTRUCTION: ["PROMPT_CONTEXT", "RAG"],
  EXAMPLE: ["EXAMPLE_LIBRARY", "RAG"],
  STYLE: ["STYLE_LIBRARY", "RAG"],
  MODEL_TRAINING: ["MODEL_TRAINING", "FINE_TUNING"],
};

export const MODE_INFO: Record<TeachingMode, { label: string; description: string; available: boolean; unavailableReason?: string }> = {
  KNOWLEDGE: { label: "Knowledge", description: "Facts, guides and documents the AI can look up.", available: true },
  EXAMPLE: { label: "Examples", description: "Input and desired result pairs, reference media and before/after pairs.", available: true },
  STYLE: { label: "Style", description: "Visual, audio or writing style rules.", available: true },
  INSTRUCTION: { label: "Instructions", description: "Rules the AI should follow for a capability.", available: true },
  MODEL_TRAINING: { label: "Model training / fine-tuning", description: "Change model weights with a dataset.", available: false, unavailableReason: NO_TRAINING_INFRA },
};

export type TrainingScope = "SYSTEM" | "ADMIN" | "BUSINESS" | "CUSTOMER" | "PROJECT";
export const SCOPE_INFO: Record<TrainingScope, { label: string; available: boolean; description: string; unavailableReason?: string }> = {
  SYSTEM: { label: "System (all projects)", available: true, description: "Applies to every project." },
  ADMIN: { label: "Admin (all projects)", available: true, description: "Admin-authored teaching that applies to every project." },
  PROJECT: { label: "One project", available: true, description: "Applies only inside one project; never visible to other projects." },
  BUSINESS: {
    label: "Business", available: false, description: "Applies to one business account.",
    unavailableReason: "Runtime retrieval is scoped by project only; no business account identity reaches the planners yet.",
  },
  CUSTOMER: {
    label: "Customer", available: false, description: "Applies to one customer account.",
    unavailableReason: "Runtime retrieval is scoped by project only; no customer account identity reaches the planners yet.",
  },
};

export interface TeachableGuidanceSpec {
  key: string;
  min: number;
  max: number;
  default: number;
  unit: string;
  label: string;
  integer?: boolean;
}

export const TEACHABLE_GUIDANCE: Record<string, TeachableGuidanceSpec> = {
  "composition.minSafeCoverage": { key: "composition.minSafeCoverage", min: 0.7, max: 0.9, default: 0.8, unit: "share", label: "Minimum kept share of a photo before the full product is shown on an extended canvas" },
  "typography.maxItemsPerScene": { key: "typography.maxItemsPerScene", min: 2, max: 3, default: 3, unit: "items", label: "Maximum text items per scene", integer: true },
  "typography.maxItemsCtaScene": { key: "typography.maxItemsCtaScene", min: 2, max: 4, default: 4, unit: "items", label: "Maximum text items on the closing/CTA scene", integer: true },
  "audio.loopCrossfadeSec": { key: "audio.loopCrossfadeSec", min: 0.03, max: 0.25, default: 0.08, unit: "s", label: "Crossfade when looping music on a beat boundary" },
  "audio.fadeOutSec": { key: "audio.fadeOutSec", min: 1, max: 3, default: 2, unit: "s", label: "Music fade-out length at the end of the video" },
};

/** Guidance specs exactly as each runtime caller resolves them (see video-production-manager). */
export const TASK_RUNTIME_SPECS: Partial<Record<KnowledgeTask, TeachableGuidanceSpec[]>> = {
  PRODUCT_SLIDESHOW: [TEACHABLE_GUIDANCE["composition.minSafeCoverage"]!],
  CINEMATIC_VIDEO: [TEACHABLE_GUIDANCE["composition.minSafeCoverage"]!],
  TYPOGRAPHY_PLAN: [TEACHABLE_GUIDANCE["typography.maxItemsPerScene"]!, TEACHABLE_GUIDANCE["typography.maxItemsCtaScene"]!],
  AUDIO_PLAN: [TEACHABLE_GUIDANCE["audio.loopCrossfadeSec"]!, TEACHABLE_GUIDANCE["audio.fadeOutSec"]!],
};

/** Representative runtime queries (same shape the runtime callers build) used for evaluation and runtime tests. */
export const TASK_RUNTIME_QUERY: Record<KnowledgeTask, string> = {
  PRODUCT_SLIDESHOW: "product slideshow composition crop safe canvas motion scene timing transitions vertical",
  CINEMATIC_VIDEO: "product cinematic video camera movement pacing",
  AUDIO_PLAN: "music loop crossfade fade out beat sync measured tempo bpm",
  TYPOGRAPHY_PLAN: "product video text hierarchy readability contrast placement",
  COPYWRITING: "product advertising copy headline benefit cta",
  IMAGE_UNDERSTANDING: "product image subject background lighting crop",
  CODE_ASSIST: "typescript api function module test security",
  GENERAL: "product",
};

export interface CapabilityDefinition {
  id: string;
  label: string;
  target: TrainingTarget;
  task: KnowledgeTask;
  domain: string;
  guidanceKeys: string[];
  /** Runtime callers that retrieve this task in production. */
  runtimeConsumers: string[];
  /** False when no production code path retrieves this task yet (still stored and searchable). */
  runtimeWired: boolean;
  runtimeNote: string;
  /** Record kinds that make sense for this capability. */
  kinds: TeachingRecordKind[];
}

export type TeachingRecordKind =
  | "TEXT" | "INSTRUCTION" | "EXAMPLE" | "DOCUMENT" | "CODE" | "IMAGE" | "VIDEO" | "AUDIO"
  | "AUDIO_VIDEO_PAIR" | "BEFORE_AFTER" | "EVALUATION_CASE";

export const RECORD_KINDS: TeachingRecordKind[] = [
  "TEXT", "INSTRUCTION", "EXAMPLE", "DOCUMENT", "CODE", "IMAGE", "VIDEO", "AUDIO", "AUDIO_VIDEO_PAIR", "BEFORE_AFTER", "EVALUATION_CASE",
];

const TEXTUAL: TeachingRecordKind[] = ["TEXT", "INSTRUCTION", "EXAMPLE", "DOCUMENT", "EVALUATION_CASE"];

const CREATIVE_PLAN = "Creative Plan (creative-planning)";
const SCENE_PLAN = "Video scene plan (video-production.plan)";

export const CAPABILITIES: CapabilityDefinition[] = [
  {
    id: "PRODUCT_SLIDESHOW", label: "Product slideshow videos", target: "VIDEO_AI", task: "PRODUCT_SLIDESHOW", domain: "PRODUCT_CREATIVE",
    guidanceKeys: ["composition.minSafeCoverage"], runtimeConsumers: [CREATIVE_PLAN, SCENE_PLAN], runtimeWired: true,
    runtimeNote: "Retrieved when a Creative Plan and a video scene plan are created; composition guidance sets the safe-canvas threshold.",
    kinds: [...TEXTUAL, "IMAGE", "VIDEO", "BEFORE_AFTER"],
  },
  {
    id: "CINEMATIC_VIDEO", label: "Cinematic product videos", target: "VIDEO_AI", task: "CINEMATIC_VIDEO", domain: "VIDEO",
    guidanceKeys: ["composition.minSafeCoverage"], runtimeConsumers: [`${CREATIVE_PLAN} — cinematic mode`, `${SCENE_PLAN} — cinematic mode`], runtimeWired: true,
    runtimeNote: "Retrieved for projects in cinematic production mode.",
    kinds: [...TEXTUAL, "VIDEO", "IMAGE"],
  },
  {
    id: "AUDIO_VIDEO_SYNC", label: "Music and video synchronisation", target: "AUDIO_AI", task: "AUDIO_PLAN", domain: "AUDIO",
    guidanceKeys: ["audio.loopCrossfadeSec", "audio.fadeOutSec"], runtimeConsumers: ["Audio fit / render timeline (video-production.audio)"], runtimeWired: true,
    runtimeNote: "Retrieved when music is fitted to the video length; guidance sets crossfade and fade-out. Measured beats still choose the boundaries.",
    kinds: [...TEXTUAL, "AUDIO", "VIDEO", "AUDIO_VIDEO_PAIR"],
  },
  {
    id: "AUDIO_ANALYSIS", label: "Music analysis and editing", target: "AUDIO_AI", task: "AUDIO_PLAN", domain: "MUSIC",
    guidanceKeys: ["audio.loopCrossfadeSec", "audio.fadeOutSec"], runtimeConsumers: ["Audio fit / render timeline (video-production.audio)"], runtimeWired: true,
    runtimeNote: "Retrieved with audio planning. Measured BPM, beats and loudness are authoritative and are never replaced by teaching.",
    kinds: [...TEXTUAL, "AUDIO"],
  },
  {
    id: "PRODUCT_VIDEO_TYPOGRAPHY", label: "Text on product videos", target: "TYPOGRAPHY_AI", task: "TYPOGRAPHY_PLAN", domain: "TYPOGRAPHY",
    guidanceKeys: ["typography.maxItemsPerScene", "typography.maxItemsCtaScene"], runtimeConsumers: ["Typography plan (video-production.typography)"], runtimeWired: true,
    runtimeNote: "Retrieved when the typography plan is composed; guidance limits text density per scene.",
    kinds: [...TEXTUAL, "IMAGE", "BEFORE_AFTER"],
  },
  {
    id: "PRODUCT_COPY", label: "Product advertising copy", target: "COPYWRITING_AI", task: "COPYWRITING", domain: "COPYWRITING",
    guidanceKeys: [], runtimeConsumers: ["Creative Plan copy (creative-planning.copy)"], runtimeWired: true,
    runtimeNote: "Retrieved as reference context for Creative Plan copy.",
    kinds: TEXTUAL,
  },
  {
    id: "PRODUCT_UNDERSTANDING", label: "Product understanding", target: "PRODUCT_INTELLIGENCE_AI", task: "PRODUCT_SLIDESHOW", domain: "PRODUCT_CREATIVE",
    guidanceKeys: [], runtimeConsumers: [CREATIVE_PLAN, SCENE_PLAN], runtimeWired: true,
    runtimeNote: "Product-creative knowledge is retrieved with product video planning.",
    kinds: [...TEXTUAL, "IMAGE"],
  },
  {
    id: "GRAPHIC_DESIGN", label: "Graphic design", target: "DESIGN_AI", task: "PRODUCT_SLIDESHOW", domain: "GRAPHIC_DESIGN",
    guidanceKeys: [], runtimeConsumers: [CREATIVE_PLAN, SCENE_PLAN, "Typography plan (video-production.typography)"], runtimeWired: true,
    runtimeNote: "Graphic design knowledge is retrieved by product video and typography planning.",
    kinds: [...TEXTUAL, "IMAGE", "BEFORE_AFTER"],
  },
  {
    id: "CREATIVE_PLANNING", label: "Creative direction", target: "CREATIVE_DIRECTOR_AI", task: "PRODUCT_SLIDESHOW", domain: "STORYTELLING",
    guidanceKeys: [], runtimeConsumers: [CREATIVE_PLAN, "Creative director learned patterns (STYLE teaching)"], runtimeWired: true,
    runtimeNote: "Retrieved with Creative Plans; STYLE teaching also becomes abstract creative patterns read by the creative director.",
    kinds: [...TEXTUAL, "IMAGE", "VIDEO"],
  },
  {
    id: "IMAGE_UNDERSTANDING", label: "Image understanding", target: "IMAGE_AI", task: "IMAGE_UNDERSTANDING", domain: "PHOTOGRAPHY",
    guidanceKeys: [], runtimeConsumers: [], runtimeWired: false,
    runtimeNote: "Stored and searchable. No production image pipeline retrieves the IMAGE_UNDERSTANDING task yet.",
    kinds: [...TEXTUAL, "IMAGE", "BEFORE_AFTER"],
  },
  {
    id: "GENERAL_TEXT", label: "General writing", target: "TEXT_AI", task: "GENERAL", domain: "GENERAL",
    guidanceKeys: [], runtimeConsumers: [], runtimeWired: false,
    runtimeNote: "Stored and searchable. No production text feature retrieves the GENERAL task yet.",
    kinds: TEXTUAL,
  },
  {
    id: "PROGRAMMING_ASSISTANCE", label: "Programming assistance", target: "CODE_AI", task: "CODE_ASSIST", domain: "PROGRAMMING",
    guidanceKeys: [], runtimeConsumers: ["CODE_ASSIST knowledge retrieval"], runtimeWired: false,
    runtimeNote: "Indexed for CODE_ASSIST retrieval (verifiable with a runtime test). The studio has no customer-facing coding assistant yet. Uploaded code is never executed.",
    kinds: [...TEXTUAL, "CODE"],
  },
];

export function capabilityById(id: string | null | undefined): CapabilityDefinition | null {
  return CAPABILITIES.find((c) => c.id === id) ?? null;
}

export function clampGuidance(key: string, value: unknown): { value: number; clamped: boolean } | null {
  const spec = TEACHABLE_GUIDANCE[key];
  const n = typeof value === "number" ? value : Number(value);
  if (!spec || !Number.isFinite(n)) return null;
  let bounded = Math.min(spec.max, Math.max(spec.min, n));
  if (spec.integer) bounded = Math.round(bounded);
  return { value: bounded, clamped: bounded !== n };
}

export function publicCatalog() {
  return {
    targets: TRAINING_TARGETS.map((id) => ({ id, label: TARGET_LABELS[id], capabilities: CAPABILITIES.filter((c) => c.target === id).map((c) => c.id) })),
    capabilities: CAPABILITIES.map((c) => ({
      id: c.id, label: c.label, target: c.target, task: c.task, domain: c.domain, kinds: c.kinds,
      guidance: c.guidanceKeys.map((k) => TEACHABLE_GUIDANCE[k]),
      runtimeConsumers: c.runtimeConsumers, runtimeWired: c.runtimeWired, runtimeNote: c.runtimeNote,
    })),
    modes: TEACHING_MODES.map((id) => ({ id, ...MODE_INFO[id], strategies: MODE_STRATEGY[id] })),
    strategies: Object.values(STRATEGIES),
    scopes: (Object.keys(SCOPE_INFO) as TrainingScope[]).map((id) => ({ id, ...SCOPE_INFO[id] })),
    recordKinds: RECORD_KINDS,
    modelTraining: { available: false, reason: NO_TRAINING_INFRA },
  };
}
