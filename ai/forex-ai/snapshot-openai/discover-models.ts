/**
 * Phase 44A — Discover eligible chat models + probe GPT-6 candidates.
 */
import { OPENAI_GPT6_CANDIDATE_IDS, filterEligibleOpenAiModels } from "./model-policy.js";
import { getOpenAiModel, listOpenAiModels, type OpenAiListedModel } from "./openai-client.js";

export interface DiscoveredOpenAiModelRow extends OpenAiListedModel {
  eligible: true;
  source: "list" | "probe";
  gpt6Family: boolean;
}

export async function discoverEligibleOpenAiModels(input: {
  apiKey: string;
  timeoutMs?: number;
  probeCandidates?: readonly string[];
}): Promise<{
  ok: boolean;
  code: string;
  latencyMs: number;
  models: DiscoveredOpenAiModelRow[];
  probed: Array<{ id: string; found: boolean; code: string }>;
  listedCount: number;
  error?: string;
}> {
  const listed = await listOpenAiModels({
    apiKey: input.apiKey,
    timeoutMs: input.timeoutMs,
  });
  if (!listed.ok) {
    return {
      ok: false,
      code: listed.code,
      latencyMs: listed.latencyMs,
      models: [],
      probed: [],
      listedCount: 0,
      error: listed.error,
    };
  }

  const byId = new Map<string, OpenAiListedModel & { source: "list" | "probe" }>();
  for (const m of listed.models) {
    byId.set(m.id, { ...m, source: "list" });
  }

  const candidates = input.probeCandidates ?? OPENAI_GPT6_CANDIDATE_IDS;
  const probed: Array<{ id: string; found: boolean; code: string }> = [];
  let probeLatency = 0;

  for (const id of candidates) {
    if (byId.has(id)) {
      probed.push({ id, found: true, code: "ALREADY_LISTED" });
      continue;
    }
    const lookup = await getOpenAiModel({
      apiKey: input.apiKey,
      modelId: id,
      timeoutMs: 8_000,
    });
    probeLatency += lookup.latencyMs;
    if (lookup.ok && lookup.model) {
      byId.set(lookup.model.id, { ...lookup.model, source: "probe" });
      probed.push({ id, found: true, code: "OK" });
    } else {
      probed.push({ id, found: false, code: lookup.code });
    }
  }

  const eligible = filterEligibleOpenAiModels([...byId.values()]).map((m) => ({
    ...m,
    source: (byId.get(m.id)?.source ?? "list") as "list" | "probe",
    gpt6Family: m.id.toLowerCase().startsWith("gpt-6"),
  }));

  return {
    ok: true,
    code: "OK",
    latencyMs: listed.latencyMs + probeLatency,
    models: eligible,
    probed,
    listedCount: listed.models.length,
  };
}
