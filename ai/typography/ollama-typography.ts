/**
 * Optional typography personality assist via the existing Ollama client.
 * Never talks to FFmpeg. Invalid output is ignored.
 */
import {
  fetchOllamaTags,
  isOllamaDisabled,
  ollamaBaseUrl,
  ollamaGenerateJson,
  parseJsonObject,
  preferredReasoningModelId,
  selectPreferredReasoningModel,
} from "../ai-provider/ollama-client.js";
import type { FontPersonality, PlacementRegion, TextRole } from "./types.js";
import { isFontPersonality, PLACEMENT_REGIONS } from "./types.js";

export interface TypographyAiHint {
  personality?: FontPersonality;
  region?: PlacementRegion;
  emphasis?: string;
}

export async function suggestTypographyHints(input: {
  category?: string;
  role: TextRole;
  purpose?: string;
}): Promise<TypographyAiHint | null> {
  if (isOllamaDisabled()) return null;
  const tags = await fetchOllamaTags({ baseUrl: ollamaBaseUrl() });
  if (!tags.ok) return null;
  const model = selectPreferredReasoningModel(tags.models, preferredReasoningModelId());
  if (!model) return null;
  const generated = await ollamaGenerateJson({
    model,
    prompt: [
      "Return JSON only.",
      '{"personality":"clean-sans|tech|luxury-serif|fashion|promotional|playful","region":"top-center|bottom-center|upper-center","emphasis":"short"}',
      `category:${input.category ?? "general"} role:${input.role} purpose:${input.purpose ?? ""}`,
    ].join("\n"),
    timeoutMs: 12_000,
    options: { num_ctx: 512, num_predict: 80, temperature: 0.1 },
  });
  if (!generated.ok) return null;
  const parsed = parseJsonObject(generated.text);
  if (!parsed) return null;
  const personality = typeof parsed.personality === "string" && isFontPersonality(parsed.personality)
    ? parsed.personality
    : undefined;
  const region = typeof parsed.region === "string" && PLACEMENT_REGIONS.includes(parsed.region as PlacementRegion)
    ? parsed.region as PlacementRegion
    : undefined;
  return { personality, region, emphasis: typeof parsed.emphasis === "string" ? parsed.emphasis : undefined };
}
