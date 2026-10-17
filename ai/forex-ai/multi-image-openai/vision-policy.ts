/**
 * Phase 49B — Which configured OpenAI chat models may receive image inputs.
 * Text-only models must not silently strip images.
 */
import { isOpenAiChatEligibleModel } from "../snapshot-openai/model-policy.js";

/** Families documented / expected to accept image_url content parts in Chat Completions. */
const VISION_PREFIXES = [
  "gpt-4o",
  "gpt-4.1",
  "gpt-4-turbo",
  "gpt-4-vision",
  "gpt-5",
  "gpt-6",
  "o4",
] as const;

/** Explicit text-only / unsafe-for-vision families among chat-eligible IDs. */
const VISION_EXCLUDE = [
  "gpt-3.5",
  "o1",
  "o3-mini",
] as const;

export function isOpenAiVisionEligibleModel(modelId: string): boolean {
  const id = String(modelId ?? "").trim().toLowerCase();
  if (!id || !isOpenAiChatEligibleModel(id)) return false;
  if (VISION_EXCLUDE.some((p) => id === p || id.startsWith(p))) return false;
  return VISION_PREFIXES.some((p) => id === p || id.startsWith(p));
}

export function visionCapabilityNote(modelId: string): string {
  if (isOpenAiVisionEligibleModel(modelId)) {
    return `Model ${modelId} is treated as vision-capable for multi-image chart analysis.`;
  }
  return (
    `Configured model "${modelId || "(none)"}" is not eligible for image inputs. `
    + "Select a vision-capable chat model (e.g. gpt-4o / gpt-4.1 / gpt-5 / gpt-6 family) in Forex Admin OpenAI settings."
  );
}
