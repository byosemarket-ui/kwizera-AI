import type { FontPersonality, TextRole, VerifiedFont } from "./types.js";
import { fontSupportsText, pickFallbackFont } from "./font-registry.js";

const ROLE_HIERARCHY: Record<TextRole, number> = {
  hook: 1,
  title: 1,
  headline: 1,
  productName: 2,
  cta: 2,
  price: 2,
  discount: 2,
  promotion: 2,
  benefit: 3,
  productFeature: 3,
  previousPrice: 3,
  subtitle: 4,
  sceneCaption: 4,
  supporting: 4,
  brand: 4,
  closingMessage: 2,
};

export function roleHierarchy(role: TextRole): number {
  return ROLE_HIERARCHY[role] ?? 4;
}

export function personalityForContext(input: {
  category?: string;
  goal?: string;
  tone?: string;
  role: TextRole;
}): FontPersonality {
  const blob = `${input.category ?? ""} ${input.goal ?? ""} ${input.tone ?? ""}`.toLowerCase();
  if (input.role === "price" || input.role === "discount" || input.role === "promotion" || input.role === "cta") {
    return "promotional";
  }
  if (/luxur|premium|jewel|watch|perfume/.test(blob)) return "luxury-serif";
  if (/fashion|apparel|clothing|style/.test(blob)) return "fashion";
  if (/beauty|cosmetic|skincare/.test(blob)) return "premium";
  if (/tech|phone|gadget|electronic|software/.test(blob)) return "tech";
  if (/food|restaurant|snack|coffee/.test(blob)) return "humanist-sans";
  if (/child|kid|toy|play/.test(blob)) return "playful";
  if (/cinema|film|dramatic/.test(blob) || /cinematic/i.test(input.tone ?? "")) return "cinematic";
  return "clean-sans";
}

export function selectFontForRole(
  fonts: VerifiedFont[],
  role: TextRole,
  text: string,
  personality: FontPersonality,
): VerifiedFont {
  const fallback = pickFallbackFont(fonts);
  if (!fonts.length) {
    throw new Error("No verified fonts available");
  }
  const supporting = fonts.filter((font) => fontSupportsText(font, text));
  const pool = supporting.length ? supporting : fonts;
  const byPersonality = pool.find((font) => font.personalities.includes(personality) && font.roles.includes(role))
    ?? pool.find((font) => font.personalities.includes(personality))
    ?? pool.find((font) => font.roles.includes(role) && font.category === (personality.includes("serif") ? "serif" : "sans"))
    ?? (personality.includes("serif") ? pool.find((font) => font.category === "serif") : undefined)
    ?? (personality === "playful" ? pool.find((font) => font.category === "script") : undefined)
    ?? fallback
    ?? pool[0]!;
  return byPersonality;
}
