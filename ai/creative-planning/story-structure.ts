export type StoryBeatId =
  | "HOOK"
  | "PRODUCT_REVEAL"
  | "FEATURE"
  | "DETAIL"
  | "EXPLORATION"
  | "MESSAGE"
  | "PRICE"
  | "CTA";

export interface StoryBeatPlan {
  id: StoryBeatId;
  purpose: string;
  durationMs: number;
}

function platformKey(platform: string): string {
  return platform.trim().toLowerCase();
}

export function parseDurationMs(value: string | undefined, fallbackMs = 15_000): number {
  if (!value) return fallbackMs;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)s$/i);
  if (match) return Math.max(4_000, Math.round(Number(match[1]) * 1000));
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber > 180 ? Math.round(asNumber) : Math.round(asNumber * 1000);
  }
  if (/short/i.test(value)) return 15_000;
  if (/medium/i.test(value)) return 30_000;
  if (/long/i.test(value)) return 60_000;
  return fallbackMs;
}

export function planStoryBeats(input: {
  durationMs: number;
  platform: string;
  uniqueViewCount: number;
  hasPrice: boolean;
  hasPromotion: boolean;
}): StoryBeatId[] {
  const ms = input.durationMs;
  const tiktok = /tiktok/.test(platformKey(input.platform));
  const youtube = /youtube/.test(platformKey(input.platform));
  const facebook = /facebook/.test(platformKey(input.platform));
  const views = input.uniqueViewCount;

  if (ms <= 8_000) return ["HOOK", "PRODUCT_REVEAL", "CTA"];
  if (ms <= 16_000 && views < 2) return ["HOOK", "PRODUCT_REVEAL", "CTA"];

  const beats: StoryBeatId[] = ["HOOK", "PRODUCT_REVEAL"];
  if (ms >= 12_000 && (views >= 2 || ms >= 20_000)) beats.push("FEATURE");
  if (views >= 3 && ms >= 12_000) beats.push("DETAIL");
  if (views >= 4 && ms >= 24_000) beats.push("EXPLORATION");
  if ((youtube || facebook || ms >= 28_000) && ms >= 20_000) beats.push("MESSAGE");
  if (input.hasPrice && ms >= 18_000) beats.push("PRICE");
  else if (input.hasPromotion && ms >= 18_000) beats.push("PRICE");
  if (tiktok && beats.includes("MESSAGE") && ms < 25_000) {
    beats.splice(beats.indexOf("MESSAGE"), 1);
  }
  beats.push("CTA");
  return beats;
}

export function allocateDurations(totalMs: number, beats: StoryBeatId[], platform: string): number[] {
  const count = Math.max(1, beats.length);
  const tiktok = /tiktok/.test(platformKey(platform));
  const instagram = /instagram/.test(platformKey(platform));
  const weights = beats.map((beat, index) => {
    if (beat === "HOOK") return tiktok || instagram ? 0.7 : 1;
    if (beat === "CTA") return 1.15;
    if (beat === "PRODUCT_REVEAL") return 1.2;
    if (beat === "DETAIL") return 0.9;
    if (index === 0) return tiktok ? 0.7 : 1;
    return 1;
  });
  const sum = weights.reduce((total, item) => total + item, 0);
  const raw = weights.map((weight) => Math.round((weight / sum) * totalMs));
  const min = tiktok || instagram ? 1_200 : 1_500;
  const next = raw.map((value) => Math.max(min, value));
  let drift = next.reduce((total, item) => total + item, 0) - totalMs;
  for (let i = next.length - 1; i >= 0 && drift !== 0; i -= 1) {
    const adjustable = next[i]! - min;
    if (drift > 0 && adjustable > 0) {
      const take = Math.min(adjustable, drift);
      next[i]! -= take;
      drift -= take;
    } else if (drift < 0) {
      next[i]! += -drift;
      drift = 0;
    }
  }
  return next;
}

export function beatPurpose(beat: StoryBeatId): string {
  switch (beat) {
    case "HOOK": return "HOOK";
    case "PRODUCT_REVEAL": return "PRODUCT_REVEAL";
    case "FEATURE": return "FEATURE";
    case "DETAIL": return "DETAIL_SCENE";
    case "EXPLORATION": return "VISUAL_EXPLORATION";
    case "MESSAGE": return "KEY_MESSAGE";
    case "PRICE": return "PRICE_OR_OFFER";
    case "CTA": return "CTA";
  }
}

export function purposeToBeat(purpose: string): StoryBeatId {
  switch (purpose) {
    case "HOOK": return "HOOK";
    case "PRODUCT_REVEAL": return "PRODUCT_REVEAL";
    case "FEATURE": return "FEATURE";
    case "DETAIL":
    case "DETAIL_SCENE": return "DETAIL";
    case "EXPLORATION":
    case "VISUAL_EXPLORATION": return "EXPLORATION";
    case "MESSAGE":
    case "KEY_MESSAGE": return "MESSAGE";
    case "PRICE":
    case "PRICE_OR_OFFER": return "PRICE";
    case "CTA": return "CTA";
    default: return "FEATURE";
  }
}
