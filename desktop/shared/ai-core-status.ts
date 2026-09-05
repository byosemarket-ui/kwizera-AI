/** Compact AI Core / Ollama / Knowledge / Skills status for production UIs. */

export type AiCoreStatusLabel = "READY" | "DEGRADED" | "FALLBACK";
export type OllamaUiStatus = "READY" | "UNAVAILABLE" | "MODEL_MISSING" | "ERROR" | "DISABLED";

export interface AiCoreStatusSnapshot {
  aiCore: AiCoreStatusLabel;
  ollama: OllamaUiStatus;
  model: string | null;
  videoKnowledge: { ready: boolean; version: string; count: number };
  videoSkills: { ready: boolean; version: string; count: number };
  creativeDirector: "READY" | "FALLBACK";
  creativeAdvisor: { version: string };
  note: string;
  latencyMs: number | null;
}

function mapOllamaCode(code: string | undefined, ready: boolean): OllamaUiStatus {
  if (code === "OLLAMA_DISABLED") return "DISABLED";
  if (code === "OLLAMA_MODEL_MISSING") return "MODEL_MISSING";
  if (code === "OLLAMA_READY" && ready) return "READY";
  if (code === "OLLAMA_UNAVAILABLE") return "UNAVAILABLE";
  return "ERROR";
}

export async function fetchAiCoreStatus(): Promise<AiCoreStatusSnapshot> {
  const res = await fetch("/api/creative-director/status");
  const body = await res.json() as {
    status?: {
      ollamaReady?: boolean;
      ollamaNote?: string;
      ollamaAdapter?: { code?: string; ready?: boolean; model?: string | null; latencyMs?: number | null };
      videoKnowledge?: { ready?: boolean; version?: string; count?: number };
      videoSkills?: { ready?: boolean; version?: string; count?: number };
      creativeAdvisor?: { version?: string };
      creativeDirector?: { available?: boolean; mode?: string; modelId?: string | null };
    };
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? `AI status failed (${res.status})`);
  }
  const s = body.status ?? {};
  const adapter = s.ollamaAdapter ?? {};
  const ollama = mapOllamaCode(adapter.code, Boolean(adapter.ready ?? s.ollamaReady));
  const cdMode = s.creativeDirector?.mode === "ai" && s.creativeDirector?.available
    ? "READY" as const
    : "FALLBACK" as const;
  let aiCore: AiCoreStatusLabel = "FALLBACK";
  if (ollama === "READY" && cdMode === "READY") aiCore = "READY";
  else if (ollama === "READY" || cdMode === "READY") aiCore = "DEGRADED";

  return {
    aiCore,
    ollama,
    model: adapter.model ?? s.creativeDirector?.modelId ?? null,
    videoKnowledge: {
      ready: s.videoKnowledge?.ready !== false,
      version: s.videoKnowledge?.version ?? "—",
      count: s.videoKnowledge?.count ?? 0,
    },
    videoSkills: {
      ready: s.videoSkills?.ready !== false,
      version: s.videoSkills?.version ?? "—",
      count: s.videoSkills?.count ?? 0,
    },
    creativeDirector: cdMode,
    creativeAdvisor: { version: s.creativeAdvisor?.version ?? "—" },
    note: s.ollamaNote ?? "",
    latencyMs: adapter.latencyMs ?? null,
  };
}
