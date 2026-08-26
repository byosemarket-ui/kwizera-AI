/** Intent detection for EN + Kinyarwanda — never guess destructive actions. */

import type { AssistantIntent, AssistantLanguage } from "./types";
import type { FeedbackCategory } from "../creative-review/types";

export function detectLanguage(text: string): AssistantLanguage {
  const t = text.toLowerCase();
  if (/\b(reba|ni iki|hindura|gabanya|shyira|ntabwo|ndashaka|yikore|igeze|igaragara|masegonda|scene|video|cta)\b/i.test(t)
    || /[àáâãäåèéêëìíîïòóôõöùúûü]/i.test(text)) {
    // Rough heuristic: common Kinyarwanda tokens in the mission examples
    if (/\b(reba|ntabwo|ndashaka|hindura|gabanya|shyira|yikore|igeze|igaragara|neza|iki|ihe)\b/i.test(t)) return "rw";
  }
  return "en";
}

export function detectIntent(text: string): { intent: AssistantIntent; confidence: number; needsClarify: boolean } {
  const t = text.toLowerCase().trim();

  if (!t) return { intent: "HELP", confidence: 1, needsClarify: false };

  // Ambiguous "make it better"
  if (/^(make it better|improve it|hindura byose|kora neza)$/i.test(t) || /make it better|improve (this|it|everything)/i.test(t) && !/scene|cta|music|product|text|audio/i.test(t)) {
    return { intent: "CLARIFY", confidence: 0.9, needsClarify: true };
  }

  if (/delete|overwrite|replace final|reject version|cancel production|remove asset/i.test(t)
    || /siba|kuraho|funga production/i.test(t)) {
    return { intent: "REJECT", confidence: 0.7, needsClarify: false };
  }

  if (/approve|emeza|yemeza/i.test(t)) return { intent: "APPROVE", confidence: 0.85, needsClarify: false };

  if (/prepare (a )?fix|prepare change|create (a )?new version|v1\.\d|version ya/i.test(t)
    || /tegur(a|ira).*fix|kora version/i.test(t)) {
    return { intent: "PREPARE_CHANGE", confidence: 0.85, needsClarify: false };
  }

  if (/make .+ (bigger|larger|shorter|louder|quieter)|reduce music|gabanya music|shyira product|cta .+|hindura scene|change scene|product .+middle|product hagati/i.test(t)) {
    return { intent: "REQUEST_CHANGE", confidence: 0.8, needsClarify: false };
  }

  if (/record|feedback|comment|ntabwo igaragara|issue|ikibazo/i.test(t) && /scene|cta|product|audio|text/i.test(t)) {
    return { intent: "CREATE_FEEDBACK", confidence: 0.8, needsClarify: false };
  }

  if (/qc|quality control|why .+ fail|inanirwa|yaratsinze|failed check/i.test(t)) {
    return { intent: "QC_QUERY", confidence: 0.9, needsClarify: false };
  }

  if (/production igeze|how far|progress|eta|gpu|cpu|ram|rendering|stage/i.test(t)) {
    return { intent: "PRODUCTION_QUERY", confidence: 0.85, needsClarify: false };
  }

  if (/current version|what version|explain version|iyi version/i.test(t)) {
    return { intent: "VERSION_REQUEST", confidence: 0.85, needsClarify: false };
  }

  if (/resolution|output|file size|duration|format|thumbnail|package/i.test(t)) {
    return { intent: "OUTPUT_QUERY", confidence: 0.8, needsClarify: false };
  }

  if (/open scene|show qc|show (the )?final|version history|navigate|fungura|jya kuri/i.test(t)) {
    return { intent: "NAVIGATE", confidence: 0.8, needsClarify: false };
  }

  if (/suggest|recommend|ni iki wahindura|ni iki nakosora|what should i improve|improvement|nkora iki ubu|what (should|can) i do|status|summary/i.test(t)) {
    if (/nkora iki ubu|what (should|can) i do|status|summary|igeze he/i.test(t)) {
      return { intent: "PRODUCTION_QUERY", confidence: 0.8, needsClarify: false };
    }
    return { intent: "SUGGEST", confidence: 0.85, needsClarify: false };
  }

  if (/creative profile|buryo dukoresha|ubu buryo|ni ubuhe buryo/i.test(t)) {
    return { intent: "EXPLAIN", confidence: 0.85, needsClarify: false };
  }

  if (/review (this |the )?(video|scene)|find problem|ni iki kitagenda|reba iyi/i.test(t)) {
    return { intent: "REVIEW", confidence: 0.85, needsClarify: false };
  }

  if (/explain|what is|describe|sobanura|ni iki/i.test(t)) {
    return { intent: "EXPLAIN", confidence: 0.75, needsClarify: false };
  }

  if (/help|commands|what can you|ufasha/i.test(t)) {
    return { intent: "HELP", confidence: 0.9, needsClarify: false };
  }

  if (/\?$/.test(t) || /^(why|how|what|where|when|who|ni)/i.test(t)) {
    return { intent: "QUESTION", confidence: 0.6, needsClarify: false };
  }

  return { intent: "GENERAL", confidence: 0.4, needsClarify: false };
}

export function extractSceneId(text: string, scenes: Array<{ id: string; number: number; name: string }>): string | null {
  const m = text.match(/scene\s*(\d+)/i) || text.match(/\b(\d+)\b/);
  if (m) {
    const num = Number(m[1]);
    const hit = scenes.find((s) => s.number === num);
    if (hit) return hit.id;
  }
  const byName = scenes.find((s) => text.toLowerCase().includes(s.name.toLowerCase()));
  return byName?.id ?? null;
}

export function extractTimestampSec(text: string): number | null {
  const mmss = text.match(/(\d{1,2}):(\d{2})/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const sec = text.match(/(?:masegonda|second|sec|at)\s*(\d+)/i) || text.match(/ku masegonda\s*(\d+)/i);
  if (sec) return Number(sec[1]);
  return null;
}

export function inferFeedbackCategory(text: string): FeedbackCategory {
  const t = text.toLowerCase();
  if (/product|visibility|igaragara|product hagati/i.test(t)) return "PRODUCT_VISIBILITY";
  if (/cta/i.test(t)) return "CTA";
  if (/music|gabanya|audio|voice|sfx/i.test(t)) return "AUDIO";
  if (/text|readable|subtitle/i.test(t)) return "TEXT_READABILITY";
  if (/timing|shorter|longer|duration|masegonda/i.test(t)) return "TIMING";
  if (/visual|color|lighting|background/i.test(t)) return "VISUAL";
  return "OTHER";
}

export function bumpVersionLabel(current: string): string {
  const m = current.match(/^v?(\d+)\.(\d+)/i);
  if (!m) return "v1.1";
  return `v${m[1]}.${Number(m[2]) + 1}`;
}
