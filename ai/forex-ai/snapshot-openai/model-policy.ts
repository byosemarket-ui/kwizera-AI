/**
 * OpenAI model eligibility for Forex snapshot analysis (Phase 43F / 44A).
 * Discovery lists account models; only chat-compatible IDs are selectable.
 */

/** Prefixes known or expected to support chat.completions + JSON object responses. */
export const OPENAI_CHAT_MODEL_PREFIXES = [
  "gpt-6",
  "gpt-5",
  "gpt-4o",
  "gpt-4.1",
  "gpt-4-turbo",
  "gpt-4-",
  "gpt-3.5-turbo",
  "o1",
  "o3",
  "o4",
] as const;

/**
 * Candidate GPT-6 IDs to probe during discovery when absent from the account list.
 * Probing does not claim access — only confirmed responses are merged.
 */
export const OPENAI_GPT6_CANDIDATE_IDS = [
  "gpt-6-astra",
  "gpt-6.1-sol",
  "gpt-6-luna",
] as const;

const EXCLUDE_SUBSTRINGS = [
  "embedding",
  "whisper",
  "tts",
  "dall-e",
  "davinci",
  "babbage",
  "moderation",
  "realtime",
  "transcribe",
  "audio",
  "search",
  "image",
];

export function isOpenAiChatEligibleModel(modelId: string): boolean {
  const id = String(modelId ?? "").trim().toLowerCase();
  if (!id || id.length < 3 || id.length > 64) return false;
  if (EXCLUDE_SUBSTRINGS.some((s) => id.includes(s))) return false;
  return OPENAI_CHAT_MODEL_PREFIXES.some((prefix) => id === prefix || id.startsWith(prefix));
}

export function isOpenAiGpt6FamilyModel(modelId: string): boolean {
  const id = String(modelId ?? "").trim().toLowerCase();
  return id.startsWith("gpt-6");
}

export function filterEligibleOpenAiModels(
  models: Array<{ id: string; created?: number | null; ownedBy?: string | null }>,
): Array<{
  id: string;
  created: number | null;
  ownedBy: string | null;
  eligible: true;
  source?: "list" | "probe";
}> {
  const seen = new Set<string>();
  const out: Array<{
    id: string;
    created: number | null;
    ownedBy: string | null;
    eligible: true;
    source?: "list" | "probe";
  }> = [];
  for (const m of models) {
    const id = String(m.id ?? "").trim();
    if (!id || seen.has(id) || !isOpenAiChatEligibleModel(id)) continue;
    seen.add(id);
    out.push({
      id,
      created: typeof m.created === "number" ? m.created : null,
      ownedBy: m.ownedBy == null ? null : String(m.ownedBy),
      eligible: true,
      source: (m as { source?: "list" | "probe" }).source,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
