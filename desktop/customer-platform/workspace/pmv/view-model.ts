/**
 * Product Marketing Video — customer view model.
 * Maps detailed PMV / workflow state onto five customer steps and a small customer-safe status set.
 * Pure functions only: no network, no engine access.
 */
import type { CustomerWorkflowSummary } from "../../../../ai/pmv-orchestrator/views";
import { PMV_VIDEO_MODES, PMV_VIDEO_MODE_COPY, isPmvVideoMode, type PmvVideoMode } from "../../../../ai/pmv-shared/modes.js";
import type { PmvModeAvailability } from "../../../../ai/pmv-shared/video-mode-resolver.js";
import {
  formatDuration,
  resolvePmvDestination,
  validateDuration,
  type PmvPlatform,
} from "../../../../ai/pmv-shared/destination.js";

export type PmvCustomerStep = "product" | "style" | "create" | "preview" | "final";

export const PMV_CUSTOMER_STEPS: Array<{ id: PmvCustomerStep; label: string }> = [
  { id: "product", label: "Product" },
  { id: "style", label: "Style" },
  { id: "create", label: "Create" },
  { id: "preview", label: "Preview" },
  { id: "final", label: "Final" },
];

export type PmvCustomerStatus = "READY" | "CREATING" | "PROCESSING" | "REVIEW" | "COMPLETED" | "FAILED";

export type PmvVideoStyleAvailability = "available" | "unavailable" | "coming_soon" | "checking";

export interface PmvVideoStyleOption {
  id: PmvVideoMode;
  title: string;
  description: string;
  availability: PmvVideoStyleAvailability;
  /** Customer-safe badge text for a card that cannot be chosen. */
  note: string | null;
}

/** Minimal slice of the PMV snapshot the customer UI reasons about. */
export interface PmvViewInput {
  productName: string;
  savedPhotoCount: number;
  uploadingPhotoCount: number;
  videoMode: PmvVideoMode;
  /** Backend-decided availability; null while it is being checked. */
  videoModes: PmvModeAvailability[] | null;
  platform: PmvPlatform | null;
  aspectRatio: string;
  durationSeconds: number;
  finalOutputUrl: string | null;
  deliveryStatus: string;
  produceStatus: string;
}

const FINAL_READY_STATUSES = new Set(["DELIVERED"]);

export function isVideoDelivered(input: Pick<PmvViewInput, "finalOutputUrl" | "deliveryStatus" | "produceStatus">): boolean {
  return Boolean(input.finalOutputUrl)
    && (input.deliveryStatus === "DELIVERED" || FINAL_READY_STATUSES.has(input.produceStatus));
}

export function customerStatus(workflow: CustomerWorkflowSummary | null, input: PmvViewInput): PmvCustomerStatus {
  if (workflow) {
    if (workflow.status === "QUEUED") return "CREATING";
    if (workflow.status === "RUNNING") return "PROCESSING";
    if (workflow.status === "WAITING_FOR_USER") return "REVIEW";
    if (workflow.status === "FAILED") return "FAILED";
  }
  if (isVideoDelivered(input)) return "COMPLETED";
  return "READY";
}

const AVAILABILITY: Record<PmvModeAvailability["availability"], PmvVideoStyleAvailability> = {
  READY: "available",
  UNAVAILABLE: "unavailable",
  COMING_SOON: "coming_soon",
};

/** Mode cards in canonical order; availability comes only from the backend. */
export function videoStyleOptions(videoModes: PmvModeAvailability[] | null): PmvVideoStyleOption[] {
  return PMV_VIDEO_MODES.map((mode) => {
    const server = videoModes?.find((m) => m.mode === mode);
    return {
      id: mode,
      title: PMV_VIDEO_MODE_COPY[mode].label,
      description: PMV_VIDEO_MODE_COPY[mode].description,
      availability: server ? AVAILABILITY[server.availability] : "checking",
      note: server ? server.note : "Checking…",
    };
  });
}

export function validateProduct(input: Pick<PmvViewInput, "productName" | "savedPhotoCount" | "uploadingPhotoCount">): string | null {
  if (!input.productName.trim()) return "Please enter a product name.";
  if (input.savedPhotoCount < 1) {
    return input.uploadingPhotoCount > 0
      ? "Please wait for your photos to finish uploading."
      : "Please add at least one product photo.";
  }
  if (input.uploadingPhotoCount > 0) return "Please wait for your photos to finish uploading.";
  return null;
}

