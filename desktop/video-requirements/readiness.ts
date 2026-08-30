import type {
  CommercialFields,
  DurationOption,
  ReadinessResult,
  VideoRequirementsSnapshot,
} from "./types.js";
import { durationToSeconds } from "./platform-map.js";

export function calculateDiscount(
  previousPrice: number | null,
  currentPrice: number | null,
): { valid: boolean; percent: number | null; label: string | null } {
  if (
    previousPrice == null
    || currentPrice == null
    || !Number.isFinite(previousPrice)
    || !Number.isFinite(currentPrice)
    || previousPrice <= currentPrice
  ) {
    return { valid: false, percent: null, label: null };
  }
  const percent = Math.round(((previousPrice - currentPrice) / previousPrice) * 100);
  return { valid: true, percent, label: `Save ${percent}%` };
}

export function computeReadiness(
  snap: Pick<
    VideoRequirementsSnapshot,
    "projectId" | "product" | "commercial" | "platformId" | "duration" | "customDurationSeconds" | "objective" | "language"
  >,
): ReadinessResult {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (!snap.projectId) blockingIssues.push("Open or create a project first.");
  if (!snap.product?.productId) blockingIssues.push("Canonical product is missing. Complete Product Setup first.");
  if ((snap.product?.imageCount ?? 0) < 1) blockingIssues.push("At least one original product image is required.");
  if (!snap.commercial.productName.trim()) blockingIssues.push("Product name is required to continue.");
  if (!snap.platformId) blockingIssues.push("Select a video destination platform.");
  if (!snap.objective) blockingIssues.push("Select a campaign objective.");
  if (!snap.language.trim()) blockingIssues.push("Select a video language.");

  const seconds = durationToSeconds(snap.duration, snap.customDurationSeconds);
  if (seconds < 5 || seconds > 120) blockingIssues.push("Video duration must be between 5 and 120 seconds.");
  if (snap.duration === "custom" && (!snap.customDurationSeconds || snap.customDurationSeconds <= 0)) {
    blockingIssues.push("Enter a custom duration in seconds.");
  }

  if (snap.commercial.previousPrice != null && snap.commercial.currentPrice != null
    && snap.commercial.previousPrice <= snap.commercial.currentPrice) {
    warnings.push("Previous price must be higher than current price to show a discount.");
  }

  if (snap.commercial.currentPrice === null) {
    warnings.push("Price is optional — add it if you want pricing in the video.");
  }

  const ready = blockingIssues.length === 0;
  return {
    ready,
    blockingIssues,
    warnings,
    statusLabel: ready
      ? warnings.length ? "READY WITH RECOMMENDATIONS" : "READY TO CONTINUE"
      : "NOT READY",
  };
}

export function formatSellingPointLabel(
  text: string,
  source: string,
  confidence: number,
): string {
  const src = source === "USER_CONFIRMED" || source === "CONFIRMED"
    ? "Confirmed"
    : source === "AI_INFERRED" || source === "INFERRED"
      ? `AI inference · ${Math.round(confidence * 100)}% confidence`
      : source.replace(/_/g, " ");
  return `${text}\n${src}`;
}

export function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function durationLabel(duration: DurationOption, custom: number | null): string {
  if (duration === "custom" && custom) return `${custom} sec`;
  return duration.replace("s", " sec");
}
