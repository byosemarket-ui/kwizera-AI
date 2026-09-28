/**
 * Phase 20 — online-first, task-aware research for teaching sessions.
 * Pages come only from an approved registry whose hosts are in the trusted knowledge-source library; retrieval goes
 * through the hardened teaching fetcher (private-network block, DNS pinning, robots.txt, per-host rate limit). Pages
 * are chosen for the task (target, capability, media, focus, measured knowledge gaps), never crawled. Downloaded text
 * is data: only short grounded statements are extracted, never whole pages, and instruction-like text is dropped.
 */
import type { CapabilityAvailability, MediaCapabilityEntry, OnlinePreflight, SourceKind } from "./training-types.js";
import type { TrainingTarget } from "./training-catalog.js";

export type ResearchTopic =
  | "VIDEO_TRANSITIONS" | "VIDEO_ENCODING" | "PLATFORM_FORMAT" | "COMPOSITION" | "TYPOGRAPHY_READABILITY" | "TEXT_CONTRAST"
  | "CAPTIONS" | "AUDIO_TEMPO" | "AUDIO_DELIVERY";

export interface ResearchRegistryEntry {
  id: string;
  /** Id of the TRUSTED_SOURCE_LIBRARY entry whose host this page belongs to. */
  libraryId: string;
  publisher: string;
  title: string;
  url: string;
  topics: ResearchTopic[];
  media: Array<"VIDEO" | "AUDIO" | "IMAGE" | "TEXT">;
  license: string;
  /** Re-retrieve after this many days; older knowledge is flagged for freshness review. */
  freshnessDays: number;
}

export const RESEARCH_REGISTRY: ResearchRegistryEntry[] = [
  {
    id: "youtube-upload-encoding", libraryId: "google-merchant-center-docs", publisher: "Google (YouTube Help)", title: "YouTube recommended upload encoding settings",
    url: "https://support.google.com/youtube/answer/1722171", topics: ["VIDEO_ENCODING", "PLATFORM_FORMAT", "AUDIO_DELIVERY"], media: ["VIDEO", "AUDIO"],
    license: "Google Help Center terms — facts only, no page copies", freshnessDays: 90,
  },
  {
    id: "youtube-aspect-ratios", libraryId: "google-merchant-center-docs", publisher: "Google (YouTube Help)", title: "YouTube video resolution and aspect ratios",
    url: "https://support.google.com/youtube/answer/6375112", topics: ["PLATFORM_FORMAT", "COMPOSITION"], media: ["VIDEO", "IMAGE"],
    license: "Google Help Center terms — facts only, no page copies", freshnessDays: 90,
  },
  {
    id: "nngroup-legibility", libraryId: "nngroup-ux", publisher: "Nielsen Norman Group", title: "Legibility, Readability, and Comprehension",
    url: "https://www.nngroup.com/articles/legibility-readability-comprehension/", topics: ["TYPOGRAPHY_READABILITY", "TEXT_CONTRAST"], media: ["IMAGE", "VIDEO", "TEXT"],
    license: "NN/g article — short grounded statements only", freshnessDays: 365,
  },
  {
    id: "w3c-contrast-minimum", libraryId: "w3c-wai", publisher: "W3C WAI", title: "Understanding WCAG 2.2 — Contrast (Minimum)",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html", topics: ["TEXT_CONTRAST", "TYPOGRAPHY_READABILITY"], media: ["IMAGE", "VIDEO"],
    license: "W3C Document License", freshnessDays: 365,
  },
  {
    id: "w3c-three-flashes", libraryId: "w3c-wai", publisher: "W3C WAI", title: "Understanding WCAG 2.2 — Three Flashes or Below Threshold",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html", topics: ["VIDEO_TRANSITIONS"], media: ["VIDEO"],
    license: "W3C Document License", freshnessDays: 365,
  },
  {
    id: "w3c-captions", libraryId: "w3c-wai", publisher: "W3C WAI", title: "Captions/Subtitles — Making Audio and Video Media Accessible",
    url: "https://www.w3.org/WAI/media/av/captions/", topics: ["CAPTIONS", "TYPOGRAPHY_READABILITY"], media: ["VIDEO", "AUDIO"],
    license: "W3C Document License", freshnessDays: 365,
  },
  {
    id: "ableton-tempo-warping", libraryId: "ableton-live-manual", publisher: "Ableton", title: "Ableton Live Manual — Audio Clips, Tempo, and Warping",
    url: "https://www.ableton.com/en/manual/audio-clips-tempo-and-warping/", topics: ["AUDIO_TEMPO"], media: ["AUDIO", "VIDEO"],
    license: "Ableton manual — short grounded statements only", freshnessDays: 365,
  },
];

