/**
 * Phase 18C — lightweight language identification for teaching text (function-word frequency). It only labels
 * the language; the original text is always kept. "und" (undetermined) is returned when the evidence is weak.
 */

const WORDS: Record<string, { name: string; words: string[] }> = {
  en: { name: "English", words: "the and of to in is that for it with as on be are this by or from an at not your you should always never keep use".split(" ") },
  fr: { name: "French", words: "le la les et des du de un une est que pour dans sur pas avec ce cette qui au aux vous toujours jamais il elle".split(" ") },
  es: { name: "Spanish", words: "el la los las y de del que en un una es para por con no se su al lo como siempre nunca".split(" ") },
  pt: { name: "Portuguese", words: "o a os as e de do da que em um uma para com não se por no na ao sempre nunca você".split(" ") },
  de: { name: "German", words: "der die das und ist nicht mit den dem ein eine zu von für auf im sie es immer nie".split(" ") },
  it: { name: "Italian", words: "il lo la gli le e di che un una per con non del della sono sempre mai".split(" ") },
  nl: { name: "Dutch", words: "de het een en van is dat niet op te met voor zijn altijd nooit".split(" ") },
  sw: { name: "Swahili", words: "na ya wa kwa ni za katika la kwamba hii kila huu hiyo sana pia bidhaa".split(" ") },
  rw: { name: "Kinyarwanda", words: "na mu ku ni kandi ko iki uyu aba ibi cyane buri ntabwo kugira ngo bya bwa".split(" ") },
};

export interface LanguageGuess { code: string; name: string; confidence: number }

export function detectLanguage(text: string): LanguageGuess {
  const tokens = String(text ?? "").toLowerCase().normalize("NFKC").match(/\p{L}+/gu) ?? [];
  if (tokens.length < 4) return { code: "und", name: "Undetermined", confidence: 0 };
  const scores = Object.entries(WORDS).map(([code, { name, words }]) => {
    const set = new Set(words);
    return { code, name, hits: tokens.filter((t) => set.has(t)).length };
  }).sort((a, b) => b.hits - a.hits);
  const best = scores[0]!;
  const second = scores[1]!;
  const ratio = best.hits / tokens.length;
  if (best.hits < 2 || ratio < 0.08) return { code: "und", name: "Undetermined", confidence: 0 };
  const margin = (best.hits - second.hits) / Math.max(1, best.hits);
  const confidence = Number(Math.min(0.95, 0.4 + ratio * 1.5 + margin * 0.3).toFixed(2));
  if (margin < 0.2) return { code: "und", name: "Undetermined", confidence: Number((confidence / 2).toFixed(2)) };
  return { code: best.code, name: best.name, confidence };
}