export function validateStyle(
  input: Pick<PmvViewInput, "videoMode" | "videoModes" | "platform" | "aspectRatio" | "durationSeconds">,
): string | null {
  if (!isPmvVideoMode(input.videoMode)) return "Please choose a video style.";
  const option = videoStyleOptions(input.videoModes).find((o) => o.id === input.videoMode)!;
  if (option.availability === "checking") return "Checking which video styles are available…";
  if (option.availability === "coming_soon") return `${option.title} is coming soon. Choose another video style.`;
  if (option.availability !== "available") return `${option.title} is not available yet. Choose another video style.`;
  const destination = resolvePmvDestination(input.platform, input.aspectRatio);
  return validateDuration(input.durationSeconds, destination, input.videoMode);
}

export function validateForCreate(input: PmvViewInput): string | null {
  return validateProduct(input) ?? validateStyle(input);
}

/** Steps the customer can open right now. Product and Style are always editable. */
export function reachableSteps(workflow: CustomerWorkflowSummary | null, input: PmvViewInput): Set<PmvCustomerStep> {
  const steps = new Set<PmvCustomerStep>(["product", "style"]);
  if (!validateProduct(input) || workflow) steps.add("create");
  if (input.finalOutputUrl) steps.add("preview");
  if (isVideoDelivered(input)) steps.add("final");
  return steps;
}

/** Where to land when a project opens. */
export function initialStep(workflow: CustomerWorkflowSummary | null, input: PmvViewInput): PmvCustomerStep {
  const status = customerStatus(workflow, input);
  if (status === "CREATING" || status === "PROCESSING" || status === "REVIEW" || status === "FAILED") return "create";
  if (status === "COMPLETED") return "final";
  if (input.finalOutputUrl) return "preview";
  return "product";
}

export const STYLE_PRESETS = [
  { id: "professional", label: "Professional", goal: "product_showcase", energy: "balanced", tone: "Premium" },
  { id: "modern", label: "Modern", goal: "brand_awareness", energy: "balanced", tone: "Modern" },
  { id: "minimal", label: "Minimal", goal: "product_showcase", energy: "calm", tone: "Minimal" },
  { id: "energetic", label: "Energetic", goal: "drive_orders", energy: "energetic", tone: "Energetic" },
] as const;

export type StylePresetId = typeof STYLE_PRESETS[number]["id"];

export function stylePresetFromTone(tone: string): StylePresetId {
  return STYLE_PRESETS.find((p) => p.tone === tone)?.id ?? "professional";
}

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "rw", label: "Kinyarwanda" },
  { value: "fr", label: "French" },
  { value: "sw", label: "Swahili" },
] as const;

export const CTA_SUGGESTIONS = ["Buy Now", "Shop Now", "Order on WhatsApp", "Call Now", "Learn More"] as const;

export const CURRENCY_OPTIONS = ["RWF", "USD", "EUR", "GBP", "KES", "UGX", "TZS"] as const;

/** "9:16" style label from rendered dimensions, falling back to the requested format. */
export function formatLabel(width: number | null, height: number | null, fallback: string): string {
  if (!width || !height) return fallback;
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.05) return "1:1";
  if (Math.abs(ratio - 0.8) < 0.05) return "4:5";
  return ratio < 1 ? "9:16" : "16:9";
}

export function durationLabel(durationMs: number | null, fallbackSeconds: number): string {
  const seconds = durationMs != null && durationMs > 0 ? Math.round(durationMs / 1000) : fallbackSeconds;
  return seconds < 60 ? `${seconds} sec` : formatDuration(seconds);
}

export function formatPrice(price: number | null, currency: string): string | null {
  if (price == null || !Number.isFinite(price)) return null;
  return `${price.toLocaleString("en-US")} ${currency || "RWF"}`.trim();
}

export function workflowErrorMessage(workflow: CustomerWorkflowSummary | null): string | null {
  if (!workflow) return null;
  if (workflow.status === "FAILED") return workflow.message || "Your video could not be completed. Please try again.";
  if (workflow.status === "WAITING_FOR_USER") return workflow.message || "Your video needs your input to continue.";
  return null;
}