export interface ResearchTask {
  target: TrainingTarget;
  capability: string;
  mediaKinds: SourceKind[];
  focus: string[];
  /** Capability matrices of the analysed sources; LOW_CONFIDENCE / UNAVAILABLE / FAILED entries are knowledge gaps. */
  gaps: MediaCapabilityEntry[];
  textRegionsSeen: boolean;
}

const TOPIC_KEYWORDS: Record<ResearchTopic, RegExp> = {
  VIDEO_TRANSITIONS: /transition|cut|dissolve|fade|flash|edit/i,
  VIDEO_ENCODING: /encod|codec|bitrate|frame ?rate|export|render/i,
  PLATFORM_FORMAT: /aspect|vertical|youtube|tiktok|reel|platform|resolution|format/i,
  COMPOSITION: /composition|framing|layout|crop|safe/i,
  TYPOGRAPHY_READABILITY: /typograph|text|font|legib|readab|headline|caption/i,
  TEXT_CONTRAST: /contrast|colou?r|legib/i,
  CAPTIONS: /caption|subtitle|speech|transcri/i,
  AUDIO_TEMPO: /tempo|bpm|beat|rhythm|sync|music/i,
  AUDIO_DELIVERY: /loud|audio|sound|mix|master/i,
};

/** Ranks approved pages for the task; returns at most `maxPages`, each with the reason it was chosen. */
export function planResearch(task: ResearchTask, maxPages = 3): Array<{ entry: ResearchRegistryEntry; reason: string; score: number }> {
  const weights = new Map<ResearchTopic, { w: number; why: Set<string> }>();
  const add = (t: ResearchTopic, w: number, why: string) => {
    const cur = weights.get(t) ?? { w: 0, why: new Set<string>() };
    cur.w += w;
    cur.why.add(why);
    weights.set(t, cur);
  };
  const media = new Set(task.mediaKinds);
  if (media.has("VIDEO")) {
    add("VIDEO_TRANSITIONS", 2, "video transitions were analysed");
    add("PLATFORM_FORMAT", 2, "video format and aspect ratio");
    add("VIDEO_ENCODING", 1, "video delivery");
  }
  if (media.has("AUDIO") || media.has("VIDEO")) add("AUDIO_TEMPO", media.has("AUDIO") ? 2 : 1, "music timing");
  if (media.has("IMAGE")) {
    add("COMPOSITION", 2, "image composition");
    add("TEXT_CONTRAST", 1, "image text contrast");
  }
  if (task.textRegionsSeen) {
    add("TYPOGRAPHY_READABILITY", 2, "on-screen text was located");
    add("TEXT_CONTRAST", 2, "on-screen text was located");
  }
  const cap = `${task.capability} ${task.target}`;
  for (const [topic, re] of Object.entries(TOPIC_KEYWORDS) as Array<[ResearchTopic, RegExp]>) {
    if (re.test(cap)) add(topic, 2, `capability ${task.capability}`);
    if (task.focus.some((f) => re.test(f))) add(topic, 3, "requested focus");
  }
  for (const g of task.gaps) {
    if (g.status === "EXECUTED" || g.status === "NO_RESULT") continue;
    const gap = `${g.capability.toLowerCase().replace(/_/g, " ")} ${g.status.toLowerCase().replace(/_/g, " ")}`;
    if (g.capability === "TEMPO" || g.capability === "BEATS") add("AUDIO_TEMPO", 2, `gap: ${gap}`);
    if (g.capability === "TEXT_READING" || g.capability === "VISION") add("TYPOGRAPHY_READABILITY", 1, `gap: ${gap}`);
    if (g.capability === "TRANSCRIPTION" || g.capability === "SPEECH") add("CAPTIONS", 1, `gap: ${gap}`);
  }
  return RESEARCH_REGISTRY
    .map((entry) => {
      const hits = entry.topics.filter((t) => weights.has(t));
      const mediaMatch = entry.media.some((m) => media.has(m as SourceKind)) ? 1 : 0;
      const score = hits.reduce((a, t) => a + weights.get(t)!.w, 0) + mediaMatch;
      const why = [...new Set(hits.flatMap((t) => [...weights.get(t)!.why]))].slice(0, 4);
      return { entry, score, reason: `${hits.map((t) => t.toLowerCase().replace(/_/g, " ")).join(", ")} — ${why.join("; ")}` };
    })
    .filter((p) => p.score > 1)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, Math.max(0, maxPages));
}

