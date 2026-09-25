/**
 * Product Marketing Video — customer view model.
 * Maps detailed PMV / workflow state onto five customer steps and a small customer-safe status set.
 * Pure functions only: no network, no engine access.
 */
import type { CustomerWorkflowSummary } from "../../../../ai/pmv-orchestrator/views";
import type { PmvGenerationMode } from "../../../../ai/pmv-shared/modes.js";

export type PmvCustomerStep = "product" | "style" | "create" | "preview" | "final";

export const PMV_CUSTOMER_STEPS: Array<{ id: PmvCustomerStep; label: string }> = [
  { id: "product", label: "Product" },
  { id: "style", label: "Style" },
  { id: "create", label: "Create" },
  { id: "preview", label: "Preview" },
  { id: "final", label: "Final" },
];

export type PmvCustomerStatus = "READY" | "CREATING" | "PROCESSING" | "REVIEW" | "COMPLETED" | "FAILED";

export type PmvVideoStyleId = "slideshow" | "showcase3d" | "cinematic";

export interface PmvVideoStyleOption {
  id: PmvVideoStyleId;
  title: string;
  description: string;
  generationMode: PmvGenerationMode | null;
  availability: "available" | "unavailable" | "coming_soon";
}

/** Minimal slice of the PMV snapshot the customer UI reasons about. */
export interface PmvViewInput {
  productName: string;
  savedPhotoCount: number;
  uploadingPhotoCount: number;
  generationMode: PmvGenerationMode;
  cinematicAvailable: boolean | null;
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

export function videoStyleOptions(cinematicAvailable: boolean | null): PmvVideoStyleOption[] {
  return [
    {
      id: "slideshow",
      title: "Product Slideshow",
      description: "Turn your product photos into a polished promotional video with transitions, text and music.",
      generationMode: "EXACT_PRODUCT",
      availability: "available",
    },
    {
      id: "showcase3d",
      title: "3D Product Showcase",
      description: "Create a product-focused 3D/360-style presentation when the required 3D capability is available.",
      generationMode: null,
      availability: "coming_soon",
    },
    {
      id: "cinematic",
      title: "Cinematic AI Advertisement",
      description: "Create cinematic product scenes using AI video generation when the required online capability is available.",
      generationMode: "CINEMATIC",
      availability: cinematicAvailable ? "available" : "unavailable",
    },
  ];
}

export function selectedStyleId(mode: PmvGenerationMode): PmvVideoStyleId | null {
  if (mode === "EXACT_PRODUCT") return "slideshow";
  if (mode === "CINEMATIC") return "cinematic";
  return null;
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

export function validateStyle(input: Pick<PmvViewInput, "generationMode" | "cinematicAvailable">): string | null {
  const id = selectedStyleId(input.generationMode);
  if (!id) return "Please choose a video style.";
  const option = videoStyleOptions(input.cinematicAvailable).find((o) => o.id === id);
  if (!option || option.availability !== "available") return "One of the selected video styles is not available yet.";
  return null;
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

export const DURATION_OPTIONS = [15, 30, 45, 60] as const;

export const FORMAT_OPTIONS = [
  { value: "9:16", label: "9:16 Vertical" },
  { value: "1:1", label: "1:1 Square" },
  { value: "16:9", label: "16:9 Landscape" },
] as const;

export const CTA_SUGGESTIONS = ["Buy Now", "Shop Now", "Order on WhatsApp", "Call Now", "Learn More"] as const;

export const CURRENCY_OPTIONS = ["RWF", "USD", "EUR", "GBP", "KES", "UGX", "TZS"] as const;

/** "9:16" style label from rendered dimensions, falling back to the requested format. */
export function formatLabel(width: number | null, height: number | null, fallback: string): string {
  if (!width || !height) return fallback;
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.05) return "1:1";
  return ratio < 1 ? "9:16" : "16:9";
}

export function durationLabel(durationMs: number | null, fallbackSeconds: number): string {
  const seconds = durationMs != null && durationMs > 0 ? Math.round(durationMs / 1000) : fallbackSeconds;
  return `${seconds} sec`;
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