export interface PreflightInput {
  requested: boolean;
  retrievalConfigured: boolean;
  urlPolicy?: (url: string) => { ok: boolean };
  capabilities: CapabilityAvailability[];
  dailyUsed: number;
  dailyLimit: number;
  /** Reachability probe through the hardened fetcher (only called when research was requested). */
  probe?: () => Promise<{ ok: boolean; detail: string }>;
  now: string;
}

export async function onlinePreflight(input: PreflightInput): Promise<OnlinePreflight> {
  const checks: OnlinePreflight["checks"] = [];
  checks.push({ check: "RETRIEVAL_CONFIGURED", ok: input.retrievalConfigured, detail: input.retrievalConfigured ? "Hardened fetcher with private-network block, DNS pinning, robots.txt and per-host rate limit." : "Online retrieval is disabled on this server (KWIZERA_KNOWLEDGE_ONLINE_RETRIEVAL=0 or no fetcher)." });
  const allowed = input.urlPolicy ? RESEARCH_REGISTRY.filter((e) => input.urlPolicy!(e.url).ok).length : 0;
  checks.push({ check: "APPROVED_SOURCES", ok: allowed > 0, detail: `${allowed} of ${RESEARCH_REGISTRY.length} registry page(s) pass the teaching allowlist.` });
  checks.push({ check: "RATE_LIMIT", ok: input.dailyUsed < input.dailyLimit, detail: `${input.dailyUsed} of ${input.dailyLimit} research page(s) used today; hosts are fetched at most once per interval.` });
  checks.push({ check: "CREDENTIALS", ok: true, detail: "Approved sources are public documentation; no credentials are used or exposed." });
  const reasoning = input.capabilities.find((c) => c.capability === "REASONING");
  checks.push({ check: "REASONING_ROUTE", ok: reasoning ? reasoning.executable : null, detail: reasoning ? (reasoning.executable ? "AI-assisted grounded extraction is executable through CapabilityRuntime." : "Rule-based extraction only (CapabilityRuntime reasoning route not executable).") : "Capability runtime not reported." });
  let reachable: boolean | null = null;
  if (!input.requested) checks.push({ check: "REACHABILITY", ok: null, detail: "Not tested: online research was not requested for this session." });
  else if (input.retrievalConfigured && input.probe) {
    const r = await input.probe().catch(() => ({ ok: false, detail: "The reachability probe failed." }));
    reachable = r.ok;
    checks.push({ check: "REACHABILITY", ok: r.ok, detail: r.detail });
  } else checks.push({ check: "REACHABILITY", ok: false, detail: "No fetcher to test with." });
  const available = input.retrievalConfigured && allowed > 0 && input.dailyUsed < input.dailyLimit && (!input.requested || reachable === true);
  return { state: available ? "ONLINE_RESEARCH_AVAILABLE" : "ONLINE_RESEARCH_UNAVAILABLE", requested: input.requested, checkedAt: input.now, checks };
}

/** Text that tries to instruct the reader (prompt injection) is never learned from. */
const INJECTION = /\b(ignore|disregard|forget)\b.{0,40}\b(previous|prior|above|all)\b.{0,40}\b(instructions?|prompts?|rules)\b|\bsystem prompt\b|\byou are now\b|\bact as (an?|the)\b|\b(reveal|print|output)\b.{0,30}\b(api key|password|token|secret)s?\b|<\s*\/?\s*(system|assistant)\s*>/i;

export function isInstructionLike(text: string): boolean {
  return INJECTION.test(text);
}
